"""Automatic agent capture hook for Antigravity and Codex.

Fires on hook events via stdin and appends verbatim prompts and final responses into .agent-logs/.
"""

import json
import os
import re
import sys
from datetime import datetime, timezone
from pathlib import Path

DEFAULT_AUTHOR = "harilexm"
DEFAULT_PROJECT = "Fathom-clone"
DEFAULT_TOOL = "antigravity-ide"
DEFAULT_MODEL = "gemini-3.8-flash"

REPO_ROOT = Path(__file__).resolve().parent
if REPO_ROOT.name == ".agents":
    REPO_ROOT = REPO_ROOT.parent

LOG_DIR = REPO_ROOT / ".agent-logs"
BRAIN_DIR = Path(os.environ.get("USERPROFILE", "C:/Users/DeLL")) / ".gemini" / "antigravity-ide" / "brain"


def get_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def extract_prompt_text(raw: str) -> str:
    if not isinstance(raw, str):
        return ""
    m = re.search(r"<USER_REQUEST>\s*(.*?)\s*</USER_REQUEST>", raw, re.DOTALL)
    if m:
        return m.group(1).strip("\r\n")
    return raw.strip("\r\n")


def parse_antigravity_transcript(transcript_path: Path):
    if not transcript_path.exists():
        return []

    lines = []
    with open(transcript_path, "r", encoding="utf-8", errors="replace") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                lines.append(json.loads(line))
            except Exception:
                continue

    turns = []
    user_indices = [i for i, s in enumerate(lines) if s.get("type") == "USER_INPUT"]
    for idx, u_idx in enumerate(user_indices):
        user_step = lines[u_idx]
        next_u_idx = user_indices[idx + 1] if idx + 1 < len(user_indices) else len(lines)
        planner_steps = [
            lines[j]
            for j in range(u_idx + 1, next_u_idx)
            if lines[j].get("type") == "PLANNER_RESPONSE" and lines[j].get("content")
        ]
        planner_step = planner_steps[-1] if planner_steps else None

        raw_prompt = user_step.get("content", "")
        prompt_text = extract_prompt_text(raw_prompt)
        prompt_time = user_step.get("created_at") or get_utc_now()

        response_text = None
        response_time = None
        if planner_step:
            response_text = planner_step.get("content", "").strip("\r\n")
            response_time = planner_step.get("created_at") or get_utc_now()

        turns.append({
            "num": idx + 1,
            "prompt": prompt_text,
            "prompt_time": prompt_time,
            "response": response_text,
            "response_time": response_time,
        })
    return turns


def sync_conversation_log(
    session_id: str,
    turns: list,
    model: str = DEFAULT_MODEL,
    tool: str = DEFAULT_TOOL,
    author: str = DEFAULT_AUTHOR,
    project: str = DEFAULT_PROJECT,
):
    if not turns:
        return None

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    short_id = session_id.split("-")[0]

    existing = list(LOG_DIR.glob(f"*_{session_id}.md"))
    first_time = turns[0]["prompt_time"]
    date_str = first_time[:10]

    if existing:
        log_path = existing[0]
    else:
        time_part = first_time[11:19].replace(":", "-") if len(first_time) >= 19 else "00-00-00"
        log_path = LOG_DIR / f"{date_str}_{time_part}_{session_id}.md"

    total_exchanges = len(turns)
    last_prompt_time = turns[-1]["prompt_time"]

    content = (
        f"---\n"
        f"session_id: {session_id}\n"
        f"date: {date_str}\n"
        f"author: {author}\n"
        f"model: {model}\n"
        f"tool: {tool}\n"
        f"project: {project}\n"
        f"total_exchanges: {total_exchanges}\n"
        f"first_prompt_time: {first_time}\n"
        f"last_prompt_time: {last_prompt_time}\n"
        f"---\n\n"
        f"# Session Log - {date_str}\n\n"
        f"Session: `{short_id}` | Project: `{project}` | Author: `{author}`\n\n"
        f"---\n"
    )

    for turn in turns:
        num = turn["num"]
        content += (
            f"\n[LOG_ENTRY type=PROMPT num={num} session={short_id}]\n"
            f"timestamp: {turn['prompt_time']}\n"
            f"model: {model}\n\n"
            f"{turn['prompt']}\n\n"
        )
        if turn["response"] is not None:
            content += (
                f"\n[LOG_ENTRY type=RESPONSE num={num} session={short_id}]\n"
                f"timestamp: {turn['response_time']}\n"
                f"model: {model}\n\n"
                f"{turn['response']}\n\n"
            )

    log_path.write_text(content, encoding="utf-8", newline="\n")
    return log_path


