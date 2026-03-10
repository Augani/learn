# Lesson 02: Data Loading at Scale

> **Analogy**: Imagine a Formula 1 pit crew. The car (GPU) is
> incredibly fast, but it spends time in the pit (idle) if the
> crew (data pipeline) fumbles. At small scale, a slow pit crew
> doesn't matter -- the race is long. At scale, every millisecond
> of GPU idle time costs real money. A 256-GPU cluster at $2/GPU/hr
> costs $512/hr. A data pipeline that keeps GPUs 10% idle wastes
> $51/hr -- $1,224/day.

---

## The Data Loading Problem

On a single GPU, `torch.utils.data.DataLoader` with `num_workers=4`
is usually fine. At scale, everything breaks.

```
Single GPU:
  Dataset: 100 GB images on local SSD
  Read speed: 3 GB/s
  GPU throughput: ~500 samples/sec
  Data loading: ~800 samples/sec (workers keep up)
  GPU utilization: ~95%  ✓

256 GPUs:
  Dataset: 100 TB images on network storage
  Total throughput needed: 128,000 samples/sec
  Network storage read: ~10 GB/s shared across all nodes
  Per-GPU bandwidth: 39 MB/s
  GPU throughput per GPU: ~500 samples/sec
  Data loading per GPU: ~50 samples/sec  ← BOTTLENECK
  GPU utilization: ~10%  ✗

  You're paying for 256 GPUs but using 25.
```

---

## Three Levels of Scale

```
+------------+--------------+--------------------+-------------------+
| Scale      | Dataset Size | Storage            | Strategy          |
+------------+--------------+--------------------+-------------------+
| Small      | < 500 GB     | Local SSD          | Standard DataLoader|
| Medium     | 500 GB - 5TB | Distributed FS     | WebDataset/shards |
| Large      | 5 TB+        | Object storage     | Streaming + cache |
+------------+--------------+--------------------+-------------------+
```

---

## Problem 1: Random Access Kills Network Storage

Standard PyTorch datasets do random access: pick a random index,
read that file. On local SSD, this is fine. On network storage
(NFS, S3, GCS), each random read is a network round-trip.

```
Local SSD random read:    ~100 microseconds
NFS random read:          ~1-10 milliseconds (10-100x slower)
S3 GET request:           ~20-100 milliseconds (200-1000x slower)

Sequential read of 1 MB chunk:
Local SSD:  ~300 microseconds
NFS:        ~1-5 milliseconds
S3:         ~50-200 milliseconds
```

The fix: **pack data into large sequential chunks**.

---

## WebDataset: The Sharded Format

WebDataset stores data in tar files. Each tar file is a shard
containing hundreds or thousands of samples. Reading is
sequential, which is exactly what network storage is good at.

```
Traditional layout:              WebDataset layout:
  images/                         shards/
    img_000000.jpg                  shard-000000.tar
    img_000001.jpg                  shard-000001.tar
    img_000002.jpg                  ...
    ...                             shard-009999.tar
    img_9999999.jpg
                                  Each tar contains ~1000 samples:
  10M random file reads!            shard-000000.tar:
                                      000.jpg
                                      000.cls
                                      001.jpg
                                      001.cls
                                      ...

  10K sequential reads of large files.
```

### Creating WebDataset Shards

```python
import webdataset as wds
import os
import io
from PIL import Image

def create_shards(image_dir, output_dir, samples_per_shard=1000):
    os.makedirs(output_dir, exist_ok=True)

    pattern = os.path.join(output_dir, "shard-%06d.tar")
    with wds.ShardWriter(pattern, maxcount=samples_per_shard) as sink:
        for idx, filename in enumerate(sorted(os.listdir(image_dir))):
            if not filename.endswith(('.jpg', '.png')):
                continue

            image_path = os.path.join(image_dir, filename)
            with open(image_path, 'rb') as f:
                image_data = f.read()

            label = extract_label(filename)

            sink.write({
                "__key__": f"sample{idx:08d}",
                "jpg": image_data,
                "cls": str(label).encode(),
            })

create_shards("/data/imagenet/train", "/data/shards/train")
```

