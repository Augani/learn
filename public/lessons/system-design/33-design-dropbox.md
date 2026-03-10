# Lesson 33: Design Dropbox

Dropbox syncs files across devices seamlessly. Edit a document on your
laptop and it appears on your phone seconds later. The hard part isn't
uploading files — it's syncing efficiently when files change, handling
conflicts when two devices edit the same file, and minimizing bandwidth
by only transferring what changed.

**Analogy:** Imagine two people editing copies of the same book in
different cities. Every time one person changes a page, a courier carries
just the changed pages (not the whole book) to the other person. If both
people change the same page simultaneously, someone needs to decide
which version wins — or keep both.

---

## Step 1: Requirements

### Functional Requirements

1. **Upload/download files** — Store files in the cloud
2. **Sync across devices** — Changes propagate automatically
3. **File versioning** — Revert to previous versions
4. **Conflict resolution** — Handle simultaneous edits
5. **Sharing** — Share files/folders with others

### Non-Functional Requirements

1. **Sync latency < 10 seconds** for small file changes
2. **Bandwidth efficient** — Only transfer changed portions
3. **Offline support** — Queue changes, sync when online
4. **Reliability** — Never lose user data

### Scale Estimation

```
Users:              500M registered, 100M DAU
Files per user:     average 200 files
Total files:        100 billion
Average file size:  500 KB
Total storage:      100B × 500 KB = 50 PB
Daily file changes: 1B file modifications/day
Sync events/sec:    1B / 86400 ≈ 12,000/sec
```

---

## Step 2: High-Level Design

```
┌──────────────────────────────────────────────────────────┐
│                     CLIENT (Desktop)                      │
│                                                          │
│  ┌────────────┐  ┌─────────────┐  ┌────────────────┐    │
│  │  Watcher   │  │  Chunker    │  │  Sync Engine   │    │
│  │ (file      │  │ (split file │  │ (upload/download│    │
│  │  changes)  │  │  into blocks)│  │  changed blocks)│   │
│  └────────────┘  └─────────────┘  └────────┬───────┘    │
└────────────────────────────────────────────┬─────────────┘
                                             │
                    ┌────────────────────────▼───────────┐
                    │            CLOUD                     │
                    │                                     │
                    │  ┌──────────────┐  ┌─────────────┐ │
                    │  │  Sync       │  │  Metadata   │ │
                    │  │  Service    │  │  Service    │ │
                    │  └──────┬──────┘  └──────┬──────┘ │
                    │         │                │        │
                    │  ┌──────▼──────┐  ┌──────▼──────┐ │
                    │  │  Block     │  │  Metadata   │ │
                    │  │  Storage   │  │  Database   │ │
                    │  │  (S3)     │  │ (PostgreSQL)│ │
                    │  └────────────┘  └─────────────┘ │
                    │                                     │
                    │  ┌──────────────┐                   │
                    │  │ Notification │  (WebSocket)      │
                    │  │ Service     │                   │
                    │  └──────────────┘                   │
                    └─────────────────────────────────────┘
```

---

## Step 3: Chunking and Delta Sync

The key insight: don't upload entire files. Split files into chunks
and only upload the chunks that changed.

```
CHUNKING:

  report.docx (10 MB)
  ┌──────┬──────┬──────┬──────┬──────┐
  │ 4 MB │ 4 MB │ 2 MB │      │      │
  │ blk1 │ blk2 │ blk3 │      │      │
  └──┬───┘──┬───┘──┬───┘      │      │
     │      │      │           │      │
   hash1  hash2  hash3        │      │
  (sha256)(sha256)(sha256)    │      │

  User edits page 5 (in block 2):

  ┌──────┬──────┬──────┐
  │ 4 MB │ 4 MB │ 2 MB │
  │ blk1 │ blk2'│ blk3 │  (blk2 changed, blk1/blk3 same)
  └──┬───┘──┬───┘──┬───┘
     │      │      │
   hash1  hash2' hash3
   (same) (NEW!) (same)

  Only blk2' is uploaded (4 MB instead of 10 MB).
  60% bandwidth savings on this edit.
```

