# Deployment Checklist Reference

Use this checklist before shipping your model. Each section covers a
deployment stage with specific verification steps and target metrics.

---

## 1. Model Training Verification

```
□ Training loss converged (below 2.0 for our model)
□ Validation loss is within 0.5 of training loss (no severe overfitting)
□ Generation quality is reasonable on test prompts
□ Best checkpoint saved and verified
□ Training curves plotted and reviewed
```

---

## 2. ONNX Export Verification

```
□ ONNX export completes without errors
□ ONNX model file is created
□ Verification tests pass (PyTorch vs ONNX output match, tolerance < 1e-4)
□ Dynamic axes work (tested with different sequence lengths)
□ ONNX Runtime can load and run the model
□ Generation with ONNX Runtime produces same quality as PyTorch
```

---

## 3. Size Targets

```
┌──────────────────────────────────────────────┐
│  Format          │  Target Size  │  Actual   │
├──────────────────┼───────────────┼───────────┤
│  PyTorch FP32    │  ~60 MB       │  _____ MB │
│  ONNX FP32       │  ~60 MB       │  _____ MB │
│  Quantized INT8  │  ~15-20 MB    │  _____ MB │
│  ONNX (quantized)│  ~15-20 MB    │  _____ MB │
└──────────────────────────────────────────────┘

For browser deployment: aim for < 30 MB total
(model + tokenizer vocabulary)
```

---

## 4. Latency Benchmarks

```
┌──────────────────────────────────────────────────────┐
│  Runtime              │  Target       │  Actual       │
├───────────────────────┼───────────────┼───────────────┤
│  PyTorch GPU          │  > 100 tok/s  │  _____ tok/s  │
│  PyTorch CPU (FP32)   │  > 10 tok/s   │  _____ tok/s  │
│  ONNX Runtime CPU     │  > 15 tok/s   │  _____ tok/s  │
│  ONNX Runtime (INT8)  │  > 25 tok/s   │  _____ tok/s  │
│  Browser (WASM)       │  > 5 tok/s    │  _____ tok/s  │
│  Browser (WebGPU)     │  > 20 tok/s   │  _____ tok/s  │
└──────────────────────────────────────────────────────┘

Measure with: 50 tokens generated, average of 5 runs,
excluding first run (warmup).
```

---

## 5. Browser Deployment Checklist

```
□ model.onnx copied to deploy/browser/model/
□ vocab.json copied to deploy/browser/model/
□ ONNX Runtime Web loaded from CDN (or bundled)
□ Page loads without JavaScript errors
□ Model loads successfully (check console)
□ Tokenizer loads and encodes/decodes correctly
□ Generation produces output
□ UI is responsive during generation
□ Works in Chrome (latest)
□ Works in Firefox (latest)
□ Works in Safari (latest)
□ Works in Edge (latest)
□ Error handling: graceful message if model fails to load
□ Error handling: graceful message if generation fails
```

### Browser Compatibility Notes

```
┌──────────────────────────────────────────────────────┐
│  Feature          │  Chrome  │  Firefox │  Safari    │
├───────────────────┼──────────┼──────────┼────────────┤
│  WASM             │  ✓       │  ✓       │  ✓         │
│  WebGL            │  ✓       │  ✓       │  ✓         │
│  WebGPU           │  ✓       │  Flag    │  Preview   │
│  SharedArrayBuffer│  ✓*      │  ✓*      │  ✓*        │
└──────────────────────────────────────────────────────┘

* SharedArrayBuffer requires cross-origin isolation headers:
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp

  For local development with python -m http.server,
  SharedArrayBuffer may not be available. ONNX Runtime Web
  falls back to single-threaded WASM in this case.
```

---

## 6. CLI Tool Packaging Checklist

```
□ pyproject.toml has correct metadata
□ model.onnx copied to mini_llm_cli/model/
□ vocab.json copied to mini_llm_cli/model/
□ Package installs with: pip install -e .
□ mini-llm command is available after install
□ Basic generation works: mini-llm "def hello():"
□ --file flag works
□ stdin pipe works: echo "def f():" | mini-llm
□ --stream flag works
□ --max-tokens flag works
□ --temperature flag works
□ --help shows usage information
□ Works on Python 3.9+
□ Works without GPU (CPU-only)
□ Works on Linux
□ Works on macOS
□ Works on Windows
□ Error message if model files are missing
□ Error message if onnxruntime not installed
```

### CLI Performance Targets

```
┌──────────────────────────────────────────────┐
│  Metric              │  Target    │  Actual   │
├──────────────────────┼────────────┼───────────┤
│  Model load time     │  < 3 sec   │  _____ s  │
│  First token latency │  < 1 sec   │  _____ s  │
│  Tokens per second   │  > 15      │  _____    │
│  Memory usage        │  < 500 MB  │  _____ MB │
│  Package size        │  < 80 MB   │  _____ MB │
└──────────────────────────────────────────────┘
```

---

## 7. Quality Verification

```
□ Test with 10+ diverse prompts
□ Output is syntactically valid Python (most of the time)
□ Common patterns work: def, class, if/else, for, import
□ Indentation is correct
□ No degenerate outputs (infinite loops, repeated tokens)
□ Temperature 0.1 produces deterministic-ish output
□ Temperature 1.5 produces varied output
□ Quantized model quality is comparable to FP32

Test Prompts:
  1. "def fibonacci(n):"
  2. "class LinkedList:\n    def __init__(self):"
  3. "import os\nimport sys\n\ndef main():"
  4. "# Binary search\ndef binary_search(arr, target):"
  5. "def read_csv(filename):"
  6. "class HTTPServer:\n    def __init__(self, host, port):"
  7. "from typing import List, Optional\n\ndef merge_sort("
  8. "# Calculate the area of a circle\n"
  9. "try:\n    "
  10. "with open('data.json', 'r') as f:\n    "
```

---

## 8. Final Sign-Off

```
┌──────────────────────────────────────────────────────┐
│                                                        │
│  □ Model trained and checkpoint saved                  │
│  □ ONNX export verified                               │
│  □ Quantization applied and benchmarked               │
│  □ Browser demo working                               │
│  □ CLI tool installed and working                     │
│  □ Both deliverables produce reasonable output         │
│                                                        │
│  Congratulations — you built and deployed an LLM       │
│  from scratch.                                         │
│                                                        │
└──────────────────────────────────────────────────────┘
```
