# 04 - Data Pipeline Optimization

## The Analogy

Picture a highway feeding cars into a toll booth. No matter how fast the toll
booth processes each car, throughput is limited by how quickly cars arrive. If
the feeder road has a 30 mph speed limit but the toll booth can handle cars at
60 mph, the booth sits idle half the time.

Your data pipeline is the feeder road. The GPU is the toll booth. If data
arrives slower than the GPU can process it, you've got **GPU starvation** --
the most common and most overlooked performance problem in ML training.

```
  THE DATA PIPELINE

  Disk/Network --> Decode --> Transform --> Collate --> GPU Transfer --> Model
  [   IO    ]   [ CPU  ]   [  CPU   ]    [ CPU  ]    [  PCIe   ]    [ GPU ]

  Each stage can be the bottleneck.

  HEALTHY PIPELINE (GPU never waits):
  CPU: [load+transform batch 3] [load+transform batch 4] [load+transform 5]
  GPU: [train batch 1] [train batch 2] [train batch 3] [train batch 4]
       <-- overlapped: GPU trains while CPU prepares next batch -->

  STARVED PIPELINE (GPU waits for data):
  CPU: [load batch 1.....] [load batch 2.....] [load batch 3.....]
  GPU: [......wait......] [train 1] [...wait..] [train 2] [...wait..]
       <-- GPU utilization: ~30% -->
```

## Diagnosing the Data Bottleneck

Before optimizing, confirm the data pipeline is actually the problem:

```python
import time
import torch

def benchmark_dataloader(dataloader, num_batches=100):
    torch.cuda.synchronize()
    start = time.perf_counter()

    for idx, batch in enumerate(dataloader):
        if idx >= num_batches:
            break
        if isinstance(batch, (list, tuple)):
            batch = [b.cuda() if torch.is_tensor(b) else b for b in batch]
        elif torch.is_tensor(batch):
            batch = batch.cuda()

    torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    print(f"Data loading: {elapsed:.2f}s for {num_batches} batches")
    print(f"Per batch: {elapsed/num_batches*1000:.1f}ms")
    return elapsed

def benchmark_training_step(model, batch, criterion, optimizer):
    inputs, targets = batch[0].cuda(), batch[1].cuda()
    torch.cuda.synchronize()
    start = time.perf_counter()

    optimizer.zero_grad()
    outputs = model(inputs)
    loss = criterion(outputs, targets)
    loss.backward()
    optimizer.step()

    torch.cuda.synchronize()
    elapsed = time.perf_counter() - start
    print(f"Training step: {elapsed*1000:.1f}ms")
    return elapsed
```

If data loading time > training step time, the data pipeline is your
bottleneck. Fix it before touching the model.

## DataLoader Optimization

### num_workers: The Most Important Parameter

`num_workers=0` means the main process loads data. This serializes data
loading and training -- the GPU is idle while data loads.

```python
from torch.utils.data import DataLoader

dataloader = DataLoader(
    dataset,
    batch_size=32,
    num_workers=8,
    pin_memory=True,
    persistent_workers=True,
    prefetch_factor=2,
)
```

**How to choose num_workers**:

```
  FINDING OPTIMAL num_workers

  Rule of thumb: start with 4 * num_gpus, then benchmark

  num_workers    Throughput    CPU Util    Notes
  --------------------------------------------------------
  0              100 img/s     25%         Main process only
  2              350 img/s     50%         Some overlap
  4              600 img/s     80%         Good overlap
  8              750 img/s     95%         Diminishing returns
  16             720 img/s     100%        Too many workers, contention
  32             500 img/s     100%        Thrashing, OOM on CPU

  Sweet spot is where throughput plateaus.
  More workers isn't always better -- they compete for CPU
  and memory resources.
```

Benchmark it systematically:

```python
import time

for num_workers in [0, 1, 2, 4, 8, 12, 16]:
    loader = DataLoader(
        dataset,
        batch_size=32,
        num_workers=num_workers,
        pin_memory=True,
    )
    start = time.perf_counter()
    for idx, batch in enumerate(loader):
        if idx >= 50:
            break
        _ = batch[0].cuda()
    elapsed = time.perf_counter() - start
    print(f"workers={num_workers:2d}: {elapsed:.2f}s ({50/elapsed:.0f} batches/s)")
```

### Persistent Workers

Without `persistent_workers=True`, worker processes are killed and restarted
every epoch. This means re-initializing datasets, re-opening files, and
re-building any caches.

```python
dataloader = DataLoader(
    dataset,
    num_workers=8,
    persistent_workers=True,
)
```

The tradeoff: persistent workers keep their memory allocated between epochs.
If workers hold large caches, this increases memory pressure. But the
speedup is usually worth it.

