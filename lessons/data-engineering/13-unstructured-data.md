# Lesson 13: Unstructured Data at Scale

> Structured data is like a neatly organized filing cabinet --
> everything has a labeled folder. Unstructured data is like a
> warehouse full of boxes: photos, voice recordings, documents,
> videos. You know there's valuable stuff in there, but you need
> specialized tools to find and process it.

---

## The Unstructured Data Problem

```
  80-90% of enterprise data is UNSTRUCTURED

  +-------------------+-------------------+
  | Structured        | Unstructured      |
  +-------------------+-------------------+
  | SQL tables        | Images            |
  | CSV files         | Videos            |
  | JSON with schema  | Audio files       |
  | Parquet           | PDFs              |
  |                   | Emails            |
  |                   | Free-text docs    |
  |                   | Log files         |
  |                   | Sensor data       |
  +-------------------+-------------------+

  Challenges:
  - No schema (can't just SELECT * FROM images)
  - Variable size (1KB text to 10GB video)
  - Expensive to process (GPU needed for ML)
  - Hard to index and search
  - Storage costs scale differently
```

---

## Text Processing Pipeline

```
  Raw Documents --> [Extract] --> [Clean] --> [Chunk] --> [Embed] --> [Store]

  +--------+    +--------+    +--------+    +--------+    +--------+
  | PDF    | -> | Text   | -> | Remove | -> | Split  | -> | Vector |
  | DOCX   |    | extract|    | noise  |    | into   |    | DB     |
  | HTML   |    |        |    | normalize   | chunks |    | (Pinecone,
  | Email  |    |        |    |        |    |        |    |  Weaviate)
  +--------+    +--------+    +--------+    +--------+    +--------+
```

```python
from dataclasses import dataclass
from pathlib import Path
import re


@dataclass
class TextChunk:
    text: str
    source: str
    chunk_index: int
    metadata: dict


class TextProcessor:
    def __init__(self, chunk_size: int = 512, chunk_overlap: int = 50):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap

    def extract_text(self, file_path: str) -> str:
        path = Path(file_path)
        suffix = path.suffix.lower()

        if suffix == ".txt":
            return path.read_text(encoding="utf-8")
        elif suffix == ".pdf":
            return self._extract_pdf(file_path)
        elif suffix == ".html":
            return self._extract_html(file_path)
        else:
            raise ValueError(f"Unsupported file type: {suffix}")

    def _extract_pdf(self, path: str) -> str:
        import fitz
        doc = fitz.open(path)
        text_parts = []
        for page in doc:
            text_parts.append(page.get_text())
        return "\n".join(text_parts)

    def _extract_html(self, path: str) -> str:
        from bs4 import BeautifulSoup
        with open(path, "r") as f:
            soup = BeautifulSoup(f.read(), "html.parser")
        for tag in soup(["script", "style", "nav", "footer"]):
            tag.decompose()
        return soup.get_text(separator="\n", strip=True)

    def clean_text(self, text: str) -> str:
        text = re.sub(r"\s+", " ", text)
        text = re.sub(r"[^\x20-\x7E\n]", "", text)
        text = re.sub(r"\n{3,}", "\n\n", text)
        return text.strip()

    def chunk_text(self, text: str, source: str) -> list[TextChunk]:
        words = text.split()
        chunks = []
        start = 0

        while start < len(words):
            end = start + self.chunk_size
            chunk_words = words[start:end]
            chunk_text = " ".join(chunk_words)

            chunks.append(TextChunk(
                text=chunk_text,
                source=source,
                chunk_index=len(chunks),
                metadata={"word_count": len(chunk_words)},
            ))

            start = end - self.chunk_overlap

        return chunks

    def process_file(self, file_path: str) -> list[TextChunk]:
        raw_text = self.extract_text(file_path)
        cleaned = self.clean_text(raw_text)
        return self.chunk_text(cleaned, source=file_path)
```

---

## Image Processing Pipeline

```
  Raw Images --> [Validate] --> [Resize] --> [Normalize] --> [Store]
                                    |
                                    v
                              [Thumbnails]
                              [Metadata extraction]

  Image storage patterns:
  +--------------------------------------------------+
  | Object store (S3/GCS):                            |
  |   s3://bucket/images/                             |
  |     raw/       <-- Original uploads               |
  |     processed/ <-- Resized/normalized              |
  |     thumbnails/<-- Small previews                  |
  |                                                    |
  | Metadata in database:                              |
  |   image_id | path | width | height | format | ... |
  +--------------------------------------------------+
```

