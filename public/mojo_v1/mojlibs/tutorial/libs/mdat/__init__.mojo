# __init__.mojo — the public API of the `mdat` package.
#
# Three commitments shape this surface, and each one exists to stop a
# specific class of quiet failure:
#
#   1. **A missing value is never a zero.** NaN is the marker throughout,
#      because it is the only value that propagates through arithmetic as
#      itself. Everything that consumes a series either handles NaN or
#      refuses it.
#   2. **Cleaning reports, it does not clean.** Every routine in `clean`
#      returns a `CleaningReport` describing what it would change. Deciding
#      to drop a customer is a business decision, and a library has no
#      standing to make it silently.
#   3. **Resampling states what it invented.** A `ResampleReport` carries the
#      count of forward-filled points, so a series that is 40% interpolated
#      cannot be mistaken for one that is observed.

# ── series ──────────────────────────────────────────────────────────────────
from .series import Series
from .series import gap_report
from .series import max_gap
from .series import is_regular
from .series import index_range
from .series import slice
from .series import resample
from .series import moving_average
from .series import moving_std
from .series import differences
from .series import pct_change
from .series import zscore
from .series import ResampleReport

# ── clean ───────────────────────────────────────────────────────────────────
from .clean import CleaningReport
from .clean import missing_count
from .clean import index_of_missing
from .clean import complete_cases
from .clean import find_outliers
from .clean import median_of
from .clean import impute_linear
from .clean import drop_missing
from .clean import winsorize
from .clean import quantile_of
from .clean import dedupe_consecutive
from .clean import normalize_min_max
from .clean import summarize_cleanliness

# ── metrics ─────────────────────────────────────────────────────────────────
from .metrics import coverage
from .metrics import level_mean
from .metrics import level_median
from .metrics import level_trimmed_mean
from .metrics import spread_std
from .metrics import spread_mad
from .metrics import coefficient_of_variation
from .metrics import percentiles
from .metrics import interquartile_range
from .metrics import skewness
from .metrics import trend
from .metrics import growth_rate
from .metrics import index_to_base
from .metrics import errors
from .metrics import ErrorReport
from .metrics import TrendReport

comptime VERSION = "0.1.0"
comptime PACKAGE_NAME = "mdat"