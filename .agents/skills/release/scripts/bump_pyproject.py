#!/usr/bin/env python3
"""Bump `version = "..."` under [project] in backend/pyproject.toml."""

import re
import sys
from pathlib import Path


def main() -> None:
    version = sys.argv[1]
    path = Path("backend/pyproject.toml")
    text = path.read_text()
    new, n = re.subn(
        r'(^\[project\][^\[]*?\nversion\s*=\s*")[^"]+(")',
        lambda m: m.group(1) + version + m.group(2),
        text,
        count=1,
        flags=re.MULTILINE,
    )
    if n != 1:
        sys.exit("error: failed to update version in backend/pyproject.toml")
    path.write_text(new)


if __name__ == "__main__":
    main()
