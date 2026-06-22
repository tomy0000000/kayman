#!/usr/bin/env python3
"""Bump FastAPI(version="...") in backend/kayman/main.py."""

import re
import sys
from pathlib import Path


def main() -> None:
    version = sys.argv[1]
    path = Path("backend/kayman/main.py")
    text = path.read_text()
    new, n = re.subn(
        r'(\n\s*version\s*=\s*")[^"]+(")',
        lambda m: m.group(1) + version + m.group(2),
        text,
        count=1,
    )
    if n != 1:
        sys.exit("error: failed to update version in backend/kayman/main.py")
    path.write_text(new)


if __name__ == "__main__":
    main()
