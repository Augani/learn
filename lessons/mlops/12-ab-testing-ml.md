# Lesson 12: A/B Testing for ML

## Measuring Real-World Impact

```
  Offline Metrics                   Online A/B Test
  +----------------------------+    +----------------------------+
  | "Model B has 2% higher     |    | "Model B actually          |
  |  accuracy on test set"     |    |  increases revenue by 3%   |
  |                            |    |  when real users use it"   |
  | Lab results                |    | Real-world proof           |
  +----------------------------+    +----------------------------+

  Like taste-testing a new recipe in the kitchen
  vs putting it on the menu and seeing if customers order it.
```

Offline metrics tell you if a model is **technically** better.
A/B tests tell you if it's **actually** better for your users
and business. Sometimes a model with higher accuracy makes users
less happy -- the only way to know is to test with real traffic.

---

## How A/B Testing Works for ML

```
  Incoming Traffic (100%)
       |
       +---> 50% ---> Model A (control)   ---> Measure outcomes
       |
       +---> 50% ---> Model B (treatment) ---> Measure outcomes

  After enough data:
  Compare outcomes. Is B statistically better than A?
  If YES --> replace A with B
  If NO  --> keep A, discard B
```

---

## Traffic Splitting

```python
import hashlib


def assign_variant(
    user_id: str,
    experiment_name: str,
    variants: list[str],
    weights: list[float] | None = None,
) -> str:
    if weights is None:
        weights = [1.0 / len(variants)] * len(variants)

    hash_input = f"{experiment_name}:{user_id}"
    hash_value = int(hashlib.sha256(hash_input.encode()).hexdigest(), 16)
    bucket = (hash_value % 10000) / 10000.0

    cumulative = 0.0
    for variant, weight in zip(variants, weights):
        cumulative += weight
        if bucket < cumulative:
            return variant

    return variants[-1]


class ABRouter:
    def __init__(self, models: dict, experiment_name: str):
        self.models = models
        self.experiment_name = experiment_name

    def route(self, user_id: str) -> tuple[str, object]:
        variant = assign_variant(
            user_id=user_id,
            experiment_name=self.experiment_name,
            variants=list(self.models.keys()),
        )
        return variant, self.models[variant]

    def predict(self, user_id: str, features: dict) -> dict:
        variant, model = self.route(user_id)
        prediction = model.predict(features)
        return {
            "variant": variant,
            "prediction": prediction,
            "experiment": self.experiment_name,
        }
```

---

## Statistical Significance

```
  Is the difference real or just noise?

  Scenario: Model B has 2.1% conversion vs Model A's 2.0%

  +---+---+---+---+---+---+---+---+---+---+
  | With 100 users each:                    |
  | p-value = 0.82                          |
  | "Could easily be random noise"          |
  +---+---+---+---+---+---+---+---+---+---+

  +---+---+---+---+---+---+---+---+---+---+
  | With 100,000 users each:                |
  | p-value = 0.003                         |
  | "Very likely a real difference"         |
  +---+---+---+---+---+---+---+---+---+---+

  Rule of thumb: p-value < 0.05 = statistically significant
```

### Computing Statistical Significance

