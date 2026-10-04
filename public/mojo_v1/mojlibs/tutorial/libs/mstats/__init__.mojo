# __init__.mojo — the public API of the `mstats` package.
#
# The organising rule for this package's surface: **every function that can
# produce a plausible but meaningless number refuses to.** Empty input,
# a length mismatch, zero variance, an out-of-range probability — all raise.
#
# A statistics library that returns a number in every situation is easy to
# use and impossible to trust. Raising is cheap; discovering three months
# later that a mean was computed over an empty slice is not.

# ── descriptive ────────────────────────────────────────────────────────────
from .descriptive import count
from .descriptive import sum
from .descriptive import sum_squared
from .descriptive import minimum
from .descriptive import maximum
from .descriptive import variance
from .descriptive import standard_deviation
from .descriptive import mean_absolute_deviation
from .descriptive import median_absolute_deviation
from .descriptive import coefficient_of_variation
from .descriptive import sorted_copy
from .descriptive import quantile
from .descriptive import median
from .descriptive import interquartile_range
from .descriptive import mode
from .descriptive import skewness
from .descriptive import excess_kurtosis
from .descriptive import summarize
from .descriptive import Summary

# ── probability ────────────────────────────────────────────────────────────
from .probability import erf
from .probability import normal_pdf
from .probability import normal_cdf
from .probability import standard_normal
from .probability import two_sided_p
from .probability import normal_quantile
from .probability import two_sided_z_for_p
from .probability import critical_z
from .probability import confidence_interval
from .probability import standardized
from .probability import probability_clamped
from .probability import log_normal_pdf

# ── relationship ───────────────────────────────────────────────────────────
from .relationship import covariance
from .relationship import pearson
from .relationship import r_squared
from .relationship import covariance_matrix_cols
from .relationship import ranks
from .relationship import spearman
from .relationship import least_squares
from .relationship import residual_sd_of
from .relationship import LinearFit

comptime VERSION = "0.1.0"
comptime PACKAGE_NAME = "mstats"