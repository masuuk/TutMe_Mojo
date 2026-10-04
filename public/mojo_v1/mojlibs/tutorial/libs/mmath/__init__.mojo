# __init__.mojo — the public API of the `mmath` package.
#
# This is the bottom of the dependency stack: nothing here imports another
# package, so `mmath` can be the foundation of any of the seven rather than a
# peer of them. Every other library may depend on this one; none of the other
# six is a dependency of it.
#
# The API is organised by precondition rather than by technique, because the
# precondition is what a caller has to know before choosing an algorithm:
#
#   * no precondition  -- `polynomial` and `roots` work on anything
#   * must be square    -- `Matrix` operations in `linalg`
#   * must be symmetric positive definite -- `cholesky`, `cholesky_solve`
#   * must be symmetric -- `symmetric_eigen`
#   * must have a dominant eigenvalue -- `dominant_eigenpair`
#
# A module organised by algorithm names (`newton`, `bischitz`, `gauss`)
# tells a caller nothing about whether they may use it. One organised by
# precondition tells them what they have to check first.

# ── roots ───────────────────────────────────────────────────────────────────
from .roots import RootResult
from .roots import bisect
from .roots import secant
from .roots import newton
from .roots import safeguarded_newton
from .roots import find_all_roots
from .roots import tolerance_reached

# ── polynomial ──────────────────────────────────────────────────────────────
from .polynomial import degree
from .polynomial import is_zero
from .polynomial import trim
from .polynomial import evaluate
from .polynomial import evaluate_all
from .polynomial import derivative
from .polynomial import add
from .polynomial import subtract
from .polynomial import scale
from .polynomial import multiply
from .polynomial import multiply_all
from .polynomial import divide_by_root
from .polynomial import remainder_of
from .polynomial import is_exact_factor
from .polynomial import roots_of
from .polynomial import expand_binomial_power
from .polynomial import constant_term
from .polynomial import leading_coefficient

# ── linalg ──────────────────────────────────────────────────────────────────
from .linalg import Eigen
from .linalg import is_symmetric
from .linalg import is_positive_definite
from .linalg import cholesky
from .linalg import cholesky_solve
from .linalg import symmetric_eigen
from .linalg import dominant_eigenpair
from .linalg import frobenius_norm
from .linalg import spectral_norm
from .linalg import reconstruct_from_eigen

comptime VERSION = "0.1.0"
comptime PACKAGE_NAME = "mmath"