
# training data
import numpy as np

np.random.seed(1)

# input data
tells = np.array([
    [1, 0, 1],
    [0, 1, 1],
    [0, 0, 1],
    [1, 1, 1]
])

# output
strike = np.array([[1, 1, 0, 0]]).T

# relu functions
def relu(x): return (x > 0) * x
def relu2deriv(y): return y > 0

# network architecture and weights
alpha, hidden_size = 0.2, 4
weights_0_1 = 2 * np.random.random((3, hidden_size)) - 1
weights_1_2 = 2 * np.random.random((hidden_size, 1)) - 1

# stochastic gradient descent
for epoch in range(60):
  layer_2_error = 0

  for i in range(len(tells)):
    # forward propagation
    layer_0 = tells[i : i + 1]
    layer_1 = relu(layer_0.dot(weights_0_1))
    layer_2 = layer_1.dot(weights_1_2)

    # measure our error
    layer_2_error += np.sum(
        (layer_2 - strike[i : i + 1]) ** 2
    )

    layer_2_delta = layer_2 - strike[i : i + 1]

    # backpropagation
    layer_1_delta = (
        layer_2_delta.dot(weights_1_2.T)
        * relu2deriv(layer_1)
    )

    # update our weights
    weights_1_2 -= (
        alpha * layer_1.T.dot(layer_2_delta)
    )

    weights_0_1 -= (
        alpha * layer_0.T.dot(layer_1_delta)
    )

  # summary print
  if epoch % 10 == 9:
    print(
        f"epoch {epoch + 1: >2} "
        f"error = {layer_2_error:.6f}"
    )
     
epoch 10 error = 0.634231
epoch 20 error = 0.358384
epoch 30 error = 0.083018
epoch 40 error = 0.006467
epoch 50 error = 0.000329
epoch 60 error = 0.000015

# final preds
print('Final predictions:')

for row in tells:
  layer_0 = row.reshape(-1, 1)
  layer_1 = relu(layer_0.T.dot(weights_0_1))
  prediction = layer_1.dot(weights_1_2)
  print(row, "->", round(float(prediction[0,0]), 4))
     
Final predictions:
[1 0 1] -> 1.0
[0 1 1] -> 0.9986
[0 0 1] -> 0.0026
[1 1 1] -> 0.0