# ============================================================================
#  A 3-4-1 neural network in Mojo 1.x — forward, backprop, SGD
#
#  This is the Mojo 1.x port of nn_mojo.py (NumPy). It learns the same
#  thing: a three-input pattern where the first two inputs are XOR'd and
#  the third input is a constant 1.
#
#  Run with:   mojo nn_mojo.mojo
#
#  What changed in the port, and why:
#
#    * No NumPy. Mojo 1.x's prelude ships no tensor or matrix type, so
#      there is a small row-major Matrix struct below and the three
#      matrix products are written out by hand.
#
#    * Examples are COLUMNS. NumPy slices tells[i:i+1] to pull a 1x3
#      ROW out of a 4x3 array; tells.column(i) here pulls a 3x1 COLUMN
#      out of a 3x4 one. The weight matrices are stored transposed
#      relative to the original so the arithmetic still lines up.
#
#    * Seeded by a hand-rolled XorShift instead of np.random.seed. A
#      fixed seed then gives the same network on every run, on every
#      platform.
#
#    * ReLU's derivative is applied to the hidden PRE-activation, which
#      is the textbook formulation. The original applies relu2deriv to
#      the post-activation; the mask is the same either way, because
#      relu(x) > 0 exactly when x > 0.
#
#    * Because the generator is a different one, the weights -- and so
#      the loss curve -- will not match the NumPy run digit for digit.
#      Both converge; they just take their own path there.
# ============================================================================
from std.math import floor

# ------------------------------------------------------------------ PRNG ---
struct XorShift:
    """A tiny deterministic pseudo-random generator (xorshift64).

    Implemented by hand so that every run of this file is reproducible:
    the same seed always produces the same network and the same results.
    """

    var state: UInt64

    def __init__(out self, seed: UInt64):
        self.state = seed
        if self.state == 0:
            self.state = 88172645463325252
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
        # Pull the top 53 bits and scale them into [0, 1).
        return Float64(self.next_u64() >> 11) / Float64(1 << 53)


# ---------------------------------------------------------------- Matrix ---
struct Matrix(Copyable, Movable):
    """A dense matrix stored row-major in a flat List[Float64].

    Convention used throughout: an example is a COLUMN. So X is
    (features x m), Y is (1 x m), W0_1 is (features x hidden) and
    W1_2 is (hidden x 1).
    """

    var rows: Int
    var cols: Int
    var data: List[Float64]

    def __init__(out self, rows: Int, cols: Int):
        self.rows = rows
        self.cols = cols
        self.data = List[Float64]()
        for _ in range(rows * cols):
            self.data.append(0.0)

    def __init__(out self, *, copy: Self):
        self.rows = copy.rows
        self.cols = copy.cols
        self.data = List[Float64]()
        for i in range(len(copy.data)):
            self.data.append(copy.data[i])

    def get(self, r: Int, c: Int) -> Float64:
        return self.data[r * self.cols + c]

    def set(mut self, r: Int, c: Int, v: Float64):
        self.data[r * self.cols + c] = v

    def column(self, j: Int) -> Matrix:
        """Pull column j out as a rows x 1 matrix -- numpy's tells[i:i+1]."""
        var out = Matrix(self.rows, 1)
        for r in range(self.rows):
            out.data[r] = self.data[r * self.cols + j]
        return out^

    @staticmethod
    def zeros(rows: Int, cols: Int) -> Matrix:
        return Matrix(rows, cols)

    @staticmethod
    def rand_small(rows: Int, cols: Int, mut rng: XorShift, scale: Float64) -> Matrix:
        """Uniform entries in [-scale/2, +scale/2).

        Called with scale = 2.0 this is numpy's 2 * random() - 1.
        """
        var m = Matrix(rows, cols)
        for i in range(len(m.data)):
            m.data[i] = (rng.next_f64() - 0.5) * scale
        return m^

    def transpose(self) -> Matrix:
        var out = Matrix(self.cols, self.rows)
        for r in range(self.rows):
            for c in range(self.cols):
                out.data[c * self.rows + r] = self.data[r * self.cols + c]
        return out^

    def matmul(self, other: Matrix) -> Matrix:
        """self @ other, with a pure triple loop. No BLAS, no surprises."""
        var out = Matrix(self.rows, other.cols)
        for i in range(self.rows):
            for j in range(other.cols):
                var acc = 0.0
                for k in range(self.cols):
                    acc += self.data[i * self.cols + k] * other.data[k * other.cols + j]
                out.data[i * other.cols + j] = acc
        return out^

    def outer(self, other: Matrix) -> Matrix:
        """(n x 1) . (m x 1) read as the n x m product a @ b^T.

        This is what turns a column and a column into a full weight
        gradient, and it is why every step here is an outer product.
        """
        var out = Matrix(self.rows, other.rows)
        for i in range(self.rows):
            for j in range(other.rows):
                out.data[i * other.rows + j] = self.data[i] * other.data[j]
        return out^

    def mul(self, other: Matrix) -> Matrix:
        """Element-wise (Hadamard) product: same shape, entry by entry."""
        var out = Matrix(self.rows, self.cols)
        for i in range(len(out.data)):
            out.data[i] = self.data[i] * other.data[i]
        return out^

    def scalar_mul(self, factor: Float64) -> Matrix:
        var out = Matrix(self.rows, self.cols)
        for i in range(len(out.data)):
            out.data[i] = self.data[i] * factor
        return out^

    def sub(self, other: Matrix) -> Matrix:
        var out = Matrix(self.rows, self.cols)
        for i in range(len(out.data)):
            out.data[i] = self.data[i] - other.data[i]
        return out^


