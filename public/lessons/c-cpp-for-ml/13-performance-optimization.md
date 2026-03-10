# Lesson 13 — Performance Optimization

> **Analogy:** Your code is a delivery truck route. Cache-friendly code
> is like delivering to houses on the same street (fast). Cache-unfriendly
> code is like zigzagging across town for each package. SIMD is loading
> 4 packages at once instead of one at a time. Profiling is the GPS
> that shows where you're stuck in traffic.

## The Memory Hierarchy — Why Layout Matters

```
  Access time (approximate):

  Register:    ~0.5 ns    ████
  L1 Cache:    ~1 ns      ████████
  L2 Cache:    ~5 ns      ████████████████████
  L3 Cache:    ~20 ns     ████████████████████████████████████████
  RAM:         ~100 ns    ████████████████████████████████...████████
  SSD:         ~100 us    (off the chart)

  A cache MISS is 100x slower than a cache HIT.
  Optimizing for cache is often more important than reducing operations.
```

```
  Cache line: 64 bytes (8 doubles, 16 floats)

  When you read ONE float, the CPU loads the ENTIRE 64-byte line.
  If your next read is adjacent → already in cache (FREE).
  If your next read is far away → another cache miss (EXPENSIVE).

  ┌───────────────────────────────────────────┐
  │ Cache line (64 bytes)                     │
  │ [f0][f1][f2][f3][f4][f5][f6][f7]         │
  │ [f8][f9][f10][f11][f12][f13][f14][f15]   │
  └───────────────────────────────────────────┘
  Read f0 → entire line loaded → f1-f15 are "free"
```

## Row-Major vs Column-Major Access

```cpp
#include <cstdio>
#include <cstdlib>
#include <chrono>

void row_major_sum(const float* matrix, int rows, int cols, float* out) {
    float sum = 0;
    for (int i = 0; i < rows; i++) {
        for (int j = 0; j < cols; j++) {
            sum += matrix[i * cols + j];
        }
    }
    *out = sum;
}

void col_major_sum(const float* matrix, int rows, int cols, float* out) {
    float sum = 0;
    for (int j = 0; j < cols; j++) {
        for (int i = 0; i < rows; i++) {
            sum += matrix[i * cols + j];
        }
    }
    *out = sum;
}

int main() {
    int n = 4096;
    float* matrix = (float*)malloc(n * n * sizeof(float));
    for (int i = 0; i < n * n; i++) matrix[i] = 1.0f;

    float result;

    auto t1 = std::chrono::high_resolution_clock::now();
    for (int rep = 0; rep < 10; rep++) row_major_sum(matrix, n, n, &result);
    auto t2 = std::chrono::high_resolution_clock::now();

    auto t3 = std::chrono::high_resolution_clock::now();
    for (int rep = 0; rep < 10; rep++) col_major_sum(matrix, n, n, &result);
    auto t4 = std::chrono::high_resolution_clock::now();

    double row_ms = std::chrono::duration<double, std::milli>(t2 - t1).count();
    double col_ms = std::chrono::duration<double, std::milli>(t4 - t3).count();

    printf("Row-major: %.1f ms\n", row_ms);
    printf("Col-major: %.1f ms\n", col_ms);
    printf("Ratio: %.1fx\n", col_ms / row_ms);

    free(matrix);
    return 0;
}
```

```
  Row-major access (cache-friendly):
  Memory: [a00 a01 a02 a03 | a10 a11 a12 a13 | ...]
  Access:  →    →    →    →   →    →    →    →
  Cache lines loaded: N/16 (sequential)

  Column-major access (cache-hostile):
  Memory: [a00 a01 a02 a03 | a10 a11 a12 a13 | ...]
  Access:  →              →                   →
           ↑    skip cols    ↑    skip cols    ↑
  Cache lines loaded: N (each access misses!)
```

## Structure of Arrays vs Array of Structures

```
  AoS (Array of Structures):          SoA (Structure of Arrays):
  [{x,y,z}, {x,y,z}, {x,y,z}]        {[x,x,x], [y,y,y], [z,z,z]}

  AoS in memory:                       SoA in memory:
  [x0 y0 z0 x1 y1 z1 x2 y2 z2]       [x0 x1 x2 y0 y1 y2 z0 z1 z2]

  If you only need x values:
  AoS: skip y,z → cache waste          SoA: sequential x → cache perfect
```

