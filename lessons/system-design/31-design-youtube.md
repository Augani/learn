# Lesson 31: Design YouTube

YouTube handles 500 hours of video uploaded every minute and serves
billions of views per day. The interesting part isn't just storage — it's
the pipeline from raw upload to playable video across every device and
bandwidth.

**Analogy:** Imagine a TV studio that receives home videos from millions
of people, converts each into 10 different formats (HD, SD, mobile),
stores them in warehouses worldwide, and delivers the right format to
each viewer based on their screen and internet speed — all within
minutes of upload.

---

## Step 1: Requirements

### Functional Requirements

1. **Upload videos** — Users upload videos up to 1 hour long
2. **Stream videos** — Adaptive bitrate streaming on any device
3. **Recommendations** — Suggest related and personalized videos
4. **Search** — Find videos by title, description, tags

### Non-Functional Requirements

1. **Upload processing < 5 minutes** for a 10-minute video
2. **Playback start < 2 seconds** (first frame)
3. **High availability** — video playback must always work
4. **Global** — serve users worldwide with low latency

### Scale Estimation

```
DAU:                    500M
Video uploads/day:      500K (0.1% of users upload)
Average video:          200 MB raw, 10 min duration
Storage per day:        500K × 200 MB = 100 TB raw uploads
Transcoded (10 formats): 100 TB × 3 = 300 TB/day
Views per day:          5B video views
Peak streaming:         50M concurrent streams

Bandwidth:
  Average video: 5 Mbps stream
  50M concurrent × 5 Mbps = 250 Pbps
  (CDN handles this, not your origin)
```

---

## Step 2: High-Level Design

```
┌───────────────────────────────────────────────────────────┐
│                         CLIENTS                            │
└────┬──────────────────┬────────────────────┬──────────────┘
     │                  │                    │
  Upload             Stream              Browse/Search
     │                  │                    │
┌────▼──────┐    ┌──────▼───────┐    ┌──────▼──────┐
│ Upload    │    │  Streaming   │    │    API      │
│ Service   │    │  Service     │    │  Gateway    │
└────┬──────┘    └──────┬───────┘    └──────┬──────┘
     │                  │                    │
┌────▼──────┐    ┌──────▼───────┐    ┌──────▼──────┐
│ Transcode │    │    CDN       │    │ Search/Rec  │
│ Pipeline  │    │   (edge)     │    │  Service    │
└────┬──────┘    └──────────────┘    └─────────────┘
     │
┌────▼──────────────────────────┐
│        Blob Storage (S3)      │
│  Raw uploads + transcoded     │
└───────────────────────────────┘
```

---

## Step 3: Video Upload Pipeline

```
Upload flow:

  ┌────────┐     ┌───────────┐     ┌──────────────┐
  │ Client │────▶│  Upload   │────▶│  Blob Store  │
  │        │     │  Service  │     │  (raw video) │
  └────────┘     └─────┬─────┘     └──────────────┘
                       │
                 ┌─────▼──────┐
                 │   Message  │
                 │   Queue    │
                 └─────┬──────┘
                       │
              ┌────────┼────────┐
              │        │        │
         ┌────▼───┐ ┌──▼────┐ ┌▼────────┐
         │Transcode│ │Thumb- │ │Metadata │
         │ Worker  │ │nail   │ │Extract  │
         │         │ │Gen    │ │         │
         └────┬────┘ └───┬───┘ └────┬────┘
              │          │          │
              ▼          ▼          ▼
         ┌─────────────────────────────┐
         │  Video DB (metadata)        │
         │  video_id, status, formats  │
         └─────────────────────────────┘
```

### Chunked Upload

Large files need chunked upload with resume capability.

```
500 MB video, 5 MB chunks:

  Chunk 1 (0-5MB)    ──▶ upload ✓
  Chunk 2 (5-10MB)   ──▶ upload ✓
  Chunk 3 (10-15MB)  ──▶ upload ✗ (network error)
  Chunk 3 (10-15MB)  ──▶ retry  ✓  (resume from chunk 3)
  Chunk 4 ...
  ...
  Chunk 100 (495-500MB) ──▶ upload ✓
  All chunks received ──▶ reassemble ──▶ start transcoding
```

---

## Step 4: Transcoding

Convert one raw video into multiple formats and resolutions.

```
Input: raw_video.mp4 (1080p, H.264, 200 MB)

Transcoding pipeline:
  ┌──────────────────────────────────────────────────┐
  │                 Transcoder Farm                    │
  │                                                  │
  │  ┌──────────┐  Output formats:                   │
  │  │          │  ├─ 2160p (4K)  H.265  8000 kbps  │
  │  │   Raw    │  ├─ 1080p (HD)  H.264  5000 kbps  │
  │  │  Video   │──├─ 720p        H.264  2500 kbps  │
  │  │          │  ├─ 480p (SD)   H.264  1000 kbps  │
  │  │          │  ├─ 360p        H.264   500 kbps  │
  │  └──────────┘  └─ 240p        H.264   300 kbps  │
  │                                                  │
  │  Each resolution also gets segmented into        │
  │  small chunks (2-10 seconds) for streaming       │
  └──────────────────────────────────────────────────┘
```

### Back-of-Envelope: Transcoding Capacity

