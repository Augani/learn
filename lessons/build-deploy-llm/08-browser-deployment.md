# Lesson 08: Browser Deployment

Your model is exported to ONNX. Now you put it in a browser. This
lesson builds a complete HTML/JavaScript application that loads your
ONNX model, takes text input, and generates Python code completions —
all running locally in the user's browser. No server required.

---

## The Core Idea

Running ML models in the browser used to be impractical. ONNX Runtime
Web changed that. It uses WebAssembly (WASM) and optionally WebGL/WebGPU
to run ONNX models directly in JavaScript.

```
Browser Deployment Architecture:

  ┌─────────────────────────────────────────────┐
  │  BROWSER                                     │
  │                                               │
  │  ┌──────────┐    ┌──────────────────────┐   │
  │  │  HTML UI  │    │  ONNX Runtime Web    │   │
  │  │  - Input  │───▶│  - Load model.onnx   │   │
  │  │  - Button │    │  - Run inference     │   │
  │  │  - Output │◀───│  - Return logits     │   │
  │  └──────────┘    └──────────────────────┘   │
  │                           │                   │
  │                    ┌──────┴──────┐            │
  │                    │ model.onnx  │            │
  │                    │ vocab.json  │            │
  │                    └─────────────┘            │
  │                                               │
  │  Everything runs locally. No server calls.    │
  └─────────────────────────────────────────────┘
```

---

## Project Structure

```
deploy/browser/
├── index.html          # Main page
├── app.js              # Application logic
├── tokenizer.js        # BPE tokenizer in JavaScript
├── model/
│   ├── model.onnx      # Your exported model
│   └── vocab.json      # Tokenizer vocabulary
└── README.md
```

---

## Step 1: The HTML Page

```html
<!-- deploy/browser/index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mini LLM — Python Code Completion</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            background: #1a1a2e;
            color: #e0e0e0;
            min-height: 100vh;
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 2rem;
        }
        h1 {
            color: #00d4ff;
            margin-bottom: 0.5rem;
            font-size: 1.8rem;
        }
        .subtitle {
            color: #888;
            margin-bottom: 2rem;
            font-size: 0.9rem;
        }
        .container {
            width: 100%;
            max-width: 800px;
        }
        .editor {
            width: 100%;
            min-height: 200px;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 1rem;
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 14px;
            color: #c9d1d9;
            resize: vertical;
            line-height: 1.6;
        }
        .editor:focus {
            outline: none;
            border-color: #00d4ff;
        }
        .controls {
            display: flex;
            gap: 1rem;
            margin: 1rem 0;
            align-items: center;
        }
        button {
            padding: 0.6rem 1.5rem;
            border: none;
            border-radius: 6px;
            font-size: 0.95rem;
            cursor: pointer;
            transition: background 0.2s;
        }
        #generate-btn {
            background: #00d4ff;
            color: #1a1a2e;
            font-weight: 600;
        }
        #generate-btn:hover {
            background: #00b8d9;
        }
        #generate-btn:disabled {
            background: #555;
            cursor: not-allowed;
        }
        #clear-btn {
            background: #30363d;
            color: #e0e0e0;
        }
        .settings {
            display: flex;
            gap: 1rem;
            align-items: center;
            font-size: 0.85rem;
            color: #888;
        }
        .settings label {
            display: flex;
            align-items: center;
            gap: 0.3rem;
        }
        .settings input {
            width: 60px;
            padding: 0.2rem 0.4rem;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 4px;
            color: #e0e0e0;
            font-size: 0.85rem;
        }
        .output {
            width: 100%;
            min-height: 200px;
            background: #0d1117;
            border: 1px solid #30363d;
            border-radius: 8px;
            padding: 1rem;
            font-family: 'Fira Code', 'Consolas', monospace;
            font-size: 14px;
            color: #7ee787;
            white-space: pre-wrap;
            line-height: 1.6;
        }
        .status {
            margin-top: 1rem;
            font-size: 0.85rem;
            color: #888;
        }
        .status.loading { color: #f0ad4e; }
        .status.ready { color: #7ee787; }
        .status.error { color: #f85149; }
    </style>
</head>
<body>
    <h1>Mini LLM</h1>
    <p class="subtitle">Python code completion — running entirely in your browser</p>

    <div class="container">
        <textarea class="editor" id="input"
            placeholder="Type Python code here...&#10;&#10;Example: def fibonacci(n):"
            spellcheck="false">def fibonacci(n):
</textarea>

        <div class="controls">
            <button id="generate-btn" disabled>Generate</button>
            <button id="clear-btn">Clear</button>
            <div class="settings">
                <label>Tokens: <input type="number" id="max-tokens" value="100" min="10" max="500"></label>
                <label>Temp: <input type="number" id="temperature" value="0.8" min="0.1" max="2.0" step="0.1"></label>
            </div>
        </div>

        <div class="output" id="output">Generated code will appear here...</div>

        <div class="status" id="status">Loading model...</div>
    </div>

    <!-- ONNX Runtime Web -->
    <script src="https://cdn.jsdelivr.net/npm/onnxruntime-web/dist/ort.min.js"></script>
    <script src="tokenizer.js"></script>
    <script src="app.js"></script>
</body>
</html>
```

