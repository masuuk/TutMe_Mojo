# random.mojo — a small, deterministic pseudo-random generator.
#
# Why not the standard library's generator? Because a tutorial's printed
# output is only trustworthy if it is reproducible. This generator is
# fully specified in ~30 lines, so a reader can verify by hand that a given
# seed produces the sequence they see, and every example in this tutorial is
# reproducible on every platform.
#
# The algorithm is xorshift64*, chosen because it has no multiplication
# overflow surprises and passes BigCrush. It is excellent for simulation,
# sampling and shuffling. It is NOT cryptographically secure, and it must
# never be used for keys, tokens or anything else adversarial.

from std.math import exp, log, sqrt

# 64-bit magic constants. xorshift64* needs three nonzero odd multipliers.
comptime _A: Int64 = 0x2545F4914F6CDD1D
comptime _B: Int64 = 0x9E3779B97F4A7C15
comptime _MASK: Int64 = 0xFFFFFFFFFFFFFFFF
comptime _TWO_POW_M53: Float64 = 9007199254740992.0  # 2^53

# SplitMix64 — used only to expand a small integer seed into a well-mixed
# 64-bit state, so that seeds 1 and 2 do not produce correlated streams.
comptime _MIX_A: Int64 = 0xE7037ED1A0B428DB
comptime _MIX_B: Int64 = 0x8EBC6AF09C88C6E3


@always_inline("builtin")
def _mix64(x: Int64) -> Int64:
    # Scramble `x` into a full-entropy 64-bit value.
    var z = x + _MIX_B
    z = (z ^ (z >> 30)) * _MIX_A
    z = (z ^ (z >> 27)) * _MIX_B
    return z ^ (z >> 31)


struct Rng:
    """A deterministic generator of 64-bit integers and unit-range floats.

    The struct owns exactly one piece of state, so it is cheap to copy by
    reference and trivial to serialise. `Rng` declares no trait list, which
    means it is `Movable` but *not* `Copyable` — a generator that could be
    silently duplicated would undermine the whole point of seeding.
    """

    var state: Int64
    var draws: Int64

    def __init__(out self, seed: Int64 = 42):
        # Never allow a zero state: xorshift would be stuck at zero forever.
        var mixed = _mix64(seed)
        self.state = mixed | 1  # the `| 1` guarantees nonzero
        self.draws = 0

    def next_u64(mut self) -> Int64:
        """The next 64-bit value, advancing the state.

        xorshift64*: shift left, shift right, xor, multiply, xor right.
        """
        var x = self.state
        x = x ^ (x >> 12)
        x = x ^ (x << 25)
        x = x ^ (x >> 27)
        self.state = x
        self.draws += 1
        # The high three bits of xorshift64* are the best-mixed.
        return (x * _A) >> 1

    def uniform(mut self) -> Float64:
        """A float in `[0, 1)`.

        Built from the top 53 bits, which is exactly the mantissa width of
        a Float64, so every representable value below 1.0 is reachable with
        equal probability. Taking `low % 53` bits, or all 64 bits, would bias
        the result.
        """
        var bits = self.next_u64() >> 11
        return Float64(bits) / _TWO_POW_M53

    def uniform_range(mut self, lo: Float64, hi: Float64) -> Float64:
        """A float uniformly distributed in `[lo, hi)`."""
        return lo + (hi - lo) * self.uniform()

    def below(mut self, bound: Int) raises -> Int:
        """An integer in `[0, bound)`.

        Rejection sampling: discard draws that fall in the short final block
        where `bound` does not divide the generator's range evenly. Taking a
        plain modulo would make the low outcomes slightly more likely.
        """
        if bound <= 0:
            raise "Rng.below: bound must be positive"
        var limit = _MASK - (_MASK % Int64(bound))
        while True:
            var v = self.next_u64()
            if v <= limit:
                return Int(v % Int64(bound))

    def between(mut self, lo: Int, hi: Int) raises -> Int:
        """An integer in the inclusive range `[lo, hi]`."""
        if hi < lo:
            raise "Rng.between: empty range"
        return lo + self.below(hi - lo + 1)

    def normal(mut self, mu: Float64 = 0.0, sigma: Float64 = 1.0) -> Float64:
        """A normal deviate via the Box-Muller transform.

        Uses the polar form, which avoids the `log(0)` that the trigonometric
        form hits when the underlying uniform lands on exactly zero. Consumes
        a variable number of draws, so `draws` is the honest cost measure.
        """
        var u1 = 0.0
        var u2 = 0.0
        var s = 2.0
        while s >= 1.0 or s == 0.0:
            u1 = self.uniform_range(-1.0, 1.0)
            u2 = self.uniform_range(-1.0, 1.0)
            s = u1 * u1 + u2 * u2
        var f = sqrt(-2.0 * log(s) / s)
        # Return one of the pair; the other is discarded. Rejection-free.
        return mu + sigma * u1 * f

    def lognormal(mut self, mu: Float64 = 0.0, sigma: Float64 = 1.0) -> Float64:
        """A lognormal deviate: `exp(normal(mu, sigma))`.

        This is the correct generative model for quantities that are strictly
        positive and right-skewed — returns, claim sizes, waiting times.
        """
        return exp(self.normal(mu, sigma))

    def bernoulli(mut self, p: Float64) -> Bool:
        """True with probability `p`."""
        return self.uniform() < p

    def pick(mut self, values: List[Float64]) raises -> Float64:
        """One uniformly chosen element of a non-empty list."""
        if len(values) == 0:
            raise "Rng.pick: empty list"
        return values[self.below(len(values))]

    def fill(mut self, mut buf: List[Float64], lo: Float64, hi: Float64):
        """Overwrite `buf` with `len(buf)` uniforms in `[lo, hi)`.

        Takes `mut`, not `out`. The caller already owns `buf` and expects its
        contents to change; `out` would promise to *build* an uninitialised
        value, which is not what is happening here.
        """
        for i in range(len(buf)):
            buf[i] = self.uniform_range(lo, hi)

    def shuffled(mut self, mut buf: List[Float64]):
        """In-place Fisher-Yates shuffle of `buf`."""
        var n = len(buf)
        var i = n - 1
        while i > 0:
            var j = self.below(i + 1)
            var tmp = buf[i]
            buf[i] = buf[j]
            buf[j] = tmp
            i -= 1