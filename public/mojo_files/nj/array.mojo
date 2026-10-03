# ============================================================================
#  nj -- a very small NumPy-shaped array library for Mojo 1.x
#
#  nj/array.mojo
#
#  This exists to make one specific program -- a three-layer neural network
#  written out by hand -- read like the NumPy version of the same program.
#  It is NOT a NumPy replacement. It covers roughly a dozen operations and
#  nothing else; see the "Scope" table on the page.
#
#  Everything is 2D. There is no n-dimensional code here, no strides, no
#  views, no broadcasting between two differently-shaped arrays, and no
#  dtype support. What there is:
#
#      nj.array([[1, 0, 1], [0, 1, 1]])   2D from a nested literal
#      x.T()                              transpose
#      x.dot(y)                           matrix product
#      len(x)                             row count
#      x[i]                               row i, as a 1 x cols matrix
#      x * y, x - y, x - s, 2.0 * x       element-wise, with scalar broadcast
#      x ** 2                             element-wise power
#      x > 0                              1.0 where true, 0.0 where false
#      x -= y                             in-place subtract
#      nj.sum(x)                          add up every entry
#      nj.zeros(r, c)                     all zeros
# ============================================================================
from collections import List


@fieldwise_init
struct ndarray(Copyable, Movable):
    """A dense 2D matrix of Float64, row-major, in a flat List.

    One Float64 type only. NumPy would infer an integer dtype from
    nj.array([[1, 0], [0, 1]]) and then promote on the first float it met;
    Mojo will not silently mix Int and Float64, so the array() overloads
    below convert once, at construction, and everything downstream is
    Float64.
    """

    var rows: Int
    var cols: Int
    var data: List[Float64]

    # ---------------------------------------------------------- accessors --

    def get(self, r: Int, c: Int) -> Float64:
        return self.data[r * self.cols + c]

    def set(mut self, r: Int, c: Int, v: Float64):
        self.data[r * self.cols + c] = v

    def __len__(self) -> Int:
        """len(x) is the row count, the way numpy reports a matrix."""
        return self.rows

    def __getitem__(self, i: Int) -> ndarray:
        """Row i as a 1 x cols matrix.

        numpy needs tells[i:i+1] to get a row; a plain index here already
        returns a matrix, so the slice is unnecessary.
        """
        var out = ndarray(1, self.cols, List[Float64]())
        for c in range(self.cols):
            out.data.append(self.data[i * self.cols + c])
        return out^

    def T(self) -> ndarray:
        """Transpose. numpy spells this as the attribute x.T; a method keeps
        it uniform with the rest of this library."""
        var out = ndarray(self.cols, self.rows, List[Float64]())
        for r in range(self.rows):
            for c in range(self.cols):
                out.data.append(self.data[r * self.cols + c])
        return out^

    @staticmethod
    def zeros(rows: Int, cols: Int) -> ndarray:
        var out = ndarray(rows, cols, List[Float64]())
        for _ in range(rows * cols):
            out.data.append(0.0)
        return out^

    def copy(self) -> ndarray:
        var out = ndarray(self.rows, self.cols, List[Float64]())
        for i in range(len(self.data)):
            out.data.append(self.data[i])
        return out^

    def __str__(self) -> String:
        """Rows of space-separated numbers, so print(x) shows the matrix.

        This is what lets the prediction loop end with a single
        print(t"{tells[i]} -> {shown}") instead of hand-formatting cells.
        """
        var text = String("")
        for r in range(self.rows):
            if r > 0:
                text += "\n"
            for c in range(self.cols):
                if c > 0:
                    text += " "
                text += _fmt(self.get(r, c))
        return text^

    # ------------------------------------------------------------- algebra --

    def dot(self, other: ndarray) -> ndarray:
        """Matrix product, a plain triple loop.

        Shapes are checked because numpy raises a ValueError on a bad dot
        and silently producing garbage is worse than stopping.
        """
        if self.cols != other.rows:
            raise Error(
                String("dot: ") + String(self.rows) + "x" +
                String(self.cols) + " cannot dot " + String(other.rows) + "x" +
                String(other.cols)
            )
        var out = ndarray(self.rows, other.cols, List[Float64]())
        for i in range(self.rows):
            for j in range(other.cols):
                var acc = 0.0
                for k in range(self.cols):
                    acc += self.data[i * self.cols + k] * other.data[k * other.cols + j]
                out.data.append(acc)
        return out^

    def _same_shape(self, other: ndarray, who: String) -> Bool:
        if self.rows != other.rows or self.cols != other.cols:
            raise Error(
                who + ": shapes " + String(self.rows) + "x" + String(self.cols) +
                " and " + String(other.rows) + "x" + String(other.cols) +
                " do not match"
            )
        return True

    def __mul__(self, other: ndarray) -> ndarray:
        """Element-wise product, the * numpy applies to two arrays."""
        _ = self._same_shape(other, "*")
        var out = ndarray(self.rows, self.cols, List[Float64]())
        for i in range(len(self.data)):
            out.data.append(self.data[i] * other.data[i])
        return out^

    def __rmul__(self, s: Float64) -> ndarray:
        """2.0 * x, so a scalar can sit on the left."""
        var out = ndarray(self.rows, self.cols, List[Float64]())
        for i in range(len(self.data)):
            out.data.append(s * self.data[i])
        return out^

    def __sub__(self, other: ndarray) -> ndarray:
        _ = self._same_shape(other, "-")
        var out = ndarray(self.rows, self.cols, List[Float64]())
        for i in range(len(self.data)):
            out.data.append(self.data[i] - other.data[i])
        return out^

    def __sub__(self, s: Float64) -> ndarray:
        var out = ndarray(self.rows, self.cols, List[Float64]())
        for i in range(len(self.data)):
            out.data.append(self.data[i] - s)
        return out^

    def __isub__(mut self, other: ndarray):
        """x -= y, modifying x in place and returning nothing."""
        _ = self._same_shape(other, "-=")
        for i in range(len(self.data)):
            self.data[i] -= other.data[i]

    def __pow__(self, e: Int) -> ndarray:
        """x ** 2, element-wise. numpy allows this; so does nj."""
        var out = ndarray(self.rows, self.cols, List[Float64]())
        for i in range(len(self.data)):
            out.data.append(self.data[i] ** Float64(e))
        return out^

    def __gt__(self, s: Float64) -> ndarray:
        """x > 0 yields 1.0 and 0.0, not a Bool array.

        This is what makes numpy's one-line ReLU work: (x > 0) * x. A
        Bool here would need a dtype system nj does not have.
        """
        var out = ndarray(self.rows, self.cols, List[Float64]())
        for i in range(len(self.data)):
            out.data.append(1.0 if self.data[i] > s else 0.0)
        return out^


