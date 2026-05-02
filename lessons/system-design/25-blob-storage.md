# Lesson 25: Blob Storage

Every system eventually needs to store files — images, videos, backups,
logs. Relational databases are terrible at this. You need a different
kind of storage: one that handles objects from 1 KB to 5 TB, serves them
fast, and never loses them.

**Analogy:** Think of a massive warehouse with labeled boxes. Each box
has a unique barcode (key), contains something (object), and has a label
(metadata). You don't search inside the boxes — you find them by
barcode. The warehouse has a receiving dock (upload), a pickup window
(download), and a catalog (metadata store). That's blob storage.

---

## How Object Storage Works (S3-Like)

```
┌────────────────────────────────────────────────────────────┐
│                    Object Storage System                     │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                    API Gateway                       │   │
│  │  PUT /bucket/key  │  GET /bucket/key  │  DELETE      │   │
│  └────────┬──────────┴──────┬────────────┴─────────────┘   │
│           │                 │                               │
│  ┌────────▼────────┐  ┌────▼──────────┐                    │
│  │  Metadata Store │  │  Data Store   │                    │
│  │  (where is it?) │  │ (actual bytes)│                    │
│  │                 │  │               │                    │
│  │  bucket: imgs   │  │  ┌─────────┐  │                    │
│  │  key: cat.jpg   │  │  │ Chunk 1 │  │                    │
│  │  size: 2.3 MB   │  │  │ Chunk 2 │  │                    │
│  │  chunks: [c1,c2]│  │  │ Chunk 3 │  │                    │
│  │  created: ...   │  │  └─────────┘  │                    │
│  └─────────────────┘  └──────────────┘                     │
└────────────────────────────────────────────────────────────┘
```

### The Key Insight: Separate Metadata from Data

Metadata (key, size, timestamps) goes into a fast, indexed database.
Actual bytes go onto cheap, high-capacity disk. The metadata store is
small and queryable; the data store is huge and dumb.

```
Metadata DB (PostgreSQL / DynamoDB):
  ┌──────────┬───────────┬────────┬────────────────┐
  │  bucket  │   key     │  size  │  chunk_ids     │
  ├──────────┼───────────┼────────┼────────────────┤
  │  images  │  cat.jpg  │  2.3MB │  [c1a, c1b]    │
  │  images  │  dog.png  │  800KB │  [c2a]         │
  │  backups │  db.tar   │  50GB  │  [c3a..c3z]    │
  └──────────┴───────────┴────────┴────────────────┘

Data Nodes (raw disk):
  Node 1: [c1a, c2a, c3a, c3b, ...]
  Node 2: [c1b, c3c, c3d, ...]     (replicas on different nodes)
  Node 3: [c1a_replica, c2a_replica, ...]
```

---

## Chunking Large Files

A 5 GB video can't be stored as one blob. Split it into fixed-size
chunks (typically 64 MB or 128 MB), store each independently, and
reassemble on download.

```
Upload: 5 GB video

  ┌────────────────────────────────────────────┐
  │              Original File (5 GB)           │
  └─┬──────┬──────┬──────┬──────┬──────┬──────┘
    │ 64MB │ 64MB │ 64MB │ ...  │ 64MB │ 32MB │  (last chunk partial)
    └──┬───┘──┬───┘──┬───┘      └──┬───┘──┬───┘
       │      │      │             │      │
    chunk_1 chunk_2 chunk_3 ... chunk_79 chunk_80

  Each chunk:
    - Gets a content-hash ID: SHA256(bytes) → "a3f8c2..."
    - Stored on 3 data nodes (replication factor = 3)
    - Metadata records chunk order
```

**Why chunk?**

| Benefit | Explanation |
|---------|-------------|
| Parallel upload | Upload 4 chunks simultaneously |
| Parallel download | Download from multiple nodes at once |
| Partial retry | If chunk 37 fails, retry only chunk 37 |
| Deduplication | Identical chunks share storage |
| Replication | Replicate small chunks, not 5 GB blobs |

---

## Deduplication

If 1000 users upload the same profile picture, store it once.

```
Content-Addressable Storage:
  chunk_id = SHA256(chunk_bytes)

  User A uploads photo.jpg → SHA256 = "abc123"
  User B uploads same photo → SHA256 = "abc123"

  Storage: only ONE copy of "abc123"
  Metadata: both users' keys point to "abc123"

  ┌──────────────────┐
  │ user_a/photo.jpg │──┐
  └──────────────────┘  │     ┌──────────────┐
                        ├────▶│  chunk abc123 │  (stored once)
  ┌──────────────────┐  │     └──────────────┘
  │ user_b/photo.jpg │──┘
  └──────────────────┘
```

### Back-of-Envelope: Dedup Savings

```
Photo sharing service:
  100M photos/day, average 3 MB each
  Raw storage: 100M × 3 MB = 300 TB/day

With dedup (assume 40% duplicate rate):
  Unique data: 300 TB × 0.6 = 180 TB/day
  Savings: 120 TB/day = $3,600/day at $0.03/GB

Annual savings: $1.3 million
```

