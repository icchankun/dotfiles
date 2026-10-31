import { View } from "gpui-kit";
import { props } from "herdr";
import { Graph } from "./graph.js";
import { DiffView } from "./diff.js";

// One mod, two roles: the graph (a panel or a pane), and a file's diff in a window over it (props.role).
export default class GitGraph extends View {
  init(_props, cx) {
    const role = props()?.role;
    this.part = role === "diff" ? new DiffView() : new Graph();
    this.part.init(cx);
  }

  render(cx) { return this.part.render(cx); }
}
