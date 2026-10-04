# __init__.mojo — the public API of the `geomatics` package.
#
# Surveying libraries are where a sloppy API does the most damage, because
# the outputs end up in drawings, legal boundaries and coordinate databases
# where a wrong number is worse than no number. Three rules shaped this
# surface:
#
#   1. Angles always carry their unit in the name (`*_deg`, `_rad`).
#   2. Coordinates are stored in degrees; conversion happens at the edge.
#   3. Judgement calls return a *report*, they do not silently adjust. What
#      to do about an unacceptable traverse depends on ground conditions the
#      library cannot see.

# ── geodesy ────────────────────────────────────────────────────────────────
from .geodesy import LatLon
from .geodesy import EnuFrame
from .geodesy import haversine_m
from .geodesy import geodesic_m
from .geodesy import bearing_deg
from .geodesy import midpoint
from .geodesy import normalize_lon
from .geodesy import is_valid_lat
from .geodesy import is_valid_lon
from .geodesy import validate
from .geodesy import forward_azimuth
from .geodesy import back_azimuth
from .geodesy import EARTH_A
from .geodesy import EARTH_B
from .geodesy import EARTH_R

# ── traverse ───────────────────────────────────────────────────────────────
from .traverse import Course
from .traverse import TraverseReport
from .traverse import check_traverse
from .traverse import bowditch_adjust
from .traverse import station_positions
from .traverse import angular_misclosure
from .traverse import angular_tolerance
from .traverse import traverse_closure_error
from .traverse import perimeter
from .traverse import sum_latitudes
from .traverse import sum_departures

# ── leveling ───────────────────────────────────────────────────────────────
from .leveling import LevelStation
from .leveling import LevelRun
from .leveling import check_run
from .leveling import reduced_levels
from .leveling import distribute_correction
from .leveling import allowable_misclosure_mm
from .leveling import total_rise
from .leveling import run_length_m

comptime VERSION = "0.1.0"
comptime PACKAGE_NAME = "geomatics"