```python
from pathlib import Path
from dataclasses import dataclass
from PIL import Image
import io


@dataclass
class ImageMetadata:
    path: str
    width: int
    height: int
    format: str
    file_size_bytes: int
    channels: int


class ImageProcessor:
    def __init__(self, target_size: tuple[int, int] = (224, 224)):
        self.target_size = target_size

    def validate(self, image_path: str) -> bool:
        try:
            with Image.open(image_path) as img:
                img.verify()
            return True
        except Exception:
            return False

    def extract_metadata(self, image_path: str) -> ImageMetadata:
        path = Path(image_path)
        with Image.open(image_path) as img:
            return ImageMetadata(
                path=str(path),
                width=img.width,
                height=img.height,
                format=img.format or "unknown",
                file_size_bytes=path.stat().st_size,
                channels=len(img.getbands()),
            )

    def resize(self, image_path: str, output_path: str) -> str:
        with Image.open(image_path) as img:
            img = img.convert("RGB")
            img = img.resize(self.target_size, Image.LANCZOS)
            img.save(output_path, "JPEG", quality=85)
        return output_path

    def create_thumbnail(self, image_path: str, output_path: str, size: tuple[int, int] = (128, 128)):
        with Image.open(image_path) as img:
            img.thumbnail(size, Image.LANCZOS)
            img.save(output_path, "JPEG", quality=75)
        return output_path

    def process_batch(self, image_paths: list[str], output_dir: str) -> list[dict]:
        results = []
        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)

        for path in image_paths:
            if not self.validate(path):
                results.append({"path": path, "status": "invalid"})
                continue

            name = Path(path).stem
            try:
                self.resize(path, str(output / f"{name}_resized.jpg"))
                self.create_thumbnail(path, str(output / f"{name}_thumb.jpg"))
                metadata = self.extract_metadata(path)
                results.append({"path": path, "status": "success", "metadata": metadata})
            except Exception as exc:
                results.append({"path": path, "status": "error", "error": str(exc)})

        return results
```

---

## Audio Processing Pipeline

```
  Raw Audio --> [Transcode] --> [Normalize] --> [Segment] --> [Process]
                    |
                    v
  Formats: WAV, MP3, FLAC, OGG, M4A --> Standardize to WAV/FLAC

  Audio pipeline decisions:
  +----------------------+-----------------------------------+
  | Parameter            | Typical Values                    |
  +----------------------+-----------------------------------+
  | Sample rate          | 16kHz (speech) / 44.1kHz (music) |
  | Bit depth            | 16-bit                           |
  | Channels             | Mono (speech) / Stereo (music)   |
  | Format               | WAV (processing) / FLAC (storage)|
  | Segment length       | 30s (ASR) / variable (music)     |
  +----------------------+-----------------------------------+
```

```python
import subprocess
from pathlib import Path


class AudioProcessor:
    def __init__(self, target_sample_rate: int = 16000):
        self.target_sample_rate = target_sample_rate

    def transcode(self, input_path: str, output_path: str) -> str:
        subprocess.run([
            "ffmpeg", "-i", input_path,
            "-ar", str(self.target_sample_rate),
            "-ac", "1",
            "-f", "wav",
            output_path,
            "-y",
        ], check=True, capture_output=True)
        return output_path

    def get_duration(self, audio_path: str) -> float:
        result = subprocess.run([
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            audio_path,
        ], capture_output=True, text=True)
        return float(result.stdout.strip())

    def segment(self, audio_path: str, output_dir: str, segment_length: float = 30.0) -> list[str]:
        duration = self.get_duration(audio_path)
        output = Path(output_dir)
        output.mkdir(parents=True, exist_ok=True)
        segments = []

        for start in range(0, int(duration), int(segment_length)):
            segment_path = str(output / f"segment_{start:06d}.wav")
            subprocess.run([
                "ffmpeg", "-i", audio_path,
                "-ss", str(start),
                "-t", str(segment_length),
                "-ar", str(self.target_sample_rate),
                "-ac", "1",
                segment_path,
                "-y",
            ], check=True, capture_output=True)
            segments.append(segment_path)

        return segments
```

