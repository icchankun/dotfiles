import { spawn, spawnSync } from "node:child_process";
import { mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const STATUS_LABEL = { done: "完了", blocked: "入力待ち" };
const STATUS_EMOJI = { done: "✅", blocked: "⚠️" };
// A name from /System/Library/Sounds, or a path to any audio file.
const STATUS_SOUND = { done: "Tink", blocked: "Pop" };
// Notification Center plays sounds at the system alert volume, which is relative
// to the output volume. Playing the file ourselves keeps the level fixed.
const SOUND_VOLUME = "1";
// How long the notification exists, not how long its banner is on screen: when
// this elapses alerter closes the notification and it leaves Notification Center
// with it. How briefly the banner shows is the notification style macOS keeps per
// sending app — Terminal, since no --sender is passed — so leave this long enough
// that a finished pane can still be found later.
const TIMEOUT_SECONDS = "3600";

const GHOST_ICON = fileURLToPath(new URL("assets/ghost.png", import.meta.url));

// 通知をクリックしたときに前面へ出すアプリ。使っている端末はGhosttyだけなので、
// 候補を並べて走っているものを選ぶことはしない。
const TERMINAL_APP = "Ghostty";

const herdrBin = process.env.HERDR_BIN_PATH ?? "herdr";
const alerterBin = "alerter";

main();

function main() {
  const [flag, payload] = process.argv.slice(2);

  if (flag === "--wait") {
    deliver(JSON.parse(Buffer.from(payload, "base64").toString("utf8")));
    return;
  }

  const notification = flag === "--test" ? testNotification() : notificationFromEvent();
  if (!notification) {
    return;
  }

  // Without alerter there is no clickable notification, but the pane details are
  // the point of this plugin, so still deliver them. Running in the parent puts
  // the warning where `herdr plugin log` can show it.
  if (!alerterAvailable()) {
    console.error(
      `${alerterBin} not found: falling back to a plain osascript notification. ` +
        "Install it for click-to-focus: brew install vjeantet/tap/alerter",
    );
    playSound(notification.sound);
    notifyWithOsascript(notification);
    return;
  }

  // alerter blocks until the notification is clicked or dismissed, so the wait
  // goes to a detached child and herdr's event command returns at once.
  const child = spawn(
    process.execPath,
    [fileURLToPath(import.meta.url), "--wait", Buffer.from(JSON.stringify(notification)).toString("base64")],
    { detached: true, stdio: ["ignore", "ignore", openLogFile()] },
  );
  child.unref();
}

function notificationFromEvent() {
  const event = readJsonEnv("HERDR_PLUGIN_EVENT_JSON");
  const status = String(event?.data?.agent_status ?? "").toLowerCase();
  const paneId = String(event?.data?.pane_id ?? "").trim();

  if (!paneId) {
    return undefined;
  }

  if (!mayNotify(paneId)) {
    return undefined;
  }

  const notifyAs = classify(paneId, status);
  if (!notifyAs) {
    return undefined;
  }

  return buildNotification(paneId, notifyAs, findPane(paneId), event?.data);
}

/**
 * In an orchestration every worker changes state constantly while only one agent
 * ever talks to the human, and Herdr has no per-agent notification setting. That
 * one agent is the driver, named `<pane id>-driver`, so the driver role is what
 * earns a notification and every other role stays silent. Pane labels are
 * rewritten by other plugins, which is why the name is the key.
 */
function mayNotify(paneId) {
  const agents = herdrJson(["agent", "list"])?.result?.agents ?? [];
  const name = String(agents.find((agent) => agent.pane_id === paneId)?.name ?? "").trim();
  return !name || isDriver(name) || name === paneIdName(paneId);
}

/** `wk-p3-driver` — the pane a human talks to. */
function isDriver(name) {
  return name.endsWith("-driver");
}

/**
 * Herdr's own auto-naming for a pane nothing has given a role to. Not a role, so
 * it keeps notifying.
 */
function paneIdName(paneId) {
  return paneId.toLowerCase().replaceAll(":", "-");
}

/**
 * Herdr only promotes a finished agent to `done` while its pane is out of sight;
 * a pane sharing the active tab just drops back to `idle`. Watching the
 * working -> idle transition catches those completions too, and the remembered
 * status keeps one completion from notifying twice.
 */
function classify(paneId, status) {
  const previous = readPaneState(paneId);
  const inferred = status === "idle" && previous?.status === "working";
  const finished = status === "done" || inferred;

  writePaneState(paneId, {
    status,
    finishNotified: status === "working" ? false : Boolean(previous?.finishNotified || finished),
  });

  if (status === "blocked") {
    return "blocked";
  }
  if (!finished || previous?.finishNotified) {
    return undefined;
  }

  // Escで止めたときもworking -> idleになり、ステータスだけでは完了と区別できない。
  // ただし中断でも完了でも、人がそのペインを見ているなら通知する意味はないので、
  // 推定した完了に限り「見ているか」で弾く。herdrがdoneに昇格させるのはペインが
  // 見えていないときだけなので、本物のdoneはここを通らない。
  return inferred && humanIsWatching(paneId) ? undefined : "done";
}

/**
 * そのペインが今まさに目の前にあるか。Herdr側のフォーカスだけだと、ペインを開いた
 * まま別アプリを見ている間の完了まで黙ってしまうため、端末が最前面かも合わせて見る。
 */
function humanIsWatching(paneId) {
  return listPanes().some((pane) => pane.pane_id === paneId && pane.focused) && terminalIsFrontmost();
}

/**
 * System Eventsのfrontmostは権限確認で数十秒返らないことがある。lsappinfoは
 * 権限が要らず即答するので、イベントごとに走るこの経路ではこちらを使う。
 */
function terminalIsFrontmost() {
  const asn = spawnSync("lsappinfo", ["front"], { encoding: "utf8" }).stdout?.trim();
  if (!asn) {
    return false;
  }
  const name = (spawnSync("lsappinfo", ["info", "-only", "name", asn], { encoding: "utf8" }).stdout ?? "")
    .toLowerCase();
  return name.includes(`"${TERMINAL_APP.toLowerCase()}"`);
}

function readPaneState(paneId) {
  try {
    return JSON.parse(readFileSync(paneStatePath(paneId), "utf8"));
  } catch {
    return undefined;
  }
}

function writePaneState(paneId, state) {
  try {
    mkdirSync(dirname(paneStatePath(paneId)), { recursive: true });
    writeFileSync(paneStatePath(paneId), JSON.stringify(state));
  } catch (error) {
    console.error(`failed to save pane state: ${error.message}`);
  }
}

/**
 * One file per pane. Herdr runs this plugin as a separate process per event, so
 * panes finishing at the same time would clobber each other's entry in a shared
 * file — and losing a `working` entry that way means a missed notification.
 */
function paneStatePath(paneId) {
  return join(stateDir(), "panes", `${sanitize(paneId)}.json`);
}

function stateDir() {
  return process.env.HERDR_PLUGIN_STATE_DIR ?? tmpdir();
}

function testNotification() {
  const panes = listPanes();
  const pane = panes.find((entry) => entry.focused) ?? panes[0];
  if (!pane) {
    console.error("no panes found");
    return undefined;
  }
  return buildNotification(pane.pane_id, "done", pane, {});
}

/**
 * リポジトリ: ブランチ / ペイン名 / 何がどうなったかの3行。サイドバーと同じ並びで、
 * 場所を絞り、その中のペインを見つけ、位置で確かめる。
 */
function buildNotification(paneId, status, pane, eventData) {
  const workspace = labelFor("workspace", pane?.workspace_id) ?? pane?.workspace_id ?? "workspace";
  // タブ名は herdr-tab-rename がブランチ名で付ける。1タブ1worktreeなので、
  // ワークスペースと合わせて「どのリポジトリのどのブランチか」がこの1行で読める
  const tab = labelFor("tab", pane?.tab_id);
  const paneName = firstNonEmpty([pane?.label, pane?.terminal_title_stripped, eventData?.title]);
  const agent = firstNonEmpty([eventData?.display_agent, eventData?.agent, pane?.agent]) ?? "Agent";
  const position = panePosition(paneId);

  return {
    paneId,
    title: `${STATUS_EMOJI[status]} ${workspace}${tab ? `: ${tab}` : ""}`,
    subtitle: paneName ?? "",
    message: `${titleCase(agent)} が${STATUS_LABEL[status]}${position ? `・${position}` : ""}`,
    group: `pane-status-notify-${sanitize(paneId)}`,
    sound: soundFor(status),
  };
}

/** "左のペイン", "右上のペイン" — how the pane is actually found on screen. */
function panePosition(paneId) {
  const layout = herdrJson(["pane", "layout", "--pane", paneId])?.result?.layout;
  const panes = layout?.panes ?? [];
  const target = panes.find((entry) => entry.pane_id === paneId);
  if (!target || panes.length < 2) {
    return undefined;
  }

  // A pane spanning the whole width is neither left nor right, and one spanning
  // the whole height is neither top nor bottom.
  const { rect } = target;
  const column = rect.width < layout.area.width
    ? axisLabels(panes.map((entry) => entry.rect.x), ["左", "中央", "右"], "列").get(rect.x)
    : undefined;
  const row = rect.height < layout.area.height
    ? axisLabels(panes.map((entry) => entry.rect.y), ["上", "中段", "下"], "段").get(rect.y)
    : undefined;
  const position = `${column ?? ""}${row ?? ""}`;

  return position ? `${position}のペイン` : `${panes.indexOf(target) + 1}番目のペイン`;
}

/**
 * Map each distinct coordinate on one axis to a label. Two tracks read as the
 * ends ("左"/"右"), three take the middle label too, and anything denser gets a
 * number because there is no natural word for it.
 */
function axisLabels(coordinates, [start, middle, end], unit) {
  const tracks = [...new Set(coordinates)].sort((a, b) => a - b);
  const labels = new Map();

  if (tracks.length < 2) {
    return labels;
  }
  if (tracks.length > 3) {
    tracks.forEach((coordinate, index) => labels.set(coordinate, `${index + 1}${unit}目`));
    return labels;
  }

  labels.set(tracks[0], start);
  labels.set(tracks[tracks.length - 1], end);
  if (tracks.length === 3) {
    labels.set(tracks[1], middle);
  }
  return labels;
}

function deliver(notification) {
  playSound(notification.sound);

  const result = spawnSync(
    alerterBin,
    [
      "--title", notification.title,
      ...(notification.subtitle ? ["--subtitle", notification.subtitle] : []),
      "--message", notification.message,
      "--group", notification.group,
      "--app-icon", GHOST_ICON,
      "--actions", "Focus",
      "--close-label", "Dismiss",
      "--timeout", TIMEOUT_SECONDS,
    ],
    { encoding: "utf8" },
  );

  // alerter existed when the parent checked, so this is a runtime failure such
  // as missing permissions. Report it, then still get the notification out.
  if (result.error || result.status !== 0) {
    console.error(`${alerterBin} failed: ${result.error?.message ?? `exit ${result.status}`}`);
    notifyWithOsascript(notification);
    return;
  }

  if (!["Focus", "@ACTIONCLICKED", "@CONTENTCLICKED"].includes(result.stdout?.trim())) {
    return;
  }

  spawnSync("open", ["-a", TERMINAL_APP]);
  spawnSync(herdrBin, ["agent", "focus", notification.paneId]);
}

function soundFor(status) {
  const sound = STATUS_SOUND[status];
  return sound.includes("/") ? sound : `/System/Library/Sounds/${sound}.aiff`;
}

function playSound(soundPath) {
  const player = spawn("afplay", ["-v", SOUND_VOLUME, soundPath], { detached: true, stdio: "ignore" });
  player.unref();
}

function alerterAvailable() {
  return !spawnSync(alerterBin, ["--version"]).error;
}

/** Fallback notification: no icon and no click action, but the details arrive. */
function notifyWithOsascript(notification) {
  const script =
    `display notification ${appleScriptString(notification.message)} ` +
    `with title ${appleScriptString(notification.title)} ` +
    `subtitle ${appleScriptString(notification.subtitle)}`;
  const result = spawnSync("osascript", ["-e", script], { encoding: "utf8" });
  if (result.error || result.status !== 0) {
    console.error(`osascript failed: ${result.error?.message ?? result.stderr?.trim()}`);
  }
}

function appleScriptString(value) {
  return `"${String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** Detached children have nowhere to report to, so give them a log file. */
function openLogFile() {
  try {
    return openSync(join(stateDir(), "notify.log"), "a");
  } catch {
    return "ignore";
  }
}

function listPanes() {
  return herdrJson(["pane", "list"])?.result?.panes ?? [];
}

function findPane(paneId) {
  return listPanes().find((pane) => pane.pane_id === paneId);
}

function labelFor(kind, id) {
  if (!id) {
    return undefined;
  }
  const entries = herdrJson([kind, "list"])?.result?.[`${kind}s`] ?? [];
  const label = String(entries.find((entry) => entry[`${kind}_id`] === id)?.label ?? "").trim();
  // Auto-numbered tabs carry a bare number as their label, which identifies nothing.
  return !label || /^\d+$/.test(label) ? undefined : label;
}

function herdrJson(args) {
  const result = spawnSync(herdrBin, args, { encoding: "utf8" });
  if (result.status !== 0) {
    return undefined;
  }
  try {
    return JSON.parse(result.stdout);
  } catch {
    return undefined;
  }
}

function readJsonEnv(name) {
  const raw = process.env[name];
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    console.error(`invalid ${name}: ${error.message}`);
    return undefined;
  }
}

function sanitize(paneId) {
  return paneId.replace(/[^A-Za-z0-9_-]/g, "-");
}

function firstNonEmpty(values) {
  return values.map((value) => String(value ?? "").trim()).find((value) => value.length > 0);
}

function titleCase(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