```cpp
#include <cstdio>
#include <vector>
#include <chrono>

struct ParticleAoS {
    float x, y, z;
    float vx, vy, vz;
    float mass;
    float padding;
};

struct ParticlesSoA {
    std::vector<float> x, y, z;
    std::vector<float> vx, vy, vz;
    std::vector<float> mass;
};

float sum_mass_aos(const std::vector<ParticleAoS>& particles) {
    float sum = 0;
    for (const auto& p : particles) {
        sum += p.mass;
    }
    return sum;
}

float sum_mass_soa(const ParticlesSoA& particles) {
    float sum = 0;
    for (size_t i = 0; i < particles.mass.size(); i++) {
        sum += particles.mass[i];
    }
    return sum;
}

int main() {
    const int n = 10000000;

    std::vector<ParticleAoS> aos(n);
    for (auto& p : aos) p.mass = 1.0f;

    ParticlesSoA soa;
    soa.mass.resize(n, 1.0f);
    soa.x.resize(n); soa.y.resize(n); soa.z.resize(n);

    auto t1 = std::chrono::high_resolution_clock::now();
    volatile float r1 = sum_mass_aos(aos);
    auto t2 = std::chrono::high_resolution_clock::now();
    volatile float r2 = sum_mass_soa(soa);
    auto t3 = std::chrono::high_resolution_clock::now();

    double aos_ms = std::chrono::duration<double, std::milli>(t2 - t1).count();
    double soa_ms = std::chrono::duration<double, std::milli>(t3 - t2).count();

    printf("AoS: %.1f ms\n", aos_ms);
    printf("SoA: %.1f ms\n", soa_ms);
    printf("SoA is %.1fx faster\n", aos_ms / soa_ms);

    return 0;
}
```

## SIMD Intrinsics — Processing 4/8/16 Values at Once

```
  Scalar:     one operation, one value
  SIMD:       one operation, multiple values

  Scalar add:
  a[0]+b[0]  →  c[0]
  a[1]+b[1]  →  c[1]
  a[2]+b[2]  →  c[2]
  a[3]+b[3]  →  c[3]
  (4 instructions)

  SIMD add (128-bit SSE, 4 floats):
  [a0 a1 a2 a3] + [b0 b1 b2 b3] → [c0 c1 c2 c3]
  (1 instruction!)

  256-bit AVX:  8 floats at once
  512-bit AVX512: 16 floats at once
```

```cpp
#include <immintrin.h>
#include <cstdio>
#include <cstdlib>
#include <chrono>

void add_scalar(const float* a, const float* b, float* c, int n) {
    for (int i = 0; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}

void add_avx(const float* a, const float* b, float* c, int n) {
    int i = 0;
    for (; i + 7 < n; i += 8) {
        __m256 va = _mm256_loadu_ps(a + i);
        __m256 vb = _mm256_loadu_ps(b + i);
        __m256 vc = _mm256_add_ps(va, vb);
        _mm256_storeu_ps(c + i, vc);
    }
    for (; i < n; i++) {
        c[i] = a[i] + b[i];
    }
}

int main() {
    const int n = 10000000;
    float* a = (float*)aligned_alloc(32, n * sizeof(float));
    float* b = (float*)aligned_alloc(32, n * sizeof(float));
    float* c = (float*)aligned_alloc(32, n * sizeof(float));

    for (int i = 0; i < n; i++) {
        a[i] = (float)i;
        b[i] = (float)i * 0.5f;
    }

    auto t1 = std::chrono::high_resolution_clock::now();
    for (int rep = 0; rep < 100; rep++) add_scalar(a, b, c, n);
    auto t2 = std::chrono::high_resolution_clock::now();
    for (int rep = 0; rep < 100; rep++) add_avx(a, b, c, n);
    auto t3 = std::chrono::high_resolution_clock::now();

    double scalar_ms = std::chrono::duration<double, std::milli>(t2 - t1).count();
    double avx_ms = std::chrono::duration<double, std::milli>(t3 - t2).count();

    printf("Scalar: %.1f ms\n", scalar_ms);
    printf("AVX:    %.1f ms\n", avx_ms);
    printf("Speedup: %.1fx\n", scalar_ms / avx_ms);

    free(a);
    free(b);
    free(c);
    return 0;
}
```

```bash
g++ -O2 -mavx2 -o simd_test simd_test.cpp && ./simd_test
```

## Profiling — Finding the Bottleneck

### Using perf (Linux)

```bash
g++ -O2 -g -o program program.cpp
perf stat ./program
perf record ./program
perf report
```

### Using Instruments (macOS)

```bash
g++ -O2 -g -o program program.cpp
instruments -t "Time Profiler" ./program
```

