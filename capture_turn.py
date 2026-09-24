"""Append Codex prompt and final response hook events to a session log."""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

AUTHOR = "harilexm"
PROJECT = "Fathom-clone"
TOOL = os.environ.get("AGENT_CAPTURE_TOOL", "codex-desktop")


def main():
    sys.stdin.reconfigure(encoding="utf-8")
    event = json.load(sys.stdin)
    kind = event.get("hook_event_name")
    if kind not in ("UserPromptSubmit", "Stop"):
        return
    session_id = event["session_id"]
    short_id = session_id.split("-")[0]
    model = event.get("model") or "unknown"
    now = datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")
    log_dir = Path(event["cwd"]) / ".agent-logs"
    log_dir.mkdir(exist_ok=True)
    existing = list(log_dir.glob(f"*_{session_id}.md"))
    if existing:
        log_path = existing[0]
        current = log_path.read_text(encoding="utf-8")
    else:
        log_path = log_dir / f"{now[:10]}_{now[11:19].replace(':', '-')}_{session_id}.md"
        current = (
            f"---\nsession_id: {session_id}\ndate: {now[:10]}\nauthor: {AUTHOR}\n"
            f"model: {model}\ntool: {TOOL}\nproject: {PROJECT}\ntotal_exchanges: 0\n"
            f"first_prompt_time: {now}\nlast_prompt_time: {now}\n---\n\n"
            f"# Session Log - {now[:10]}\n\n"
            f"Session: `{short_id}` | Project: `{PROJECT}` | Author: `{AUTHOR}`\n\n---\n"
        )
    if kind == "UserPromptSubmit":
        payload = event.get("prompt")
        if not isinstance(payload, str):
            raise ValueError("UserPromptSubmit omitted prompt")
        number = len(re.findall(r"^\[LOG_ENTRY type=PROMPT ", current, re.MULTILINE)) + 1
        current = re.sub(r"(?m)^total_exchanges: \d+$", f"total_exchanges: {number}", current, count=1)
        current = re.sub(r"(?m)^last_prompt_time: .+$", f"last_prompt_time: {now}", current, count=1)
        entry = f"\n[LOG_ENTRY type=PROMPT num={number} session={short_id}]\ntimestamp: {now}\nmodel: {model}\n\n{payload}\n\n"
    else:
        payload = event.get("last_assistant_message")
        if not isinstance(payload, str):
            raise ValueError("Stop omitted last_assistant_message")
        number = len(re.findall(r"^\[LOG_ENTRY type=RESPONSE ", current, re.MULTILINE)) + 1
        entry = f"\n[LOG_ENTRY type=RESPONSE num={number} session={short_id}]\ntimestamp: {now}\nmodel: {model}\n\n{payload}\n\n"
    log_path.write_text(current + entry, encoding="utf-8", newline="\n")
    if kind == "Stop":
        print("{}")


if __name__ == "__main__":
    main()