### Reading WebDataset Shards

```python
import webdataset as wds
import torchvision.transforms as T

transform = T.Compose([
    T.RandomResizedCrop(224),
    T.RandomHorizontalFlip(),
    T.ToTensor(),
    T.Normalize(mean=[0.485, 0.456, 0.406],
                std=[0.229, 0.224, 0.225]),
])

def make_dataset(shard_urls, epoch_length=100000):
    dataset = (
        wds.WebDataset(shard_urls, shardshuffle=True)
        .shuffle(5000)
        .decode("pil")
        .to_tuple("jpg", "cls")
        .map_tuple(transform, int)
    )
    return dataset

shard_urls = "s3://my-bucket/shards/train/shard-{000000..009999}.tar"
dataset = make_dataset(shard_urls)

loader = wds.WebLoader(dataset, batch_size=64, num_workers=8)
loader = loader.unbatched().shuffle(10000).batched(64)
```

The `shardshuffle=True` shuffles which shards are read. The
`.shuffle(5000)` shuffles samples within a buffer. The final
`.shuffle(10000).batched(64)` shuffles across shard boundaries.

---

## Problem 2: Distributed Shard Assignment

With 256 workers, you need each worker to read different shards.
If two workers read the same shard, you waste bandwidth and
get duplicate samples.

```
BAD: All workers read all shards and skip
  Worker 0: read shard 0, process sample 0, skip 1-255, process 256...
  Worker 1: read shard 0, skip sample 0, process 1, skip 2-256...

  Every worker reads everything. 256x wasted I/O.

GOOD: Each worker reads its own shards
  Worker 0:   shards 0-38
  Worker 1:   shards 39-77
  Worker 2:   shards 78-116
  ...
  Worker 255: shards 9962-9999

  Each worker reads ~39 shards. No wasted I/O.
```

```python
import webdataset as wds
from torch.utils.data import DataLoader
import torch.distributed as dist

def make_distributed_loader(shard_pattern, batch_size, num_workers):
    rank = dist.get_rank()
    world_size = dist.get_world_size()

    dataset = (
        wds.WebDataset(
            shard_pattern,
            shardshuffle=True,
            nodesplitter=wds.split_by_node,
        )
        .shuffle(5000)
        .decode("pil")
        .to_tuple("jpg", "cls")
        .map_tuple(transform, int)
        .batched(batch_size)
    )

    loader = wds.WebLoader(dataset, num_workers=num_workers, batch_size=None)
    return loader
```

The `nodesplitter=wds.split_by_node` automatically assigns
disjoint shard subsets to each rank.

---

## Problem 3: The Prefetch-Compute Overlap

Even with sharded data, loading a batch takes time. The GPU
should never wait for the next batch.

```
WITHOUT prefetching:
  Time: |--Load--|--GPU--|--Load--|--GPU--|--Load--|--GPU--|
  GPU:  |  idle  | busy  |  idle  | busy  |  idle  | busy  |

WITH prefetching:
  Time: |--Load--|--Load--|--Load--|--Load--|--Load--|
        |        |--GPU--|--GPU---|--GPU--|--GPU---|
  GPU:  |  idle  | busy  | busy   | busy  | busy   |

  GPU idle time: ~0 (first batch only)
```

PyTorch's DataLoader already prefetches with `prefetch_factor`:

```python
loader = DataLoader(
    dataset,
    batch_size=64,
    num_workers=8,
    prefetch_factor=4,
    pin_memory=True,
    persistent_workers=True,
)
```

But at scale, you need more aggressive prefetching because
network reads have high variance. A single slow S3 GET can
stall your entire pipeline.

### NVIDIA DALI: Hardware-Accelerated Prefetching

DALI moves data decoding and augmentation to the GPU, freeing
CPU workers and eliminating the CPU-GPU transfer bottleneck.

