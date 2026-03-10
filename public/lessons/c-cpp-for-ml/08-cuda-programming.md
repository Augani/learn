# Lesson 08 — CUDA Programming

> **Analogy:** Lesson 07 taught you what a factory looks like. Now you'll
> learn to run the assembly lines: moving materials in and out (memory
> transfers), setting up team workspaces (shared memory), and making sure
> workers don't step on each other (synchronization).

## Memory Management Patterns

```
  Pattern 1: Explicit malloc/copy/free (most common in kernels)

  Host                          Device
  ┌──────┐  cudaMalloc          ┌──────┐
  │ data │  ──────────────────> │      │  (allocate)
  │      │  cudaMemcpy H2D      │ data │  (fill)
  │      │  ──────────────────> │      │
  │      │  kernel<<<>>>        │ data │  (compute)
  │      │  cudaMemcpy D2H      │ data │
  │      │  <────────────────── │      │  (read back)
  │      │  cudaFree            │      │
  └──────┘  ──────────────────> └──────┘  (release)

  Pattern 2: Unified Memory (simpler, sometimes slower)

  ┌──────────────────────────────────┐
  │         Unified Memory           │
  │   Accessible from CPU AND GPU    │
  │   Runtime migrates pages         │
  └──────────────────────────────────┘
```

### Unified Memory

```cuda
#include <cstdio>

__global__ void square(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        data[idx] = data[idx] * data[idx];
    }
}

int main() {
    int n = 1024;
    float* data;
    cudaMallocManaged(&data, n * sizeof(float));

    for (int i = 0; i < n; i++) {
        data[i] = (float)i;
    }

    int block_size = 256;
    int grid_size = (n + block_size - 1) / block_size;
    square<<<grid_size, block_size>>>(data, n);
    cudaDeviceSynchronize();

    printf("data[10] = %f (expected 100)\n", data[10]);

    cudaFree(data);
    return 0;
}
```

## Shared Memory — The Team Whiteboard

```
  Global memory: 400-900 cycles latency
  Shared memory: 5-10 cycles latency  (30-100x faster!)

  Each block has its own shared memory.
  Threads within a block can share data through it.

  ┌─────────────────────────────┐
  │ Block 0                     │
  │  ┌───────────────────────┐  │
  │  │   Shared Memory       │  │
  │  │  (team whiteboard)    │  │
  │  └───────────────────────┘  │
  │  Thread 0  Thread 1  ...    │
  │  (all can read/write above) │
  └─────────────────────────────┘

  ┌─────────────────────────────┐
  │ Block 1                     │
  │  ┌───────────────────────┐  │
  │  │   Shared Memory       │  │
  │  │  (DIFFERENT whiteboard)│  │
  │  └───────────────────────┘  │
  │  Thread 0  Thread 1  ...    │
  └─────────────────────────────┘
```

### Array Reduction with Shared Memory

```cuda
#include <cstdio>
#include <cstdlib>

__global__ void sum_reduce(const float* input, float* output, int n) {
    __shared__ float sdata[256];

    int tid = threadIdx.x;
    int gid = blockIdx.x * blockDim.x + threadIdx.x;

    sdata[tid] = (gid < n) ? input[gid] : 0.0f;
    __syncthreads();

    for (int stride = blockDim.x / 2; stride > 0; stride >>= 1) {
        if (tid < stride) {
            sdata[tid] += sdata[tid + stride];
        }
        __syncthreads();
    }

    if (tid == 0) {
        output[blockIdx.x] = sdata[0];
    }
}

int main() {
    int n = 1024;
    size_t bytes = n * sizeof(float);

    float* h_input = (float*)malloc(bytes);
    for (int i = 0; i < n; i++) h_input[i] = 1.0f;

    float* d_input;
    float* d_output;
    int block_size = 256;
    int grid_size = (n + block_size - 1) / block_size;

    cudaMalloc(&d_input, bytes);
    cudaMalloc(&d_output, grid_size * sizeof(float));

    cudaMemcpy(d_input, h_input, bytes, cudaMemcpyHostToDevice);
    sum_reduce<<<grid_size, block_size>>>(d_input, d_output, n);

    float* h_output = (float*)malloc(grid_size * sizeof(float));
    cudaMemcpy(h_output, d_output, grid_size * sizeof(float),
               cudaMemcpyDeviceToHost);

    float total = 0.0f;
    for (int i = 0; i < grid_size; i++) total += h_output[i];
    printf("Sum = %f (expected %d)\n", total, n);

    cudaFree(d_input);
    cudaFree(d_output);
    free(h_input);
    free(h_output);
    return 0;
}
```

```
  Reduction tree (256 threads):

  Step 1: stride=128   [0]+=[128], [1]+=[129], ... [127]+=[255]
  Step 2: stride=64    [0]+=[64],  [1]+=[65],  ... [63]+=[127]
  Step 3: stride=32    [0]+=[32],  [1]+=[33],  ... [31]+=[63]
  ...
  Step 8: stride=1     [0]+=[1]

  Final result in sdata[0]

  __syncthreads() = "everyone stop and wait here"
  Like a factory checkpoint where all workers must arrive
  before anyone moves on.
```

## Synchronization — Don't Step on Each Other

```
  __syncthreads()
  ════════════════
  Barrier within a block. ALL threads in the block must
  reach this point before ANY thread continues.

  WRONG (race condition):
  sdata[tid] = input[gid];
  result = sdata[tid] + sdata[tid + 1];  // tid+1 might not be written yet!

  RIGHT:
  sdata[tid] = input[gid];
  __syncthreads();                        // wait for everyone
  result = sdata[tid] + sdata[tid + 1];   // now safe to read
```

