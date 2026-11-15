// Lays commits out on lanes. Commits come newest first, every child before its
// parents (git log --date-order). A lane is a column waiting for one commit and
// keeps its column until that commit arrives, so lines bend only where
// branches fork or merge. A commit marked `dashed` (uncommitted changes) draws
// its line to its parent dashed. A merge draws a line only to a parent that is in
// COMMITS: the history is read with --first-parent, so a merged pull request's own
// commits are not there, and a lane waiting for them would stay open to the bottom.
//
// Each row gets the commit's lane and its segments [fromLane, fromY, toLane,
// toY, colorLane, dashed], with y 0 = top of the row, 0.5 = the dot, 1 = bottom.
export function layoutLanes(commits) {
  const lanes = [], dashed = []; // lanes[i]: the hash that column waits for, or null
  const free = () => { const i = lanes.indexOf(null); return i < 0 ? lanes.length : i; };
  let width = 1;
  const known = new Set(commits.map((c) => c.hash));
  const rows = commits.map((commit) => {
    const before = lanes.slice(), wasDashed = dashed.slice(), segments = [];
    let lane = before.indexOf(commit.hash);
    if (lane < 0) { lane = free(); lanes[lane] = commit.hash; dashed[lane] = false; } // a branch tip: nothing above it
    before.forEach((hash, j) => {
      if (hash === null || hash === undefined) return;
      if (hash === commit.hash) {
        segments.push([j, 0, lane, 0.5, j, Boolean(wasDashed[j])]);
        if (j !== lane) { lanes[j] = null; dashed[j] = false; } // branches that end here
      } else segments.push([j, 0, j, 1, j, Boolean(wasDashed[j])]);
    });
    const [first, ...rest] = commit.parents;
    lanes[lane] = first ?? null;
    dashed[lane] = Boolean(first && commit.dashed);
    if (first) segments.push([lane, 0.5, lane, 1, lane, dashed[lane]]);
    for (const parent of rest) {
      if (!known.has(parent)) continue;
      let k = lanes.indexOf(parent);
      if (k < 0) { k = free(); lanes[k] = parent; dashed[k] = Boolean(commit.dashed); }
      segments.push([lane, 0.5, k, 1, k, dashed[k]]);
    }
    width = Math.max(width, before.length, lanes.length);
    while (lanes.length && lanes[lanes.length - 1] === null) { lanes.pop(); dashed.length = lanes.length; }
    return { lane, segments };
  });
  return { rows, width };
}