### Simple Timer

```cpp
#include <chrono>
#include <cstdio>

class Timer {
    std::chrono::high_resolution_clock::time_point start_;
    const char* name_;
public:
    Timer(const char* name) : name_(name) {
        start_ = std::chrono::high_resolution_clock::now();
    }
    ~Timer() {
        auto end = std::chrono::high_resolution_clock::now();
        double ms = std::chrono::duration<double, std::milli>(
            end - start_).count();
        printf("[%s] %.3f ms\n", name_, ms);
    }
};

void heavy_work() {
    volatile double sum = 0;
    for (int i = 0; i < 100000000; i++) {
        sum += i * 0.001;
    }
}

int main() {
    {
        Timer t("heavy_work");
        heavy_work();
    }
    return 0;
}
```

## Loop Optimization Techniques

```cpp
#include <cstdio>
#include <cstdlib>

void naive_matmul(const float* A, const float* B, float* C,
                   int M, int N, int K) {
    for (int i = 0; i < M; i++) {
        for (int j = 0; j < N; j++) {
            float sum = 0;
            for (int k = 0; k < K; k++) {
                sum += A[i * K + k] * B[k * N + j];
            }
            C[i * N + j] = sum;
        }
    }
}

void tiled_matmul(const float* A, const float* B, float* C,
                   int M, int N, int K) {
    const int TILE = 32;
    for (int i = 0; i < M; i++) {
        for (int j = 0; j < N; j++) {
            C[i * N + j] = 0;
        }
    }
    for (int ii = 0; ii < M; ii += TILE) {
        for (int kk = 0; kk < K; kk += TILE) {
            for (int jj = 0; jj < N; jj += TILE) {
                int i_end = (ii + TILE < M) ? ii + TILE : M;
                int k_end = (kk + TILE < K) ? kk + TILE : K;
                int j_end = (jj + TILE < N) ? jj + TILE : N;
                for (int i = ii; i < i_end; i++) {
                    for (int k = kk; k < k_end; k++) {
                        float a_val = A[i * K + k];
                        for (int j = jj; j < j_end; j++) {
                            C[i * N + j] += a_val * B[k * N + j];
                        }
                    }
                }
            }
        }
    }
}

int main() {
    int n = 512;
    float* A = (float*)calloc(n * n, sizeof(float));
    float* B = (float*)calloc(n * n, sizeof(float));
    float* C = (float*)calloc(n * n, sizeof(float));

    for (int i = 0; i < n * n; i++) {
        A[i] = 1.0f;
        B[i] = 1.0f;
    }

    naive_matmul(A, B, C, n, n, n);
    printf("C[0][0] = %f (expected %d)\n", C[0], n);

    tiled_matmul(A, B, C, n, n, n);
    printf("C[0][0] = %f (expected %d)\n", C[0], n);

    free(A);
    free(B);
    free(C);
    return 0;
}
```

## Compiler Optimization Flags

```
  Flag      Effect
  ════      ═══════════════════════════════════════
  -O0       No optimization (debugging)
  -O1       Basic optimizations
  -O2       Most optimizations (good default)
  -O3       Aggressive (auto-vectorization, inlining)
  -Ofast    -O3 + fast-math (may change floating-point results)
  -march=native  Use all CPU instructions available
  -ffast-math    Allow FP reordering (breaks IEEE)
  -funroll-loops Unroll small loops
  -flto          Link-time optimization
```

```bash
g++ -O3 -march=native -ffast-math -o fast program.cpp
```

## Exercises

1. **Cache benchmark:** Write a program that accesses an array with
   stride 1, 2, 4, 8, 16, 32, 64 elements. Measure time for each stride.
   Plot the results — you should see a cliff at the cache line boundary.

2. **AoS vs SoA:** Implement a particle system both ways. Benchmark
   operations that touch one field (mass only) vs all fields.

3. **SIMD dot product:** Implement dot product with AVX intrinsics for
   `float`. Benchmark against a scalar loop and against compiler
   auto-vectorization (`-O3 -march=native`).

4. **Tiled matmul:** Experiment with tile sizes (8, 16, 32, 64) for the
   tiled matrix multiplication. Find the optimal tile size on your machine
   and explain why.

5. **Profile and optimize:** Take the naive matmul, profile it with
   `perf stat` or Instruments. Identify the bottleneck (cache misses
   vs compute), then apply tiling and measure the improvement.

---

[Next: Lesson 14 — Build an ML Kernel (Capstone) →](14-build-ml-kernel.md)
