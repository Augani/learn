# Lesson 12 — Multimodal Vision

## Connecting Eyes to Language

Humans don't just see — we describe what we see with words. Multimodal
vision models learn to connect images and text in a shared space. Show the
model a photo of a golden retriever, and it knows that "a fluffy dog playing
in the park" is a good description without ever being explicitly trained on
that exact image-text pair.

Think of it as building a universal translator between visual and textual
languages.

## CLIP — Contrastive Language-Image Pretraining

CLIP learns to align images and text by training on 400 million image-text
pairs scraped from the internet.

```
  Training: Contrastive Learning

  Image Encoder          Text Encoder
  (ViT or ResNet)        (Transformer)
       |                      |
       v                      v
  Image embedding         Text embedding
  [img1_vec]              [txt1_vec]  "a photo of a cat"
  [img2_vec]              [txt2_vec]  "a red sports car"
  [img3_vec]              [txt3_vec]  "sunset over ocean"

  Similarity Matrix:
              txt1    txt2    txt3
  img1  [    HIGH    low     low   ]   img1 = cat photo
  img2  [    low     HIGH    low   ]   img2 = car photo
  img3  [    low     low     HIGH  ]   img3 = sunset photo

  Training pushes matching pairs together (diagonal)
  and non-matching pairs apart (off-diagonal).
```

## Using CLIP

```python
import torch
from PIL import Image
from transformers import CLIPProcessor, CLIPModel

model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

image = Image.open("photo.jpg")
texts = ["a photo of a cat", "a photo of a dog", "a photo of a car"]

inputs = processor(text=texts, images=image, return_tensors="pt",
                   padding=True)

with torch.no_grad():
    outputs = model(**inputs)

logits = outputs.logits_per_image
probs = logits.softmax(dim=-1)

for text, prob in zip(texts, probs[0]):
    print(f"{text}: {prob:.3f}")
```

## Zero-Shot Classification

The magic of CLIP: classify images into categories it has never been
explicitly trained on. Just describe the categories in text.

```
  Traditional classifier:
  Train on labeled data -> fixed set of classes

  CLIP zero-shot:
  No training needed -> ANY text description becomes a class

  Want to classify dog breeds? Just write:
  - "a photo of a golden retriever"
  - "a photo of a poodle"
  - "a photo of a bulldog"
  ...
  CLIP picks the best match.
```

```python
def zero_shot_classify(image_path, class_names, template="a photo of a {}"):
    model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
    processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

    image = Image.open(image_path)
    texts = [template.format(name) for name in class_names]

    inputs = processor(text=texts, images=image, return_tensors="pt",
                       padding=True)

    with torch.no_grad():
        outputs = model(**inputs)

    probs = outputs.logits_per_image.softmax(dim=-1)[0]

    results = sorted(zip(class_names, probs.tolist()),
                     key=lambda x: x[1], reverse=True)

    return results
```

## Prompt Engineering for CLIP

The text prompt matters enormously. Small changes in wording can shift
predictions.

```
  Bad prompts:           Good prompts:
  "cat"                  "a photo of a cat"
  "dog"                  "a photograph of a dog"
  "car"                  "a photo of a red sports car"

  Even better — use multiple templates and average:
  "a photo of a {}"
  "a photograph of a {}"
  "an image of a {}"
  "a picture showing a {}"
```

```python
def ensemble_zero_shot(image, class_names, model, processor):
    templates = [
        "a photo of a {}",
        "a photograph of a {}",
        "an image showing a {}",
        "a picture of a {}",
        "a close-up photo of a {}",
    ]

    all_probs = []
    for template in templates:
        texts = [template.format(name) for name in class_names]
        inputs = processor(text=texts, images=image, return_tensors="pt",
                           padding=True)
        with torch.no_grad():
            outputs = model(**inputs)
        probs = outputs.logits_per_image.softmax(dim=-1)
        all_probs.append(probs)

    avg_probs = torch.stack(all_probs).mean(dim=0)
    return avg_probs
```

## Image Search with CLIP