### Content-Defined Chunking (CDC)

Fixed-size chunks have a problem: inserting one byte at the start shifts
every chunk boundary, making ALL chunks look new.

```
FIXED CHUNKING (bad for inserts):

  Original:  [AAAA][BBBB][CCCC]
  Insert X:  [XAAA][ABBB][BCCC][C...]
              ^^^^   ^^^^   ^^^^
              ALL chunks changed! (boundaries shifted)

CONTENT-DEFINED CHUNKING (Rabin fingerprint):
  Chunk boundaries determined by content, not position.
  Insert at beginning only changes the first chunk.

  Original:  [AAAA..A][BBBB..B][CCC..C]
  Insert X:  [XAAAA..A][BBBB..B][CCC..C]
              ^^^^^^^^^
              Only first chunk changed!
```

---

## Step 4: Sync Protocol

```
LOCAL CHANGE DETECTED:

  1. Watcher detects file modified
  2. Chunker splits file into blocks
  3. Compare block hashes with server version
  4. Upload only new/changed blocks
  5. Update file metadata (new block list)
  6. Notify other devices via WebSocket

  ┌─────────────┐
  │ Client A    │
  │ edits file  │
  └─────┬───────┘
        │  upload changed blocks
        ▼
  ┌──────────────┐     ┌──────────────┐
  │ Block Store  │     │  Metadata DB │
  │ (store blk2')│     │ (update hash │
  └──────────────┘     │  list)       │
                       └──────┬───────┘
                              │  notify
                       ┌──────▼───────┐
                       │ Notification │
                       │ Service      │
                       └──────┬───────┘
                              │  WebSocket push
                       ┌──────▼───────┐
                       │  Client B    │
                       │  downloads   │
                       │  blk2' only  │
                       └──────────────┘
```

### Metadata Schema

```
files table:
  ┌──────────┬────────────┬──────────┬─────────┬─────────┐
  │ file_id  │ path       │ version  │ user_id │ is_dir  │
  ├──────────┼────────────┼──────────┼─────────┼─────────┤
  │ f_001    │ /docs/rep  │ 7        │ u_123   │ false   │
  └──────────┴────────────┴──────────┴─────────┴─────────┘

file_versions table:
  ┌──────────┬─────────┬────────────────────────┬───────────┐
  │ file_id  │ version │ block_list             │ timestamp │
  ├──────────┼─────────┼────────────────────────┼───────────┤
  │ f_001    │ 7       │ [hash_a, hash_b', hash_c]│ 10:30:00│
  │ f_001    │ 6       │ [hash_a, hash_b, hash_c] │ 09:15:00│
  └──────────┴─────────┴────────────────────────┴───────────┘

blocks table:
  ┌──────────────┬──────────┬────────────────┐
  │ block_hash   │ size     │ storage_path   │
  ├──────────────┼──────────┼────────────────┤
  │ hash_a       │ 4194304  │ s3://blk/hash_a│
  │ hash_b'      │ 4194304  │ s3://blk/hash_b│
  └──────────────┴──────────┴────────────────┘
```

---

## Step 5: Conflict Resolution

Two devices edit the same file offline. Both sync when they come online.

```
CONFLICT SCENARIO:

  t=0:  File version 5 on both devices
  t=1:  Device A edits file (offline)
  t=2:  Device B edits file (offline)
  t=3:  Device A comes online, syncs → version 6
  t=4:  Device B comes online, tries to sync
        → CONFLICT: B's base is version 5, but server is now version 6

RESOLUTION STRATEGIES:

  1. Last-Writer-Wins:
     Device B's changes overwrite Device A's.
     Simple but lossy.

  2. Conflicted Copy (Dropbox's approach):
     Keep BOTH versions:
       report.docx                    ← Device A's version (v6)
       report (conflicted copy).docx  ← Device B's version
     User manually merges.

  3. Operational Transform (Google Docs):
     Track individual operations (insert char, delete line).
     Merge operations from both devices.
     Complex but seamless for text documents.
```

