# ============================================================================
#  A 3-4-1 neural network in Mojo 1.x, written with nj
#
#  Run with:   mojo nn_nj.mojo
#
#  This is the same program as nn_mojo.mojo, but using the small nj library
#  in nj/ so the arithmetic reads the way the NumPy original reads.
#
#  It produces bit-identical results to nn_mojo.mojo at seed 15: the error
#  curve agrees to the last bit across all 60 epochs and the four predictions
#  match exactly. That is a measured result, not a guarantee. The two files
#  initialise their weights with formulas that differ only in rounding --
#
#      here      2.0 * u - 1.0        the numpy line
#      nn_mojo  (u - 0.5) * 2.0
#
#  and on these sixteen draws they happen to round identically. Change the
#  seed and they may not. The library changes how the code looks; what it
#  computes is the same program either way.
#
#  Side by side, the differences from NumPy are now just these:
#
#      np.random.seed(1)              var rng = nj.random(seed=1)
#      np.array([[1, 0, 1], ...])     nj.array([[1, 0, 1], ...])
#      strike.T                       strike.T()
#      tells[i : i + 1]               tells[i]
#      row.reshape(-1, 1).T           -- not needed
#      f"{x:.6f}"                     floor(x * 1e6) / 1e6, then t"{x}"
#
#  Everything else -- .dot(), element-wise * and -, np.sum, the loop, the
#  -= updates -- is the same call you would write in Python.
# ============================================================================
import nj
from std.math import floor


def relu(x: nj.ndarray) -> nj.ndarray:
    return (x > 0.0) * x


def relu2deriv(y: nj.ndarray) -> nj.ndarray:
    return y > 0.0


def main():
    var rng = nj.random(seed=15)
    var tells = nj.array([[1, 0, 1], [0, 1, 1], [0, 0, 1], [1, 1, 1]])
    var strike = nj.array([[1, 1, 0, 0]]).T()

    # network architecture and weights
    var alpha = 0.2
    var hidden_size = 4
    var weights_0_1 = 2.0 * rng.random((3, hidden_size)) - 1.0
    var weights_1_2 = 2.0 * rng.random((hidden_size, 1)) - 1.0

    # stochastic gradient descent
    for epoch in range(60):
        var layer_2_error = 0.0

        for i in range(len(tells)):
            # forward propagation
            var layer_0 = tells[i]
            var layer_1 = relu(layer_0.dot(weights_0_1))
            var layer_2 = layer_1.dot(weights_1_2)

            # measure our error
            var target = strike[i]
            layer_2_error += nj.sum((layer_2 - target) ** 2)

            # backpropagation
            var layer_2_delta = layer_2 - target
            var layer_1_delta = layer_2_delta.dot(weights_1_2.T()) * relu2deriv(layer_1)

            # update our weights
            weights_1_2 -= alpha * layer_1.T().dot(layer_2_delta)
            weights_0_1 -= alpha * layer_0.T().dot(layer_1_delta)

        # summary print
        if epoch % 10 == 9:
            var shown = floor(layer_2_error * 1000000.0) / 1000000.0
            print(t"epoch {epoch + 1}  error = {shown}")

    # final preds
    print("Final predictions:")
    for i in range(len(tells)):
        var layer_0 = tells[i]
        var layer_1 = relu(layer_0.dot(weights_0_1))
        var prediction = layer_1.dot(weights_1_2)
        var shown = floor(prediction.get(0, 0) * 10000.0) / 10000.0
        print(t"{tells[i]} -> {shown}")
