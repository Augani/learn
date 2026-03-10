# Lesson 11: From Prototype to Production

> **Analogy**: Research code is a proof of concept -- a hand-built
> prototype car that drives once around the block to prove the engine
> works. Production code is the factory-built version that needs to
> start in winter, survive potholes, pass safety inspections, and
> run for 200,000 miles. Same engine, entirely different standards.

---

## The Gap

Research code and production code serve different masters.

```
Research code:                Production code:
  Proves an idea works         Must work every time
  Runs once on one dataset     Runs millions of times on live data
  Crashes are informative      Crashes cost money
  Speed doesn't matter         Latency has SLAs
  One person reads it          Team maintains it for years
  "It works on my machine"     "It works everywhere"
```

The gap is real and it's wider than most researchers think. A Google
study found that only 5-10% of ML code in production systems is the
actual model. The rest is data pipelines, serving infrastructure,
monitoring, and configuration.

```
The real ML system:

  +----------------------------------------------+
  |                                              |
  |   +--------+                                 |
  |   | MODEL  |  <-- The part papers cover     |
  |   +--------+                                 |
  |                                              |
  |   Data pipeline | Feature store | Config     |
  |   Serving       | Monitoring   | Testing     |
  |   Logging       | Versioning   | Alerting    |
  |   Fallbacks     | A/B testing  | Rollback    |
  |                                              |
  +----------------------------------------------+
       ^
       The actual production system
```

---

## Refactoring Research Code

### Step 1: Extract Configuration

Research code has magic numbers everywhere. The first refactoring
step is pulling them out.

```python
HIDDEN_DIM = 768
NUM_HEADS = 12
LEARNING_RATE = 3e-4
BATCH_SIZE = 32
MAX_LENGTH = 512

model = Transformer(HIDDEN_DIM, NUM_HEADS)
```

becomes:

```python
from dataclasses import dataclass
from typing import Optional

@dataclass(frozen=True)
class ModelConfig:
    hidden_dim: int = 768
    num_heads: int = 12
    num_layers: int = 6
    vocab_size: int = 32000
    max_length: int = 512
    dropout: float = 0.1

    def __post_init__(self):
        if self.hidden_dim % self.num_heads != 0:
            raise ValueError(
                f"hidden_dim ({self.hidden_dim}) must be divisible "
                f"by num_heads ({self.num_heads})"
            )

@dataclass(frozen=True)
class TrainingConfig:
    learning_rate: float = 3e-4
    batch_size: int = 32
    num_epochs: int = 10
    weight_decay: float = 0.01
    warmup_fraction: float = 0.1
    gradient_clip: float = 1.0
    checkpoint_dir: str = "checkpoints"
```

### Step 2: Add Input Validation

Research code assumes good inputs. Production code gets garbage.

```python
def predict(self, text: str) -> dict:
    if not text or not text.strip():
        return {"label": "unknown", "confidence": 0.0}

    if len(text) > self.config.max_input_length:
        text = text[:self.config.max_input_length]

    tokens = self.tokenizer.encode(text)
    if len(tokens) == 0:
        return {"label": "unknown", "confidence": 0.0}

    if len(tokens) > self.config.max_length:
        tokens = tokens[:self.config.max_length]

    input_ids = torch.tensor([tokens], device=self.device)

    with torch.no_grad():
        logits = self.model(input_ids)
        probs = torch.softmax(logits, dim=-1)
        confidence, predicted = probs.max(dim=-1)

    return {
        "label": self.label_map[predicted.item()],
        "confidence": confidence.item(),
        "input_length": len(tokens),
    }
```

### Step 3: Handle Edge Cases

```
Research code handles:          Production code must handle:

  Normal inputs                   Empty inputs
  Expected shapes                 Wrong shapes
  Clean data                      Corrupted data
  GPU available                   GPU not available
  Enough memory                   Out of memory
  Network works                   Network timeout
  Model loaded                    Model file missing
  One request at a time           Concurrent requests
  English text                    Any encoding
```

```python
class ModelServer:
    def __init__(self, model_path: str, config: ModelConfig):
        self.config = config
        self.device = self._select_device()
        self.model = self._load_model(model_path)

    def _select_device(self) -> torch.device:
        if torch.cuda.is_available():
            device = torch.device("cuda")
            free_memory = torch.cuda.get_device_properties(0).total_mem
            if free_memory < self.config.min_gpu_memory:
                print(f"Insufficient GPU memory, falling back to CPU")
                return torch.device("cpu")
            return device
        return torch.device("cpu")

    def _load_model(self, path: str) -> nn.Module:
        if not Path(path).exists():
            raise FileNotFoundError(f"Model not found: {path}")

        try:
            state_dict = torch.load(path, map_location=self.device, weights_only=True)
            model = build_model(self.config)
            model.load_state_dict(state_dict)
            model.to(self.device)
            model.eval()
            return model
        except Exception as exc:
            raise RuntimeError(f"Failed to load model from {path}: {exc}") from exc
```