```
Dropbox conflict flow:

  Device B attempts sync:
    "My base version: 5, my changes: [blk2_B, blk3_B]"

  Server:
    "Current version: 6 (from Device A)"
    "Your base (5) ≠ current (6) → CONFLICT"

  Server creates conflicted copy:
    report.docx → keeps Device A's version
    report (B's conflicted copy).docx → Device B's version

  Both files sync to all devices.
  User resolves manually.
```

---

## Step 6: Deduplication

Across 500M users, many identical files exist (same PDF, same photo).

```
Block-level dedup:

  User A uploads thesis.pdf:
    blocks: [hash_1, hash_2, hash_3, hash_4]
    All new → upload all 4 blocks

  User B uploads same thesis.pdf:
    blocks: [hash_1, hash_2, hash_3, hash_4]
    All exist → upload ZERO blocks
    Just create metadata pointing to existing blocks

  Storage: 1 copy instead of 2. Scale this to 500M users.
```

### Back-of-Envelope: Dedup Savings

```
100B files, average 500 KB, ~40% duplicate content

Without dedup: 100B × 500 KB = 50 PB
With dedup:    50 PB × 0.6 = 30 PB
Savings:       20 PB = $600K/month at $0.03/GB

Plus bandwidth savings: duplicate blocks never uploaded.
```

---

## Step 7: Offline Support

```
┌────────────────────────────────────────────────────┐
│                 OFFLINE QUEUE                        │
│                                                    │
│  Device goes offline:                              │
│    Changes queue locally in SQLite:                │
│    ┌────────┬──────────┬───────────┐               │
│    │ action │ file     │ blocks    │               │
│    ├────────┼──────────┼───────────┤               │
│    │ modify │ doc.txt  │ [blk2']   │               │
│    │ create │ new.pdf  │ [blk1..4] │               │
│    │ delete │ old.txt  │ -         │               │
│    └────────┴──────────┴───────────┘               │
│                                                    │
│  Device comes online:                              │
│    1. Push local queue to server (in order)        │
│    2. Pull remote changes since last sync          │
│    3. Detect and resolve conflicts                 │
│    4. Apply remote changes locally                 │
└────────────────────────────────────────────────────┘
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Chunking | Fixed-size | Content-defined (CDC) | CDC for fewer false changes |
| Chunk size | 4 MB | 1 MB | 4 MB (fewer chunks, less metadata) |
| Sync trigger | Polling | WebSocket push | Push for speed, poll as fallback |
| Conflicts | Last-writer-wins | Conflicted copies | Conflicted copies (no data loss) |
| Dedup | File-level | Block-level | Block-level (catches partial dups) |
| Notification | Long polling | WebSocket | WebSocket for real-time sync |

---

## Exercises

1. Implement content-defined chunking using a rolling hash (Rabin
   fingerprint). Compare it with fixed-size chunking when inserting
   10 bytes at the start of a 1 MB file.

2. Design the sync protocol: Client A modifies file, server notifies
   Client B, Client B downloads only changed blocks. Implement the
   metadata comparison logic.

3. Calculate: 100M DAU, 1B file changes/day, average 2 changed blocks
   per change at 4 MB each. What's the daily ingress bandwidth?
   How many block storage servers do you need?

4. Handle this conflict: Device A renames `report.docx` to `final.docx`.
   Device B edits the contents of `report.docx`. Both sync
   simultaneously. What should the system do?

---

*Next: [Lesson 34 — Design a Search Engine](./34-design-search-engine.md),
where we build web-scale search with crawling, indexing, and ranking.*