def sync_antigravity_session(session_id: str, transcript_hint: str = None, model: str = DEFAULT_MODEL):
    candidates = []
    if transcript_hint:
        p = Path(transcript_hint)
        candidates.append(p.parent / "transcript_full.jsonl")
        candidates.append(p)

    candidates.append(BRAIN_DIR / session_id / ".system_generated" / "logs" / "transcript_full.jsonl")
    candidates.append(BRAIN_DIR / session_id / ".system_generated" / "logs" / "transcript.jsonl")

    target = None
    for c in candidates:
        if c.exists():
            target = c
            break

    if not target:
        return None

    turns = parse_antigravity_transcript(target)
    if not turns:
        return None

    return sync_conversation_log(session_id, turns, model=model)


def handle_codex_event(event: dict):
    kind = event.get("hook_event_name")
    if kind not in ("UserPromptSubmit", "Stop"):
        return
    session_id = event["session_id"]
    short_id = session_id.split("-")[0]
    model = event.get("model") or "unknown"
    now = get_utc_now()
    log_dir = Path(event.get("cwd", REPO_ROOT)) / ".agent-logs"
    log_dir.mkdir(parents=True, exist_ok=True)
    existing = list(log_dir.glob(f"*_{session_id}.md"))
    if existing:
        log_path = existing[0]
        current = log_path.read_text(encoding="utf-8")
    else:
        log_path = log_dir / f"{now[:10]}_{now[11:19].replace(':', '-')}_{session_id}.md"
        current = (
            f"---\nsession_id: {session_id}\ndate: {now[:10]}\nauthor: {DEFAULT_AUTHOR}\n"
            f"model: {model}\ntool: codex-cli\nproject: {DEFAULT_PROJECT}\ntotal_exchanges: 0\n"
            f"first_prompt_time: {now}\nlast_prompt_time: {now}\n---\n\n"
            f"# Session Log - {now[:10]}\n\n"
            f"Session: `{short_id}` | Project: `{DEFAULT_PROJECT}` | Author: `{DEFAULT_AUTHOR}`\n\n---\n"
        )
    if kind == "UserPromptSubmit":
        payload = event.get("prompt")
        if not isinstance(payload, str):
            return
        number = len(re.findall(r"^\[LOG_ENTRY type=PROMPT ", current, re.MULTILINE)) + 1
        current = re.sub(r"(?m)^total_exchanges: \d+$", f"total_exchanges: {number}", current, count=1)
        current = re.sub(r"(?m)^last_prompt_time: .+$", f"last_prompt_time: {now}", current, count=1)
        entry = f"\n[LOG_ENTRY type=PROMPT num={number} session={short_id}]\ntimestamp: {now}\nmodel: {model}\n\n{payload}\n\n"
    else:
        payload = event.get("last_assistant_message")
        if not isinstance(payload, str):
            return
        number = len(re.findall(r"^\[LOG_ENTRY type=RESPONSE ", current, re.MULTILINE)) + 1
        entry = f"\n[LOG_ENTRY type=RESPONSE num={number} session={short_id}]\ntimestamp: {now}\nmodel: {model}\n\n{payload}\n\n"
    log_path.write_text(current + entry, encoding="utf-8", newline="\n")


def main():
    if sys.stdin.isatty():
        print("{}")
        return

    sys.stdin.reconfigure(encoding="utf-8")
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            print("{}")
            return

        event = json.loads(raw_input)
        if "conversationId" in event:
            session_id = event["conversationId"]
            transcript_path = event.get("transcriptPath")
            model = event.get("modelName")
            if not model or model == "auto":
                model = DEFAULT_MODEL
            sync_antigravity_session(session_id, transcript_path, model=model)
            print("{}")
            return
        elif "session_id" in event and "hook_event_name" in event:
            handle_codex_event(event)
            print("{}")
            return
    except Exception:
        pass

    print("{}")


if __name__ == "__main__":
    main()
