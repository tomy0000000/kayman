#!/usr/bin/env python3
"""Bump the top-level "version" in every package.json that carries one."""

import json
import sys
from pathlib import Path

PATHS = (Path("frontend/package.json"), Path("icon/package.json"))


def main() -> None:
    version = sys.argv[1]
    for path in PATHS:
        data = json.loads(path.read_text())
        data["version"] = version
        # ensure_ascii=False so emoji survive the round-trip instead of being
        # escaped to \uXXXX sequences.
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
