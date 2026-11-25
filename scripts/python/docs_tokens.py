#!/usr/bin/env python3
"""
@name docs-tokens
@purpose Токен-бюджет docs/prompts: сколько «стоит» каждый модуль и самые тяжёлые файлы (контроль раздувания handoff)
@input argv: --root docs/prompts, --top N (default 15), --warn N (default 15000)
@output stdout: сводка по модулям + топ файлов; предупреждение при превышении порога
@args {"type":"object","properties":{"root":{"type":"string","default":"docs/prompts"},"top":{"type":"integer","default":15},"warn":{"type":"integer","default":15000}}}
@result {"type":"object","properties":{"files":{"type":"integer"},"tokens":{"type":"integer"},"modules":{"type":"object"}}}
@exit 0 — успех
@exit 1 — каталог не найден
@tool true
@example python3 scripts/python/docs_tokens.py
@example python3 scripts/python/docs_tokens.py --top 25 --warn 12000
"""

import argparse
import os
import sys
from pathlib import Path

BYTES_PER_TOKEN = 3.2


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--root", default="docs/prompts")
    ap.add_argument("--top", type=int, default=15)
    ap.add_argument("--warn", type=int, default=15000)
    args = ap.parse_args()

    project_root = Path(__file__).resolve().parents[2]
    root = Path(args.root)
    if not root.is_absolute():
        root = project_root / root
    if not root.exists():
        print(f"✗ каталог не найден: {root}", file=sys.stderr)
        return 1

    modules: dict[str, dict[str, int]] = {}
    files: list[tuple[str, int]] = []

    for dirpath, _dirnames, filenames in os.walk(root):
        for name in filenames:
            if not name.endswith(".md"):
                continue
            full = Path(dirpath) / name
            size = full.stat().st_size
            rel = full.relative_to(root)
            module = rel.parts[0] if len(rel.parts) > 1 else "(root)"
            acc = modules.setdefault(module, {"files": 0, "bytes": 0})
            acc["files"] += 1
            acc["bytes"] += size
            files.append((str(rel), size))

    total_bytes = sum(v["bytes"] for v in modules.values())
    print(f"root={root}")
    print(f"files={len(files)} bytes={total_bytes} ~tokens={round(total_bytes / BYTES_PER_TOKEN)}")
    print("\nпо модулям:")
    for module, v in sorted(modules.items(), key=lambda kv: kv[1]["bytes"], reverse=True):
        tokens = round(v["bytes"] / BYTES_PER_TOKEN)
        flag = "  ⚠ > warn" if tokens >= args.warn else ""
        print(f"  {module:<16} ~{tokens:>7} tok  ({v['files']} files){flag}")

    print(f"\nтоп-{args.top} файлов:")
    for rel, size in sorted(files, key=lambda kv: kv[1], reverse=True)[: args.top]:
        print(f"  ~{round(size / BYTES_PER_TOKEN):>7} tok  {rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
