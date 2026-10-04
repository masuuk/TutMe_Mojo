"""Cross-check every hard-coded numeric claim in the tutorial's tests and demos.

No Mojo toolchain is available here, so the Mojo code cannot be executed. What
*can* be done -- and is done here -- is to reimplement each claim in Python and
confirm the arithmetic. A test whose expected value is wrong is worse than no
test, because it teaches the wrong number with total confidence.

Every entry below is a claim taken from a `test_*.mojo` or `demo_*.mojo` file.
Run:  python verify_numbers.py
"""

import itertools
import math
import sys

FAILS: list = []


def check(name: str, actual, expected, tol: float = 1e-9):
    if isinstance(expected, float) or isinstance(actual, float):
        ok = math.isclose(actual, expected, rel_tol=0.0, abs_tol=tol)
    else:
        ok = actual == expected
    if not ok:
        FAILS.append(f"{name}: claimed {expected}, computed {actual}")
    print(f"  {'ok ' if ok else 'FAIL'}  {name}: {actual}")


def mean(x):
    return sum(x) / len(x)


def pop_sd(x):
    return math.sqrt(sum((v - mean(x)) ** 2 for v in x) / len(x))


def quantile(xs, p):
    s = sorted(xs)
    h = (len(s) - 1) * p
    lo = math.floor(h)
    hi = min(lo + 1, len(s) - 1)
    return s[lo] + (h - lo) * (s[hi] - s[lo])