```
500K uploads/day, average 10 minutes each
Total transcode time: 500K × 10 min = 5M minutes/day

Transcoding is ~2x real-time on modern hardware:
  1 server transcodes 10 min video in ~20 min (for all formats)
  Per day: 5M minutes / (60 min/hour × 24 hours) ≈ 3,500 hours
  At 20 min per video: 3,500 × 3 = 10,500 server-hours/day

  Need: ~450 transcoding servers running 24/7
  Or: use spot instances, scale up during peak upload hours
```

---

## Step 5: Adaptive Bitrate Streaming

Don't serve one quality — serve the right quality for each viewer's
bandwidth, adjusting in real time.

```
HLS (HTTP Live Streaming):

  Master playlist (index):
    #EXT-X-STREAM-INF:BANDWIDTH=8000000,RESOLUTION=3840x2160
    /video/abc/4k/playlist.m3u8
    #EXT-X-STREAM-INF:BANDWIDTH=5000000,RESOLUTION=1920x1080
    /video/abc/1080p/playlist.m3u8
    #EXT-X-STREAM-INF:BANDWIDTH=2500000,RESOLUTION=1280x720
    /video/abc/720p/playlist.m3u8

  Player starts at medium quality.
  Bandwidth good → switch to higher quality.
  Bandwidth drops → switch to lower quality.

  ┌────────┐     ┌─────────┐     ┌──────────────┐
  │ Player │────▶│   CDN   │────▶│ Blob Storage │
  │        │     │  (edge) │     │ (origin)     │
  └────────┘     └─────────┘     └──────────────┘

  Player requests 2-second segments one at a time.
  Each segment can be a different quality.

  Timeline:
  [1080p][1080p][720p][720p][480p][720p][1080p]
    ↑ good bandwidth  ↑ bandwidth drop  ↑ recovered
```

---

## Step 6: CDN Strategy

Videos are the CDN's biggest workload. Most views are for a small
percentage of videos (viral content, trending).

```
CDN cache strategy:

  HOT videos (< 0.1% of library, > 80% of views):
    Cached at EVERY edge location worldwide
    Cache TTL: 7 days

  WARM videos (top 10% by views):
    Cached at regional POPs
    Cache TTL: 24 hours

  COLD videos (long tail, 90% of library):
    NOT cached at edge
    Served from origin (blob storage)
    Only cached if a surge happens

  ┌──────────────────────────────────────────────┐
  │              CDN Edge (Tokyo)                  │
  │  ┌──────────────────────────────────────┐    │
  │  │  Hot cache: 1000 videos (500 GB)     │    │
  │  │  Hit rate: 80%                       │    │
  │  └──────────────────────────────────────┘    │
  │                    │ miss                     │
  │             ┌──────▼──────┐                   │
  │             │  Regional   │                   │
  │             │  POP (Asia) │                   │
  │             │  50K videos │                   │
  │             └──────┬──────┘                   │
  │                    │ miss                     │
  │             ┌──────▼──────┐                   │
  │             │   Origin    │                   │
  │             │  (S3, all   │                   │
  │             │   videos)   │                   │
  │             └─────────────┘                   │
  └──────────────────────────────────────────────┘
```

---

## Step 7: Recommendations

```
┌──────────────────────────────────────────────────┐
│            Recommendation Pipeline                │
│                                                  │
│  ┌────────────┐  ┌────────────┐  ┌───────────┐  │
│  │ Candidate  │─▶│  Scoring   │─▶│  Ranking  │  │
│  │ Generation │  │  Model     │  │  & Filter │  │
│  │            │  │            │  │           │  │
│  │ Sources:   │  │ Features:  │  │ Remove:   │  │
│  │ -Similar   │  │ -Watch %   │  │ -Already  │  │
│  │  videos    │  │ -User hist │  │  watched  │  │
│  │ -Same      │  │ -Recency   │  │ -Flagged  │  │
│  │  channel   │  │ -Populrty  │  │           │  │
│  │ -Trending  │  │            │  │ Diversify │  │
│  │ -Collab.   │  │            │  │ results   │  │
│  │  filtering │  │            │  │           │  │
│  └────────────┘  └────────────┘  └───────────┘  │
└──────────────────────────────────────────────────┘
```

---

## Trade-Off Summary

| Decision | Option A | Option B | Recommendation |
|----------|----------|----------|---------------|
| Upload | Single request | Chunked + resumable | Chunked for files > 10MB |
| Transcoding | On-upload (eager) | On-first-view (lazy) | Eager for popular formats, lazy for rare ones |
| Streaming | Progressive download | Adaptive bitrate (HLS/DASH) | ABR for quality experience |
| CDN caching | Cache everything | Tiered (hot/warm/cold) | Tiered — 90% of videos rarely watched |
| Storage | Single region | Multi-region replicated | Multi-region for global audience |
| Thumbnails | Static (one frame) | AI-selected frame | AI-selected increases CTR |

---

## Exercises

1. Design the transcoding pipeline as a DAG: raw video enters, multiple
   parallel transcode jobs run, thumbnails generate, metadata extracts.
   What's the critical path for time-to-playable?

2. Calculate CDN costs for 5B video views/day, average 5 minutes
   watched at 2500 kbps. How much egress bandwidth? At $0.02/GB?

3. Implement a chunked upload endpoint in Go that accepts 5MB chunks,
   tracks progress, and reassembles the file when complete.

4. Design the database schema for video metadata: video info, formats
   available, view counts, recommendations. What do you cache?

---

*Next: [Lesson 32 — Design Uber](./32-design-uber.md), where we build
a real-time matching and dispatch system with geospatial indexing.*