```python
from nvidia.dali import pipeline_def, fn, types
from nvidia.dali.plugin.pytorch import DALIGenericIterator

@pipeline_def(batch_size=64, num_threads=8, device_id=0)
def training_pipeline(data_dir):
    jpegs, labels = fn.readers.file(
        file_root=data_dir,
        random_shuffle=True,
        name="reader",
    )
    images = fn.decoders.image(jpegs, device="mixed")
    images = fn.resize(images, resize_x=256, resize_y=256)
    images = fn.crop_mirror_normalize(
        images,
        crop=(224, 224),
        mirror=fn.random.coin_flip(),
        mean=[0.485 * 255, 0.456 * 255, 0.406 * 255],
        std=[0.229 * 255, 0.224 * 255, 0.225 * 255],
        dtype=types.FLOAT,
    )
    return images, labels

pipe = training_pipeline(data_dir="/data/imagenet/train")
pipe.build()
loader = DALIGenericIterator(pipe, ["images", "labels"])
```

---

## Problem 4: Memory-Mapped Datasets

For datasets that fit on local storage, memory mapping avoids
reading data entirely -- the OS handles paging from disk to RAM.

```
Traditional file read:
  1. Open file
  2. Read bytes into user-space buffer (copy #1)
  3. Copy to tensor (copy #2)
  4. Copy to GPU (copy #3)

Memory-mapped:
  1. mmap file (no data movement yet)
  2. Access bytes (OS pages from disk to kernel buffer)
  3. Zero-copy into tensor (shares kernel buffer)
  4. Copy to GPU (copy #1)

  2 fewer copies = less memory pressure, faster loading.
```

### Building a Memory-Mapped Dataset

```python
import numpy as np
import torch
from torch.utils.data import Dataset

class MemmapTokenDataset(Dataset):
    def __init__(self, filepath, seq_length, dtype=np.uint16):
        self.data = np.memmap(filepath, dtype=dtype, mode='r')
        self.seq_length = seq_length
        self.n_samples = (len(self.data) - 1) // seq_length

    def __len__(self):
        return self.n_samples

    def __getitem__(self, idx):
        start = idx * self.seq_length
        end = start + self.seq_length
        chunk = self.data[start:end + 1]
        x = torch.from_numpy(chunk[:-1].astype(np.int64))
        y = torch.from_numpy(chunk[1:].astype(np.int64))
        return x, y
```

This is exactly how nanoGPT and many LLM training codebases
handle tokenized text data. The entire dataset lives as a flat
binary file. The OS's page cache handles caching -- if you read
the same region twice, it's already in RAM.

### Creating the Memmap File

```python
import numpy as np
from transformers import AutoTokenizer

def tokenize_to_memmap(input_files, output_path, tokenizer_name):
    tokenizer = AutoTokenizer.from_pretrained(tokenizer_name)
    token_count = 0

    for filepath in input_files:
        with open(filepath, 'r') as f:
            text = f.read()
        tokens = tokenizer.encode(text)
        token_count += len(tokens)

    memmap = np.memmap(output_path, dtype=np.uint16, mode='w+',
                       shape=(token_count,))

    offset = 0
    for filepath in input_files:
        with open(filepath, 'r') as f:
            text = f.read()
        tokens = tokenizer.encode(text)
        memmap[offset:offset + len(tokens)] = tokens
        offset += len(tokens)

    memmap.flush()
    print(f"Wrote {token_count} tokens to {output_path}")
```

---

## Problem 5: Streaming from Object Storage

For truly large datasets (100 TB+), you can't download everything
first. You stream directly from S3/GCS during training.

```
Streaming architecture:

  +--------+     +--------+     +--------+
  |  S3    |     |  S3    |     |  S3    |
  | Bucket |     | Bucket |     | Bucket |
  +---+----+     +---+----+     +---+----+
      |              |              |
      v              v              v
  +------+       +------+       +------+
  | Node |       | Node |       | Node |
  | 0    |       | 1    |       | 2    |
  +--+---+       +--+---+       +--+---+
     |              |              |
  Prefetch       Prefetch       Prefetch
  Buffer         Buffer         Buffer
  (10 GB)        (10 GB)        (10 GB)
     |              |              |
  +--+---+       +--+---+       +--+---+
  | GPU  |       | GPU  |       | GPU  |
  | 0-7  |       | 0-7  |       | 0-7  |
  +------+       +------+       +------+
```

