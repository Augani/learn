# Lesson 11: Multimodal Models

> **Analogy**: A person who speaks multiple languages. They can
> hear something in French, think about it in their "internal
> language of thought," and explain it in Japanese. Multimodal
> models do the same with images, text, audio -- they translate
> between modalities through a shared representation space.

---

## What Is Multimodal?

```
Unimodal:  text -> text   (GPT)
           image -> label  (ResNet)

Multimodal: text + image -> text   (describe this photo)
            text -> image          (draw me a cat)
            audio -> text          (transcription)
            text + image -> image  (edit this photo based on text)

The key: a SHARED representation space where different
modalities can "talk" to each other.

  Text "a cat" ----+
                    |
                    v
              [Shared Space]  <-- embeddings live here
                    ^
                    |
  Image [cat] -----+

  In this space, "a cat" and [photo of cat]
  are NEAR each other.
```

---

## Architecture Patterns

```
Pattern 1: Dual Encoder (CLIP-style)
  Separate encoders, shared embedding space.

  Image --> [Image Encoder] --> image_emb ---|
                                             |--> similarity
  Text  --> [Text Encoder]  --> text_emb  ---|

  Good for: retrieval, zero-shot classification


Pattern 2: Encoder-Decoder (Flamingo, LLaVA-style)
  Visual tokens fed into a language model.

  Image --> [Vision Encoder] --> visual tokens
                                      |
                                      v
  Text  --> [Language Model that sees visual tokens] --> output text

  Good for: VQA, captioning, reasoning


Pattern 3: Unified (Gemini-style)
  Single model handles all modalities natively.

  [image tokens] + [text tokens] --> [Unified Transformer] --> output

  Good for: everything (if you have enough compute)
```

---

## CLIP: The Foundation

We saw CLIP in Lesson 09. It's the backbone of most
multimodal systems.

```
CLIP's shared space:

  "a dog playing fetch"  .  [photo of dog playing]
                         ^
                    high similarity

  "a dog playing fetch"  .  [photo of a car]
                         ^
                    low similarity

This space enables:
- Image search with text queries
- Zero-shot classification
- Image-text matching
- Foundation for bigger multimodal models
```

---

## Building a Multimodal Classifier

Combine image features and text features for classification.

```python
import torch
import torch.nn as nn
from transformers import CLIPModel, CLIPProcessor


class MultimodalClassifier(nn.Module):
    def __init__(self, num_classes, clip_model="openai/clip-vit-base-patch32"):
        super().__init__()
        self.clip = CLIPModel.from_pretrained(clip_model)

        for param in self.clip.parameters():
            param.requires_grad = False

        clip_dim = self.clip.config.projection_dim
        self.classifier = nn.Sequential(
            nn.Linear(clip_dim * 2, 256),
            nn.ReLU(),
            nn.Dropout(0.3),
            nn.Linear(256, num_classes),
        )

    def forward(self, pixel_values, input_ids, attention_mask):
        with torch.no_grad():
            image_features = self.clip.get_image_features(pixel_values=pixel_values)
            text_features = self.clip.get_text_features(
                input_ids=input_ids, attention_mask=attention_mask
            )

        image_features = image_features / image_features.norm(dim=-1, keepdim=True)
        text_features = text_features / text_features.norm(dim=-1, keepdim=True)

        combined = torch.cat([image_features, text_features], dim=-1)
        return self.classifier(combined)
```

---

## Visual Question Answering (VQA)

```
Input: Image + "What color is the car?"
Output: "Red"

  [Image of red car]    "What color is the car?"
         |                        |
         v                        v
  [Vision Encoder]         [Text Encoder]
         |                        |
         v                        v
  visual tokens            text tokens
         |                        |
         +----------+-------------+
                    |
                    v
             [Cross-Attention]
                    |
                    v
              [Decoder]
                    |
                    v
                 "Red"
```

```python
from transformers import BlipProcessor, BlipForQuestionAnswering
from PIL import Image

processor = BlipProcessor.from_pretrained("Salesforce/blip-vqa-base")
model = BlipForQuestionAnswering.from_pretrained("Salesforce/blip-vqa-base")

image = Image.open("red_car.jpg")
question = "What color is the car?"

inputs = processor(image, question, return_tensors="pt")

with torch.no_grad():
    output = model.generate(**inputs)

answer = processor.decode(output[0], skip_special_tokens=True)
print(f"Q: {question}")
print(f"A: {answer}")
```

---

## Image Captioning

```
Input:  [photo of a dog catching a frisbee]
Output: "A dog jumps to catch a frisbee in a park"

  [Image] --> [Vision Encoder] --> visual tokens
                                       |
                                       v
                              [Language Decoder]
                                       |
                                       v
                              "A dog jumps to catch
                               a frisbee in a park"
```

```python
from transformers import BlipProcessor, BlipForConditionalGeneration

processor = BlipProcessor.from_pretrained("Salesforce/blip-image-captioning-base")
model = BlipForConditionalGeneration.from_pretrained("Salesforce/blip-image-captioning-base")

image = Image.open("dog_frisbee.jpg")
inputs = processor(image, return_tensors="pt")

with torch.no_grad():
    output = model.generate(**inputs, max_new_tokens=50)

caption = processor.decode(output[0], skip_special_tokens=True)
print(f"Caption: {caption}")
```