Embed all images in a database. At query time, embed the text query and
find the nearest image embeddings.

```
  Database:
  img1 -> [0.12, -0.34, 0.56, ...]
  img2 -> [0.78, 0.23, -0.11, ...]
  img3 -> [-0.45, 0.67, 0.89, ...]
  ...

  Query: "a sunset over mountains"
         -> [0.15, 0.62, 0.88, ...]

  Cosine similarity:
  img1: 0.21
  img2: 0.45
  img3: 0.93  <-- best match!
```

```python
import numpy as np
from pathlib import Path

def build_image_index(image_dir, model, processor):
    embeddings = []
    paths = []

    for path in sorted(Path(image_dir).glob("*.jpg")):
        image = Image.open(path)
        inputs = processor(images=image, return_tensors="pt")
        with torch.no_grad():
            emb = model.get_image_features(**inputs)
        emb = emb / emb.norm(dim=-1, keepdim=True)
        embeddings.append(emb.squeeze().numpy())
        paths.append(str(path))

    return np.array(embeddings), paths


def search_images(query_text, embeddings, paths, model, processor, top_k=5):
    inputs = processor(text=[query_text], return_tensors="pt", padding=True)
    with torch.no_grad():
        text_emb = model.get_text_features(**inputs)
    text_emb = text_emb / text_emb.norm(dim=-1, keepdim=True)

    similarities = embeddings @ text_emb.squeeze().numpy()
    top_indices = np.argsort(similarities)[::-1][:top_k]

    return [(paths[i], similarities[i]) for i in top_indices]
```

## Beyond CLIP — Other Multimodal Models

```
  +----------------+------------------------------------------+
  | Model          | What it does                             |
  +----------------+------------------------------------------+
  | CLIP           | Image-text alignment, zero-shot classify |
  | ALIGN          | Google's CLIP-like model, larger scale   |
  | BLIP-2         | Image captioning + visual QA             |
  | LLaVA          | Visual instruction following (chat+image)|
  | Florence       | Unified vision-language foundation model |
  | SigLIP         | Sigmoid loss CLIP (better for retrieval) |
  +----------------+------------------------------------------+
```

## Image Captioning with BLIP

```python
from transformers import BlipProcessor, BlipForConditionalGeneration

processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)
model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)

image = Image.open("photo.jpg")
inputs = processor(image, return_tensors="pt")

with torch.no_grad():
    output = model.generate(**inputs, max_new_tokens=50)

caption = processor.decode(output[0], skip_special_tokens=True)
print(f"Caption: {caption}")
```

## Visual Question Answering

```python
from transformers import BlipProcessor, BlipForQuestionAnswering

processor = BlipProcessor.from_pretrained("Salesforce/blip-vqa-base")
model = BlipForQuestionAnswering.from_pretrained("Salesforce/blip-vqa-base")

image = Image.open("kitchen.jpg")
question = "How many people are in the image?"

inputs = processor(image, question, return_tensors="pt")
with torch.no_grad():
    output = model.generate(**inputs)

answer = processor.decode(output[0], skip_special_tokens=True)
print(f"Q: {question}")
print(f"A: {answer}")
```

## Exercises

1. Use CLIP to classify 20 images into 5 categories of your choice. Compare
   zero-shot accuracy to a fine-tuned ResNet-18 trained on the same
   categories with 10 labeled examples each.

2. Build a text-to-image search engine: index a folder of 100+ images with
   CLIP, then search with natural language queries. How accurate are the
   results?

3. Test prompt engineering: for the same image and class set, try 5 different
   prompt templates. Which template gives the highest accuracy? Why?

4. Use BLIP to generate captions for 10 images. Rate each caption on a 1-5
   scale for accuracy. What types of images get good captions vs. poor ones?

5. Combine CLIP and a detection model: detect objects with YOLOv8, crop each
   detection, then classify the crops with CLIP zero-shot. Compare to
   YOLO's built-in classification.

---

**Next: [Lesson 13 — Generative Vision](13-generative-vision.md)**
