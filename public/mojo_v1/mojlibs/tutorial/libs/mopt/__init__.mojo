# __init__.mojo — the public API of the `mopt` package.
#
# The theme across this package: **recognising problem structure beats handing
# things to a general solver.** The assignment problem is a linear program,
# but expressing it as one costs 2n variables and n^2 constraints, and no
# solver should ever be run on that formulation when the Hungarian algorithm
# solves the same problem in O(n^3) on an n-by-n matrix.
#
# Where a general method *is* the right answer, it is exposed with the
# limitations in its signature rather than its documentation: `solve`
# rejects negative right-hand sides because it does not implement Big-M, and
# `brute_force` refuses more than ten rows because it is exponential.

# ── linear programming ──────────────────────────────────────────────────────
from .lp import solve
from .lp import pivot
from .lp import extract
from .lp import objective_of
from .lp import LpResult
from .lp import LpBuilder

# ── assignment ─────────────────────────────────────────────────────────────
from .assignment import assign
from .assignment import solve_with_duals
from .assignment import total_cost
from .assignment import is_valid
from .assignment import dual_value
from .assignment import check_complementary_slackness
from .assignment import brute_force
from .assignment import rectangular_assign
from .assignment import hungarian_gap

# ── networks ───────────────────────────────────────────────────────────────
from .network import Graph
from .network import dijkstra
from .network import shortest_path
from .network import reverse
from .network import find
from .network import minimum_spanning_tree
from .network import tour_length
from .network import nearest_neighbour_tour
from .network import SpanningTree

comptime VERSION = "0.1.0"
comptime PACKAGE_NAME = "mopt"