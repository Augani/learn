# Lesson 05 — STL Containers

> **Analogy:** The STL is C++'s toolbox. Rust has `Vec`, `HashMap`,
> `String` in its standard library. C++ has the same things, just with
> different names and quirks. It's like renting a car in another country —
> same concept, different dashboard layout.

## The Big Picture

```
  Rust                      C++ STL                 When to Use
  ═══════════════           ═══════════════         ═══════════════════
  Vec<T>                    std::vector<T>          Default sequence
  HashMap<K,V>              std::unordered_map<K,V> Fast key lookup
  BTreeMap<K,V>             std::map<K,V>           Sorted key lookup
  String                    std::string             Text
  VecDeque<T>               std::deque<T>           Double-ended queue
  HashSet<T>                std::unordered_set<T>   Unique elements
  [T; N]                    std::array<T, N>        Fixed-size array
```

## std::vector — The Workhorse

```
  vector<float> is THE container for ML data.
  It's a dynamic array, just like Vec<f32>.

  ┌─────────────────────────────────────────┐
  │ vector internals                        │
  │  data ──> [1.0][2.0][3.0][   ][   ]    │
  │  size = 3                               │
  │  capacity = 5                           │
  └─────────────────────────────────────────┘
```

```cpp
#include <vector>
#include <cstdio>
#include <numeric>

int main() {
    std::vector<float> losses;

    losses.push_back(2.5f);
    losses.push_back(1.8f);
    losses.push_back(0.9f);
    losses.push_back(0.3f);

    printf("Training losses:\n");
    for (size_t i = 0; i < losses.size(); i++) {
        printf("  epoch %zu: %.2f\n", i, losses[i]);
    }

    printf("size: %zu, capacity: %zu\n", losses.size(), losses.capacity());

    losses.reserve(1000);
    printf("after reserve: size=%zu, cap=%zu\n",
           losses.size(), losses.capacity());

    float sum = std::accumulate(losses.begin(), losses.end(), 0.0f);
    printf("avg loss: %.3f\n", sum / losses.size());

    return 0;
}
```

### Vector Gotchas for Rust Devs

```
  Rust                              C++
  ──────────────────────────        ──────────────────────────
  v[10]  → panics if OOB           v[10]  → UB if OOB (no check!)
  v.get(10) → Option<&T>           v.at(10) → throws if OOB
  v.push(x) → always works         v.push_back(x) → may invalidate
              (reallocs)                             iterators!
```

```cpp
#include <vector>
#include <cstdio>
#include <stdexcept>

int main() {
    std::vector<int> v = {1, 2, 3};

    printf("v[1] = %d\n", v[1]);

    try {
        printf("v.at(10) = %d\n", v.at(10));
    } catch (const std::out_of_range& e) {
        printf("Caught: %s\n", e.what());
    }

    return 0;
}
```

## Iterating — Range-based For Loops

```cpp
#include <vector>
#include <cstdio>

int main() {
    std::vector<float> weights = {0.1f, 0.5f, -0.3f, 0.8f};

    printf("By value (copy):\n");
    for (float w : weights) {
        printf("  %.1f\n", w);
    }

    printf("By const ref (read-only):\n");
    for (const auto& w : weights) {
        printf("  %.1f\n", w);
    }

    printf("By ref (mutable):\n");
    for (auto& w : weights) {
        w *= 2.0f;
    }

    printf("After scaling:\n");
    for (const auto& w : weights) {
        printf("  %.1f\n", w);
    }

    return 0;
}
```

```
  Rust                          C++
  ──────────────                ──────────────
  for &w in &weights            for (const auto& w : weights)
  for w in &mut weights         for (auto& w : weights)
  for w in weights              for (auto w : weights)  // copies!
```

## std::string — Text Handling

```cpp
#include <string>
#include <cstdio>
#include <iostream>

int main() {
    std::string model_name = "resnet50";
    std::string path = "/models/" + model_name + "/weights.pt";

    printf("path: %s\n", path.c_str());
    printf("length: %zu\n", path.size());

    if (path.find("resnet") != std::string::npos) {
        printf("Found resnet in path\n");
    }

    std::string sub = path.substr(0, 7);
    printf("substring: %s\n", sub.c_str());

    std::string layer = "layer_";
    for (int i = 0; i < 4; i++) {
        std::string name = layer + std::to_string(i);
        printf("  %s\n", name.c_str());
    }

    return 0;
}
```

```
  Rust String           C++ std::string
  ═══════════           ═══════════════
  .len()                .size() or .length()
  .push_str("x")        += "x" or .append("x")
  .contains("x")        .find("x") != npos
  .as_str()             .c_str()  (returns const char*)
  &s[0..5]              .substr(0, 5)
  format!("{}", x)      std::to_string(x)
```

## std::unordered_map — Hash Map

```
  Like Rust's HashMap<K, V>.
  Average O(1) lookup, insert, delete.

  ┌───────────────────────────────────┐
  │ unordered_map                     │
  │  bucket[0] → ("lr", 0.001)       │
  │  bucket[1] → empty                │
  │  bucket[2] → ("epochs", 100)      │
  │  bucket[3] → ("batch", 32)        │
  │  ...                              │
  └───────────────────────────────────┘
```

