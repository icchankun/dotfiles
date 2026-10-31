// Git for the graph, with no herdr imports so node can test it: reading the
// history, the labels on each row, and a commit's files and diffs. Commands are
// argv arrays, never a shell line. Trimmed to reading: agents run git.

// Reads write nothing under .git (no index refresh or lock, no fsmonitor
// cookie), so the folder watch never wakes for the panel's own reads.
// diff.external and core.hooksPath are also cleared, so a repository's own config runs nothing.
// Filter drivers set in a repository's own .git/config still run on status.
// A clone never copies .git/config, so this only bites a .git unpacked from an untrusted archive.
export const READ = ["--no-optional-locks", "-c", "core.fsmonitor=false", "-c", "diff.autoRefreshIndex=false",
  "-c", "diff.external=", "-c", "core.hooksPath=/dev/null"];
export const STATUS = ["status", "--porcelain=v1", "-z", "--no-renames", "--untracked-files=all"];
export const UNCOMMITTED = "*";
const FORMAT = "%x1e%H%x1f%P%x1f%an%x1f%ae%x1f%at%x1f%D%x1f%s";

// Every branch, remote ones included, as one history.
export function logArgs({ limit }) {
  return ["log", "--exclude=refs/stash", "--all", "--date-order", "--decorate=full", `-n${limit}`, `--format=${FORMAT}`];
}

export function parseRefs(text) {
  const refs = [];
  for (let name of text ? text.split(", ") : []) {
    const head = name.startsWith("HEAD -> ");
    if (head) name = name.slice(8);
    if (name === "HEAD") refs.push({ kind: "detached", name: "HEAD" });
    else if (name.startsWith("refs/heads/")) refs.push({ kind: "branch", name: name.slice(11), head });
    else if (name.startsWith("tag: refs/tags/")) refs.push({ kind: "tag", name: name.slice(15) });
    else if (name.startsWith("refs/remotes/") && !name.endsWith("/HEAD")) refs.push({ kind: "remote", name: name.slice(13) });
  }
  return refs;
}

export function parseLog(text) {
  return text.split("\x1e").filter((r) => r.trim()).map((record) => {
    const [hash, parents, author, email, time, refs, subject] = record.replace(/\n$/, "").split("\x1f");
    const parsed = parseRefs(refs);
    return { hash, parents: parents ? parents.split(" ") : [], author, email, time: Number(time), refs: parsed, subject,
      head: parsed.some((r) => r.head || r.kind === "detached") };
  });
}

// `git status --porcelain=v1 -z --no-renames`: one NUL-terminated "XY path" per file.
export function parseStatus(text) {
  return text.split("\0").filter(Boolean).map((entry) => {
    const xy = entry.slice(0, 2), path = entry.slice(3);
    // Letters as VS Code's Source Control shows them: U untracked, ! conflicted.
    const status = xy === "??" ? "U" : xy.includes("U") || xy === "AA" || xy === "DD" ? "!" : xy.includes("D") ? "D" : xy.includes("A") ? "A" : "M";
    return { path, status, untracked: xy === "??" };
  });
}

// The working tree's changes as the newest row, drawn dashed to HEAD.
export function withUncommitted(commits, changes, head) {
  if (!changes) return commits;
  return [{ hash: UNCOMMITTED, parents: head ? [head] : [], uncommitted: true, dashed: true, refs: [], head: false,
    subject: `Uncommitted changes (${changes})`, author: "", email: "", time: null }, ...commits];
}

// Labels are drawn at these exact widths (monospace text, fixed padding and icon).
export const LABEL = { CHAR: 6.6, PAD: 5, ICON: 13, GAP: 6, MAX: 22, FONT: 11 };
const fit = (s, n) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const partWidth = (part) => Math.ceil(LABEL.PAD * 2 + (part.icon ? LABEL.ICON : 0) + part.text.length * LABEL.CHAR) + 1;