---

## Scaling Unstructured Data Processing

```
  Small scale (< 10K files):
  +--------+
  | Single | --> Process sequentially or with multiprocessing
  | machine|
  +--------+

  Medium scale (10K - 1M files):
  +--------+    +--------+    +--------+
  | Worker | -> | Queue  | -> | Object |
  | Pool   |    | (SQS)  |    | Store  |
  +--------+    +--------+    +--------+

  Large scale (1M+ files):
  +--------+    +--------+    +--------+
  | Spark  | -> | Process| -> | Delta  |
  | Cluster|    | in     |    | Lake   |
  +--------+    | parallel    +--------+
                +--------+

  Cost comparison (processing 1M images):
  +-------------------+----------+----------+----------+
  | Approach          | Time     | Cost     | Complexity|
  +-------------------+----------+----------+----------+
  | Single machine    | 100 hrs  | $50      | Low      |
  | 10x machines      | 10 hrs   | $50      | Medium   |
  | Spark (20 nodes)  | 2 hrs    | $40      | High     |
  | Serverless (Lambda)| 1 hr    | $30      | Medium   |
  +-------------------+----------+----------+----------+
```

```python
from concurrent.futures import ProcessPoolExecutor, as_completed
from pathlib import Path


def process_file(file_path: str) -> dict:
    processor = ImageProcessor()
    if not processor.validate(file_path):
        return {"path": file_path, "status": "invalid"}

    try:
        metadata = processor.extract_metadata(file_path)
        return {"path": file_path, "status": "success", "metadata": metadata}
    except Exception as exc:
        return {"path": file_path, "status": "error", "error": str(exc)}


def process_directory(input_dir: str, max_workers: int = 8) -> list[dict]:
    files = list(Path(input_dir).glob("**/*.jpg")) + list(Path(input_dir).glob("**/*.png"))

    results = []
    with ProcessPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(process_file, str(f)): f for f in files}
        for future in as_completed(futures):
            results.append(future.result())

    success = sum(1 for r in results if r["status"] == "success")
    failed = sum(1 for r in results if r["status"] != "success")
    print(f"Processed {len(results)} files: {success} success, {failed} failed")

    return results
```

---

## Vector Storage for Embeddings

```
  Unstructured data --> [Embedding Model] --> Vector --> [Vector DB]

  Text:  "The cat sat on the mat"  --> [0.12, -0.45, 0.78, ...]
  Image: photo_of_cat.jpg          --> [0.33, 0.21, -0.56, ...]
  Audio: meow.wav                  --> [0.67, -0.12, 0.44, ...]

  Vector databases:
  +-------------+--------+---------+---------------------------+
  | Database    | Type   | Scale   | Best For                  |
  +-------------+--------+---------+---------------------------+
  | Pinecone    | Managed| Billions| Production, managed       |
  | Weaviate    | OSS    | Millions| Hybrid search             |
  | Milvus      | OSS    | Billions| Large scale               |
  | Qdrant      | OSS    | Millions| Filtering + search        |
  | ChromaDB    | OSS    | Millions| Prototyping               |
  | pgvector    | OSS    | Millions| PostgreSQL ecosystem      |
  +-------------+--------+---------+---------------------------+
```

---

## Exercises

1. **Text pipeline**: Build a pipeline that processes 100 PDF
   files: extract text, clean, chunk (500 words), and store
   chunks with metadata in a JSON file.

2. **Image pipeline**: Process a directory of images: validate,
   extract metadata, resize to 224x224, create thumbnails.
   Handle corrupt files gracefully.

3. **Parallel processing**: Take your image pipeline from exercise
   2 and parallelize it using ProcessPoolExecutor. Benchmark
   with 1, 4, 8, and 16 workers.

4. **Audio pipeline**: Build a pipeline that takes audio files in
   various formats, transcodes to 16kHz mono WAV, segments into
   30-second chunks, and logs metadata.

5. **Vector search**: Process 1000 text documents into embeddings
   (use sentence-transformers). Store in ChromaDB. Build a
   search function that finds the top-5 most similar documents
   for a query.

---

**Next**: [Lesson 14 - Building a Data Platform](./14-building-data-platform.md)
