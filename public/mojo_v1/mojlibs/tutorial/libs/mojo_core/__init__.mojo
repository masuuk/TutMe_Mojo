# __init__.mojo — the public API of the `mojo_core` package.
#
# This file is the single most important file in a Mojo package. It defines
# what `from mojo_core import X` resolves to, and therefore what your
# library's contract with the world is. Everything not re-exported here is
# private, even if it has a perfectly good name.
#
# Two rules govern what belongs in this file:
#
#   1. Re-export the names people should call, in dependency order.
#   2. Do NOT re-export helper internals. A name you export is a name you
#      have promised to keep working.
#
# Note there is no top-level code here. Mojo does not allow statements that
# execute on import, so `__init__.mojo` is a list of imports and definitions,
# never a setup routine. If you need initialisation, expose a function and
# let the caller decide when to run it.

# ── numeric ────────────────────────────────────────────────────────────────
# Tolerances, clamping, interpolation, unit conversion, angle folding.
from .numeric import close_to
from .numeric import clamp
from .numeric import lerp
from .numeric import safe_div
from .numeric import relative_error
from .numeric import deg_to_rad
from .numeric import rad_to_deg
from .numeric import arcseconds_to_deg
from .numeric import wrap_degrees
from .numeric import angular_difference_deg
from .numeric import mean
from .numeric import sum_of_squares
from .numeric import DEFAULT_ATOL
from .numeric import DEFAULT_RTOL
from .numeric import DEG_TO_RAD
from .numeric import RAD_TO_DEG
from .numeric import ARCSEC_TO_DEG

# ── random ─────────────────────────────────────────────────────────────────
# A deterministic, self-contained generator.
from .random import Rng

# ── vec ────────────────────────────────────────────────────────────────────
from .vec import Vec2
from .vec import Vec3
from .vec import lerp2
from .vec import distance
from .vec import centroid
from .vec import bounding_box
from .vec import VEC_EPS

# ── matrix ─────────────────────────────────────────────────────────────────
from .matrix import Matrix
from .matrix import matmul
from .matrix import trace
from .matrix import frobenius_norm
from .matrix import is_diagonal
from .matrix import MAX_DIM

# Package version. A consumer can print `mojo_core.VERSION` to record which
# build produced a result set — worth more than it sounds in numerical work.
comptime VERSION = "0.1.0"
comptime PACKAGE_NAME = "mojo_core"