---

## Testing ML Systems

ML code is notoriously under-tested. But the testing strategies
are different from traditional software.

### Level 1: Unit Tests

Test individual components in isolation.

```python
import pytest
import torch

class TestModel:
    def setup_method(self):
        self.config = ModelConfig(hidden_dim=64, num_heads=4, num_layers=2)
        self.model = TransformerModel(self.config)

    def test_output_shape(self):
        batch_size, seq_len = 2, 10
        input_ids = torch.randint(0, self.config.vocab_size, (batch_size, seq_len))
        output = self.model(input_ids)
        assert output.shape == (batch_size, self.config.num_classes)

    def test_different_sequence_lengths(self):
        for seq_len in [1, 10, 100, 512]:
            input_ids = torch.randint(0, self.config.vocab_size, (1, seq_len))
            output = self.model(input_ids)
            assert output.shape == (1, self.config.num_classes)

    def test_batch_independence(self):
        input_a = torch.randint(0, self.config.vocab_size, (1, 10))
        input_b = torch.randint(0, self.config.vocab_size, (1, 10))

        out_a_solo = self.model(input_a)
        combined = torch.cat([input_a, input_b], dim=0)
        out_combined = self.model(combined)

        assert torch.allclose(out_a_solo, out_combined[0:1], atol=1e-5)

    def test_deterministic(self):
        self.model.eval()
        input_ids = torch.randint(0, self.config.vocab_size, (2, 10))
        out1 = self.model(input_ids)
        out2 = self.model(input_ids)
        assert torch.equal(out1, out2)
```

### Level 2: Integration Tests

Test the full pipeline from raw input to final prediction.

```python
class TestPipeline:
    def setup_method(self):
        self.pipeline = InferencePipeline(
            model_path="test_fixtures/small_model.pt",
            config=ModelConfig(hidden_dim=64, num_heads=4, num_layers=2),
        )

    def test_end_to_end(self):
        result = self.pipeline.predict("This is a test input")
        assert "label" in result
        assert "confidence" in result
        assert 0.0 <= result["confidence"] <= 1.0

    def test_empty_input(self):
        result = self.pipeline.predict("")
        assert result["label"] == "unknown"
        assert result["confidence"] == 0.0

    def test_very_long_input(self):
        long_text = "word " * 10000
        result = self.pipeline.predict(long_text)
        assert "label" in result

    def test_unicode_input(self):
        result = self.pipeline.predict("Cafe with unicode")
        assert "label" in result

    def test_batch_processing(self):
        inputs = ["text one", "text two", "text three"]
        results = self.pipeline.predict_batch(inputs)
        assert len(results) == 3
```

### Level 3: ML-Specific Tests

Tests unique to ML systems.

```python
class TestModelBehavior:
    def test_invariance(self):
        """Adding extra spaces shouldn't change prediction."""
        result_a = pipeline.predict("great product")
        result_b = pipeline.predict("great  product")
        assert result_a["label"] == result_b["label"]

    def test_directional(self):
        """Adding 'not' should change sentiment direction."""
        pos = pipeline.predict("This movie is great")
        neg = pipeline.predict("This movie is not great")
        assert pos["label"] != neg["label"]

    def test_minimum_performance(self):
        """Model must exceed baseline on standard test set."""
        test_data = load_test_set("fixtures/test_data.json")
        accuracy = evaluate(pipeline, test_data)
        assert accuracy > 0.85, f"Accuracy {accuracy} below threshold 0.85"

    def test_fairness(self):
        """Performance shouldn't vary wildly across subgroups."""
        subgroup_results = {}
        for subgroup, data in load_subgroup_data().items():
            subgroup_results[subgroup] = evaluate(pipeline, data)

        accuracies = list(subgroup_results.values())
        max_gap = max(accuracies) - min(accuracies)
        assert max_gap < 0.10, (
            f"Fairness gap {max_gap:.2f} exceeds threshold. "
            f"Results: {subgroup_results}"
        )

    def test_calibration(self):
        """High-confidence predictions should be accurate."""
        test_data = load_test_set("fixtures/test_data.json")
        high_conf = [
            (pred, true) for pred, true in get_predictions(pipeline, test_data)
            if pred["confidence"] > 0.9
        ]
        high_conf_accuracy = sum(
            1 for pred, true in high_conf if pred["label"] == true
        ) / len(high_conf)
        assert high_conf_accuracy > 0.95
```

---

## Model Export and Serving

### Exporting Models

