# Optimization Checklist by Bottleneck Type

## How to Use This Reference

1. Profile your workload (see lesson 01 and reference-profiling.md)
2. Identify the bottleneck category
3. Follow the checklist for that category
4. Re-profile after each change to verify improvement

```
  BOTTLENECK IDENTIFICATION FLOWCHART

  GPU utilization < 50%?
  |-- YES --> Data pipeline or CPU bottleneck (see IO-BOUND or CPU-BOUND)
  |-- NO
      |
      GPU memory > 90%?
      |-- YES --> Memory bottleneck (see MEMORY-BOUND)
      |-- NO
          |
          GPU utilization > 90%?
          |-- YES --> Compute bottleneck (see COMPUTE-BOUND)
          |-- NO  --> Mixed bottleneck (check all categories)
```

---

## CPU-BOUND Optimizations

Symptoms: GPU utilization oscillates, CPU at 100%, `py-spy` shows Python
functions dominating time.

### Priority 1: Eliminate Python Overhead

```
[ ] Remove per-step loss.item() calls (sync every N steps instead)
[ ] Remove per-step print statements that touch tensors
[ ] Remove Python-level loops over batch elements (vectorize)
[ ] Remove unnecessary tensor.cpu() or tensor.numpy() conversions
[ ] Use torch.compile to eliminate dispatch overhead
```

### Priority 2: Optimize Data Preprocessing

```
[ ] Move preprocessing to GPU (torchvision transforms v2 with device='cuda')
[ ] Use compiled transforms (torchvision.transforms.v2.Compose)
[ ] Replace PIL-based transforms with tensor-based transforms
[ ] Pre-compute static augmentations and cache them
[ ] Consider NVIDIA DALI for GPU-accelerated preprocessing
```

### Priority 3: Reduce Python-Level Work

```
[ ] Profile with py-spy to find CPU hotspots
[ ] Replace custom Python collate_fn with default or C++ implementation
[ ] Cache tokenization results for NLP (don't re-tokenize every epoch)
[ ] Use multiprocessing for CPU-heavy preprocessing
```

---

## GPU COMPUTE-BOUND Optimizations

Symptoms: GPU utilization steady at 95-100%, memory not full, PyTorch profiler
shows large CUDA times on specific ops.

### Priority 1: Mixed Precision

```
[ ] Enable AMP with bf16 (preferred) or fp16
[ ] Verify GradScaler is used with fp16 (not needed for bf16)
[ ] Check that tensor cores are being utilized (alignment matters:
    dimensions should be multiples of 8 for fp16, multiples of 16 for int8)
```

### Priority 2: torch.compile

```
[ ] Compile model with torch.compile(mode="reduce-overhead")
[ ] Check for graph breaks: torch._dynamo.explain(model)(input)
[ ] Fix top graph breaks for better fusion
[ ] Try mode="max-autotune" for deployment
[ ] Use dynamic=True if input shapes vary
```

### Priority 3: Operator Fusion

```
[ ] Use scaled_dot_product_attention (Flash Attention)
[ ] Verify Flash Attention backend is active:
    torch.backends.cuda.flash_sdp_enabled()
[ ] Use fused optimizer: torch.optim.AdamW(fused=True) (PyTorch 2.0+)
[ ] Replace separate norm+activation+dropout with fused versions
[ ] Consider Triton kernels for custom fused ops
```

### Priority 4: Algorithmic Changes

```
[ ] Use Flash Attention for long sequences
[ ] Consider sparse attention for very long sequences (>8K tokens)
[ ] Use efficient implementations: xFormers, flash-attn package
[ ] Consider model distillation (smaller model, same accuracy)
```

### Priority 5: Hardware-Specific

```
[ ] Ensure matmul dimensions are multiples of 8 (tensor core alignment)
[ ] Use channels-last memory format for CNNs:
    model = model.to(memory_format=torch.channels_last)
[ ] Check cuDNN benchmark mode: torch.backends.cudnn.benchmark = True
```

---

## MEMORY-BOUND Optimizations

Symptoms: OOM errors, GPU memory near capacity, forced to use small batch
sizes, training slower than expected due to memory pressure.

### Priority 1: Quick Wins (No Code Changes)

```
[ ] Enable mixed precision (bf16/fp16) --> 2x memory savings on activations
[ ] Use optimizer.zero_grad(set_to_none=True)
[ ] Set PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
```

### Priority 2: Reduce Activation Memory

```
[ ] Enable gradient checkpointing (torch.utils.checkpoint)
[ ] Use Flash Attention (O(N) instead of O(N^2) memory)
[ ] Reduce sequence length if possible
[ ] Use selective checkpointing (checkpoint large layers only)
```

### Priority 3: Reduce Optimizer Memory

```
[ ] Use 8-bit Adam (bitsandbytes): 4x less optimizer memory
[ ] Use Adafactor (no momentum state)
[ ] CPU offload optimizer states (DeepSpeedCPUAdam)
```

### Priority 4: Reduce Model Memory

```
[ ] Use parameter-efficient fine-tuning (LoRA, QLoRA)
[ ] Quantize model weights (4-bit QLoRA for fine-tuning)
[ ] Share weights where possible (tied embeddings)
```

