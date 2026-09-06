#!/bin/bash
# statusline 用: 現在のセッション名（ListAgents に出る名前）を出力する
sid=$(jq -r '.session_id // empty' 2>/dev/null)
[ -z "$sid" ] && exit 0
jq -r --arg sid "$sid" 'select(.sessionId == $sid) | .name // empty' ~/.claude/sessions/*.json 2>/dev/null | head -1
