#!/usr/bin/env python3
"""Strip CRLF from staged backend/*.py paths so Black on Linux (CI) matches local edits."""
from __future__ import annotations

import pathlib
import subprocess
import sys


def main() -> int:
    try:
        out = subprocess.check_output(
            ["git", "diff", "--cached", "--name-only", "--diff-filter=ACM"],
            text=True,
        )
    except (subprocess.CalledProcessError, FileNotFoundError):
        return 0
    changed = 0
    for line in out.splitlines():
        p = pathlib.Path(line.strip())
        if not p.is_file() or p.suffix != ".py":
            continue
        parts = p.parts
        if len(parts) < 2 or parts[0] != "backend":
            continue
        data = p.read_bytes()
        if b"\r\n" not in data:
            continue
        p.write_bytes(data.replace(b"\r\n", b"\n"))
        changed += 1
    if changed:
        print(
            f"Normalized CRLF→LF in {changed} backend Python file(s). "
            "Re-stage if needed: git add backend",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