---

## Step 2: BPE Tokenizer in JavaScript

We need to port the tokenizer to JavaScript. It must produce the same
token IDs as the Python version.

```javascript
// deploy/browser/tokenizer.js

class BPETokenizer {
    constructor() {
        this.merges = new Map();  // "tokenA,tokenB" → newTokenId
        this.vocab = new Map();   // tokenId → Uint8Array
        this.mergeList = [];      // Ordered list of merges

        // Initialize base vocabulary (256 bytes)
        for (let i = 0; i < 256; i++) {
            this.vocab.set(i, new Uint8Array([i]));
        }
    }

    static async load(vocabPath) {
        const tokenizer = new BPETokenizer();
        const response = await fetch(vocabPath);
        const data = await response.json();

        // Reconstruct merges in order
        for (const [pairStr, newId] of Object.entries(data.merges)) {
            const [a, b] = pairStr.split(",").map(Number);
            tokenizer.merges.set(`${a},${b}`, newId);
            tokenizer.mergeList.push({ pair: [a, b], newId: newId });

            // Build vocab entry for merged token
            const bytesA = tokenizer.vocab.get(a) || new Uint8Array([a]);
            const bytesB = tokenizer.vocab.get(b) || new Uint8Array([b]);
            const merged = new Uint8Array(bytesA.length + bytesB.length);
            merged.set(bytesA);
            merged.set(bytesB, bytesA.length);
            tokenizer.vocab.set(newId, merged);
        }

        console.log(`Loaded tokenizer with ${tokenizer.vocab.size} tokens`);
        return tokenizer;
    }

    encode(text) {
        // Convert text to UTF-8 bytes
        const encoder = new TextEncoder();
        let tokens = Array.from(encoder.encode(text));

        // Apply merges in learned order
        for (const { pair, newId } of this.mergeList) {
            tokens = this._mergePair(tokens, pair, newId);
        }

        return tokens;
    }

    decode(tokenIds) {
        const bytes = [];
        for (const id of tokenIds) {
            const tokenBytes = this.vocab.get(id);
            if (tokenBytes) {
                bytes.push(...tokenBytes);
            }
        }
        const decoder = new TextDecoder("utf-8", { fatal: false });
        return decoder.decode(new Uint8Array(bytes));
    }

    _mergePair(tokens, pair, newId) {
        const result = [];
        let i = 0;
        while (i < tokens.length) {
            if (i < tokens.length - 1 &&
                tokens[i] === pair[0] &&
                tokens[i + 1] === pair[1]) {
                result.push(newId);
                i += 2;
            } else {
                result.push(tokens[i]);
                i += 1;
            }
        }
        return result;
    }
}
```

---

## Step 3: Application Logic

The main application loads the model, handles user input, and runs
generation with streaming output.

