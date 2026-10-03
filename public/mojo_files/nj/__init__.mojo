# ============================================================================
#  nj -- a very small NumPy-shaped library for Mojo 1.x
#
#  nj/__init__.mojo
#
#  A Mojo package is a directory with an __init__.mojo in it. That file
#  cannot run statements on import -- Mojo has no top-level code -- but it
#  can re-export, so `import nj` is enough to reach everything:
#
#      import nj
#      var rng  = nj.random(seed=15)
#      var x    = nj.array([[1, 0], [0, 1]])
#      var loss = nj.sum(x)
#
#  Each line below pulls a name out of a sibling module and puts it in the
#  package namespace. This is the same trick the `max` library uses for
#  max.algorithm.
# ============================================================================
from .array import ndarray, array, zeros, sum
from .random import random
