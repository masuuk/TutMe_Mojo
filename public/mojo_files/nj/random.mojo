# ============================================================================
#  nj -- the random half of the library
#
#  nj/random.mojo
#
#  Mojo 1.x ships no standard random module, so the generator is written
#  out here: xorshift64, seeded, which gives the same numbers on every run
#  and on every platform.
#
#  One deliberate difference from numpy. NumPy hides its generator in a
#  module-level global: np.random.seed(1) and then any later
#  np.random.random(...) picks it up. nj makes the generator a value you
#  hold, so there is no hidden state and a test can build its own:
#
#      var rng = nj.random(seed=1)
#      var w = 2.0 * rng.random((3, 4)) - 1.0
#
#  Two call sites with different seeds are then independent rather than
#  quietly sharing one stream, which is the usual reason a numpy test
#  suite becomes order-dependent.
# ============================================================================
from collections import List
from .array import ndarray


struct random(Movable):
    """A seeded xorshift64 generator. Hold one, pass it around."""

    var state: UInt64

    def __init__(out self, seed: Int = 42):
        self.state = UInt64(seed)
        if self.state == 0:
            # xorshift is stuck at zero forever, so map 0 to the usual seed
            self.state = 88172645463325252
        # the first few outputs of xorshift are poorly mixed; discard them
        for _ in range(10):
            _ = self.next_u64()

    def next_u64(mut self) -> UInt64:
        var s = self.state
        s ^= s << 13
        s ^= s >> 7
        s ^= s << 17
        self.state = s
        return s

    def next_f64(mut self) -> Float64:
        """The top 53 bits, scaled into [0, 1)."""
        return Float64(self.next_u64() >> 11) / Float64(1 << 53)

    def random(mut self, shape: Tuple[Int, Int]) -> ndarray:
        """A rows x cols matrix of uniform values in [0, 1).

        Mirrors np.random.random((rows, cols)), which returns the same
        half-open interval.
        """
        var out = ndarray(shape[0], shape[1], List[Float64]())
        for _ in range(shape[0] * shape[1]):
            out.data.append(self.next_f64())
        return out^

    def uniform(mut self, rows: Int, cols: Int, low: Float64, high: Float64) -> ndarray:
        """A rows x cols matrix of values in [low, high)."""
        var out = ndarray(rows, cols, List[Float64]())
        for _ in range(rows * cols):
            out.data.append(low + self.next_f64() * (high - low))
        return out^
