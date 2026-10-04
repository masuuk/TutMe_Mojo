# relationship.mojo — how two variables move together.
#
# Correlation is the most over-quoted statistic in existence, so this module
# is deliberately awkward about what it will accept. It refuses degenerate
# data, refuses to guess whether a repeated x is a mistake, and returns a
# fit object carrying the sample size and the residual spread rather than a
# bare slope.
#
# Nothing here tests for significance. A correlation of 0.9 across ten
# observations and a correlation of 0.1 across ten thousand are both weak
# evidence, for different reasons, and separating the effect size from its
# precision is the caller's job.

from std.math import abs, sqrt

from mojo_core import close_to
from mojo_core import mean
from .descriptive import standard_deviation
from .probability import two_sided_p


# ── covariance ─────────────────────────────────────────────────────────────

def covariance(xs: List[Float64], ys: List[Float64], sample: Bool = True) raises -> Float64:
    """The average product of corresponding deviations from the mean.

    Raises on a length mismatch. Pairing up two series by index and stopping
    at the shorter one is the single most common bug in spreadsheet-shaped
    code, and a library must not make it easy.
    """
    var n = len(xs)
    if n != len(ys):
        raise "covariance: inputs must be the same length"
    if n == 0:
        raise "covariance: empty input"

    var denom = n - 1 if sample else n
    if denom < 1:
        raise "covariance: sample covariance needs at least two observations"

    var mx = mean(xs)
    var my = mean(ys)
    var acc = 0.0
    for i in range(n):
        var dx = xs[i] - mx
        var dy = ys[i] - my
        acc += dx * dy
    return acc / Float64(denom)


def pearson(xs: List[Float64], ys: List[Float64]) raises -> Float64:
    """Pearson's product-moment correlation coefficient, in [-1, 1].

    Computed through the covariance and the two standard deviations rather
    than the textbook raw-sums formula. That is a little more arithmetic and
    enormously better conditioned: the raw-sums version loses precision
    badly when `x` is large but barely varies, which is exactly the shape of
    data where the correlation matters.
    """
    var n = len(xs)
    if n != len(ys):
        raise "pearson: inputs must be the same length"
    if n < 2:
        raise "pearson: need at least two observations"

    var sx = standard_deviation(xs, True)
    var sy = standard_deviation(ys, True)
    if close_to(sx, 0.0) or close_to(sy, 0.0):
        raise "pearson: one input has zero variance"

    var r = covariance(xs, ys, True) / (sx * sy)
    # Round-off can push r a hair outside [-1, 1] for near-perfect fits.
    if r > 1.0:
        return 1.0
    if r < -1.0:
        return -1.0
    return r


def r_squared(xs: List[Float64], ys: List[Float64]) raises -> Float64:
    """`r^2`: the fraction of variance in `y` explained by a linear fit.

    Reported on its own rather than left to the caller, because squaring a
    negative correlation is the step most often skipped — and the sign of `r`
    carries most of the information.
    """
    var r = pearson(xs, ys)
    return r * r


def covariance_matrix_cols(
    columns: List[List[Float64]],
) raises -> List[List[Float64]]:
    """The full covariance matrix of several equal-length series.

    Returns a plain nested list rather than a `Matrix`, deliberately: this
    belongs in the statistics layer, and pulling the linear-algebra package
    in would invert the dependency direction the rest of the tutorial sets
    up. `mojo_core.Matrix` is one call away for callers who want the better
    numeric type.
    """
    var k = len(columns)
    if k == 0:
        raise "covariance_matrix_cols: no columns supplied"
    var n = len(columns[0])
    for i in range(1, k):
        if len(columns[i]) != n:
            raise "covariance_matrix_cols: columns must be the same length"

    var out = List[List[Float64]]()
    for i in range(k):
        var row = List[Float64]()
        for j in range(k):
            row.append(covariance(columns[i], columns[j], True))
        out.append(row)
    return out


# ── rank correlation ───────────────────────────────────────────────────────

def ranks(values: List[Float64]) raises -> List[Float64]:
    """Average ranks, so ties share the mean of the ranks they span.

    Ties are common in real data — two instruments reading identically, two
    employees with the same score — and getting their ranks wrong changes
    every rank correlation computed from the data.
    """
    var n = len(values)
    if n == 0:
        raise "ranks: empty input"

    # Selection sort on the values, carrying the original indices. O(n^2)
    # and stable in exactly the way the tie handling below needs: equal
    # values end up adjacent whatever order the search found them in,
    # because `best` only moves on a strict `<`.
    var idx = List[Int]()
    for i in range(n):
        idx.append(i)
    for i in range(n):
        var best = i
        for j in range(i + 1, n):
            if values[idx[j]] < values[idx[best]]:
                best = j
        if best != i:
            var tmp = idx[i]
            idx[i] = idx[best]
            idx[best] = tmp

    var out = List[Float64]()
    for i in range(n):
        out.append(0.0)

    var i = 0
    while i < n:
        var j = i
        while j < n and close_to(values[idx[j]], values[idx[i]]):
            j += 1
        # Ranks are 1-based; this block spans ranks i+1 .. j.
        var average_rank = (Float64(i + 1) + Float64(j)) / 2.0
        for k in range(i, j):
            out[idx[k]] = average_rank
        i = j
    return out


