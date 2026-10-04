# __init__.mojo — the public API of the `mphysics` package.
#
# Physics packages are strongest when they make the assumptions visible.
# The public surface below is intentionally small and descriptive: it names the
# physical model, not a long list of accidental helpers.

from .mechanics import force
from .mechanics import kinetic_energy
from .mechanics import momentum
from .mechanics import work
from .mechanics import orbital_speed

from .oscillation import angular_frequency
from .oscillation import frequency_from_period
from .oscillation import phase_from_cycles
from .oscillation import cycle_count

comptime VERSION = "0.1.0"
comptime PACKAGE_NAME = "mphysics"
