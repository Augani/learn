# CUDA Programming Quick Reference

## Kernel Launch Syntax

```
  kernel<<<gridDim, blockDim, sharedMem, stream>>>(args...);

  gridDim:    number of blocks (dim3 or int)
  blockDim:   threads per block (dim3 or int)
  sharedMem:  dynamic shared memory in bytes (default 0)
  stream:     CUDA stream (default 0 = default stream)
```

## Thread Indexing

```
  1D grid, 1D block:
  int idx = blockIdx.x * blockDim.x + threadIdx.x;
  int stride = gridDim.x * blockDim.x;

  2D grid, 2D block:
  int row = blockIdx.y * blockDim.y + threadIdx.y;
  int col = blockIdx.x * blockDim.x + threadIdx.x;

  3D grid, 3D block:
  int x = blockIdx.x * blockDim.x + threadIdx.x;
  int y = blockIdx.y * blockDim.y + threadIdx.y;
  int z = blockIdx.z * blockDim.z + threadIdx.z;
```

```
  Built-in variables:
  ═══════════════════════════════════════
  threadIdx.x/y/z   Thread index within block
  blockIdx.x/y/z    Block index within grid
  blockDim.x/y/z    Threads per block
  gridDim.x/y/z     Blocks per grid
  warpSize           Warp size (always 32)
```

## Grid Size Calculation

```
  int n = total_elements;
  int threads = 256;
  int blocks = (n + threads - 1) / threads;
  kernel<<<blocks, threads>>>(..., n);

  2D:
  dim3 block(16, 16);
  dim3 grid((cols + 15) / 16, (rows + 15) / 16);
  kernel<<<grid, block>>>(...);
```

## Memory Management

```
  ALLOCATION
  ═══════════════════════════════════════
  cudaMalloc(&d_ptr, bytes);
  cudaMallocManaged(&ptr, bytes);
  cudaMallocHost(&h_ptr, bytes);        // pinned host memory
  cudaFree(d_ptr);
  cudaFreeHost(h_ptr);

  TRANSFER
  ═══════════════════════════════════════
  cudaMemcpy(dst, src, bytes, cudaMemcpyHostToDevice);
  cudaMemcpy(dst, src, bytes, cudaMemcpyDeviceToHost);
  cudaMemcpy(dst, src, bytes, cudaMemcpyDeviceToDevice);
  cudaMemcpyAsync(dst, src, bytes, kind, stream);

  INITIALIZE
  ═══════════════════════════════════════
  cudaMemset(d_ptr, value, bytes);
  cudaMemsetAsync(d_ptr, value, bytes, stream);
```

## Memory Types

```
  Type            Keyword         Scope       Lifetime    Speed
  ═══════════     ═══════════     ═════════   ════════    ═════
  Register        (automatic)     Thread      Thread      Fastest
  Local           (automatic)     Thread      Thread      Slow*
  Shared          __shared__      Block       Block       Fast
  Global          __device__      Grid        App         Slow
  Constant        __constant__    Grid        App         Fast**
  Texture         texture<T>      Grid        App         Fast**

  * Spills to global memory
  ** Cached, fast for broadcast reads
```

## Function Qualifiers

```
  __global__    Kernel: called from host, runs on device
  __device__    Device function: called from device only
  __host__      Host function: called from host only
  __host__ __device__   Compiles for both host and device
```

## Synchronization

```
  __syncthreads();          Block-level barrier
  __syncwarp(mask);         Warp-level barrier (CC 7.0+)
  cudaDeviceSynchronize();  Host waits for all GPU work
  cudaStreamSynchronize(s); Host waits for stream
```

## Atomic Operations

```
  atomicAdd(&addr, val);
  atomicSub(&addr, val);
  atomicMin(&addr, val);
  atomicMax(&addr, val);
  atomicAnd(&addr, val);
  atomicOr(&addr, val);
  atomicXor(&addr, val);
  atomicExch(&addr, val);
  atomicCAS(&addr, compare, val);   // compare-and-swap
```

## Warp-Level Primitives (CC 7.0+)

```
  __shfl_sync(mask, val, srcLane);         // broadcast
  __shfl_up_sync(mask, val, delta);        // shift up
  __shfl_down_sync(mask, val, delta);      // shift down
  __shfl_xor_sync(mask, val, laneMask);    // butterfly
  __ballot_sync(mask, pred);               // vote
  __any_sync(mask, pred);                  // any true?
  __all_sync(mask, pred);                  // all true?
  __activemask();                          // active lanes

  mask = 0xffffffff for full warp
```

## Warp Reduction Example

```cuda
__device__ float warp_reduce_sum(float val) {
    for (int offset = 16; offset > 0; offset >>= 1) {
        val += __shfl_down_sync(0xffffffff, val, offset);
    }
    return val;
}
```

## Streams

```
  cudaStream_t stream;
  cudaStreamCreate(&stream);
  cudaStreamDestroy(stream);

  cudaMemcpyAsync(dst, src, bytes, kind, stream);
  kernel<<<grid, block, 0, stream>>>(args);
  cudaStreamSynchronize(stream);
```

## Events (Timing)

```
  cudaEvent_t start, stop;
  cudaEventCreate(&start);
  cudaEventCreate(&stop);

  cudaEventRecord(start, stream);
  kernel<<<...>>>(args);
  cudaEventRecord(stop, stream);
  cudaEventSynchronize(stop);

  float ms;
  cudaEventElapsedTime(&ms, start, stop);

  cudaEventDestroy(start);
  cudaEventDestroy(stop);
```

## Error Handling

