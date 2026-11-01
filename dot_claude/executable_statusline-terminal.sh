#!/bin/bash
# statusline 用: Herdr.app の terminal の番地と役割（`t7 driver` など）を出力する
# 手で「t7 に送って」と頼むときの宛先になる。Herdr.app の外では何も出さない
[ -n "${HC_TERMINAL_ID:-}" ] || exit 0
role=$(hc get --json "$HC_TERMINAL_ID" 2>/dev/null | jq -r '.labels.role // empty')
printf '%s%s\n' "$HC_TERMINAL_ID" "${role:+ $role}"