### Priority 5: Batch Size Management

```
[ ] Use gradient accumulation to simulate larger batches
[ ] Find optimal micro-batch size that fills memory efficiently
[ ] Use dynamic batch sizing based on sequence length
```

### Priority 6: Distributed Strategies

```
[ ] ZeRO Stage 1: Partition optimizer states across GPUs
[ ] ZeRO Stage 2: + Partition gradients
[ ] ZeRO Stage 3: + Partition parameters
[ ] FSDP (Fully Sharded Data Parallel) -- PyTorch native ZeRO
[ ] Tensor parallelism for very large models
```

---

## IO-BOUND Optimizations

Symptoms: GPU utilization oscillates (periods of 0%), disk IO at capacity,
DataLoader workers busy reading data, network transfers visible in profile.

### Priority 1: DataLoader Configuration

```
[ ] num_workers > 0 (start with 4 * num_gpus, benchmark to find optimum)
[ ] pin_memory=True
[ ] persistent_workers=True
[ ] prefetch_factor >= 2
[ ] Use non_blocking=True on .cuda() calls
```

### Priority 2: Data Storage

```
[ ] Store data on local NVMe SSD (not NFS, not HDD, not network mount)
[ ] Use containerized format (WebDataset, HDF5, LMDB) instead of individual files
[ ] Pre-process and cache data (don't decode/transform redundantly)
[ ] Verify disk bandwidth: dd if=/dev/zero of=/tmp/test bs=1G count=1 oflag=direct
```

### Priority 3: Data Format

```
[ ] Convert small files to sharded tar archives (WebDataset)
[ ] Use appropriate compression (LZ4 for speed, ZSTD for ratio)
[ ] Pre-resize images to training resolution
[ ] Store pre-tokenized text (avoid re-tokenizing every epoch)
```

### Priority 4: Advanced

```
[ ] NVIDIA DALI for GPU-accelerated decoding and augmentation
[ ] Memory-mapped files for random access without file open overhead
[ ] Async data prefetching with separate CUDA streams
[ ] For multi-node: stage data to local disk before training starts
```

---

## INFERENCE-SPECIFIC Optimizations

### Priority 1: Low-Hanging Fruit

```
[ ] model.eval() mode
[ ] torch.inference_mode() context (not just no_grad)
[ ] Remove dropout (set to 0 or remove module)
[ ] Ensure no gradient computation anywhere in the pipeline
```

### Priority 2: Model Optimization

```
[ ] torch.compile(mode="max-autotune")
[ ] FP16/BF16 inference
[ ] TensorRT conversion (for maximum throughput)
[ ] INT8 quantization with calibration
```

### Priority 3: Serving Optimization

```
[ ] KV-cache for autoregressive models
[ ] Request batching (dynamic batching)
[ ] Async inference pipeline (overlap pre/post processing)
[ ] Multiple CUDA streams for concurrent requests
```

### Priority 4: Model Compression

```
[ ] INT4 quantization (GPTQ, AWQ)
[ ] Structured pruning + fine-tuning
[ ] Knowledge distillation to smaller model
[ ] 2:4 sparsity (Ampere+ GPUs)
```

### Priority 5: Architecture Changes

```
[ ] Early exit for easy inputs
[ ] Speculative decoding for LLMs
[ ] Smaller model variants for latency-sensitive paths
[ ] Cascade: cheap model filters, expensive model refines
```

---

## Common Pitfalls Checklist

Things that silently kill performance:

```
[ ] Model not on GPU (check: next(model.parameters()).device)
[ ] Data not on GPU (check: input.device before forward pass)
[ ] Accidental CPU-GPU sync (search for: .item(), .cpu(), .numpy(), print(tensor))
[ ] Grad enabled during inference (wrap in inference_mode)
[ ] Non-contiguous tensors (check: tensor.is_contiguous())
[ ] cuDNN benchmark disabled (set: torch.backends.cudnn.benchmark = True)
[ ] Default num_workers=0 in DataLoader
[ ] Forgetting non_blocking=True with pin_memory
[ ] Memory leak from accumulating loss (use loss.detach() or loss.item())
[ ] GradScaler not used with fp16 (causes training instability, not speed)
[ ] Model in training mode during inference (dropout and batch norm differ)
[ ] Unnecessary torch.cuda.synchronize() in production code
```

---

## Quick Performance Targets

Rough throughput expectations for common models on A100-80GB:

```
  Model               Batch   Precision   Training      Inference
  ----------------------------------------------------------------
  ResNet-50           256     FP16        ~4000 img/s   ~12000 img/s
  BERT-base           64      FP16        ~500 seq/s    ~2000 seq/s
  GPT-2 (124M)        32      BF16        ~30K tok/s    ~80K tok/s
  ViT-Large           128     BF16        ~1500 img/s   ~5000 img/s
  LLaMA-7B            4       BF16        ~3K tok/s     ~40 tok/s (gen)
  Stable Diffusion    8       FP16        N/A           ~4 img/s

  If you're significantly below these numbers, there's optimization
  headroom. Use this reference to find and fix the bottleneck.
```