```javascript
// deploy/browser/app.js

class MiniLLMApp {
    constructor() {
        this.session = null;
        this.tokenizer = null;
        this.isGenerating = false;

        // DOM elements
        this.inputEl = document.getElementById("input");
        this.outputEl = document.getElementById("output");
        this.generateBtn = document.getElementById("generate-btn");
        this.clearBtn = document.getElementById("clear-btn");
        this.statusEl = document.getElementById("status");
        this.maxTokensEl = document.getElementById("max-tokens");
        this.temperatureEl = document.getElementById("temperature");

        // Event listeners
        this.generateBtn.addEventListener("click", () => this.generate());
        this.clearBtn.addEventListener("click", () => this.clear());

        // Initialize
        this.init();
    }

    async init() {
        try {
            this.setStatus("Loading tokenizer...", "loading");
            this.tokenizer = await BPETokenizer.load("model/vocab.json");

            this.setStatus("Loading model (this may take a moment)...", "loading");
            this.session = await ort.InferenceSession.create("model/model.onnx", {
                executionProviders: ["wasm"],
            });

            this.setStatus("Ready! Type Python code and click Generate.", "ready");
            this.generateBtn.disabled = false;
        } catch (error) {
            this.setStatus(`Error loading model: ${error.message}`, "error");
            console.error("Init error:", error);
        }
    }

    async generate() {
        if (this.isGenerating || !this.session) return;

        this.isGenerating = true;
        this.generateBtn.disabled = true;
        this.outputEl.textContent = "";

        const prompt = this.inputEl.value;
        const maxTokens = parseInt(this.maxTokensEl.value) || 100;
        const temperature = parseFloat(this.temperatureEl.value) || 0.8;
        const topK = 50;

        try {
            this.setStatus("Generating...", "loading");

            // Encode prompt
            let tokens = this.tokenizer.encode(prompt);
            let generatedText = prompt;

            for (let i = 0; i < maxTokens; i++) {
                // Prepare input tensor
                const inputTensor = new ort.Tensor(
                    "int64",
                    BigInt64Array.from(tokens.map(BigInt)),
                    [1, tokens.length]
                );

                // Run inference
                const results = await this.session.run({ input_ids: inputTensor });
                const logits = results.logits.data;

                // Get logits for last position
                const vocabSize = results.logits.dims[2];
                const lastLogits = new Float32Array(vocabSize);
                const offset = (tokens.length - 1) * vocabSize;
                for (let v = 0; v < vocabSize; v++) {
                    lastLogits[v] = logits[offset + v] / temperature;
                }

                // Top-k filtering
                const nextToken = this.sampleTopK(lastLogits, topK);
                tokens.push(nextToken);

                // Decode and display incrementally
                generatedText = this.tokenizer.decode(tokens);
                this.outputEl.textContent = generatedText;

                // Small delay for visual streaming effect
                if (i % 5 === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }

                this.setStatus(
                    `Generating... ${i + 1}/${maxTokens} tokens`,
                    "loading"
                );
            }

            this.setStatus(
                `Done! Generated ${maxTokens} tokens.`,
                "ready"
            );
        } catch (error) {
            this.setStatus(`Error: ${error.message}`, "error");
            console.error("Generation error:", error);
        } finally {
            this.isGenerating = false;
            this.generateBtn.disabled = false;
        }
    }

    sampleTopK(logits, k) {
        // Find top-k indices
        const indexed = Array.from(logits).map((val, idx) => ({ val, idx }));
        indexed.sort((a, b) => b.val - a.val);
        const topK = indexed.slice(0, k);

        // Softmax over top-k
        const maxVal = topK[0].val;
        const expValues = topK.map(item => ({
            idx: item.idx,
            exp: Math.exp(item.val - maxVal),
        }));
        const sumExp = expValues.reduce((sum, item) => sum + item.exp, 0);
        const probs = expValues.map(item => ({
            idx: item.idx,
            prob: item.exp / sumExp,
        }));

        // Sample from distribution
        let random = Math.random();
        for (const { idx, prob } of probs) {
            random -= prob;
            if (random <= 0) return idx;
        }
        return probs[probs.length - 1].idx;
    }

    clear() {
        this.inputEl.value = "";
        this.outputEl.textContent = "Generated code will appear here...";
    }

    setStatus(message, type) {
        this.statusEl.textContent = message;
        this.statusEl.className = `status ${type}`;
    }
}

// Start the app
const app = new MiniLLMApp();
```