```cpp
#include <unordered_map>
#include <string>
#include <cstdio>

int main() {
    std::unordered_map<std::string, float> config;

    config["learning_rate"] = 0.001f;
    config["momentum"] = 0.9f;
    config["weight_decay"] = 1e-4f;
    config["epochs"] = 100.0f;

    for (const auto& [key, value] : config) {
        printf("  %s = %g\n", key.c_str(), value);
    }

    auto it = config.find("learning_rate");
    if (it != config.end()) {
        printf("lr = %g\n", it->second);
    }

    printf("contains momentum: %s\n",
           config.count("momentum") ? "yes" : "no");

    return 0;
}
```

```
  Rust                              C++
  ──────────────────────────        ──────────────────────────
  map.insert("k", v)               map["k"] = v
                                    map.insert({"k", v})
  map.get("k")  → Option<&V>       map.find("k") → iterator
                                    (check != map.end())
  map.contains_key("k")            map.count("k") > 0
  for (k, v) in &map               for (const auto& [k,v] : map)
```

## std::map — Ordered Map (BTreeMap)

```cpp
#include <map>
#include <string>
#include <cstdio>

int main() {
    std::map<int, std::string> checkpoints;

    checkpoints[100] = "checkpoint_100.pt";
    checkpoints[50] = "checkpoint_50.pt";
    checkpoints[200] = "checkpoint_200.pt";
    checkpoints[150] = "checkpoint_150.pt";

    printf("Checkpoints (sorted by step):\n");
    for (const auto& [step, path] : checkpoints) {
        printf("  step %d: %s\n", step, path.c_str());
    }

    auto it = checkpoints.lower_bound(100);
    printf("First checkpoint >= step 100: step %d\n", it->first);

    return 0;
}
```

## Useful Algorithms

```cpp
#include <vector>
#include <algorithm>
#include <numeric>
#include <cstdio>

int main() {
    std::vector<float> scores = {0.8f, 0.2f, 0.95f, 0.1f, 0.6f};

    std::sort(scores.begin(), scores.end());
    printf("Sorted: ");
    for (float s : scores) printf("%.2f ", s);
    printf("\n");

    std::sort(scores.begin(), scores.end(), std::greater<float>());
    printf("Descending: ");
    for (float s : scores) printf("%.2f ", s);
    printf("\n");

    auto max_it = std::max_element(scores.begin(), scores.end());
    printf("Max: %.2f at index %ld\n", *max_it,
           std::distance(scores.begin(), max_it));

    float sum = std::accumulate(scores.begin(), scores.end(), 0.0f);
    printf("Sum: %.2f, Mean: %.2f\n", sum, sum / scores.size());

    std::vector<float> doubled(scores.size());
    std::transform(scores.begin(), scores.end(), doubled.begin(),
                   [](float x) { return x * 2.0f; });
    printf("Doubled: ");
    for (float d : doubled) printf("%.2f ", d);
    printf("\n");

    return 0;
}
```

```
  Rust                              C++
  ──────────────────────────        ──────────────────────────
  v.sort()                          std::sort(v.begin(), v.end())
  v.iter().sum()                    std::accumulate(begin, end, 0)
  v.iter().max()                    std::max_element(begin, end)
  v.iter().map(|x| x*2)            std::transform(...)
  v.iter().filter(|x| x>0)         std::copy_if(...)
```

## Lambda Functions

```cpp
#include <vector>
#include <algorithm>
#include <cstdio>

int main() {
    std::vector<float> activations = {-0.5f, 0.3f, -0.1f, 0.8f, -0.9f};

    auto relu = [](float x) -> float {
        return x > 0 ? x : 0;
    };

    float threshold = 0.0f;
    auto count = std::count_if(activations.begin(), activations.end(),
        [threshold](float x) { return x > threshold; });
    printf("Positive activations: %ld\n", count);

    std::transform(activations.begin(), activations.end(),
                   activations.begin(), relu);
    printf("After ReLU: ");
    for (float a : activations) printf("%.1f ", a);
    printf("\n");

    return 0;
}
```

```
  Rust closures               C++ lambdas
  ═══════════════             ═══════════════
  |x| x * 2                  [](auto x) { return x * 2; }
  |x| x > threshold          [threshold](auto x) { return x > threshold; }
  move |x| ...               [threshold](auto x) { ... }  (copy by default)
                              [&threshold](auto x) { ... } (capture by ref)
```

## Exercises

1. **Loss tracker:** Write a class that stores per-epoch losses in a
   `vector<float>`. Add methods for `mean()`, `min()`, `last_n(int n)`
   that returns the last N losses.

2. **Hyperparameter config:** Use `unordered_map<string, float>` to build
   a config system. Support `set(key, value)`, `get(key)` with a default,
   and `print_all()`.

3. **Top-k scores:** Given a `vector<pair<string, float>>` of
   (class_name, score) pairs, write a function that returns the top-k
   entries sorted by score descending.

4. **Frequency count:** Write a function that takes a `vector<string>`
   of tokens and returns an `unordered_map<string, int>` of token counts,
   sorted by frequency when printed.

5. **Batch iterator:** Write a function that takes a `vector<float>` and
   a batch size, and returns a `vector<vector<float>>` of batches
   (last batch may be smaller).

---

[Next: Lesson 06 — Build Systems →](06-build-systems.md)
