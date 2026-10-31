// macOS notification when an agent finishes or needs you, clicking it shows that agent.
// Herdr itself only plays a sound and draws an in-window toast, which is missed while
// another app is in front. Draws nothing: it needs a block in the layout only to run.
import { View, div } from "gpui-kit";
import { agents, terminals, exec, run, appHome } from "herdr";

const LABEL = { done: "完了", blocked: "入力待ち" };
const EMOJI = { done: "✅", blocked: "⚠️" };
const SOUND = { done: "/System/Library/Sounds/Tink.aiff", blocked: "/System/Library/Sounds/Pop.aiff" };
// How long the notification stays in Notification Center, so a finished agent can still be found later.
const TIMEOUT_SECONDS = "3600";

export default class AgentNotify extends View {
  init(_props, cx) {
    this.last = new Map(agents().map(a => [a.address, a.status]));
  }

  // Only the agent a person talks to notifies. herdr-coding labels its reviewer
  // role=reviewer, and helpers an agent starts with `hc run` have a parent.
  quiet(address) {
    const t = terminals().find(x => x.address === address);
    return Boolean(t?.parent) || t?.labels?.role === "reviewer";
  }

  render(cx) {
    for (const a of agents()) {
      const before = this.last.get(a.address);
      this.last.set(a.address, a.status);
      if (before === a.status || !LABEL[a.status] || this.quiet(a.address)) continue;
      cx.spawn(async () => this.deliver(a));
    }
    return div();
  }

  async deliver(a) {
    const report = terminals().find(x => x.address === a.address)?.report;
    const where = a.tab_name && !/^\d+$/.test(a.tab_name) ? `${a.space_name}: ${a.tab_name}` : a.space_name;
    exec("afplay", ["-v", "1", SOUND[a.status]]);
    const r = await exec("alerter", [
      "--title", `${EMOJI[a.status]} ${where}`,
      "--subtitle", report?.msg || a.title || "",
      "--message", `${a.program?.name ?? "Agent"} が${LABEL[a.status]}`,
      "--group", `agent-notify-${a.address}`,
      "--app-icon", `${appHome()}/mods/agent-notify/ghost.png`,
      "--actions", "Focus", "--close-label", "Dismiss", "--timeout", TIMEOUT_SECONDS,
    ]);
    if (!["Focus", "@ACTIONCLICKED", "@CONTENTCLICKED"].includes(r.stdout.trim())) return;
    await exec("open", ["-a", "Herdr"]);
    run("agent.focus", { terminal: a.address });
  }
}
