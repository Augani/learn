# Lesson 14: Incident Response for ML

## When Your Model Goes Wrong

```
  Fire Department                  ML Incident Response
  +----------------------------+   +----------------------------+
  | 1. Detect (alarm rings)    |   | 1. Detect (alert fires)    |
  | 2. Respond (truck rolls)   |   | 2. Respond (on-call paged) |
  | 3. Contain (stop spread)   |   | 3. Contain (rollback model)|
  | 4. Extinguish (put out)    |   | 4. Fix (root cause)        |
  | 5. Investigate (cause)     |   | 5. Post-mortem (learn)     |
  | 6. Prevent (new codes)     |   | 6. Prevent (new checks)    |
  +----------------------------+   +----------------------------+
```

Every production ML system will fail. The question is not **if**
but **when** and **how fast you recover**. This lesson is your
fire drill -- practice before the real fire.

---

## Common ML Incidents

```
  Incident Type            | Severity | Detection Time
  -------------------------|----------|---------------
  Model returns errors     | HIGH     | Minutes (alerts)
  Latency spike            | MEDIUM   | Minutes (metrics)
  Prediction drift         | HIGH     | Hours (monitoring)
  Data pipeline breaks     | HIGH     | Minutes to hours
  Silent accuracy drop     | CRITICAL | Days to weeks
  Training-serving skew    | CRITICAL | Weeks (subtle)
  Stale model (not updated)| LOW      | Days
  GPU OOM under load       | MEDIUM   | Minutes
```

```
  The Iceberg of ML Failures

       /\        <-- Visible: errors, crashes
      /  \
     /    \
    / Drift \     <-- Harder to see: distribution shift
   / Skew    \
  / Silent    \
 / degradation \  <-- Invisible: slow accuracy decay
+---------------+
```

---

## Rollback Strategies

The most important incident response tool: getting back to a
known-good state.

```
  Strategy 1: Model Version Rollback
  +--------------------------------------------------+
  | Current: model v3 (broken)                        |
  | Rollback: model v2 (last known good)              |
  |                                                    |
  | Time to recover: seconds to minutes                |
  | Risk: low (v2 was working before)                  |
  +--------------------------------------------------+

  Strategy 2: Feature Fallback
  +--------------------------------------------------+
  | ML prediction unavailable                          |
  | Fallback: rule-based system / cached predictions   |
  |                                                    |
  | Time to recover: instant                           |
  | Risk: reduced quality, but still functioning       |
  +--------------------------------------------------+

  Strategy 3: Traffic Drain
  +--------------------------------------------------+
  | Model server unhealthy                             |
  | Drain: redirect traffic to healthy replicas        |
  |                                                    |
  | Time to recover: seconds                           |
  | Risk: reduced capacity                             |
  +--------------------------------------------------+
```

### Rollback Implementation

```python
import json
import shutil
from pathlib import Path
from datetime import datetime, timezone
from dataclasses import dataclass


@dataclass
class ModelVersion:
    version: str
    path: str
    deployed_at: str
    status: str
    metrics: dict


class ModelRollbackManager:
    def __init__(self, model_dir: str, max_versions: int = 5):
        self.model_dir = Path(model_dir)
        self.model_dir.mkdir(parents=True, exist_ok=True)
        self.history_file = self.model_dir / "deployment_history.json"
        self.max_versions = max_versions
        self._history: list[dict] = self._load_history()

    def _load_history(self) -> list[dict]:
        if self.history_file.exists():
            return json.loads(self.history_file.read_text())
        return []

    def _save_history(self):
        self.history_file.write_text(json.dumps(self._history, indent=2))

    def deploy(self, version: str, model_path: str, metrics: dict) -> ModelVersion:
        version_dir = self.model_dir / version
        version_dir.mkdir(parents=True, exist_ok=True)
        shutil.copy2(model_path, version_dir / "model.pt")

        current_link = self.model_dir / "current"
        if current_link.is_symlink():
            current_link.unlink()
        current_link.symlink_to(version_dir)

        record = {
            "version": version,
            "path": str(version_dir),
            "deployed_at": datetime.now(timezone.utc).isoformat(),
            "status": "active",
            "metrics": metrics,
        }
        self._history.append(record)
        self._save_history()

        self._cleanup_old_versions()

        return ModelVersion(**record)

    def rollback(self, target_version: str | None = None) -> ModelVersion:
        if not self._history:
            raise RuntimeError("No deployment history found")

        if target_version is None:
            active = [h for h in self._history if h["status"] == "active"]
            if len(active) < 2:
                raise RuntimeError("No previous version to rollback to")
            target = active[-2]
        else:
            matching = [h for h in self._history if h["version"] == target_version]
            if not matching:
                raise RuntimeError(f"Version {target_version} not found")
            target = matching[-1]

        self._history[-1]["status"] = "rolled_back"

        current_link = self.model_dir / "current"
        if current_link.is_symlink():
            current_link.unlink()
        current_link.symlink_to(Path(target["path"]))

        rollback_record = {
            **target,
            "deployed_at": datetime.now(timezone.utc).isoformat(),
            "status": "active",
        }
        self._history.append(rollback_record)
        self._save_history()

        return ModelVersion(**rollback_record)

    def get_current_version(self) -> str | None:
        active = [h for h in self._history if h["status"] == "active"]
        if active:
            return active[-1]["version"]
        return None

    def _cleanup_old_versions(self):
        versions = [h for h in self._history if h["status"] != "rolled_back"]
        if len(versions) > self.max_versions:
            for old in versions[: -self.max_versions]:
                old_path = Path(old["path"])
                if old_path.exists():
                    shutil.rmtree(old_path)
```