# --------------------------------------------------------- constructors ---

# nj holds Float64 and only Float64, so a whole number like 1 would otherwise
# print as 1.0. numpy would have kept that cell as an int and printed 1. Trim
# it here so the output of nn_nj.mojo lines up with the NumPy original.
@always_inline
def _fmt(v: Float64) -> String:
    if v == Float64(Int(v)):
        return String(Int(v))
    return String(v)


def array(data: List[List[Int]]) -> ndarray:
    """nj.array([[1, 0, 1], [0, 1, 1]]) with integer literals."""
    var rows = len(data)
    var cols = len(data[0])
    var out = ndarray(rows, cols, List[Float64]())
    for r in range(rows):
        for c in range(cols):
            out.data.append(Float64(data[r][c]))
    return out^


def array(data: List[List[Float64]]) -> ndarray:
    """nj.array([[1.0, 0.0]]) with float literals."""
    var rows = len(data)
    var cols = len(data[0])
    var out = ndarray(rows, cols, List[Float64]())
    for r in range(rows):
        for c in range(cols):
            out.data.append(data[r][c])
    return out^


def zeros(rows: Int, cols: Int) -> ndarray:
    return ndarray.zeros(rows, cols)^


def sum(x: ndarray) -> Float64:
    """nj.sum(x) adds up every entry, the way numpy's np.sum does."""
    var acc = 0.0
    for i in range(len(x.data)):
        acc += x.data[i]
    return acc
