from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from render import build, build_interactive

if __name__ == "__main__":
    args = sys.argv[1:]
    if args and args[0] == "interactive":
        target = ROOT.parent / "mojo_libs_interactive.html"
        rc = build_interactive(target)
        print(f"built {target}")
        raise SystemExit(rc)

    book_target = Path(args[0]) if args else ROOT.parent / "mojo_libs.html"
    rc = build(book_target)
    print(f"built {book_target}")
    interactive_target = ROOT.parent / "mojo_libs_interactive.html"
    interactive_rc = build_interactive(interactive_target)
    print(f"built {interactive_target}")
    raise SystemExit(rc or interactive_rc)