```
  #define CUDA_CHECK(call) do { \
      cudaError_t err = call; \
      if (err != cudaSuccess) { \
          fprintf(stderr, "CUDA error %s:%d: %s\n", \
                  __FILE__, __LINE__, \
                  cudaGetErrorString(err)); \
          exit(1); \
      } \
  } while(0)

  // After kernel launch:
  CUDA_CHECK(cudaGetLastError());
  CUDA_CHECK(cudaDeviceSynchronize());
```

## Device Properties

```
  cudaDeviceProp prop;
  cudaGetDeviceProperties(&prop, 0);

  prop.name                    // "NVIDIA A100"
  prop.major, prop.minor       // Compute capability
  prop.multiProcessorCount     // Number of SMs
  prop.maxThreadsPerBlock      // 1024
  prop.maxThreadsPerMultiProcessor
  prop.sharedMemPerBlock       // bytes
  prop.totalGlobalMem          // bytes
  prop.warpSize                // 32
  prop.maxGridSize[3]          // max grid dimensions
  prop.maxThreadsDim[3]        // max block dimensions
```

## Occupancy API

```
  int minGrid, bestBlock;
  cudaOccupancyMaxPotentialBlockSize(
      &minGrid, &bestBlock, kernel, 0, 0);

  int maxBlocks;
  cudaOccupancyMaxActiveBlocksPerMultiprocessor(
      &maxBlocks, kernel, blockSize, sharedMem);
```

## Common Patterns

### Grid-Stride Loop
```cuda
__global__ void kernel(float* data, int n) {
    int idx = blockIdx.x * blockDim.x + threadIdx.x;
    int stride = gridDim.x * blockDim.x;
    for (int i = idx; i < n; i += stride) {
        data[i] = data[i] * 2.0f;
    }
}
```

### Shared Memory Reduction
```cuda
__global__ void reduce(const float* in, float* out, int n) {
    __shared__ float sdata[256];
    int tid = threadIdx.x;
    int idx = blockIdx.x * blockDim.x + threadIdx.x;

    sdata[tid] = (idx < n) ? in[idx] : 0.0f;
    __syncthreads();

    for (int s = blockDim.x / 2; s > 0; s >>= 1) {
        if (tid < s) sdata[tid] += sdata[tid + s];
        __syncthreads();
    }

    if (tid == 0) out[blockIdx.x] = sdata[0];
}
```

### Tiled Matrix Multiply
```cuda
#define TILE 32
__global__ void matmul(const float* A, const float* B,
                        float* C, int N) {
    __shared__ float As[TILE][TILE], Bs[TILE][TILE];
    int row = blockIdx.y * TILE + threadIdx.y;
    int col = blockIdx.x * TILE + threadIdx.x;
    float sum = 0;

    for (int t = 0; t < (N + TILE - 1) / TILE; t++) {
        int ac = t * TILE + threadIdx.x;
        int br = t * TILE + threadIdx.y;
        As[threadIdx.y][threadIdx.x] =
            (row < N && ac < N) ? A[row*N+ac] : 0;
        Bs[threadIdx.y][threadIdx.x] =
            (br < N && col < N) ? B[br*N+col] : 0;
        __syncthreads();
        for (int k = 0; k < TILE; k++)
            sum += As[threadIdx.y][k] * Bs[k][threadIdx.x];
        __syncthreads();
    }
    if (row < N && col < N) C[row*N+col] = sum;
}
```

## Compilation

```bash
# Basic
nvcc -o program program.cu

# With C++ standard and optimization
nvcc -std=c++17 -O3 -o program program.cu

# Target specific GPU architecture
nvcc -arch=sm_80 -o program program.cu

# Multiple architectures
nvcc -gencode arch=compute_70,code=sm_70 \
     -gencode arch=compute_80,code=sm_80 \
     -o program program.cu

# Debug
nvcc -G -g -o program program.cu

# Verbose (register/shared mem usage)
nvcc -Xptxas -v -o program program.cu

# Fast math
nvcc --use_fast_math -o program program.cu

# Max register limit
nvcc --maxrregcount=32 -o program program.cu
```

## Profiling

```bash
# Nsight Compute (kernel analysis)
ncu ./program
ncu --set full ./program
ncu --metrics l1tex__t_sectors_pipe_lsu_mem_global_op_ld.sum ./program

# Nsight Systems (timeline)
nsys profile ./program
nsys profile --stats=true ./program
```

## PyTorch CUDA Extension

```cpp
#include <torch/extension.h>

torch::Tensor my_op(torch::Tensor input) {
    TORCH_CHECK(input.is_cuda(), "Must be CUDA tensor");
    TORCH_CHECK(input.dtype() == torch::kFloat32, "Expected float32");

    auto output = torch::empty_like(input);
    int n = input.numel();
    int threads = 256;
    int blocks = (n + threads - 1) / threads;

    my_kernel<<<blocks, threads>>>(
        input.data_ptr<float>(),
        output.data_ptr<float>(),
        n);

    return output;
}

PYBIND11_MODULE(TORCH_EXTENSION_NAME, m) {
    m.def("my_op", &my_op);
}
```

## Common GPU Architectures

```
  Architecture    CC     Example GPUs
  ════════════    ════   ════════════════════
  Volta           7.0    V100
  Turing          7.5    RTX 2080, T4
  Ampere          8.0    A100, A30
  Ampere          8.6    RTX 3090, A40
  Ada Lovelace    8.9    RTX 4090, L40
  Hopper          9.0    H100
  Blackwell       10.0   B200

  CC = Compute Capability
  Higher CC = more features (tensor cores, newer warp ops, etc.)
```