---

## Presigned URLs

Don't proxy file downloads through your server. Let clients download
directly from storage, but with time-limited, signed URLs.

```
WITHOUT PRESIGNED URLs:
  Client → Your API → Blob Store → Your API → Client
  (your server is a bottleneck, burns bandwidth)

WITH PRESIGNED URLs:
  1. Client → Your API: "I want to download cat.jpg"
  2. Your API → generates signed URL (valid 15 min)
  3. Your API → Client: "Here's a direct link"
  4. Client → Blob Store: direct download (your server not involved)

  ┌────────┐  1. request   ┌─────────┐
  │ Client │──────────────▶│ Your API│
  │        │◀──────────────│         │
  └───┬────┘  2. signed URL└─────────┘
      │
      │ 3. direct download
      │
  ┌───▼────────┐
  │ Blob Store │
  │ (S3/GCS)   │
  └────────────┘
```

```typescript
import { S3Client, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

async function generateDownloadUrl(
    bucket: string,
    key: string,
    expiresInSeconds: number = 900
): Promise<string> {
    const client = new S3Client({ region: "us-east-1" });
    const command = new GetObjectCommand({ Bucket: bucket, Key: key });
    return getSignedUrl(client, command, { expiresIn: expiresInSeconds });
}

async function generateUploadUrl(
    bucket: string,
    key: string,
    contentType: string,
    maxSizeBytes: number
): Promise<string> {
    const client = new S3Client({ region: "us-east-1" });
    const command = new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        ContentType: contentType,
        ContentLength: maxSizeBytes,
    });
    return getSignedUrl(client, command, { expiresIn: 3600 });
}
```

---

## CDN Integration

For frequently accessed files, serve from CDN edge nodes instead of
blob storage origin.

```
┌────────┐     ┌─────────┐     ┌─────────────┐
│ Client │────▶│  CDN    │────▶│ Blob Store  │
│ (NYC)  │     │ (NYC    │     │ (us-east-1) │
└────────┘     │  edge)  │     └─────────────┘
               └─────────┘
               Cache HIT:    5ms  (95% of requests)
               Cache MISS:   80ms (fetch from origin, cache it)
```

**Strategy:**

```
Popular content (> 100 requests/day):
  CDN → edge cache → near user → fast

Cold content (< 1 request/week):
  Direct from blob store → slower but cheaper
  No point caching what nobody accesses

Very cold content (archival):
  Glacier/cold tier → cheapest storage
  Retrieval takes minutes to hours
```

### Storage Tier Trade-offs

| Tier | Latency | Cost/GB/month | Use Case |
|------|---------|---------------|----------|
| CDN edge | 5-20ms | $0.085 | Hot content |
| Standard blob | 50-100ms | $0.023 | Active data |
| Infrequent access | 50-100ms | $0.0125 | Backups, old data |
| Archive (Glacier) | Minutes-hours | $0.004 | Compliance, cold backups |

---

## Durability and Replication

S3 promises 99.999999999% (eleven 9s) durability. How?

```
Write path (replication factor = 3):

  ┌────────┐     ┌─────────┐
  │ Client │────▶│ API GW  │
  └────────┘     └────┬────┘
                      │
            ┌─────────┼─────────┐
            │         │         │
       ┌────▼───┐ ┌───▼────┐ ┌─▼──────┐
       │ Node 1 │ │ Node 2 │ │ Node 3 │  (different racks)
       │  AZ-a  │ │  AZ-b  │ │  AZ-c  │  (different AZs)
       └────────┘ └────────┘ └────────┘

  Write succeeds after 2 of 3 nodes ACK (quorum).
  Background repair fixes the third.
```

**Erasure coding** (used at scale instead of simple replication):

```
Simple replication (3 copies):
  100 GB data → 300 GB storage (3x overhead)

Erasure coding (e.g., Reed-Solomon 6+3):
  Split data into 6 chunks
  Generate 3 parity chunks
  Total: 9 chunks, can lose any 3 and still recover
  100 GB data → 150 GB storage (1.5x overhead)

  Half the storage cost of replication, same durability.
```

---

## Exercises

1. Implement a simple blob store API in Go with PUT, GET, DELETE.
   Store files on local disk with content-hash naming for dedup.

2. Calculate storage costs for a photo sharing app with 50M daily
   uploads, 4 MB average, 30% dedup rate, using S3 standard tier.
   Compare with infrequent access tier for photos older than 90 days.

3. Build a presigned URL generator. Create upload and download URLs
   that expire after 15 minutes. Verify that expired URLs are rejected.

4. Design the metadata schema for a blob store that supports:
   versioning, tagging, lifecycle policies (auto-archive after 90 days).

---

*Next: [Lesson 26 — Time-Series and Analytics](./26-time-series-analytics.md),
where we design systems for metrics, OLAP queries, and columnar storage.*