# ----------------------------------------------------------- activations ---
def relu(x: Float64) -> Float64:
    if x > 0.0:
        return x
    return 0.0

def relu_m(m: Matrix) -> Matrix:
    """ReLU applied to every entry."""
    var out = Matrix(m.rows, m.cols)
    for i in range(len(out.data)):
        out.data[i] = relu(m.data[i])
    return out^

def relu_mask(m: Matrix) -> Matrix:
    """ReLU derivative: 1.0 where the input was positive, else 0.0."""
    var out = Matrix(m.rows, m.cols)
    for i in range(len(out.data)):
        out.data[i] = 1.0 if m.data[i] > 0.0 else 0.0
    return out^


# ---------------------------------------------------------------- network ---
struct Net(Copyable, Movable):
    """A one-hidden-layer network, trained one example at a time.

    There are no bias terms, because the third input is a constant 1.0
    and is doing that job -- the same trick the NumPy version uses.
    """

    var W0_1: Matrix  # (n_in x hidden)
    var W1_2: Matrix  # (hidden x 1)
    var alpha: Float64

    def __init__(out self, n_in: Int, n_hidden: Int, mut rng: XorShift, alpha: Float64):
        self.alpha = alpha
        self.W0_1 = Matrix.rand_small(n_in, n_hidden, rng, 2.0)
        self.W1_2 = Matrix.rand_small(n_hidden, 1, rng, 2.0)

    def forward(self, x: Matrix) -> (Matrix, Matrix):
        """x is (n_in x 1). Returns (a1, z2) -- the hidden activation and
        the raw output, both before any weight update."""
        # z1 = W0_1^T @ x   ->  (hidden x 1)
        var z1 = self.W0_1.transpose().matmul(x)
        # a1 = relu(z1)
        var a1 = relu_m(z1)
        # z2 = W1_2^T @ a1  ->  (1 x 1)
        var z2 = self.W1_2.transpose().matmul(a1)
        return (a1^, z2^)

    def train_step(mut self, x: Matrix, target: Float64) -> Float64:
        """One forward pass, one backpropagation pass, one SGD step.
        Returns the squared error for this example."""
        # --- forward ------------------------------------------------------
        var z1 = self.W0_1.transpose().matmul(x)
        var a1 = relu_m(z1)
        var z2 = self.W1_2.transpose().matmul(a1)

        # --- how wrong were we --------------------------------------------
        var diff = z2.get(0, 0) - target
        var delta2 = Matrix.zeros(1, 1)
        delta2.set(0, 0, diff)

        # --- backpropagation ----------------------------------------------
        #   delta1 = (W1_2 @ delta2) * relu'(z1)
        #
        # The NumPy original writes this as
        #     layer_1_delta = layer_2_delta.dot(weights_1_2.T) * relu2deriv(layer_1)
        # which is the same product with the transpose on the other side,
        # and it is the element-wise multiply on the right that is
        # ReLU's derivative. Skip that multiply and the gradient leaks
        # through the dead units.
        var delta1 = self.W1_2.matmul(delta2).mul(relu_mask(z1))

        # --- update ---------------------------------------------------------
        # Both gradients are outer products: W1_2 moves along a1 by
        # delta2, and W0_1 moves along x by delta1.
        self.W1_2 = self.W1_2.sub(a1.outer(delta2).scalar_mul(self.alpha))
        self.W0_1 = self.W0_1.sub(x.outer(delta1).scalar_mul(self.alpha))

        return diff * diff


# ----------------------------------------------------------------- driver ---
def build_tells() -> Matrix:
    """3 x 4 -- one example per column, the transpose of the original's
    4 x 3 `tells` array. The third row is the constant bias input."""
    var t = Matrix.zeros(3, 4)
    t.set(0, 0, 1.0); t.set(0, 1, 0.0); t.set(0, 2, 0.0); t.set(0, 3, 1.0)
    t.set(1, 0, 0.0); t.set(1, 1, 1.0); t.set(1, 2, 0.0); t.set(1, 3, 1.0)
    t.set(2, 0, 1.0); t.set(2, 1, 1.0); t.set(2, 2, 1.0); t.set(2, 3, 1.0)
    return t^

def build_strike() -> Matrix:
    """1 x 4 -- one target per column."""
    var s = Matrix.zeros(1, 4)
    s.set(0, 0, 1.0)
    s.set(0, 1, 1.0)
    s.set(0, 2, 0.0)
    s.set(0, 3, 0.0)
    return s^


def main():
    # Hyper-parameters, identical to the NumPy original.
    var n_in = 3
    var n_hidden = 4
    var alpha = 0.2
    var epochs = 60
    var seed = UInt64(15)

    var tells = build_tells()
    var strike = build_strike()
    var rng = XorShift(seed=seed)
    var net = Net(n_in, n_hidden, rng, alpha)

    # Plain per-example SGD: no shuffling, one update per example.
    for epoch in range(epochs):
        var layer_2_error = 0.0
        for i in range(tells.cols):
            layer_2_error += net.train_step(tells.column(i), strike.get(0, i))
        # t-strings have no format specifiers, so round before printing
        if (epoch + 1) % 10 == 0:
            var shown = floor(layer_2_error * 1000000.0) / 1000000.0
            print(t"epoch {epoch + 1}  error = {shown}")

    print("Final predictions:")
    for i in range(tells.cols):
        var result = net.forward(tells.column(i))
        var shown = floor(result[1].get(0, 0) * 10000.0) / 10000.0
        print(t"[{tells.get(0, i)} {tells.get(1, i)} {tells.get(2, i)}] -> {shown}")
