#!/usr/bin/env python3
"""
@name db-query
@purpose Read-only SQL-запрос к gateway.db / prana_bindu.db с лимитом строк и обрезкой длинных полей
@input argv: --db gateway|prana|<путь>, --sql "SELECT ...", --limit N (default 50), --json, --max-cell N (default 120)
@output stdout: таблица или JSON; длинные значения обрезаются
@args {"type":"object","properties":{"db":{"type":"string","default":"gateway"},"sql":{"type":"string"},"limit":{"type":"integer","default":50},"json":{"type":"boolean"},"max_cell":{"type":"integer","default":120}}}
@result {"type":"object","properties":{"columns":{"type":"array"},"rows":{"type":"array"},"truncated":{"type":"boolean"}}}
@exit 0 — успех
@exit 1 — ошибка БД/SQL
@tool true
@example python3 scripts/python/db_query.py --db gateway --sql "SELECT id,title FROM conversations LIMIT 5"
@example python3 scripts/python/db_query.py --db prana --sql "SELECT COUNT(*) FROM run_facts" --json
"""

import argparse
import json
import os
import sqlite3
import sys

HOME_DB = os.path.join(os.path.expanduser("~"), ".config", "wetothemoon-electron")
DB_MAP = {
    "gateway": os.path.join(HOME_DB, "gateway.db"),
    "prana": os.path.join(HOME_DB, "prana_bindu.db"),
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--db", default="gateway")
    ap.add_argument("--sql", required=True)
    ap.add_argument("--limit", type=int, default=50)
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--max-cell", type=int, default=120)
    args = ap.parse_args()

    path = DB_MAP.get(args.db, args.db)
    if not os.path.exists(path):
        print(f"✗ БД не найдена: {path}", file=sys.stderr)
        return 1

    uri = f"file:{path}?mode=ro"
    try:
        con = sqlite3.connect(uri, uri=True)
        con.row_factory = sqlite3.Row
        cur = con.execute(args.sql)
        rows = cur.fetchmany(args.limit + 1)
        columns = [d[0] for d in cur.description] if cur.description else []
        con.close()
    except sqlite3.Error as exc:
        print(f"✗ SQL: {exc}", file=sys.stderr)
        return 1

    truncated = len(rows) > args.limit
    rows = rows[: args.limit]

    def cell(v):
        if v is None:
            return None
        s = str(v)
        return s if len(s) <= args.max_cell else s[: args.max_cell] + "…"

    data = [[cell(v) for v in r] for r in rows]

    if args.json:
        print(json.dumps(
            {"columns": columns, "rows": data, "truncated": truncated},
            ensure_ascii=False, indent=2,
        ))
        return 0

    if not columns:
        print("(no columns)")
        return 0

    widths = [len(c) for c in columns]
    for row in data:
        for i, v in enumerate(row):
            widths[i] = min(max(widths[i], len(str(v or ""))), args.max_cell)

    header = " | ".join(c.ljust(widths[i]) for i, c in enumerate(columns))
    print(header)
    print("-+-".join("-" * w for w in widths))
    for row in data:
        print(" | ".join(str(v or "").ljust(widths[i]) for i, v in enumerate(row)))
    print(f"\nrows={len(data)}{' (truncated)' if truncated else ''}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