---

## Fallback Predictions

```python
from typing import Any


class FallbackPredictor:
    def __init__(self, primary_model, fallback_fn, timeout_seconds: float = 5.0):
        self.primary = primary_model
        self.fallback_fn = fallback_fn
        self.timeout = timeout_seconds
        self.fallback_count = 0
        self.total_count = 0

    def predict(self, features: dict) -> dict:
        self.total_count += 1

        try:
            result = self.primary.predict(features)
            result["source"] = "model"
            return result
        except Exception as exc:
            self.fallback_count += 1
            result = self.fallback_fn(features)
            result["source"] = "fallback"
            result["fallback_reason"] = str(exc)
            return result

    @property
    def fallback_rate(self) -> float:
        if self.total_count == 0:
            return 0.0
        return self.fallback_count / self.total_count


def simple_rule_fallback(features: dict) -> dict:
    amount = features.get("amount", 0)
    if amount > 10000:
        return {"label": "high_risk", "confidence": 0.7}
    if amount > 1000:
        return {"label": "medium_risk", "confidence": 0.5}
    return {"label": "low_risk", "confidence": 0.6}
```

---

## Incident Runbook

```
  +----------------------------------------------------------+
  |  ML INCIDENT RUNBOOK                                      |
  +----------------------------------------------------------+
  |                                                          |
  |  STEP 1: ASSESS (2 minutes)                              |
  |  +------------------------------------------------------+|
  |  | - What is the impact? (users affected, $$ at risk)    ||
  |  | - When did it start? (check monitoring dashboard)     ||
  |  | - What changed recently? (deploy, data, config)       ||
  |  +------------------------------------------------------+|
  |                                                          |
  |  STEP 2: CONTAIN (5 minutes)                              |
  |  +------------------------------------------------------+|
  |  | - Can we rollback the model? --> DO IT                ||
  |  | - Can we enable fallback? --> DO IT                   ||
  |  | - Can we reduce traffic? --> DO IT                    ||
  |  | - Communicate to stakeholders                         ||
  |  +------------------------------------------------------+|
  |                                                          |
  |  STEP 3: DIAGNOSE (30 minutes)                            |
  |  +------------------------------------------------------+|
  |  | - Check data pipeline: is input data correct?         ||
  |  | - Check model: is it the right version?               ||
  |  | - Check infrastructure: resource issues?              ||
  |  | - Check feature store: are features fresh?            ||
  |  +------------------------------------------------------+|
  |                                                          |
  |  STEP 4: FIX (varies)                                     |
  |  +------------------------------------------------------+|
  |  | - Apply fix to root cause                             ||
  |  | - Test fix in staging                                 ||
  |  | - Deploy fix with canary                              ||
  |  | - Monitor closely for 24 hours                        ||
  |  +------------------------------------------------------+|
  |                                                          |
  |  STEP 5: POST-MORTEM (within 48 hours)                    |
  |  +------------------------------------------------------+|
  |  | - Write timeline of events                            ||
  |  | - Identify root cause                                 ||
  |  | - List action items to prevent recurrence             ||
  |  | - Share learnings with team                           ||
  |  +------------------------------------------------------+|
  +----------------------------------------------------------+
```

