#!/usr/bin/env python3
"""
@name log-digest
@purpose Сжимает лог: нормализует сообщения и группирует ошибки/варнинги по частоте (топ-N вместо мегабайт текста)
@input argv: путь к логу (опционально; иначе stdin), --top N (default 10), --json
@output stdout: группы «count × шаблон» + пример строки
@args {"type":"object","properties":{"path":{"type":"string"},"top":{"type":"integer","default":10},"json":{"type":"boolean"}}}
@result {"type":"object","properties":{"lines":{"type":"integer"},"matched":{"type":"integer"},"groups":{"type":"array"}}}
@exit 0 — успех
@exit 1 — файл не найден
@tool true
@example python3 scripts/python/log_digest.py .cache/app.log --top 5
@example tail -n 5000 src.log | python3 scripts/python/log_digest.py
"""

import argparse
import json
import re
import sys
from collections import Counter

KEYWORDS = re.compile(r"(?i)\b(error|warn|exception|failed|failure|traceback|unhandled)\b")
TS = re.compile(r"\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}(?:[.,]\d+)?(?:Z|[+-]\d{2}:?\d{2})?")
HEX = re.compile(r"\b(?:0x)?[0-9a-fA-F]{8,}\b")
NUM = re.compile(r"\b\d+\b")
UUID = re.compile(r"\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b")
PATHS = re.compile(r"(?:/home|/tmp|/Users)/\S+")


def normalize(line: str) -> str:
    s = TS.sub("<ts>", line)
    s = UUID.sub("<uuid>", s)
    s = HEX.sub("<hex>", s)
    s = PATHS.sub("<path>", s)
    s = NUM.sub("<n>", s)
    return s.strip()[:220]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path", nargs="?")
    ap.add_argument("--top", type=int, default=10)
    ap.add_argument("--json", action="store_true")
    args = ap.parse_args()

    if args.path:
        try:
            with open(args.path, "r", encoding="utf-8", errors="replace") as fh:
                lines = fh.read().splitlines()
        except OSError as exc:
            print(f"✗ {exc}", file=sys.stderr)
            return 1
    else:
        lines = sys.stdin.read().splitlines()

    groups: Counter[str] = Counter()
    example: dict[str, str] = {}
    matched = 0
    for line in lines:
        if not KEYWORDS.search(line):
            continue
        matched += 1
        key = normalize(line)
        groups[key] += 1
        example.setdefault(key, line.strip()[:300])

    result = {
        "lines": len(lines),
        "matched": matched,
        "groups": [
            {"count": c, "template": t, "example": example[t]}
            for t, c in groups.most_common(args.top)
        ],
    }

    if args.json:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"lines={len(lines)} matched={matched} unique={len(groups)}")
        for g in result["groups"]:
            print(f"\n[{g['count']:>4}x] {g['template']}")
            print(f"        e.g. {g['example']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