```python
import numpy as np
from scipy import stats
from dataclasses import dataclass


@dataclass
class ABTestResult:
    control_rate: float
    treatment_rate: float
    relative_lift: float
    p_value: float
    is_significant: bool
    confidence_interval: tuple[float, float]
    sample_size_control: int
    sample_size_treatment: int


def analyze_ab_test(
    control_conversions: int,
    control_total: int,
    treatment_conversions: int,
    treatment_total: int,
    significance_level: float = 0.05,
) -> ABTestResult:
    control_rate = control_conversions / control_total
    treatment_rate = treatment_conversions / treatment_total

    if control_rate == 0:
        relative_lift = float("inf") if treatment_rate > 0 else 0.0
    else:
        relative_lift = (treatment_rate - control_rate) / control_rate

    pooled_rate = (control_conversions + treatment_conversions) / (
        control_total + treatment_total
    )
    pooled_se = np.sqrt(
        pooled_rate * (1 - pooled_rate) * (1 / control_total + 1 / treatment_total)
    )

    if pooled_se == 0:
        z_score = 0.0
    else:
        z_score = (treatment_rate - control_rate) / pooled_se

    p_value = 2 * (1 - stats.norm.cdf(abs(z_score)))

    diff = treatment_rate - control_rate
    se_diff = np.sqrt(
        control_rate * (1 - control_rate) / control_total
        + treatment_rate * (1 - treatment_rate) / treatment_total
    )
    z_crit = stats.norm.ppf(1 - significance_level / 2)
    ci = (diff - z_crit * se_diff, diff + z_crit * se_diff)

    return ABTestResult(
        control_rate=control_rate,
        treatment_rate=treatment_rate,
        relative_lift=relative_lift,
        p_value=p_value,
        is_significant=p_value < significance_level,
        confidence_interval=ci,
        sample_size_control=control_total,
        sample_size_treatment=treatment_total,
    )
```

### Sample Size Calculator

```python
def calculate_sample_size(
    baseline_rate: float,
    minimum_detectable_effect: float,
    significance_level: float = 0.05,
    power: float = 0.8,
) -> int:
    z_alpha = stats.norm.ppf(1 - significance_level / 2)
    z_beta = stats.norm.ppf(power)

    treatment_rate = baseline_rate * (1 + minimum_detectable_effect)

    p_bar = (baseline_rate + treatment_rate) / 2

    numerator = (
        z_alpha * np.sqrt(2 * p_bar * (1 - p_bar))
        + z_beta
        * np.sqrt(
            baseline_rate * (1 - baseline_rate)
            + treatment_rate * (1 - treatment_rate)
        )
    ) ** 2

    denominator = (treatment_rate - baseline_rate) ** 2

    return int(np.ceil(numerator / denominator))
```

---

## Canary Deployments

A safer alternative to full A/B tests for risky changes.

```
  Phase 1: Canary (1% traffic)
  [=================================================]
  [A A A A A A A A A A A A A A A A A A A A A A A A B]
  99% Model A                                    1% B

  Phase 2: Ramp up (10% traffic)
  [=================================================]
  [A A A A A A A A A A A A A A A A A A A A B B B B B]
  90% Model A                          10% Model B

  Phase 3: Ramp up (50% traffic)
  [=================================================]
  [A A A A A A A A A A A A B B B B B B B B B B B B B]
  50% Model A              50% Model B

  Phase 4: Full rollout (100%)
  [=================================================]
  [B B B B B B B B B B B B B B B B B B B B B B B B B]
  100% Model B

  At any phase: if metrics degrade --> ROLLBACK to 100% A
```

```python
from datetime import datetime, timezone


class CanaryDeployment:
    def __init__(
        self,
        control_model,
        canary_model,
        initial_pct: float = 0.01,
        ramp_steps: list[float] | None = None,
    ):
        self.control = control_model
        self.canary = canary_model
        self.canary_pct = initial_pct
        self.ramp_steps = ramp_steps or [0.01, 0.05, 0.10, 0.25, 0.50, 1.0]
        self.current_step = 0
        self.metrics_log: list[dict] = []

    def predict(self, user_id: str, features: dict) -> dict:
        variant = assign_variant(
            user_id=user_id,
            experiment_name="canary",
            variants=["control", "canary"],
            weights=[1.0 - self.canary_pct, self.canary_pct],
        )

        model = self.canary if variant == "canary" else self.control
        prediction = model.predict(features)

        return {"variant": variant, "prediction": prediction}

    def check_health(self, canary_metrics: dict, control_metrics: dict) -> bool:
        if canary_metrics.get("error_rate", 0) > control_metrics.get("error_rate", 0) * 2:
            return False
        if canary_metrics.get("latency_p99", 0) > control_metrics.get("latency_p99", 0) * 1.5:
            return False
        return True

    def ramp_up(self) -> bool:
        if self.current_step >= len(self.ramp_steps) - 1:
            return False
        self.current_step += 1
        self.canary_pct = self.ramp_steps[self.current_step]
        return True

    def rollback(self):
        self.canary_pct = 0.0
        self.current_step = 0
```

