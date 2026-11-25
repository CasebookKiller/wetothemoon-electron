#!/usr/bin/env python3
"""
@name diff-review
@purpose Компактный обзор diff: файлы, ±строки и «точки касания» (hunk headers) без полного текста патча
@input argv: --staged (индексированные), --base <ref> (default HEAD), --max-files N (default 30)
@output stdout: сводка по файлам + hunk-заголовки
@args {"type":"object","properties":{"staged":{"type":"boolean"},"base":{"type":"string","default":"HEAD"},"max_files":{"type":"integer","default":30}}}
@result {"type":"object","properties":{"files":{"type":"integer"},"added":{"type":"integer"},"removed":{"type":"integer"}}}
@exit 0 — успех
@exit 1 — git ошибка
@tool true
@example python3 scripts/python/diff_review.py
@example python3 scripts/python/diff_review.py --staged
"""

import argparse
import re
import subprocess
import sys
from collections import defaultdict


def git(*args: str) -> str:
    try:
        return subprocess.run(
            ["git", *args], capture_output=True, text=True, check=True
        ).stdout
    except subprocess.CalledProcessError as exc:
        print(f"✗ git {' '.join(args)}: {exc.stderr.strip()}", file=sys.stderr)
        raise SystemExit(1)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--staged", action="store_true")
    ap.add_argument("--base", default=None)
    ap.add_argument("--max-files", type=int, default=30)
    args = ap.parse_args()

    scope = ["--cached"] if args.staged else []
    base = args.base or ("HEAD" if not args.staged else None)
    ref = [base] if base else []

    numstat = git("diff", "--numstat", *scope, *ref)
    patch = git("diff", "-U0", *scope, *ref)

    stats: dict[str, tuple[int, int]] = {}
    for line in numstat.splitlines():
        parts = line.split("\t")
        if len(parts) != 3:
            continue
        a, d, path = parts
        stats[path] = (
            int(a) if a.isdigit() else 0,
            int(d) if d.isdigit() else 0,
        )

    touches: dict[str, list[str]] = defaultdict(list)
    current = None
    for line in patch.splitlines():
        if line.startswith("+++ b/"):
            current = line[6:]
        elif line.startswith("@@") and current:
            m = re.match(r"@@[^@]*@@\s*(.*)", line)
            ctx = (m.group(1).strip() if m else "")[:110]
            if ctx and ctx not in touches[current]:
                touches[current].append(ctx)

    total_a = sum(v[0] for v in stats.values())
    total_d = sum(v[1] for v in stats.values())
    files = sorted(stats.items(), key=lambda kv: kv[1][0] + kv[1][1], reverse=True)

    print(f"files={len(files)} +{total_a} -{total_d}")
    for path, (a, d) in files[: args.max_files]:
        print(f"\n{path}  +{a} -{d}")
        for ctx in touches.get(path, [])[:6]:
            print(f"    @ {ctx}")
    if len(files) > args.max_files:
        print(f"\n… +{len(files) - args.max_files} file(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