export function labelsOf(commit) {
  const labels = [], remotes = commit.refs.filter((r) => r.kind === "remote"), paired = new Set();
  for (const ref of commit.refs) {
    if (ref.kind === "detached") labels.push({ kind: "head", head: true, parts: [{ kind: "head", name: "HEAD", text: "HEAD" }] });
    if (ref.kind !== "branch") continue;
    // A remote branch with the same name rides on its local branch's label, as in Git Graph.
    const parts = [{ kind: "branch", name: ref.name, text: fit(ref.name, LABEL.MAX), icon: true, head: ref.head }];
    for (const remote of remotes) {
      const slash = remote.name.indexOf("/");
      if (remote.name.slice(slash + 1) !== ref.name || paired.has(remote.name)) continue;
      paired.add(remote.name);
      parts.push({ kind: "remote", name: remote.name, text: fit(remote.name.slice(0, slash), 12) });
    }
    labels.push({ kind: "branch", head: ref.head, parts });
  }
  for (const remote of remotes) if (!paired.has(remote.name)) labels.push({ kind: "remote", parts: [{ kind: "remote", name: remote.name, text: fit(remote.name, LABEL.MAX), icon: true }] });
  for (const ref of commit.refs) if (ref.kind === "tag") labels.push({ kind: "tag", parts: [{ kind: "tag", name: ref.name, text: fit(ref.name, LABEL.MAX), icon: true }] });
  // What's checked out comes first.
  labels.sort((a, b) => Number(Boolean(b.head)) - Number(Boolean(a.head)));
  for (const label of labels) {
    for (const part of label.parts) part.width = partWidth(part);
    label.width = label.parts.reduce((n, p) => n + p.width, 2); // + a 1 px border each side
  }
  return labels;
}

// The files a commit changed against its first parent, joined from
// --name-status and --numstat (renames off, so the paths match).
export function fileArgs(commit) {
  const range = commit.parents.length ? [commit.parents[0], commit.hash] : null;
  const base = range ? ["diff", "--no-renames", "--no-ext-diff", "--no-textconv", ...range] : ["diff-tree", "--root", "--no-commit-id", "-r", "--no-renames", commit.hash];
  return { status: [...base, "--name-status"], numstat: [...base, "--numstat"] };
}

export function joinFiles(statusText, numstatText) {
  const stats = new Map();
  for (const line of numstatText.split("\n").filter(Boolean)) {
    const [a, d, ...path] = line.split("\t");
    stats.set(path.join("\t"), { add: Number(a) || 0, del: Number(d) || 0, binary: a === "-" });
  }
  return statusText.split("\n").filter(Boolean).map((line) => {
    const [s, ...path] = line.split("\t"), p = path.join("\t");
    return { path: p, status: s[0], ...(stats.get(p) ?? { add: 0, del: 0 }) };
  });
}

export function diffArgs(commit, path) {
  const opts = ["--no-color", "--no-ext-diff", "--no-textconv"];
  if (commit.uncommitted) return ["diff", ...opts, "HEAD", "--", path];
  if (!commit.parents.length) return ["show", ...opts, "--format=", commit.hash, "--", path];
  return ["diff", ...opts, commit.parents[0], commit.hash, "--", path];
}

// A diff side by side, as GitHub's split view: a run of removed lines is paired
// row by row with the added lines that follow it; context sits on both sides.
// Rows: { hunk } or { left, right }, each side { kind: "-" | "+" | " ", number, text } or null.
export function splitRows(text) {
  const all = text.replace(/\n$/, "").split("\n"), first = all.findIndex((l) => l.startsWith("@@"));
  if (first < 0) return null;
  const rows = [];
  let old = 0, next = 0, removed = [], added = [];
  const flush = () => {
    for (let i = 0; i < Math.max(removed.length, added.length); i++) rows.push({ left: removed[i] ?? null, right: added[i] ?? null });
    removed = []; added = [];
  };
  for (const raw of all.slice(first, first + 3000)) {
    const line = raw.length > 2000 ? raw.slice(0, 2000) + "…" : raw;
    const m = /^@@ -(\d+)(?:,\d+)? \+(\d+)/.exec(line);
    if (m) { flush(); old = +m[1]; next = +m[2]; rows.push({ hunk: line }); continue; }
    const kind = line[0], body = line.slice(1) || " ";
    if (kind === "-") removed.push({ kind, number: old++, text: body });
    else if (kind === "+") added.push({ kind, number: next++, text: body });
    else if (kind === " ") { flush(); rows.push({ left: { kind, number: old++, text: body }, right: { kind, number: next++, text: body } }); }
    else { flush(); rows.push({ hunk: line }); }
  }
  flush();
  return rows;
}

// `git diff --shortstat`: " 3 files changed, 10 insertions(+), 2 deletions(-)"; null when empty.
export function parseShortstat(text) {
  const n = (re) => +(re.exec(text)?.[1] ?? 0);
  const files = n(/(\d+) files? changed/);
  return files ? { files, add: n(/(\d+) insertions?/), del: n(/(\d+) deletions?/) } : null;
}
