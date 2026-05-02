# Lesson 16: Neural Architecture Search

> Designing a neural network is like designing a house. You choose
> how many rooms, how big each room is, how they connect. An
> architect uses experience and intuition. Neural Architecture
> Search (NAS) is like hiring a robot architect that tries thousands
> of designs and picks the one that works best for your needs.

---

## Why Automate Architecture Design?

```
  Manual architecture design:

  Researcher: "Let me try 3 layers... no, 5 layers...
               maybe skip connections... wider? deeper?
               what kernel size? what activation?"

  +----+   +----+   +----+   +----+   +----+
  | v1 |   | v2 |   | v3 |   | v4 |   | v5 |
  | 85%|   | 87%|   | 84%|   | 88%|   | 86%|
  +----+   +----+   +----+   +----+   +----+
    ^        ^        ^        ^        ^
  2 weeks  2 weeks  2 weeks  2 weeks  2 weeks = 10 weeks

  NAS:
  +-------------------------------------------+
  | Search space: 10^18 possible architectures |
  | Evaluate 1000 candidates automatically     |
  | Find 92% accuracy architecture in 3 days   |
  +-------------------------------------------+

  NAS-designed models often beat hand-designed ones:
  EfficientNet (NAS) > ResNet (hand-designed)
  NASNet > Inception (hand-designed)
  MnasNet > MobileNetV2 (hand-designed)
```

---

## The Three Components of NAS

```
  +-------------------+
  | 1. SEARCH SPACE   |  What architectures are possible?
  +-------------------+
           |
           v
  +-------------------+
  | 2. SEARCH STRATEGY|  How do we explore the space?
  +-------------------+
           |
           v
  +-------------------+
  | 3. EVALUATION     |  How do we judge each architecture?
  +-------------------+

  Think of it like house shopping:
  1. Search space = neighborhood and budget (what's possible)
  2. Search strategy = how you visit houses (random? agent?)
  3. Evaluation = how you rate each house (size? price? location?)
```

---

## Search Space Design

```
  Cell-based search space (most common):

  Instead of searching for the entire network,
  search for a repeating "cell" pattern:

  +--------+--------+--------+--------+--------+
  | Cell 1 | Cell 2 | Cell 3 | Cell 4 | Cell 5 |
  +--------+--------+--------+--------+--------+

  Each cell has the same structure, just repeated.
  Reduces search space from 10^18 to ~10^9.

  Inside a cell:
  +-------------------------------------------+
  |  Input A    Input B                        |
  |    |          |                            |
  |    v          v                            |
  |  [op1]      [op2]    Operations:           |
  |    |          |       - 3x3 conv            |
  |    +----+-----+       - 5x5 conv            |
  |         |             - 3x3 separable conv  |
  |         v             - max pool 3x3        |
  |      [combine]        - avg pool 3x3        |
  |         |             - skip connection     |
  |         v             - zero (no connection)|
  |       Output                                |
  +-------------------------------------------+

  A cell is a directed acyclic graph (DAG) of operations.
```

```python
from enum import Enum
from dataclasses import dataclass


class Operation(Enum):
    CONV_3X3 = "conv_3x3"
    CONV_5X5 = "conv_5x5"
    SEP_CONV_3X3 = "sep_conv_3x3"
    SEP_CONV_5X5 = "sep_conv_5x5"
    MAX_POOL_3X3 = "max_pool_3x3"
    AVG_POOL_3X3 = "avg_pool_3x3"
    SKIP_CONNECT = "skip_connect"
    ZERO = "zero"


@dataclass
class Edge:
    input_node: int
    output_node: int
    operation: Operation


@dataclass
class CellArchitecture:
    num_nodes: int
    edges: list[Edge]

    def num_possible_architectures(self):
        num_ops = len(Operation)
        num_edges = self.num_nodes * (self.num_nodes - 1) // 2
        return num_ops ** num_edges
```

---

## Strategy 1: Reinforcement Learning NAS

```
  The original NAS (Zoph & Le, 2017):

  +----------------+     +------------------+
  | RNN Controller | --> | Generate arch    |
  | (policy)       |     | description      |
  +----------------+     +--------+---------+
         ^                        |
         |                        v
         |               +------------------+
     reward (accuracy)   | Train child      |
         |               | network          |
         ^               +--------+---------+
         |                        |
         +--- accuracy -----------+

  Controller = RNN that outputs architecture decisions
  Each decision = action in RL framework
  Reward = validation accuracy of trained architecture

  Problem: EXTREMELY expensive
  Original paper: 800 GPUs x 28 days = 22,400 GPU-days
  That's about $2 million in compute
```

---

## Strategy 2: Evolutionary NAS

```
  Inspired by biological evolution:

  Generation 0: Random architectures
  +----+  +----+  +----+  +----+  +----+
  | 72%|  | 68%|  | 75%|  | 70%|  | 65%|
  +----+  +----+  +----+  +----+  +----+

  Selection: Pick the fittest
  +----+        +----+
  | 75%|        | 72%|
  +----+        +----+

  Mutation: Random changes
  +----+  +----+  +----+  +----+
  | 75%|  | 77%|  | 73%|  | 76%|
  +----+  +----+  +----+  +----+
  parent  swap op  add    change
          in cell  skip   kernel

  Generation 1: Evaluate mutated offspring
  Repeat for N generations

  Typically finds good architectures in 1/10 the cost of RL NAS
```