### Prefetching

`prefetch_factor` controls how many batches each worker prepares ahead of time.
Default is 2 (each worker pre-loads 2 batches). For IO-heavy workloads,
increase this:

```python
dataloader = DataLoader(
    dataset,
    num_workers=8,
    prefetch_factor=4,
)
```

This means 8 workers * 4 batches = 32 batches buffered. More prefetching
means more memory usage but smoother throughput.

## Pinned Memory

When you call `.cuda()`, data transfers from CPU RAM to GPU VRAM over PCIe.
Normal (pageable) memory must first be copied to a special pinned (page-locked)
region before the DMA transfer can begin.

```
  WITHOUT PINNED MEMORY:

  [Pageable RAM] --copy--> [Pinned Buffer] --DMA--> [GPU VRAM]
       ^                        ^                       ^
       your tensor          kernel copies           actual transfer
                            to staging area         (fast, async)

  WITH PINNED MEMORY:

  [Pinned RAM] --------DMA-------> [GPU VRAM]
       ^                               ^
       your tensor                 direct transfer
       (already pinned)            (fast, async)

  Pinned memory eliminates one copy and allows true async transfers.
```

```python
dataloader = DataLoader(
    dataset,
    num_workers=8,
    pin_memory=True,
)

for batch in dataloader:
    inputs = batch[0].cuda(non_blocking=True)
    targets = batch[1].cuda(non_blocking=True)
```

The `non_blocking=True` flag is critical when using pinned memory. It lets the
GPU transfer proceed asynchronously while the CPU continues preparing the
next batch.

```
  WITH pin_memory=True AND non_blocking=True:

  CPU:    [prepare batch 2] [prepare batch 3] [prepare batch 4]
  PCIe:   [transfer batch 1-->GPU] [transfer batch 2-->GPU] [...]
  GPU:    [compute batch 0] [compute batch 1] [compute batch 2]

  Three things happening simultaneously. This is the target state.
```

**Warning**: Pinned memory is a limited system resource. If workers pin too
much memory, the system can become unstable. Monitor with:
```bash
cat /proc/meminfo | grep -i mlocked
```

## Data Format Choices

The format your data is stored in dramatically affects loading speed.

### The Problem with Small Files

A dataset of 1 million 224x224 JPEG images as individual files:

```
  Reading 1M individual files:
  - Each file open: ~0.1ms (filesystem metadata lookup)
  - Each file read: ~0.5ms (seek + read)
  - Total overhead: 1M * 0.6ms = 600 seconds just in IO overhead
  - Actual image data transfer: maybe 50 seconds

  The filesystem metadata operations dominate.
```

### Containerized Formats

Pack many samples into a few large files:

```
  FORMAT COMPARISON

  Format       Read Speed   Random Access   Compression   Ecosystem
  -----------------------------------------------------------------------
  Individual   Slow (seeks) Yes             Per-file      Universal
  files

  HDF5         Fast         Yes (chunked)   Built-in      NumPy/SciPy
                                             (gzip, lz4)

  WebDataset   Very fast    Sequential      Optional      PyTorch
  (tar)                     only

  TFRecord     Very fast    Sequential      Optional      TensorFlow
                            only                          (works w/PyTorch)

  LMDB         Very fast    Yes             No            ML community

  Parquet      Fast         Yes (row group) Built-in      Data engineering
                                            (snappy)
```

### WebDataset: The Best Choice for PyTorch

WebDataset stores data as tar archives -- a simple sequential format with
minimal overhead. It's designed for streaming and works beautifully with
distributed training.

```python
import webdataset as wds

dataset = (
    wds.WebDataset("data/train-{000000..000099}.tar")
    .shuffle(1000)
    .decode("pil")
    .to_tuple("input.jpg", "target.cls")
    .map_tuple(transform, identity)
    .batched(32)
)

dataloader = wds.WebLoader(dataset, num_workers=8, batch_size=None)
```

Creating WebDataset shards:

```python
import webdataset as wds

with wds.TarWriter("data/train-000000.tar") as sink:
    for idx, (image, label) in enumerate(raw_dataset):
        sink.write({
            "__key__": f"sample{idx:06d}",
            "input.jpg": image_to_bytes(image),
            "target.cls": label,
        })
```

### HDF5: Random Access with Speed

HDF5 is ideal when you need random access (shuffling) but want better IO
than individual files:

