// One file's diff in a commit, in a window over the app, the way VS Code's Git Graph opens
// a file of a commit in an editor tab. Opening another file replaces it (one key).
// The old and new file sit side by side, as GitHub's split view does.
import { div } from "gpui-kit";
import { v_flex, h_flex, Scrollbar, v_virtual_list } from "gpui-base";
import { exec, readTextFile, props, closeOverlay, theme, settings } from "herdr";
import { READ, diffArgs, splitRows } from "./git.js";

const ROW = 20;

export class DiffView {
  init(cx) {
    const { root, on, commit, file } = props();
    this.path = file.path; this.rows = null; this.note = null;
    this.listId = `graph-diff-${Math.random().toString(36).slice(2)}`;
    cx.spawn(async (cx) => {
      try {
        let text;
        if (commit.uncommitted && file.untracked) {
          const content = await readTextFile(`${root}/${file.path}`, { on }).catch(() => null);
          if (content === null || content.includes("\0")) this.note = "Binary or unreadable file";
          else text = `@@ -0,0 +1 @@\n${content.slice(0, 400000).split("\n").slice(0, 3000).map((l) => `+${l}`).join("\n")}`;
        } else {
          const r = await exec("git", [...READ, ...diffArgs(commit, file.path)], { cwd: root, on });
          if (r.code !== 0) throw new Error(r.stderr.trim());
          text = r.stdout;
        }
        if (text !== undefined) {
          this.rows = splitRows(text);
          if (!this.rows) this.note = file.binary ? "Binary file changed" : "No text changes";
        }
      } catch (e) { this.note = `Can't show this diff: ${e?.message ?? e}`; }
      cx.notify();
    });
  }

  // One half of a row; a missing side is drawn as an empty gray cell, as GitHub does.
  half(side, t) {
    if (!side) return div().flex_1().min_w(0).h_full().bg(t.raised);
    const bg = side.kind === "+" ? t.ansi2 + "18" : side.kind === "-" ? t.ansi1 + "18" : null;
    return h_flex().flex_1().min_w(0).h_full().gap(10).overflow_hidden().when(Boolean(bg), (e) => e.bg(bg))
      .child(div().w(40).flex_none().text_right().text_color(t.dim).child(String(side.number)))
      .child(div().flex_1().min_w(0).truncate().child(side.text));
  }

  row(row, t) {
    if (row.hunk !== undefined) return div().w_full().px(12).h(ROW).flex_none().truncate().bg(t.raised).text_color(t.dim).child(row.hunk);
    return h_flex().w_full().h(ROW).flex_none()
      .child(this.half(row.left, t)).child(div().w(1).h_full().flex_none().bg(t.border)).child(this.half(row.right, t));
  }

  render() {
    const t = theme(), mono = settings().font_family ?? "JetBrains Mono", rows = this.rows;
    return v_flex().size_full().min_h(0).bg(t.background).text_color(t.foreground).text_size(12.5)
      .child(h_flex().h(34).flex_none().px(12).gap(8).items_center().bg(t.chrome).border_b(1).border_color(t.border)
        .child(div().flex_1().min_w(0).truncate().font_family(mono).child(this.path))
        .child(div().id("graph-diff-close").px(6).rounded(4).text_color(t.dim).cursor_pointer().hover((s) => s.bg(t.hover).text_color(t.foreground))
          .on_mouse_down("left", (_e, cx) => cx.stop_propagation())
          .on_click(() => closeOverlay(props().overlay)).child("×")))
      .child(div().flex_1().min_h(0).relative().font_family(mono).text_size(12)
        .when(!rows, (e) => e.child(div().p(12).text_color(t.dim).child(this.note ?? "Loading diff…")))
        .when(Boolean(rows), (e) => e
          .child(v_virtual_list(this.listId, rows.length, ROW, (i) => String(i),
            (range) => rows.slice(range.start, range.end).map((r) => this.row(r, t))).size_full())
          .child(Scrollbar.vertical(this.listId).viewport_from_layout().absolute().inset_0())));
  }
}