## Streams — Overlapping Work

```
  Default: operations are sequential

  H2D copy ──> Kernel ──> D2H copy ──> H2D copy ──> Kernel ──> D2H copy

  With streams: operations overlap

  Stream 0: H2D ──> Kernel ──> D2H
  Stream 1:    H2D ──> Kernel ──> D2H
  Stream 2:       H2D ──> Kernel ──> D2H

  Like having multiple assembly lines running in parallel.
```

```cuda
#include <cstdio>

__global__ void process(float* data, int n, float value) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        data[idx] = data[idx] * value + 1.0f;
    }
}

int main() {
    const int num_streams = 4;
    const int chunk_size = 1024 * 256;
    const int total = chunk_size * num_streams;
    size_t chunk_bytes = chunk_size * sizeof(float);

    float* h_data;
    cudaMallocHost(&h_data, total * sizeof(float));
    for (int i = 0; i < total; i++) h_data[i] = 1.0f;

    float* d_data;
    cudaMalloc(&d_data, total * sizeof(float));

    cudaStream_t streams[num_streams];
    for (int i = 0; i < num_streams; i++) {
        cudaStreamCreate(&streams[i]);
    }

    for (int i = 0; i < num_streams; i++) {
        int offset = i * chunk_size;
        cudaMemcpyAsync(d_data + offset, h_data + offset,
                        chunk_bytes, cudaMemcpyHostToDevice, streams[i]);
        process<<<chunk_size / 256, 256, 0, streams[i]>>>(
            d_data + offset, chunk_size, 2.0f);
        cudaMemcpyAsync(h_data + offset, d_data + offset,
                        chunk_bytes, cudaMemcpyDeviceToHost, streams[i]);
    }

    cudaDeviceSynchronize();
    printf("h_data[0] = %f (expected 3.0)\n", h_data[0]);

    for (int i = 0; i < num_streams; i++) {
        cudaStreamDestroy(streams[i]);
    }
    cudaFreeHost(h_data);
    cudaFree(d_data);
    return 0;
}
```

## Atomic Operations — Thread-Safe Updates

```
  Without atomics:
  Thread A reads counter = 5
  Thread B reads counter = 5
  Thread A writes counter = 6
  Thread B writes counter = 6   <-- lost update!

  With atomicAdd:
  Thread A: atomicAdd(&counter, 1) → 5 (returns old, sets to 6)
  Thread B: atomicAdd(&counter, 1) → 6 (returns old, sets to 7)
```

```cuda
#include <cstdio>

__global__ void histogram(const int* data, int* bins, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        atomicAdd(&bins[data[idx]], 1);
    }
}

int main() {
    const int n = 10000;
    const int num_bins = 10;

    int* h_data = (int*)malloc(n * sizeof(int));
    for (int i = 0; i < n; i++) h_data[i] = i % num_bins;

    int* d_data;
    int* d_bins;
    cudaMalloc(&d_data, n * sizeof(int));
    cudaMalloc(&d_bins, num_bins * sizeof(int));
    cudaMemcpy(d_data, h_data, n * sizeof(int), cudaMemcpyHostToDevice);
    cudaMemset(d_bins, 0, num_bins * sizeof(int));

    histogram<<<(n + 255) / 256, 256>>>(d_data, d_bins, n);

    int h_bins[num_bins];
    cudaMemcpy(h_bins, d_bins, num_bins * sizeof(int),
               cudaMemcpyDeviceToHost);

    printf("Histogram:\n");
    for (int i = 0; i < num_bins; i++) {
        printf("  bin %d: %d\n", i, h_bins[i]);
    }

    cudaFree(d_data);
    cudaFree(d_bins);
    free(h_data);
    return 0;
}
```

## CUDA Events — Timing Kernels

```cuda
#include <cstdio>

__global__ void dummy_work(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    if (idx < n) {
        for (int i = 0; i < 100; i++) {
            data[idx] = data[idx] * 1.0001f + 0.0001f;
        }
    }
}

int main() {
    int n = 1 << 20;
    float* d_data;
    cudaMalloc(&d_data, n * sizeof(float));
    cudaMemset(d_data, 0, n * sizeof(float));

    cudaEvent_t start, stop;
    cudaEventCreate(&start);
    cudaEventCreate(&stop);

    cudaEventRecord(start);
    dummy_work<<<(n + 255) / 256, 256>>>(d_data, n);
    cudaEventRecord(stop);
    cudaEventSynchronize(stop);

    float ms = 0;
    cudaEventElapsedTime(&ms, start, stop);
    printf("Kernel time: %.3f ms\n", ms);

    cudaEventDestroy(start);
    cudaEventDestroy(stop);
    cudaFree(d_data);
    return 0;
}
```

## Exercises

1. **Matrix scale:** Write a kernel that scales all elements of a 2D matrix
   by a scalar. Use 2D grid/block dimensions.

2. **Shared memory dot product:** Implement vector dot product using shared
   memory reduction. Compare timing with a naive global-memory-only version.

3. **Stream overlap:** Modify the streams example to process 8 chunks.
   Time it with and without streams using CUDA events. Compare speedup.

4. **Softmax kernel:** Write a CUDA kernel that computes softmax over a
   1D array: `exp(x[i]) / sum(exp(x))`. You'll need two passes: one for
   the sum, one for the division.

5. **Histogram with shared memory:** Improve the histogram kernel by first
   accumulating counts in shared memory, then using `atomicAdd` to merge
   into global memory. Compare performance.

---

[Next: Lesson 09 — CUDA Optimization →](09-cuda-optimization.md)