def spearman(xs: List[Float64], ys: List[Float64]) raises -> Float64:
    """Spearman's rank correlation: Pearson's `r` applied to ranks.

    Use it when the relationship is monotonic but not linear, or when either
    series contains outliers. It ignores magnitude entirely, so it will call
    a perfectly good weak relationship strong — rank correlation measures
    *order*, not *amount*.
    """
    if len(xs) != len(ys):
        raise "spearman: inputs must be the same length"
    if len(xs) < 2:
        raise "spearman: need at least two observations"
    return pearson(ranks(xs), ranks(ys))


# ── linear regression ──────────────────────────────────────────────────────

struct LinearFit(Copyable, Writable):
    """The result of an ordinary least-squares fit.

    A struct rather than a two-tuple, because the slope alone is nearly
    useless without knowing how much noise is around it. Carrying `n` and
    `residual_sd` is what lets a caller decide whether the relationship is
    worth acting on.
    """

    var slope: Float64
    var intercept: Float64
    var n: Int
    var r2: Float64
    var residual_sd: Float64

    def predict(self, x: Float64) -> Float64:
        return self.intercept + self.slope * x

    def write_to(self, mut writer: Some[Writer]):
        writer.write(String(t"y = {self.slope} x + {self.intercept} (n={self.n})"))

    def significant_at(self, alpha: Float64) raises -> Bool:
        """Whether the slope is distinguishable from zero at `alpha`.

        This is the test the `slope` number cannot answer on its own, and it
        is separated out so a caller is forced to acknowledge it. Uses a
        normal approximation to the t statistic, which is defensible above
        about thirty observations and optimistic below.
        """
        if self.n < 3 or close_to(self.residual_sd, 0.0):
            return False
        # Standard error of the slope = residual_sd / sqrt(sum (x - xbar)^2).
        # Recovered from the residual sd and the r2, since the fit object
        # deliberately does not retain the raw x values.
        if self.r2 >= 1.0:
            return True
        var se = self.residual_sd * sqrt((1.0 - self.r2) / Float64(self.n - 2))
        if close_to(se, 0.0):
            return True
        return two_sided_p(abs(self.slope) / se) < alpha


def least_squares(xs: List[Float64], ys: List[Float64]) raises -> LinearFit:
    """Fit `y = slope * x + intercept` by ordinary least squares.

    The closed-form solution is used rather than a matrix solve. With one
    predictor the normal equations reduce to a pair of sums that can be
    accumulated in a single pass, which is both faster and better
    conditioned than forming and inverting the 2x2 design matrix — and it
    means this function has no dependency on the linear-algebra package.
    """
    var n = len(xs)
    if n != len(ys):
        raise "least_squares: inputs must be the same length"
    if n < 2:
        raise "least_squares: need at least two observations"

    var mx = mean(xs)
    var my = mean(ys)

    var sxx = 0.0
    var sxy = 0.0
    for i in range(n):
        var dx = xs[i] - mx
        sxx += dx * dx
        sxy += dx * (ys[i] - my)

    if close_to(sxx, 0.0):
        raise "least_squares: all x values are identical"

    var slope = sxy / sxx
    var intercept = my - slope * mx

    # Residuals in a second pass, so the fit object does not need the data.
    var sse = 0.0
    var sst = 0.0
    for i in range(n):
        var residual = ys[i] - (intercept + slope * xs[i])
        sse += residual * residual
        var dy = ys[i] - my
        sst += dy * dy

    var r2 = 0.0
    if not close_to(sst, 0.0):
        r2 = 1.0 - sse / sst
        if r2 < 0.0:
            r2 = 0.0

    var resid_sd = 0.0
    if n > 2:
        resid_sd = sqrt(sse / Float64(n - 2))

    return LinearFit(slope, intercept, n, r2, resid_sd)


def residual_sd_of(fit: LinearFit, xs: List[Float64], ys: List[Float64]) raises -> Float64:
    """The residual spread of a fit, recomputed from the data.

    Lets a caller who already has `LinearFit` recover the number without
    redoing the regression, and doubles as a way to check that a fit belongs
    to the data in hand.
    """
    var n = len(xs)
    if n != len(ys):
        raise "residual_sd_of: inputs must be the same length"
    if n <= 2:
        raise "residual_sd_of: need at least three observations"
    var sse = 0.0
    for i in range(n):
        var residual = ys[i] - fit.predict(xs[i])
        sse += residual * residual
    return sqrt(sse / Float64(n - 2))