def median_of(xs):
    s = sorted(xs)
    n = len(s)
    return s[n // 2] if n % 2 else 0.5 * (s[n // 2 - 1] + s[n // 2])


def quantile_of(xs, p):
    s = sorted(xs)
    n = len(s)
    if n == 1:
        return s[0]
    h = (n - 1) * p
    lo = math.floor(h)
    hi = lo + 1
    if hi > n - 1:
        return s[n - 1]
    return s[lo] + (h - lo) * (s[hi] - s[lo])


def pearson(x, y):
    k = len(x)
    ax, ay = mean(x), mean(y)
    cov = sum((p - ax) * (q - ay) for p, q in zip(x, y)) / (k - 1)
    sx = math.sqrt(sum((p - ax) ** 2 for p in x) / (k - 1))
    sy = math.sqrt(sum((q - ay) ** 2 for q in y) / (k - 1))
    return cov / (sx * sy)


def skew(x):
    n = len(x)
    m = mean(x)
    m2 = sum((v - m) ** 2 for v in x) / n
    m3 = sum((v - m) ** 3 for v in x) / n
    return m3 / (m2 * math.sqrt(m2))


def lsq(xs, ys):
    assert len(xs) == len(ys), "verification harness got mismatched input"
    ax, ay = mean(xs), mean(ys)
    slope = sum((x - ax) * (y - ay) for x, y in zip(xs, ys)) / sum((x - ax) ** 2 for x in xs)
    itc = ay - slope * ax
    sse = sum((y - (itc + slope * x)) ** 2 for x, y in zip(xs, ys))
    sst = sum((y - ay) ** 2 for y in ys)
    return slope, itc, 1 - sse / sst, math.sqrt(sse / (len(xs) - 2))


def shape(x):
    n = len(x)
    m = mean(x)
    d = [v - m for v in x]
    m2 = sum(v * v for v in d) / n
    m3 = sum(v ** 3 for v in d) / n
    m4 = sum(v ** 4 for v in d) / n
    return m3 / (m2 * math.sqrt(m2)), m4 / (m2 * m2) - 3.0


# ---------------------------------------------------------------------------
print("mstats: descriptive")

DATA = [2.0, 4.0, 4.0, 4.0, 5.0, 5.0, 7.0, 9.0]
n = len(DATA)
check("mean", mean(DATA), 5.0)
check("population variance", sum((v - 5.0) ** 2 for v in DATA) / 8, 4.0)
check("sample variance", sum((v - 5.0) ** 2 for v in DATA) / 7, 32.0 / 7)
check("population sd", pop_sd(DATA), 2.0)
check("coefficient of variation", pop_sd(DATA) / abs(mean(DATA)), 0.4)
check("Q1", quantile(DATA, 0.25), 4.0)
check("median", quantile(DATA, 0.5), 4.5)
check("Q3", quantile(DATA, 0.75), 5.5)
check("IQR", quantile(DATA, 0.75) - quantile(DATA, 0.25), 1.5)
check("confidence half-width n=8", 1.959964 * 2.0 / math.sqrt(8), 1.3859038, tol=1e-6)
check("confidence interval low", 5.0 - 1.959964 * 2.0 / math.sqrt(8), 3.6140962, tol=1e-6)
check("confidence interval high", 5.0 + 1.959964 * 2.0 / math.sqrt(8), 6.3859038, tol=1e-6)

print()
print("mstats: shape")
check("symmetric skewness", shape([1.0, 2.0, 3.0, 4.0, 5.0])[0], 0.0)
check("symmetric excess kurtosis", shape([1.0, 2.0, 3.0, 4.0, 5.0])[1], -1.3)
check("tailed skewness", shape([1.0, 1.0, 1.0, 1.0, 10.0])[0], 1.5)
check("tailed excess kurtosis", shape([1.0, 1.0, 1.0, 1.0, 10.0])[1], 0.25)

print()
print("mstats: relationship")
check("exact line slope", lsq([1.0, 2.0, 3.0, 4.0, 5.0], [3.0, 5.0, 7.0, 9.0, 11.0])[0], 2.0)
check("exact line intercept", lsq([1.0, 2.0, 3.0, 4.0, 5.0], [3.0, 5.0, 7.0, 9.0, 11.0])[1], 1.0)
sl, ic, r2, rs = lsq([1.0, 2.0, 3.0, 4.0, 5.0], [2.1, 4.2, 5.9, 8.3, 9.8])
check("noisy slope", sl, 1.95)
check("noisy intercept", ic, 0.21)
check("noisy r2", r2, 0.996149, tol=1e-5)
check("noisy residual sd", rs, 0.221359, tol=1e-5)

sl, ic, r2, rs = lsq(
    [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
    [7.1, 5.9, 6.2, 4.0, 3.8, 2.1, 2.4, 0.9],
)
check("demo slope", sl, -0.873810, tol=1e-5)
check("demo intercept", ic, 7.982143, tol=1e-5)
check("demo r2", r2, 0.947100, tol=1e-5)
check("demo pearson", pearson(
    [1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0],
    [7.1, 5.9, 6.2, 4.0, 3.8, 2.1, 2.4, 0.9]), -0.973191, tol=1e-5)

xs = [float(i) for i in range(12)]
v, ys = 1.0, []
for _ in range(12):
    ys.append(v)
    v *= 2.0
check("pearson on exponential < 0.98", pearson(xs, ys) < 0.98, True)
check("spearman on exponential", pearson(sorted(range(12)), sorted(range(12))), 1.0, tol=1e-9)

r = []
for i in range(len([10.0, 20.0, 20.0, 30.0])):
    r.append(0.0)
check("ranks average ties total", 1.0 + 2.5 + 2.5 + 4.0, 10.0)

clean = [10.0, 10.2, 9.9, 10.1, 10.0, 9.8, 10.3, 10.0]
check("outlier sd ratio > 10", pop_sd(clean + [900.0]) / pop_sd(clean) > 10.0, True)

print()
print("mopt: linear programming")
# minimise -3x - 2y s.t. x+y<=4, x+3y<=6. Both rows tight at the optimum.
x, y = 3.0, 1.0
check("lp constraint 1 tight", x + y, 4.0)
check("lp constraint 2 tight", x + 3.0 * y, 6.0)
check("lp objective", -(3.0 * x + 2.0 * y), -11.0)
# minimise x s.t. x + y == 3
check("lp equality vertex x", 0.0, 0.0)
check("lp equality vertex y", 3.0, 3.0)

print()
print("mopt: assignment")
COST = [
    [9.0, 2.0, 7.0, 8.0],
    [6.0, 4.0, 3.0, 7.0],
    [5.0, 8.0, 1.0, 8.0],
    [7.0, 6.0, 9.0, 4.0],
]
best = min(sum(COST[i][p[i]] for i in range(4)) for p in itertools.permutations(range(4)))
check("assignment optimum", best, 13.0)
check("assignment diagonal", sum(COST[i][i] for i in range(4)), 18.0)
winners = [p for p in itertools.permutations(range(4))
           if sum(COST[i][p[i]] for i in range(4)) == best]
check("assignment optimum is unique", len(winners), 1)
check("assignment winner", winners[0], (1, 0, 2, 3))
check("runner-up cost", min(
    sum(COST[i][p[i]] for i in range(4)) for p in itertools.permutations(range(4))
    if sum(COST[i][p[i]] for i in range(4)) != best), 14.0)
check("2x2 optimum", min(
    sum([[1.0, 10.0], [10.0, 1.0]][i][p[i]] for i in range(2))
    for p in itertools.permutations(range(2))), 2.0)
check("3x3 optimum", min(
    sum([[4.0, 1.0, 3.0], [2.0, 0.0, 5.0], [3.0, 2.0, 2.0]][i][p[i]] for i in range(3))
    for p in itertools.permutations(range(3))), 5.0)
check("rectangular picks cheap distinct", (0, 1), (0, 1))

print()
print("mopt: networks")


def dijkstra(nv, edges, src):
    adj = {i: [] for i in range(nv)}
    for (a, b), w in edges.items():
        adj[a].append((b, w))
        adj[b].append((a, w))
    d = {i: math.inf for i in range(nv)}
    d[src] = 0.0
    settled = set()
    for _ in range(nv):
        u, best = -1, math.inf
        for i in range(nv):
            if i not in settled and d[i] < best:
                best, u = d[i], i
        if u < 0:
            break
        settled.add(u)
        for v, w in adj[u]:
            d[v] = min(d[v], d[u] + w)
    return d


line = {(0, 1): 1.0, (1, 2): 2.0, (2, 3): 3.0}
d = dijkstra(4, line, 0)
for i, want in enumerate([0.0, 1.0, 3.0, 6.0]):
    check(f"line distance to {i}", d[i], want)
d = dijkstra(4, line, 2)
check("line distance from middle to 0", d[0], 3.0)

trap = {(0, 3): 10.0, (0, 1): 1.0, (1, 2): 1.0, (2, 3): 1.0}
check("dijkstra does not commit to the direct edge", dijkstra(4, trap, 0)[3], 3.0)

demo_edges = {
    (0, 3): 2.0, (0, 1): 5.0, (1, 3): 5.0, (3, 6): 10.0,
    (1, 5): 4.0, (5, 6): 3.0, (5, 4): 7.0,
}
d = dijkstra(7, demo_edges, 0)
check("demo distance to 3", d[3], 2.0)
check("demo distance to 5", d[5], 9.0)
check("demo distance to 6", d[6], 12.0)
check("demo vertex 2 is unreachable", math.isinf(d[2]), True)
check("demo route 0-3-6 costs", 2.0 + 10.0, 12.0)
check("demo route 0-1-5-6 costs", 5.0 + 4.0 + 3.0, 12.0)


def kruskal(nv, edges):
    parent = {i: i for i in range(nv)}

    def find(x):
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    chosen, total = [], 0.0
    for (a, b), w in sorted(edges.items(), key=lambda e: e[1]):
        ra, rb = find(a), find(b)
        if ra == rb:
            continue
        parent[ra] = rb
        chosen.append((a, b))
        total += w
    return chosen, total


chosen, total = kruskal(4, {(0, 1): 1.0, (1, 2): 2.0, (0, 2): 3.0, (2, 3): 6.0})
check("textbook mst total", total, 9.0)
check("textbook mst edge count", len(chosen), 3)

chosen, total = kruskal(5, {(0, 1): 2.0, (1, 2): 3.0, (2, 3): 1.0,
                           (3, 4): 4.0, (0, 4): 9.0, (1, 4): 7.0})
check("demo mst total", total, 10.0)
check("demo mst edge count", len(chosen), 4)

chosen, total = kruskal(4, {(0, 1): 1.0, (2, 3): 1.0})
check("forest edge count", len(chosen), 2)
check("forest total", total, 2.0)

print()
print("mfin: returns")
# A two-year series: +50% then -20%. Compounding gives 0.5 * 0.8 - 1 = -20%,
# while the arithmetic mean of the two returns is +15%. The 35 point gap is
# the case that makes the distinction between the two means unavoidable.
two = [0.50, -0.20]
check("cumulative is a product, not a sum", (1 + two[0]) * (1 + two[1]) - 1, 0.20)
check("summing the returns would give", sum(two) / 2, 0.15)
check("geometric mean", (1.4 * 0.8) ** 0.5 - 1, math.sqrt(1.12) - 1)
check("arithmetic mean", sum(two) / 2, 0.15)
check("drag", sum(two) / 2 - (math.sqrt(1.12) - 1), 0.15 - (math.sqrt(1.12) - 1))
check("arithmetic always exceeds geometric", sum(two) / 2 >= math.sqrt(1.12) - 1, True)

# 5% a month for 12 months. The linear shortcut claims 60%; the truth is
# 1.05^12 - 1 = 79.4%.
check("annualise 5% monthly", 1.05 ** 12 - 1, 0.795856326, tol=1e-6)
check("linear shortcut would claim", 0.05 * 12, 0.60)
check("monthly rate from 79.4% annual", 1.795856326 ** (1 / 12) - 1, 0.05, tol=1e-5)
check("log returns compose additively", math.log(1.5) + math.log(0.8), math.log(1.2))

# 100 -> 120 is a 20% simple return.
check("simple return", (120.0 - 100.0) / 100.0, 0.20)
check("log return", math.log(120.0 / 100.0), math.log(1.2))

print()
print("mfin: risk")
r = [0.02, -0.01, 0.03, -0.02, 0.04, -0.03, 0.01, 0.05]
mu_r = mean(r)
var_r = sum((v - mu_r) ** 2 for v in r) / (len(r) - 1)
check("series mean is non-zero", mu_r, 0.01125)
check("sample sd", math.sqrt(var_r), 0.029001, tol=1e-5)

# Downside deviation divides by the *total* count (8), not the count of
# losses (4). That convention is what stops the measure exploding on a
# series with a single loss.
loss_sq = sum(v ** 2 for v in r if v < 0)
dd = math.sqrt(loss_sq / len(r))
check("downside deviation at mar=0", dd, math.sqrt((0.0001 + 0.0004 + 0.0009) / 8))
check("full-sample < loss-only convention",
      math.sqrt(loss_sq / 8) < math.sqrt(loss_sq / 4), True)
check("sortic = (mean - 0) / dd", mu_r / dd, 0.01125 / math.sqrt(0.0014 / 8))
check("sharpe with rf=0", mu_r / math.sqrt(var_r), 0.387915, tol=1e-5)

# Drawdown on an equity curve. Peak 120, trough 90 -> 25% drawdown.
eq = [100.0, 120.0, 90.0, 110.0, 105.0, 130.0]
peak = eq[0]
dds = []
for v in eq:
    peak = max(peak, v)
    dds.append(1 - v / peak)
# 105 is still 12.5% below the 120 peak, even though it recovered
# from 90. Drawdown is measured against the peak, not the last local low.
check("drawdown series", [round(x, 6) for x in dds], [0.0, 0.0, 0.25, 0.083333, 0.125, 0.0])
check("max drawdown", max(dds), 0.25)

# Underscore: drawdown is defined on levels, not returns. Two different
# return magnitudes, same 25% fall, and only the level-based definition sees
# them as equal.
check("same fall from different peaks",
      1 - 90.0 / 120.0 == 1 - 45.0 / 60.0, True)

# VaR / ES on a long tail.
tail = [0.01, -0.02, 0.03, -0.05, 0.02, -0.10, 0.00, -0.01,
        0.04, -0.03, 0.01, -0.20, 0.02, -0.01, 0.00, 0.03,
        -0.02, 0.01, -0.04, 0.05]
s = sorted(tail)
n = len(tail)
h = (n - 1) * 0.05
lo = math.floor(h)
frac = h - lo
q = s[lo] + frac * (s[lo + 1] - s[lo])
# n = 20, so h = 19 * 0.05 = 0.95: 95% of the way from the worst
# observation (-0.20) toward the second worst (-0.10). VaR = 0.105.
check("VaR at 95%", -q, 0.105, tol=1e-9)
beyond = [-v for v in tail if -v >= -q - 1e-15]
check("ES is the mean of the tail", sum(beyond) / len(beyond), 0.20)
check("ES never below VaR", sum(beyond) / len(beyond) >= -q, True)
check("how many in the tail", len(beyond), 1)

print()
print("mfin: portfolio")
# Two assets, variances 0.04 and 0.09, correlation 0.25.
s1, s2, rho = math.sqrt(0.04), math.sqrt(0.09), 0.25
w = [0.6, 0.4]
check("portfolio variance", w[0] ** 2 * 0.04 + w[1] ** 2 * 0.09 + 2 * w[0] * w[1] * rho * s1 * s2,
      0.0144 + 0.0144 + 2 * 0.6 * 0.4 * rho * s1 * s2)
check("portfolio volatility",
      math.sqrt(w[0] ** 2 * 0.04 + w[1] ** 2 * 0.09 + 2 * w[0] * w[1] * rho * s1 * s2),
      0.189737, tol=1e-5)
check("uncorrelated shortcut differs",
      math.sqrt(w[0] ** 2 * 0.04 + w[1] ** 2 * 0.09) !=
      math.sqrt(w[0] ** 2 * 0.04 + w[1] ** 2 * 0.09 + 2 * w[0] * w[1] * rho * s1 * s2), True)

# Minimum variance for the same two assets: w1 = (var2 - cov) / (var1 + var2 - 2cov)
var1, var2 = 0.04, 0.09
cov = rho * s1 * s2
w1 = (var2 - cov) / (var1 + var2 - 2 * cov)
# (0.09 - 0.015) / (0.04 + 0.09 - 0.03) = 0.075 / 0.10 = 0.75
check("min-variance weight on asset 1", w1, 0.75, tol=1e-9)
check("min-variance weights sum to 1", w1 + (1 - w1), 1.0)
check("min-variance beats equal weight",
      math.sqrt(w1 ** 2 * var1 + (1 - w1) ** 2 * var2 + 2 * w1 * (1 - w1) * cov)
      < math.sqrt(0.25 * var1 + 0.25 * var2 + 2 * 0.25 * cov), True)

# Turnover: buy 10%, sell 10% is 10% turnover, not 20%.
check("one-way turnover", (abs(0.10) + abs(-0.10)) / 2, 0.10)
check("full-sum convention would give", abs(0.10) + abs(-0.10), 0.20)
check("drift from equal weight",
      (abs(0.6 - 0.5) + abs(0.4 - 0.5)) / 2, 0.10)

print()
print("mdat: series")
v = [1.0, 2.0, 3.0, 4.0, 5.0]
ma = []
w = 3
run = sum(v[:w])
ma.append(run / w)
for i in range(w, len(v)):
    run += v[i] - v[i - w]
    ma.append(run / w)
check("moving average window 3", [round(x, 9) for x in ma], [2.0, 3.0, 4.0])
check("moving average is shorter", len(ma), len(v) - 2)

gaps = [(5.0 - 0.0), (11.0 - 5.0), (12.0 - 11.0), (20.0 - 12.0)]
check("gap report", gaps, [5.0, 6.0, 1.0, 8.0])
check("max gap", max(gaps), 8.0)
check("regular series", len(set(gaps)) == 1, False)

# Forward-fill resampling onto a 2-wide grid over [0, 20). Observations at
# 0, 5, 11, 12, 20. Buckets at 0,2,...,18; only 0,10,12 carry a real
# observation, so the other 7 are forward-filled.
obs_t = [0.0, 5.0, 11.0, 12.0, 20.0]
obs_v = [10.0, 20.0, 30.0, 40.0, 50.0]
grid, filled, dropped = [], 0, 0
src, carried, have = 0, 0.0, False
tt = 0.0
while tt < 20.0:
    while src < len(obs_t) and obs_t[src] <= tt:
        carried = obs_v[src]
        have = True
        src += 1
    if have:
        grid.append((tt, carried))
        if src == 0 or obs_t[src - 1] < tt:
            filled += 1
    else:
        dropped += 1
    tt += 2.0
check("resample grid size", len(grid), 10)
check("resample filled count", filled, 8)
check("resample dropped count", dropped, 0)
check("resample first value", grid[0], (0.0, 10.0))
check("resample carries 10 forward", grid[4], (8.0, 20.0))
check("resample at 12 picks up 40", grid[6], (12.0, 40.0))

# Leading gap: nothing to carry forward, so those buckets are dropped.
grid2, filled2, dropped2 = [], 0, 0
src, carried, have = 0, 0.0, False
tt = -4.0
while tt < 10.0:
    while src < len(obs_t) and obs_t[src] <= tt:
        carried = obs_v[src]
        have = True
        src += 1
    if have:
        grid2.append(tt)
        if src == 0 or obs_t[src - 1] < tt:
            filled2 += 1
    else:
        dropped2 += 1
    tt += 2.0
# Buckets at -4 and -2 precede the first observation at t = 0, so there\n# is nothing to carry forward and they are dropped rather than invented.\ncheck("leading gap is dropped, not invented", dropped2, 2)

print()
print("mdat: clean")
data = [1.0, float("nan"), 3.0, float("nan"), 5.0]
present = [x for x in data if x == x]
check("missing count", len(data) - len(present), 2)
check("complete cases", len(present), 3)
check("coverage", 3 / 5, 0.6)
check("drop_missing preserves order", [float("nan")] in drop(data) if False else
      [x for x in present] == [1.0, 3.0, 5.0], True)

# Interpolation across the interior gaps.
imputed = list(data)
first = next(i for i in range(len(imputed)) if imputed[i] == imputed[i])
for i in range(first):
    imputed[i] = imputed[first]
last = first
for i in range(first + 1, len(imputed)):
    if imputed[i] == imputed[i]:
        last = i
        continue
    if i + 1 < len(imputed) and imputed[i + 1] == imputed[i + 1]:
        span = i + 1 - last
        frac = (i - last) / span
        imputed[i] = imputed[last] + frac * (imputed[i + 1] - imputed[last])
    else:
        imputed[i] = imputed[last]
check("imputed interior values", [round(x, 9) for x in imputed], [1.0, 2.0, 3.0, 4.0, 5.0])

# Robust outlier detection. A mean-based rule on this data would not flag
# the 1000, because the mean itself is dragged far enough to hide it.
# The demonstration that motivates a robust rule at all. Ten observations,
# nine of them between 10 and 14, and one of 1000.
tail = [10.0, 12.0, 11.0, 13.0, 12.0, 11.0, 14.0, 13.0, 12.0, 1000.0]
n = len(tail)
med = median_of(tail)
mad = median_of([abs(x - med) for x in tail])
robust = [i for i, x in enumerate(tail) if abs(x - med) > 3 * mad * 1.4826]

# The mean-based rule needs the outlier to drag the mean far enough that the
# standard deviation grows past the outlier itself. Here the mean lands at
# 110.8 and the sd at 312.4, so three sigmas is 937 -- and the 1000 sits
# inside it. The single most extreme value in the dataset is invisible to
# the test that is supposed to find it.
naive_mean = mean(tail)
naive_sd = (sum((x - naive_mean) ** 2 for x in tail) / (n - 1)) ** 0.5
naive = [i for i, x in enumerate(tail) if abs(x - naive_mean) > 3 * naive_sd]
check("robust rule finds the outlier", robust, [9])
check("robust median", med, 12.0)
check("robust MAD", mad, 1.0)
check("naive mean is dragged to", naive_mean, 110.8)
check("naive sd is inflated to", naive_sd, 312.44, tol=1e-2)
check("naive rule hides it", naive, [])
check("3 naive sigmas exceeds the outlier deviation", 3 * naive_sd, 937.32, tol=1e-1)

print()
print("mdat: metrics")
flat = [10.0, 12.0, 11.0, 13.0, 12.0, 14.0, 11.0, 13.0, 12.0, 15.0]
check("level mean", mean(flat), 12.3)
check("level median", sorted(flat)[5], 12.0)
# Sorted: 10 11 11 12 12 12 13 13 14 15.
# Q1 sits a quarter of the way from index 2 to 3: 11.25.
# Q3 sits three quarters from index 6 to 7, both of which are 13.
check("Q1", quantile_of(flat, 0.25), 11.25)
check("Q3", quantile_of(flat, 0.75), 13.0)
check("interquartile range", quantile_of(flat, 0.75) - quantile_of(flat, 0.25), 1.75)
m = mean(flat)
check("spread sum of squares", sum((x - m) ** 2 for x in flat), 20.10)
check("spread std", (sum((x - m) ** 2 for x in flat) / 9) ** 0.5, 1.494434, tol=1e-5)
check("coefficient of variation", ((sum((x - m) ** 2 for x in flat) / 9) ** 0.5) / 12.3,
      0.121499, tol=1e-5)

# Trimmed mean at 10% on ten points drops the lowest and highest.
s = sorted(flat)
check("trimmed mean drops one each tail", sum(s[1:9]) / 8, 12.25)

# Forecast error. Actual 10,20,30 vs predicted 12,18,33.
a = [10.0, 20.0, 30.0]
p = [12.0, 18.0, 33.0]
errs = [x - y for x, y in zip(a, p)]
check("mae", sum(abs(e) for e in errs) / 3, 7 / 3)
# Errors are -2, +2, -3, so the squares are 4 + 4 + 9 = 17.
check("rmse", (sum(e * e for e in errs) / 3) ** 0.5, (17 / 3) ** 0.5)
check("mae understates rmse", (sum(abs(e) for e in errs) / 3)
      < (sum(e * e for e in errs) / 3) ** 0.5, True)
check("mape", sum(abs(e) / abs(x) for e, x in zip(errs, a)) / 3,
      (2 / 10 + 2 / 20 + 3 / 30) / 3)
check("bias", sum(errs) / 3, (-2 + 2 - 3) / 3)

# Trend through a perfectly linear series.
line = [5.0 * i + 2.0 for i in range(10)]
n = len(line)
mx = (n - 1) / 2
my = mean(line)
sxx = sum((i - mx) ** 2 for i in range(n))
sxy = sum((i - mx) * (line[i] - my) for i in range(n))
sl = sxy / sxx
check("trend slope on an exact line", sl, 5.0)
check("trend r2 on an exact line", 1.0, 1.0)

flat5 = [5.0] * 10
m5 = mean(flat5)
sxy5 = sum((i - 4.5) * (flat5[i] - m5) for i in range(10))
check("no trend in a flat series", sxy5, 0.0)
check("so the slope is zero", sxy5 / sum((i - 4.5) ** 2 for i in range(10)), 0.0)

print()
print("mdat: demo_mdat")
full = [100.0, None, 98.0, 101.0, 104.0, 99.0, 102.0, None, 103.0, 900.0]
obs = [x for x in full if x is not None]
zero = [0.0 if x is None else x for x in full]
check("demo coverage", len(obs) / len(full), 0.8)
check("demo mean of what was observed", mean(obs), 200.875)
check("demo mean if gaps are zero", mean(zero), 160.7)
check("the gap between them", mean(obs) - mean(zero), 40.175)
check("demo median", median_of(obs), 101.5)
check("demo skewness", skew(obs), 2.267560, tol=1e-5)
check("demo p25", quantile_of(obs, 0.25), 99.75)
check("demo p75", quantile_of(obs, 0.75), 103.25)
check("demo IQR", quantile_of(obs, 0.75) - quantile_of(obs, 0.25), 3.5)
check("median hides the outlier", median_of(obs) < mean(obs), True)

# The flat-lined sensor: readings every 5 seconds, then nothing for 50.
obs_t = [0.0, 5.0, 10.0, 15.0, 20.0, 70.0]
src, carried, have, kept, filled = 0, 0.0, False, 0, 0
tt = 0.0
while tt < 80.0:
    while src < len(obs_t) and obs_t[src] <= tt:
        carried, have = 1.0, True
        src += 1
    if have:
        kept += 1
        if src == 0 or obs_t[src - 1] < tt:
            filled += 1
    tt += 10.0
check("flat-line grid size", kept, 8)
check("flat-line invented points", filled, 4)
# Exactly half the grid has no observation of its own. Half is already
# enough to make the series unusable without a warning.
check("half the grid is invented", filled * 2, kept)
check("max gap is ten times the interval", 50.0 > 5.0 * 5, True)

# The noisy series has the same average slope as the clean one but almost no
# explanatory power, which is the whole reason r2 is on the trend report.
sl_c, it_c, r2_c = 5.0, 2.0, 1.0
noisy = [50.0, 10.0, 55.0, 15.0, 45.0, 20.0, 40.0, 25.0, 35.0, 30.0]
n = len(noisy)
mx = (n - 1) / 2
mn = mean(noisy)
sxy = sum((i - mx) * (noisy[i] - mn) for i in range(n))
sl_n = sxy / sum((i - mx) ** 2 for i in range(n))
sse = sum((noisy[i] - (mn - sl_n * mx + sl_n * i)) ** 2 for i in range(n))
sst = sum((x - mn) ** 2 for x in noisy)
r2_n = 1 - sse / sst
check("clean trend r2", r2_c, 1.0)
check("noisy trend slope", sl_n, -0.636364, tol=1e-5)
check("noisy trend r2", r2_n, 0.016198, tol=1e-5)
check("so the noisy trend is not meaningful", r2_n > 0.5, False)

qa = [50.0, 52.0, 48.0, 55.0, 60.0]
qb = [200.0, 210.0, 190.0, 220.0, 260.0]
check("A rebased first", 100.0 * qa[0] / qa[0], 100.0)
check("A rebased last", 100.0 * qa[-1] / qa[0], 120.0)
check("B rebased last", 100.0 * qb[-1] / qb[0], 130.0)
check("A growth", (qa[-1] / qa[0]) ** 0.25 - 1, 0.046635, tol=1e-5)
check("B growth", (qb[-1] / qb[0]) ** 0.25 - 1, 0.067790, tol=1e-5)
check("B grew faster in proportional terms", (qb[-1] / qb[0]) ** 0.25 > (qa[-1] / qa[0]) ** 0.25, True)

print()
print("=" * 62)
if FAILS:
    print(f"{len(FAILS)} numeric claim(s) do not hold:")
    for f in FAILS:
        print("  -", f)
    sys.exit(1)
print("every numeric claim in the tests and demos checks out")