---

## LLaVA: Visual Language Model

LLaVA connects a vision encoder to a large language model,
enabling complex visual reasoning.

```
Architecture:

  Image --> [CLIP Vision Encoder] --> visual tokens
                                          |
                                    [Linear Projection]
                                          |
                                          v
  "Describe this image" --> [LLM (Llama/Vicuna)] --> detailed description
                                 ^
                                 |
                            visual tokens are
                            prepended to text tokens

The LLM treats image patches like words in a sentence.
```

```python
from transformers import LlavaProcessor, LlavaForConditionalGeneration

model_name = "llava-hf/llava-1.5-7b-hf"
processor = LlavaProcessor.from_pretrained(model_name)
model = LlavaForConditionalGeneration.from_pretrained(
    model_name, torch_dtype=torch.float16, device_map="auto"
)

image = Image.open("scene.jpg")
prompt = "USER: <image>\nDescribe what's happening in this image in detail.\nASSISTANT:"

inputs = processor(text=prompt, images=image, return_tensors="pt").to("cuda")

with torch.no_grad():
    output = model.generate(**inputs, max_new_tokens=200)

response = processor.decode(output[0], skip_special_tokens=True)
print(response)
```

---

## Audio + Text: Whisper

```
Audio waveform --> [Whisper Encoder] --> audio features
                                             |
                                             v
                                   [Whisper Decoder] --> text

Whisper handles:
- Transcription (audio -> same language text)
- Translation (audio -> English text)
- Language detection
```

```python
from transformers import WhisperProcessor, WhisperForConditionalGeneration
import torch

processor = WhisperProcessor.from_pretrained("openai/whisper-base")
model = WhisperForConditionalGeneration.from_pretrained("openai/whisper-base")

import librosa
audio, sr = librosa.load("speech.wav", sr=16000)

input_features = processor(audio, sampling_rate=16000, return_tensors="pt").input_features

with torch.no_grad():
    predicted_ids = model.generate(input_features)

transcription = processor.batch_decode(predicted_ids, skip_special_tokens=True)
print(transcription[0])
```

---

## Contrastive Learning: The Glue

Most multimodal models use contrastive learning to align
modalities in a shared space.

```
Batch of N image-text pairs:

  (img_1, text_1)  <-- should match
  (img_2, text_2)  <-- should match
  (img_3, text_3)  <-- should match

Similarity matrix (N x N):

           text_1  text_2  text_3
  img_1  [  HIGH    low     low  ]
  img_2  [  low     HIGH    low  ]
  img_3  [  low     low     HIGH ]

Loss pushes diagonal (matching pairs) UP
and off-diagonal (non-matching) DOWN.

InfoNCE loss:
  L = -log( exp(sim(img_i, text_i) / tau) /
            sum_j( exp(sim(img_i, text_j) / tau) ) )
```

```python
def contrastive_loss(image_embeds, text_embeds, temperature=0.07):
    image_embeds = nn.functional.normalize(image_embeds, dim=-1)
    text_embeds = nn.functional.normalize(text_embeds, dim=-1)

    logits = image_embeds @ text_embeds.T / temperature
    labels = torch.arange(len(logits), device=logits.device)

    loss_i2t = nn.functional.cross_entropy(logits, labels)
    loss_t2i = nn.functional.cross_entropy(logits.T, labels)

    return (loss_i2t + loss_t2i) / 2
```

---

## Multimodal Model Landscape

```
+------------------+----------+----------------------------------------+
| Model            | Modality | Capability                             |
+------------------+----------+----------------------------------------+
| CLIP             | img+text | Matching, zero-shot classification     |
+------------------+----------+----------------------------------------+
| BLIP-2           | img+text | VQA, captioning, retrieval             |
+------------------+----------+----------------------------------------+
| LLaVA            | img+text | Visual reasoning, conversation         |
+------------------+----------+----------------------------------------+
| Whisper          | audio    | Transcription, translation             |
+------------------+----------+----------------------------------------+
| ImageBind        | 6 modals | Images, text, audio, depth, thermal, IMU|
+------------------+----------+----------------------------------------+
| GPT-4V / Gemini  | img+text | General multimodal reasoning           |
+------------------+----------+----------------------------------------+
```

---

## Exercises

1. **CLIP retrieval**: Build an image search engine. Encode 100
   images with CLIP, then search them using text queries. Return
   the top-5 most similar images for each query.

2. **VQA system**: Use BLIP to build a VQA system. Test it with
   10 image-question pairs. Where does it succeed and fail?

3. **Image captioning**: Generate captions for 20 images. Rate
   them 1-5 for accuracy. What kinds of scenes does the model
   describe well vs poorly?

4. **Multimodal classifier**: Build the MultimodalClassifier above
   for a dataset that has both images and text descriptions.
   Compare accuracy to image-only and text-only baselines.

5. **Contrastive training**: Implement contrastive learning on a
   small paired dataset (e.g., image-caption pairs). Train two
   encoders and verify that matching pairs have higher similarity
   than non-matching pairs.

---

**Next**: [Lesson 12 - Video Understanding](./12-video-understanding.md)