```python
import h5py
import numpy as np

with h5py.File("data/train.h5", "w") as f:
    f.create_dataset("images", data=images, chunks=(32, 224, 224, 3),
                     compression="lz4")
    f.create_dataset("labels", data=labels, chunks=(32,))

class HDF5Dataset(torch.utils.data.Dataset):
    def __init__(self, path):
        self.file = h5py.File(path, "r")
        self.images = self.file["images"]
        self.labels = self.file["labels"]

    def __len__(self):
        return len(self.labels)

    def __getitem__(self, idx):
        image = torch.from_numpy(self.images[idx])
        label = self.labels[idx]
        return image, label
```

Chunk size matters. Set chunks to match your batch size for optimal sequential
reads.

## IO Bottleneck Diagnosis

### Is It Disk?

```bash
iostat -x 1

iotop -aoP
```

Key metrics:
- **%util**: If 100%, the disk is saturated
- **await**: Average IO wait time. >10ms on SSD is a problem
- **r/s, w/s**: Read/write operations per second

```python
import os
import time

def benchmark_disk_read(path, num_reads=100):
    files = [os.path.join(path, f) for f in os.listdir(path)[:num_reads]]
    start = time.perf_counter()
    for f in files:
        with open(f, 'rb') as fh:
            _ = fh.read()
    elapsed = time.perf_counter() - start
    total_bytes = sum(os.path.getsize(f) for f in files)
    throughput_mb = total_bytes / elapsed / 1024 / 1024
    print(f"Disk read: {throughput_mb:.0f} MB/s ({num_reads/elapsed:.0f} files/s)")
```

### Is It CPU Preprocessing?

```python
import time

class TimedDataset(torch.utils.data.Dataset):
    def __init__(self, base_dataset, transform):
        self.base = base_dataset
        self.transform = transform
        self.io_time = 0
        self.transform_time = 0

    def __getitem__(self, idx):
        t0 = time.perf_counter()
        raw = self.base[idx]
        t1 = time.perf_counter()
        processed = self.transform(raw)
        t2 = time.perf_counter()

        self.io_time += t1 - t0
        self.transform_time += t2 - t1
        return processed

    def __len__(self):
        return len(self.base)
```

### Is It Network?

For data on NFS, S3, or GCS:

```bash
iperf3 -c storage-server -t 10

time aws s3 cp s3://bucket/file.tar /dev/null
```

If network bandwidth is the limit, copy data to local SSD before training.
This is almost always faster than reading from network storage.

## Advanced: NVIDIA DALI

For extreme data pipeline performance, NVIDIA DALI offloads data preprocessing
to the GPU. Decoding, resizing, and augmentation happen on GPU, avoiding CPU
bottlenecks entirely.

```python
from nvidia.dali.pipeline import pipeline_def
import nvidia.dali.fn as fn
import nvidia.dali.types as types
from nvidia.dali.plugin.pytorch import DALIGenericIterator

@pipeline_def(batch_size=64, num_threads=8, device_id=0)
def training_pipeline():
    jpegs, labels = fn.readers.file(
        file_root="data/train",
        random_shuffle=True,
        name="Reader",
    )
    images = fn.decoders.image(jpegs, device="mixed")
    images = fn.resize(images, resize_x=224, resize_y=224)
    images = fn.crop_mirror_normalize(
        images,
        dtype=types.FLOAT,
        mean=[0.485 * 255, 0.456 * 255, 0.406 * 255],
        std=[0.229 * 255, 0.224 * 255, 0.225 * 255],
    )
    return images, labels

pipe = training_pipeline()
pipe.build()

dataloader = DALIGenericIterator(
    pipe,
    ["images", "labels"],
    reader_name="Reader",
)
```

DALI is worth the setup complexity when:
- Your data preprocessing is CPU-bound
- You're training on multiple GPUs and data loading doesn't scale
- Image decoding and augmentation dominate CPU time

## Summary: Data Pipeline Optimization Checklist

```
  OPTIMIZATION CHECKLIST

  [ ] num_workers > 0 (start with 4 * num_gpus)
  [ ] pin_memory=True
  [ ] non_blocking=True on .cuda() calls
  [ ] persistent_workers=True
  [ ] Appropriate prefetch_factor
  [ ] Data in containerized format (WebDataset, HDF5, LMDB)
  [ ] Data on local SSD, not network storage
  [ ] Preprocessing is not the bottleneck (profile it)
  [ ] Consider DALI for GPU-accelerated preprocessing
```

## Exercises

1. Benchmark your DataLoader with num_workers values from 0 to 16. Plot
   throughput vs workers. Where does it plateau?

2. Convert a folder of individual files to WebDataset format. Benchmark
   loading speed before and after.

3. Add timing instrumentation to your DataLoader. What fraction of time
   goes to IO vs preprocessing vs collation?

4. Enable pin_memory and non_blocking transfers. Measure the improvement.
   Does it matter more with large or small batch sizes?