---

## Automated Incident Detection

```python
from enum import Enum
from dataclasses import dataclass, field
from datetime import datetime, timezone


class IncidentSeverity(str, Enum):
    SEV1 = "sev1"
    SEV2 = "sev2"
    SEV3 = "sev3"


@dataclass
class Incident:
    title: str
    severity: IncidentSeverity
    detected_at: str
    description: str
    metrics: dict
    actions_taken: list[str] = field(default_factory=list)
    resolved_at: str | None = None
    root_cause: str | None = None


class IncidentDetector:
    def __init__(self):
        self.rules: list[dict] = []

    def add_rule(
        self,
        name: str,
        condition_fn: callable,
        severity: IncidentSeverity,
        description: str,
    ):
        self.rules.append({
            "name": name,
            "condition_fn": condition_fn,
            "severity": severity,
            "description": description,
        })

    def check(self, metrics: dict) -> list[Incident]:
        incidents = []
        for rule in self.rules:
            if rule["condition_fn"](metrics):
                incidents.append(Incident(
                    title=rule["name"],
                    severity=rule["severity"],
                    detected_at=datetime.now(timezone.utc).isoformat(),
                    description=rule["description"],
                    metrics=metrics,
                ))
        return incidents


detector = IncidentDetector()

detector.add_rule(
    name="High Error Rate",
    condition_fn=lambda m: m.get("error_rate", 0) > 0.05,
    severity=IncidentSeverity.SEV1,
    description="Error rate exceeded 5% threshold",
)

detector.add_rule(
    name="Latency Spike",
    condition_fn=lambda m: m.get("latency_p99_ms", 0) > 500,
    severity=IncidentSeverity.SEV2,
    description="P99 latency exceeded 500ms",
)

detector.add_rule(
    name="Prediction Collapse",
    condition_fn=lambda m: m.get("unique_predictions", 10) < 2,
    severity=IncidentSeverity.SEV1,
    description="Model returning same prediction for all inputs",
)

detector.add_rule(
    name="Stale Model",
    condition_fn=lambda m: m.get("model_age_days", 0) > 30,
    severity=IncidentSeverity.SEV3,
    description="Model has not been retrained in over 30 days",
)
```

---

## Post-Mortem Template

```python
@dataclass
class PostMortem:
    incident: Incident
    timeline: list[dict]
    root_cause: str
    contributing_factors: list[str]
    what_went_well: list[str]
    what_went_wrong: list[str]
    action_items: list[dict]

    def to_markdown(self) -> str:
        lines = [
            f"# Post-Mortem: {self.incident.title}",
            f"**Severity:** {self.incident.severity.value}",
            f"**Detected:** {self.incident.detected_at}",
            f"**Resolved:** {self.incident.resolved_at or 'Ongoing'}",
            "",
            "## Timeline",
        ]
        for event in self.timeline:
            lines.append(f"- **{event['time']}**: {event['description']}")

        lines.extend([
            "",
            "## Root Cause",
            self.root_cause,
            "",
            "## Action Items",
        ])
        for item in self.action_items:
            lines.append(f"- [{item['priority']}] {item['description']} (Owner: {item['owner']})")

        return "\n".join(lines)
```

---

## Exercises

1. **Rollback System**: Implement `ModelRollbackManager`. Deploy
   3 versions, then rollback to v1. Verify the current symlink
   points to the correct version.

2. **Fallback Predictor**: Build a `FallbackPredictor` that
   uses a model when available and falls back to rules when
   the model fails. Simulate 100 requests where 10% fail.

3. **Incident Detector**: Configure 5 detection rules. Feed
   metrics that should trigger 2 of them and verify only
   those 2 incidents are created.

4. **Post-Mortem**: Write a post-mortem for a fictional
   incident: "Model started predicting all transactions as
   fraud after a data pipeline change." Include timeline,
   root cause, and 3 action items.

---

[Next: Lesson 15 - Cloud ML Services -->](15-cloud-ml-services.md)
