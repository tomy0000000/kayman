#!/usr/bin/env python3
"""Bump the top-level "version" in frontend/package.json."""

import json
import sys
from pathlib import Path


def main() -> None:
    version = sys.argv[1]
    path = Path("frontend/package.json")
    data = json.loads(path.read_text())
    data["version"] = version
    # ensure_ascii=False so emoji survive the round-trip instead of being escaped
    # to \uXXXX sequences.
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")


if __name__ == "__main__":
    main()