```python
def export_onnx(model, config, output_path):
    model.eval()
    dummy_input = torch.randint(
        0, config.vocab_size, (1, config.max_length)
    )

    torch.onnx.export(
        model,
        dummy_input,
        output_path,
        input_names=["input_ids"],
        output_names=["logits"],
        dynamic_axes={
            "input_ids": {0: "batch_size", 1: "sequence_length"},
            "logits": {0: "batch_size"},
        },
        opset_version=17,
    )

    import onnx
    onnx_model = onnx.load(output_path)
    onnx.checker.check_model(onnx_model)
    print(f"Exported to {output_path}")


def export_torchscript(model, config, output_path):
    model.eval()
    dummy_input = torch.randint(
        0, config.vocab_size, (1, config.max_length)
    )
    traced = torch.jit.trace(model, dummy_input)
    traced.save(output_path)
    print(f"Exported to {output_path}")
```

### Serving Architecture

```
Simple serving setup:

  Client --> Load Balancer --> Inference Server(s) --> Model
                                    |
                                    v
                              Monitoring/Logging

  +------------------+
  | Inference Server |
  |                  |
  | 1. Preprocess    |  Tokenize, normalize, validate
  | 2. Batch         |  Accumulate requests for efficiency
  | 3. Infer         |  Run model forward pass
  | 4. Postprocess   |  Format output, apply thresholds
  | 5. Return        |  Send response
  +------------------+
```

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
from typing import List

app = FastAPI()

class PredictionRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=10000)

class PredictionResponse(BaseModel):
    label: str
    confidence: float
    latency_ms: float

class BatchRequest(BaseModel):
    texts: List[str] = Field(..., min_length=1, max_length=64)

@app.post("/predict", response_model=PredictionResponse)
async def predict(request: PredictionRequest):
    start = time.perf_counter()

    try:
        result = model_server.predict(request.text)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    latency = (time.perf_counter() - start) * 1000
    return PredictionResponse(
        label=result["label"],
        confidence=result["confidence"],
        latency_ms=round(latency, 2),
    )

@app.get("/health")
async def health():
    return {"status": "healthy", "model_loaded": model_server.is_ready()}
```

---

## Documentation for ML Code

ML code needs specific documentation that regular code doesn't.

### Model Card

```
# Model Card: Sentiment Classifier v2.1

## Model Details
- Architecture: DistilBERT fine-tuned, 66M parameters
- Training data: 100K customer reviews (Jan-Dec 2023)
- Training compute: 4 GPU-hours on A100
- Framework: PyTorch 2.1, Transformers 4.35

## Intended Use
- Classify customer support tickets by sentiment
- NOT for: content moderation, clinical/legal text

## Performance
- Accuracy: 91.2% (+/- 0.3) on held-out test set
- Latency: 12ms p50, 25ms p99 on A100
- Throughput: 500 requests/sec (batch size 32)

## Limitations
- English only
- Degrades on very short text (< 5 words)
- Sarcasm detection is poor (~60% accuracy)
- Not tested on formal/legal language

## Ethical Considerations
- Trained on US customer data; may not generalize to other regions
- No demographic fairness audit has been performed
```

---

## Code Review Checklist for ML

```
When reviewing ML code for production:

Architecture:
  [ ] Model config is serializable and version-controlled
  [ ] No hardcoded dimensions or hyperparameters
  [ ] Model can be exported (ONNX/TorchScript)

Data:
  [ ] Input validation on all user-facing endpoints
  [ ] Handles missing/null values
  [ ] Handles unexpected types and encodings
  [ ] Max input length is enforced

Inference:
  [ ] Model is in eval mode
  [ ] torch.no_grad() wraps inference
  [ ] Device handling is correct (CPU fallback)
  [ ] Batching is supported

Reliability:
  [ ] Health check endpoint exists
  [ ] Graceful error handling (no bare except)
  [ ] Timeout handling for long inputs
  [ ] Memory limits enforced

Monitoring:
  [ ] Latency is logged
  [ ] Prediction distribution is tracked
  [ ] Errors are logged with context
  [ ] Input/output examples are sampled for debugging
```

---

## Practical Exercise

Take one of your models from a previous lesson and production-ify
it:

1. **Extract config**: Pull all magic numbers into dataclasses
2. **Add validation**: Handle empty, too-long, and malformed inputs
3. **Write tests**: Unit, integration, and ML-specific
4. **Export**: ONNX or TorchScript
5. **Serve**: Build a FastAPI endpoint with health check
6. **Document**: Write a model card

This exercise bridges the gap between "I can train a model" and
"I can ship a model."

---

## Key Takeaways

- The model is 5-10% of a production ML system -- the rest is
  infrastructure
- Configuration extraction is the first and most impactful
  refactoring step
- ML systems need ML-specific tests: invariance, directional,
  minimum performance, fairness
- Always validate inputs -- production data is nothing like your
  clean benchmark
- Model cards document what traditional docs miss: limitations,
  intended use, ethical considerations
- Health checks, monitoring, and graceful degradation are
  non-negotiable in production

Next lesson: the capstone project where you put it all together.
