"""Write <version> into every file that carries the app version."""

import json
import re
import sys
from pathlib import Path

PACKAGE_JSONS = (Path("frontend/package.json"), Path("icon/package.json"))
PATTERNS = {
    Path("backend/pyproject.toml"): r'(^\[project\][^\[]*?\nversion\s*=\s*")[^"]+(")',
    Path("backend/kayman/main.py"): r'(\n\s*version\s*=\s*")[^"]+(")',
}


def main() -> None:
    version = sys.argv[1]
    for path in PACKAGE_JSONS:
        data = json.loads(path.read_text())
        data["version"] = version
        # ensure_ascii=False keeps emoji intact instead of escaping them.
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
    for path, pattern in PATTERNS.items():
        text, n = re.subn(
            pattern,
            rf"\g<1>{version}\g<2>",
            path.read_text(),
            count=1,
            flags=re.MULTILINE,
        )
        if n != 1:
            sys.exit(f"error: failed to update version in {path}")
        path.write_text(text)


if __name__ == "__main__":
    main()