### Using MosaicML Streaming

```python
from streaming import StreamingDataset, StreamingDataLoader

dataset = StreamingDataset(
    remote='s3://my-bucket/train-mds/',
    local='/tmp/cache/',
    shuffle=True,
    shuffle_algo='py1e',
    shuffle_seed=42,
    batch_size=64,
    predownload=8 * 64,
    keep_zip=False,
    num_canonical_nodes=256,
)

loader = StreamingDataLoader(
    dataset,
    batch_size=64,
    num_workers=8,
    pin_memory=True,
    prefetch_factor=4,
)

for batch in loader:
    inputs, targets = batch
    loss = model(inputs, targets)
    loss.backward()
```

Key parameters:
- `predownload`: how many samples to buffer ahead
- `num_canonical_nodes`: virtual nodes for deterministic shuffling
- `shuffle_algo`: `py1e` gives good randomness with low download waste

---

## Benchmarking Your Data Pipeline

Never assume your pipeline is fast enough. Measure it.

```python
import time
import torch

def benchmark_dataloader(loader, num_batches=100, warmup=10):
    times = []

    for i, batch in enumerate(loader):
        if i >= warmup + num_batches:
            break

        start = time.perf_counter()

        if isinstance(batch, (list, tuple)):
            for tensor in batch:
                if isinstance(tensor, torch.Tensor):
                    tensor.to('cuda', non_blocking=True)
        torch.cuda.synchronize()

        elapsed = time.perf_counter() - start
        if i >= warmup:
            times.append(elapsed)

    avg_time = sum(times) / len(times)
    throughput = loader.batch_size / avg_time

    print(f"Average batch load time: {avg_time*1000:.1f} ms")
    print(f"Throughput: {throughput:.0f} samples/sec")
    return throughput
```

### Target Numbers

```
Training step time for your model: T_compute
Data loading time per batch:       T_data

Goal: T_data < 0.1 * T_compute

If T_data > 0.2 * T_compute:
  Your GPUs are waiting for data more than 15% of the time.
  Fix your pipeline before scaling to more GPUs.
```

---

## Common Pitfalls

1. **Not setting `persistent_workers=True`**: Without this,
   Python fork+exec for every epoch. With 16 workers, that's
   16 process startups adding 10-30 seconds per epoch.

2. **Forgetting `pin_memory=True`**: Pinned memory enables
   async CPU-to-GPU transfer. Without it, `to('cuda')` blocks
   until the copy completes.

3. **Too many or too few workers**: More workers != faster.
   Each worker uses RAM for its prefetch buffer. 4-8 workers
   per GPU is usually the sweet spot. Profile to verify.

4. **Small shards with network storage**: If each shard is 1 MB,
   you're making thousands of small network requests. Aim for
   256 MB - 1 GB shards. The overhead of opening a connection
   to S3 is ~50ms regardless of file size.

5. **No local caching for repeated epochs**: If you're training
   for 3 epochs on the same data, cache locally after the first
   download. The `local` parameter in MosaicML Streaming does
   this automatically.

---

## Exercises

1. **Benchmark**: Compare DataLoader throughput with `num_workers`
   values of 0, 2, 4, 8, 16 on your machine. Plot the throughput
   curve and find the sweet spot.

2. **Shard creation**: Take any image dataset and convert it to
   WebDataset format. Compare read throughput between the original
   random-access layout and the sharded layout over NFS.

3. **Memory mapping**: Create a memmap token dataset from a text
   corpus. Measure the memory usage versus loading the entire
   dataset into RAM.

4. **End-to-end**: Set up a data pipeline that can sustain
   1000 samples/sec from S3 to a single GPU. Measure and
   verify with the benchmarking function above.
