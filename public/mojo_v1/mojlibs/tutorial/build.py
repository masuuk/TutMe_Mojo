from __future__ import annotations

from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "src"))

from render import build_interactive

if __name__ == "__main__":
    # One edition only. The print build (render.build + src/theme.css) was retired
    # when mojo_libs.html was withdrawn; the web edition is the single artefact.
    args = sys.argv[1:]
    target = Path(args[0]) if args else ROOT.parent / "mojo_libs_interactive.html"
    rc = build_interactive(target)
    print(f"built {target}")
    raise SystemExit(rc)