```python
import random
import copy


def mutate_architecture(arch, operations):
    new_arch = copy.deepcopy(arch)
    mutation_type = random.choice(["change_op", "change_edge"])

    if mutation_type == "change_op" and new_arch.edges:
        edge_idx = random.randint(0, len(new_arch.edges) - 1)
        new_arch.edges[edge_idx].operation = random.choice(list(operations))

    elif mutation_type == "change_edge" and len(new_arch.edges) > 1:
        edge_idx = random.randint(0, len(new_arch.edges) - 1)
        valid_inputs = list(range(new_arch.edges[edge_idx].output_node))
        if valid_inputs:
            new_arch.edges[edge_idx].input_node = random.choice(valid_inputs)

    return new_arch


def evolutionary_search(
    search_space,
    evaluate_fn,
    population_size=50,
    generations=100,
    tournament_size=5,
):
    population = [
        (search_space.random_architecture(), None)
        for _ in range(population_size)
    ]

    population = [
        (arch, evaluate_fn(arch)) for arch, _ in population
    ]

    best_arch = max(population, key=lambda x: x[1])

    for gen in range(generations):
        candidates = random.sample(population, tournament_size)
        parent_arch, _ = max(candidates, key=lambda x: x[1])

        child_arch = mutate_architecture(parent_arch, Operation)
        child_score = evaluate_fn(child_arch)

        worst_idx = min(range(len(population)), key=lambda i: population[i][1])
        population[worst_idx] = (child_arch, child_score)

        current_best = max(population, key=lambda x: x[1])
        if current_best[1] > best_arch[1]:
            best_arch = current_best

        if gen % 10 == 0:
            print(f"Gen {gen}: best={best_arch[1]:.4f}")

    return best_arch
```

---

## Strategy 3: Differentiable NAS (DARTS)

```
  Key insight: make the architecture search DIFFERENTIABLE
  so we can use gradient descent instead of RL or evolution.

  Instead of choosing ONE operation per edge:
  Use a WEIGHTED MIX of ALL operations

  Standard: edge = conv_3x3(x)
  DARTS:    edge = 0.3*conv_3x3(x) + 0.5*sep_conv(x) + 0.2*pool(x)

  The weights (0.3, 0.5, 0.2) are learnable parameters!

  +----------+
  | Input x  |
  +----+-----+
       |
  +----+-----+-----+-----+
  |    |     |     |     |
  v    v     v     v     v
 3x3  5x5  sep  pool  skip     (all operations in parallel)
  |    |     |     |     |
  *a1  *a2  *a3   *a4   *a5    (multiply by architecture weights)
  |    |     |     |     |
  +----+-----+-----+-----+
       |
       v
  weighted sum = output

  Train jointly:
  - Network weights w: minimize training loss
  - Architecture weights a: minimize validation loss
  - Alternating optimization (bilevel optimization)

  After search: pick the operation with highest weight per edge
  Cost: ~1 GPU-day (vs 22,400 for RL NAS!)
```

```python
import torch
import torch.nn as nn
import torch.nn.functional as F


class MixedOperation(nn.Module):
    def __init__(self, channels, operations_list):
        super().__init__()
        self.ops = nn.ModuleList(operations_list)
        self.arch_weights = nn.Parameter(
            torch.randn(len(operations_list)) * 0.001
        )

    def forward(self, x):
        weights = F.softmax(self.arch_weights, dim=0)
        return sum(w * op(x) for w, op in zip(weights, self.ops))

    def chosen_op_index(self):
        return self.arch_weights.argmax().item()


class DARTSCell(nn.Module):
    def __init__(self, channels, num_nodes=4):
        super().__init__()
        self.num_nodes = num_nodes
        self.edges = nn.ModuleDict()

        for i in range(num_nodes):
            for j in range(i + 2):
                edge_key = f"{j}_to_{i+2}"
                self.edges[edge_key] = MixedOperation(
                    channels,
                    [
                        nn.Conv2d(channels, channels, 3, padding=1),
                        nn.Conv2d(channels, channels, 5, padding=2),
                        nn.MaxPool2d(3, stride=1, padding=1),
                        nn.AvgPool2d(3, stride=1, padding=1),
                        nn.Identity(),
                    ],
                )

    def forward(self, input_0, input_1):
        states = [input_0, input_1]

        for i in range(self.num_nodes):
            node_inputs = []
            for j in range(len(states)):
                edge_key = f"{j}_to_{i+2}"
                if edge_key in self.edges:
                    node_inputs.append(self.edges[edge_key](states[j]))
            states.append(sum(node_inputs))

        return torch.cat(states[2:], dim=1)
```

---

## Strategy 4: One-Shot NAS