---

## Multi-Armed Bandits

An alternative to traditional A/B testing that adapts in real time.

```
  A/B Test:                      Multi-Armed Bandit:
  Fixed 50/50 split              Adaptive split
  +--------+--------+            +--------+--------+
  | 50% A  | 50% B  |  t=0      | 50% A  | 50% B  |
  | 50% A  | 50% B  |  t=1      | 40% A  | 60% B  |
  | 50% A  | 50% B  |  t=2      | 25% A  | 75% B  |
  | 50% A  | 50% B  |  t=3      | 10% A  | 90% B  |
  +--------+--------+            +--------+--------+

  A/B: wait until end to decide.
  Bandit: shift traffic to winner as you go.
  Less waste, but harder to reach statistical significance.
```

```python
class EpsilonGreedyBandit:
    def __init__(self, model_names: list[str], epsilon: float = 0.1):
        self.model_names = model_names
        self.epsilon = epsilon
        self.rewards: dict[str, list[float]] = {name: [] for name in model_names}

    def select_model(self) -> str:
        if np.random.random() < self.epsilon:
            return np.random.choice(self.model_names)

        avg_rewards = {}
        for name in self.model_names:
            if not self.rewards[name]:
                return name
            avg_rewards[name] = np.mean(self.rewards[name])

        return max(avg_rewards, key=avg_rewards.get)

    def record_reward(self, model_name: str, reward: float):
        self.rewards[model_name].append(reward)

    def get_stats(self) -> dict:
        return {
            name: {
                "count": len(rewards),
                "avg_reward": np.mean(rewards) if rewards else 0,
            }
            for name, rewards in self.rewards.items()
        }
```

---

## Logging for A/B Analysis

```python
import json
from pathlib import Path
from datetime import datetime, timezone


class ExperimentLogger:
    def __init__(self, experiment_name: str, log_dir: str = "logs"):
        self.experiment_name = experiment_name
        self.log_path = Path(log_dir) / f"{experiment_name}.jsonl"
        self.log_path.parent.mkdir(parents=True, exist_ok=True)

    def log_event(
        self,
        user_id: str,
        variant: str,
        event_type: str,
        metadata: dict | None = None,
    ):
        event = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "experiment": self.experiment_name,
            "user_id": user_id,
            "variant": variant,
            "event_type": event_type,
            "metadata": metadata or {},
        }

        with open(self.log_path, "a") as f:
            f.write(json.dumps(event) + "\n")

    def log_prediction(self, user_id: str, variant: str, prediction: dict):
        self.log_event(user_id, variant, "prediction", prediction)

    def log_outcome(self, user_id: str, variant: str, converted: bool):
        self.log_event(user_id, variant, "outcome", {"converted": converted})
```

---

## Exercises

1. **Traffic Splitter**: Implement the `assign_variant` function.
   Verify it produces consistent assignments (same user always
   gets same variant) and correct proportions over 10,000 users.

2. **A/B Analyzer**: Generate synthetic conversion data for two
   models. Run `analyze_ab_test` and verify it correctly
   identifies significant and non-significant differences.

3. **Canary Deployment**: Implement the canary pattern. Simulate
   a healthy deployment (ramp to 100%) and a failing one
   (rollback at 10%).

4. **Sample Size**: Use the sample size calculator to determine
   how many users you need to detect a 5% lift on a 2% baseline
   conversion rate. Run a simulation to verify.

---

[Next: Lesson 13 - Data Quality Monitoring -->](13-data-quality-monitoring.md)