---

## Step 4: Prepare Model Files

Copy your ONNX model and tokenizer vocabulary into the browser
deployment directory:

```python
# prepare_browser_deploy.py

import shutil
import os


def prepare_browser_deployment():
    """Copy model files to browser deployment directory."""
    browser_dir = "deploy/browser/model"
    os.makedirs(browser_dir, exist_ok=True)

    # Copy ONNX model
    shutil.copy("deploy/model.onnx", os.path.join(browser_dir, "model.onnx"))

    # Copy tokenizer vocabulary
    shutil.copy("tokenizer/vocab.json", os.path.join(browser_dir, "vocab.json"))

    # Report sizes
    model_size = os.path.getsize(os.path.join(browser_dir, "model.onnx"))
    vocab_size = os.path.getsize(os.path.join(browser_dir, "vocab.json"))

    print(f"Browser deployment ready:")
    print(f"  Model: {model_size / 1024 / 1024:.1f} MB")
    print(f"  Vocab: {vocab_size / 1024:.1f} KB")
    print(f"\nTo run: serve the deploy/browser/ directory with any HTTP server:")
    print(f"  python -m http.server 8000 --directory deploy/browser")
    print(f"  Then open http://localhost:8000")


prepare_browser_deployment()
```

---

## Running the Browser Demo

```bash
# Serve the browser directory
python -m http.server 8000 --directory deploy/browser

# Open in your browser:
# http://localhost:8000
```

```
What You Should See:

  ┌──────────────────────────────────────────────┐
  │  Mini LLM                                     │
  │  Python code completion — running in browser  │
  │                                               │
  │  ┌──────────────────────────────────────┐    │
  │  │ def fibonacci(n):                     │    │
  │  │ █                                     │    │
  │  └──────────────────────────────────────┘    │
  │                                               │
  │  [Generate]  [Clear]  Tokens: 100  Temp: 0.8 │
  │                                               │
  │  ┌──────────────────────────────────────┐    │
  │  │ def fibonacci(n):                     │    │
  │  │     if n <= 1:                        │    │
  │  │         return n                      │    │
  │  │     return fibonacci(n-1) +           │    │
  │  │         fibonacci(n-2)                │    │
  │  └──────────────────────────────────────┘    │
  │                                               │
  │  ✓ Ready! Generated 100 tokens.              │
  └──────────────────────────────────────────────┘
```

---

## Performance Notes

```
Browser Performance Expectations:

  ┌──────────────────────────────────────────────┐
  │  Model loading:  2-5 seconds (first load)    │
  │                  Cached after first load      │
  │                                               │
  │  Token generation:                            │
  │    WASM backend:  ~5-15 tokens/sec           │
  │    WebGL backend: ~15-30 tokens/sec          │
  │    WebGPU backend: ~30-60 tokens/sec         │
  │                                               │
  │  Our 15M model is small enough that WASM     │
  │  performance is acceptable for a demo.        │
  │                                               │
  │  For larger models, WebGPU is essential.      │
  └──────────────────────────────────────────────┘
```

---

## Exercises

### Exercise 1: Deploy and Test

Set up the browser deployment. Verify:
- Model loads without errors
- Generation produces reasonable Python code
- The UI is responsive during generation

### Exercise 2: Add Stop Button

Add a "Stop" button that cancels generation mid-stream. Hint: use a
boolean flag that the generation loop checks.

### Exercise 3: Syntax Highlighting

Add basic syntax highlighting to the output. Color Python keywords
(def, class, if, for, return, import) differently from strings and
comments. You can use a simple regex-based approach or integrate a
library like Prism.js.

---

Next: [Lesson 09: CLI Tool Deployment](./09-cli-tool.md)