```
  Train ONE big "supernet" that contains ALL architectures:

  Supernet:
  +--[conv3x3]--+--[conv5x5]--+--[pool]--+--[skip]--+
  |             |             |          |          |
  +-- Node 0 --+-- Node 1 ---+- Node 2 -+- Node 3-+

  Each forward pass: randomly sample a sub-network
  After training: evaluate many sub-networks cheaply

  +--[conv3x3]--+--[skip]----+--[pool]--+  Sub-net 1
  +--[conv5x5]--+--[conv3x3]-+--[skip]--+  Sub-net 2
  +--[skip]-----+--[pool]----+--[conv3x3]+ Sub-net 3

  Cost: Train supernet once (~1 GPU-day)
        + evaluate N sub-nets (~minutes each)
```

---

## Efficient Evaluation: Proxy Tasks

```
  Full training to evaluate one architecture:
    100 epochs on ImageNet = 3 days on 8 GPUs

  Proxy tasks (cheaper approximations):
  +-------------------------------+-------+-----------+
  | Proxy                         | Cost  | Correlation|
  +-------------------------------+-------+-----------+
  | Train fewer epochs (5-10)     | 20x   | Good       |
  | Smaller dataset (10%)         | 10x   | Good       |
  | Smaller image size (32x32)    | 5x    | Moderate   |
  | Fewer channels (1/4)          | 16x   | Moderate   |
  | Zero-cost proxies (no train!) | 1000x | Rough      |
  +-------------------------------+-------+-----------+

  Zero-cost proxies:
  - Compute gradient norms at initialization
  - Measure network "trainability" without any training
  - 1000x faster but much less accurate
```

```python
import torch
import torch.nn as nn


def zero_cost_score(model, input_shape, num_samples=32):
    model.train()
    device = next(model.parameters()).device

    dummy_input = torch.randn(num_samples, *input_shape).to(device)
    dummy_target = torch.randint(0, 10, (num_samples,)).to(device)

    output = model(dummy_input)
    loss = nn.CrossEntropyLoss()(output, dummy_target)
    loss.backward()

    grad_norm = 0.0
    for param in model.parameters():
        if param.grad is not None:
            grad_norm += param.grad.norm().item() ** 2
    grad_norm = grad_norm ** 0.5

    model.zero_grad()
    return grad_norm
```

---

## Hardware-Aware NAS

```
  Standard NAS: maximize accuracy
  Hardware-aware NAS: maximize accuracy SUBJECT TO constraints

  Constraints:
  +----------------------------+
  | Latency < 10ms on iPhone  |
  | Model size < 5MB          |
  | FLOPs < 300M              |
  | Memory < 100MB at runtime |
  +----------------------------+

  Multi-objective optimization:

  Accuracy
  ^
  |     *  *
  |   *  *     <-- Pareto front (best tradeoffs)
  |  *   *  *
  | *  *  *  *
  |*  *  *  *  *
  +-----------------> Latency

  MnasNet objective:
  reward = accuracy * (latency / target_latency) ^ beta

  beta < 0: penalize slow models
  beta = -0.07 in practice (soft penalty)
```

---

## NAS Results: What Was Found

```
  +-------------------+--------+-----------+----------+
  | Architecture      | Method | Top-1 Acc | GPU-days |
  +-------------------+--------+-----------+----------+
  | NASNet-A          | RL     | 82.7%     | 22,400   |
  | AmoebaNet-A       | Evol.  | 83.1%     | 3,150    |
  | DARTS             | Diff.  | 82.6%     | 1        |
  | EfficientNet-B0   | RL     | 77.3%*    | ~3,800   |
  | MnasNet           | RL+HW  | 76.1%*    | ~2,000   |
  | OFA (Once-for-All)| OShot  | 80.0%     | ~50      |
  +-------------------+--------+-----------+----------+
  * = with much fewer FLOPs (mobile-focused)

  Key patterns NAS discovered:
  - Separable convolutions are almost always preferred
  - Skip connections are essential
  - Wider is often better than deeper (up to a point)
  - Channel expansion ratios of 4-6x work well
  - 3x3 kernels dominate, 5x5 rarely chosen
```

---

## Exercises

1. **Search space**: Define a cell-based search space with 4 nodes
   and 5 operation types. Calculate how many unique architectures
   exist. Implement random sampling from this space.

2. **Evolutionary search**: Implement an evolutionary NAS that
   searches for the best 3-layer MLP architecture for MNIST.
   Search over hidden sizes [32, 64, 128, 256, 512] and
   activations [ReLU, GELU, SiLU].

3. **DARTS cell**: Implement a simplified DARTS cell with mixed
   operations. Train on CIFAR-10 and extract the final
   architecture by picking the highest-weight operation per edge.

4. **Hardware-aware search**: Add a latency constraint to your
   search. Measure actual forward-pass time for each candidate
   and penalize slow architectures.

5. **Zero-cost proxy**: Implement 3 zero-cost metrics (grad norm,
   number of linear regions, jacobian covariance). Rank 20 random
   architectures by each metric. How well do they correlate with
   actual trained accuracy?

---

**Next**: [Reference - Key Architectures](./reference-architectures.md)
