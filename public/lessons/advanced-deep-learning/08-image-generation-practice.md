# Lesson 08: Image Generation Practice

> This is the hands-on lesson. We take everything from Lessons
> 05-07 and build real image generation pipelines using
> Stable Diffusion, ControlNet, and LoRA.

---

## The Stable Diffusion Pipeline

```
Your prompt: "a golden retriever in a space suit, digital art"

  +------------------+
  | Text Encoder     |  CLIP turns text into vectors
  | (CLIP ViT-L/14)  |
  +------------------+
          |
          v
  +------------------+
  | U-Net            |  Iteratively denoises in latent space
  | (860M params)    |  Guided by text embeddings
  +------------------+
          |
          v
  +------------------+
  | VAE Decoder      |  Converts 4x64x64 latent to 3x512x512 image
  | (Decoder only)   |
  +------------------+
          |
          v
      Final Image
```

---

## Basic Stable Diffusion with diffusers

```python
from diffusers import StableDiffusionPipeline
import torch

pipe = StableDiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-1",
    torch_dtype=torch.float16,
)
pipe = pipe.to("cuda")

image = pipe(
    prompt="a golden retriever in a space suit, digital art",
    num_inference_steps=50,
    guidance_scale=7.5,
).images[0]

image.save("space_dog.png")
```

---

## Key Parameters

```
+--------------------+--------+----------------------------------+
| Parameter          | Default| Effect                           |
+--------------------+--------+----------------------------------+
| num_inference_steps| 50     | More steps = better quality,     |
|                    |        | slower generation                |
+--------------------+--------+----------------------------------+
| guidance_scale     | 7.5    | Higher = more prompt-faithful,   |
|                    |        | less diverse                     |
+--------------------+--------+----------------------------------+
| negative_prompt    | None   | What to avoid: "blurry, ugly,    |
|                    |        | distorted"                       |
+--------------------+--------+----------------------------------+
| height/width       | 512    | Image dimensions (multiples of 8)|
+--------------------+--------+----------------------------------+
| seed (generator)   | random | Fix for reproducible results     |
+--------------------+--------+----------------------------------+

Guidance scale visual:

  1.0          3.0          7.5          15.0         20.0
  [random]     [loosely     [balanced]   [very        [over-
               related]                  faithful]    saturated]
```

---

## ControlNet: Precise Control

ControlNet adds spatial control to diffusion models.

```
Without ControlNet:
  "a house" --> some random house

With ControlNet:
  "a house" + [edge map of YOUR house] --> YOUR house in any style

Control types:
+-------------------+----------------------------------------+
| Control Type      | Input                                  |
+-------------------+----------------------------------------+
| Canny edges       | Edge map of the desired shape          |
| Depth map         | Depth information (near/far)           |
| Pose              | Human skeleton keypoints               |
| Segmentation      | Semantic segmentation map              |
| Scribble          | Hand-drawn rough sketch                |
+-------------------+----------------------------------------+

  Input image    Control signal    Output
  +--------+     +--------+       +--------+
  |  photo |---->| edges  |--+--->| new    |
  |  of a  |     | ////   |  |   | style  |
  |  house |     | ////   |  |   | house  |
  +--------+     +--------+  |   +--------+
                              |
                    text: "watercolor painting"
```

```python
from diffusers import (
    StableDiffusionControlNetPipeline,
    ControlNetModel,
    UniPCMultistepScheduler,
)
import torch
from PIL import Image

controlnet = ControlNetModel.from_pretrained(
    "lllyasviel/sd-controlnet-canny",
    torch_dtype=torch.float16,
)

pipe = StableDiffusionControlNetPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-1",
    controlnet=controlnet,
    torch_dtype=torch.float16,
)
pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
pipe = pipe.to("cuda")

control_image = Image.open("canny_edges.png")

image = pipe(
    prompt="a beautiful house, watercolor painting",
    image=control_image,
    num_inference_steps=30,
).images[0]

image.save("controlled_house.png")
```

### Making a Canny Edge Control Image

```python
import cv2
import numpy as np
from PIL import Image

img = np.array(Image.open("input_photo.png"))
edges = cv2.Canny(img, 100, 200)
control_image = Image.fromarray(edges)
control_image.save("canny_edges.png")
```

---

## LoRA: Lightweight Fine-Tuning

LoRA (Low-Rank Adaptation) lets you customize Stable Diffusion
with just a few MB of weights instead of the full model.

```
Standard fine-tuning:
  Update ALL 860M parameters
  Needs lots of GPU memory
  Produces a full model copy (~4GB)

LoRA fine-tuning:
  Freeze the base model
  Add tiny trainable matrices to attention layers
  Only 1-50MB of new weights!

How LoRA works:

  Original weight matrix W (d x d):
  +------------------+
  |                  |    Frozen, not updated
  |     W            |
  |                  |
  +------------------+

  LoRA adds:
  +------+   +------+
  |  A   | x |  B   |    A is (d x r), B is (r x d)
  |(d x r)|   |(r x d)|   r = rank (typically 4-64)
  +------+   +------+

  Output = W*x + A*B*x

  Only A and B are trained.
  If d=1024 and r=8:
    Full: 1024*1024 = 1M params
    LoRA: 1024*8 + 8*1024 = 16K params  (62x smaller!)
```

---

## Training LoRA

```python
from diffusers import StableDiffusionPipeline
from peft import LoraConfig, get_peft_model
import torch

pipe = StableDiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-1",
    torch_dtype=torch.float16,
)

lora_config = LoraConfig(
    r=8,
    lora_alpha=16,
    target_modules=["to_q", "to_v", "to_k", "to_out.0"],
    lora_dropout=0.05,
)

unet = get_peft_model(pipe.unet, lora_config)

trainable = sum(p.numel() for p in unet.parameters() if p.requires_grad)
total = sum(p.numel() for p in unet.parameters())
print(f"Trainable: {trainable:,} / {total:,} ({100*trainable/total:.2f}%)")
```

### LoRA Parameters

```
+---------------+--------+--------------------------------------+
| Parameter     | Typical| Effect                               |
+---------------+--------+--------------------------------------+
| r (rank)      | 4-64   | Higher = more capacity, more params  |
+---------------+--------+--------------------------------------+
| lora_alpha    | 2*r    | Scaling factor. Higher = stronger    |
|               |        | LoRA effect                          |
+---------------+--------+--------------------------------------+
| target_modules| attn   | Which layers to add LoRA to          |
+---------------+--------+--------------------------------------+
| lora_dropout  | 0.05   | Regularization                       |
+---------------+--------+--------------------------------------+
```

---

## Schedulers: Controlling the Denoising Process

```
+------------------+-------+-----+----------------------------------+
| Scheduler        | Steps | Good| Notes                            |
+------------------+-------+-----+----------------------------------+
| DDPM             | 1000  |     | Original, very slow              |
+------------------+-------+-----+----------------------------------+
| DDIM             | 50    | Yes | Deterministic, much faster       |
+------------------+-------+-----+----------------------------------+
| UniPC            | 20-30 | Yes | Best quality at low step counts  |
+------------------+-------+-----+----------------------------------+
| Euler            | 25-50 | Yes | Fast, good quality               |
+------------------+-------+-----+----------------------------------+
| DPM++ 2M Karras  | 20-30 | Yes | Popular in community             |
+------------------+-------+-----+----------------------------------+
```

```python
from diffusers import EulerDiscreteScheduler

pipe.scheduler = EulerDiscreteScheduler.from_config(pipe.scheduler.config)
```

---

## Image-to-Image Generation

Start from an existing image instead of pure noise.

```
Input image      +  "make it a watercolor"  =  Output
+----------+                                   +----------+
|  photo   |     strength=0.5                  | water-   |
|  of a    |     (50% noise added,             | color    |
|  house   |      50% original kept)           | house    |
+----------+                                   +----------+

strength=0.3  --> subtle change
strength=0.5  --> moderate change
strength=0.8  --> major change (barely recognizable)
```

```python
from diffusers import StableDiffusionImg2ImgPipeline
from PIL import Image

pipe = StableDiffusionImg2ImgPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-1",
    torch_dtype=torch.float16,
).to("cuda")

init_image = Image.open("photo.png").resize((512, 512))

image = pipe(
    prompt="watercolor painting of a house",
    image=init_image,
    strength=0.6,
    guidance_scale=7.5,
    num_inference_steps=50,
).images[0]
```

---

## Inpainting: Edit Parts of an Image

```
Original          Mask              Result
+----------+     +----------+     +----------+
|          |     |          |     |          |
|  [cat on |     |  [XXXXX] |     |  [dog on |
|   couch] |     |  [XXXXX] |     |   couch] |
|          |     |          |     |          |
+----------+     +----------+     +----------+

Only the masked region is regenerated.
The rest stays exactly the same.
```

```python
from diffusers import StableDiffusionInpaintPipeline
from PIL import Image

pipe = StableDiffusionInpaintPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-inpainting",
    torch_dtype=torch.float16,
).to("cuda")

image = Image.open("photo.png").resize((512, 512))
mask = Image.open("mask.png").resize((512, 512))

result = pipe(
    prompt="a golden retriever sitting",
    image=image,
    mask_image=mask,
    num_inference_steps=50,
).images[0]
```

---

## Memory Optimization

```
+---------------------------+---------+----------------------------+
| Technique                 | VRAM    | How                        |
+---------------------------+---------+----------------------------+
| float16                   | ~4 GB   | torch_dtype=torch.float16  |
+---------------------------+---------+----------------------------+
| Attention slicing         | ~3.5 GB | pipe.enable_attention_     |
|                           |         | slicing()                  |
+---------------------------+---------+----------------------------+
| VAE slicing               | ~3 GB   | pipe.enable_vae_slicing()  |
+---------------------------+---------+----------------------------+
| CPU offload               | ~2 GB   | pipe.enable_model_cpu_     |
|                           |         | offload()                  |
+---------------------------+---------+----------------------------+
| Sequential CPU offload    | ~1.5 GB | pipe.enable_sequential_    |
|                           |         | cpu_offload()              |
+---------------------------+---------+----------------------------+
```

```python
pipe = StableDiffusionPipeline.from_pretrained(
    "stabilityai/stable-diffusion-2-1",
    torch_dtype=torch.float16,
)
pipe.enable_model_cpu_offload()
pipe.enable_vae_slicing()
```

---

## Building a Complete Pipeline

```python
from diffusers import (
    StableDiffusionPipeline,
    UniPCMultistepScheduler,
)
import torch


def generate_image(
    prompt,
    negative_prompt="blurry, ugly, distorted, low quality",
    steps=25,
    guidance=7.5,
    seed=None,
    width=512,
    height=512,
):
    pipe = StableDiffusionPipeline.from_pretrained(
        "stabilityai/stable-diffusion-2-1",
        torch_dtype=torch.float16,
    )
    pipe.scheduler = UniPCMultistepScheduler.from_config(pipe.scheduler.config)
    pipe.enable_model_cpu_offload()

    generator = None
    if seed is not None:
        generator = torch.Generator("cuda").manual_seed(seed)

    result = pipe(
        prompt=prompt,
        negative_prompt=negative_prompt,
        num_inference_steps=steps,
        guidance_scale=guidance,
        generator=generator,
        width=width,
        height=height,
    )

    return result.images[0]


image = generate_image(
    prompt="a cozy cabin in snowy mountains, cinematic lighting",
    seed=42,
    steps=30,
)
image.save("cabin.png")
```

---

## Exercises

1. **Basic generation**: Generate 5 images with different prompts
   using Stable Diffusion. Experiment with guidance_scale values
   of 3, 7.5, and 15. Describe the quality differences.

2. **Scheduler comparison**: Generate the same prompt with DDIM,
   Euler, and UniPC schedulers at 20, 30, and 50 steps. Which
   scheduler gives the best quality at the fewest steps?

3. **Image-to-image**: Take a photo, apply img2img with
   strength values of 0.3, 0.5, and 0.8. Find the sweet spot
   between preserving the original and applying the style.

4. **ControlNet edges**: Create a Canny edge map from a photo,
   then use ControlNet to generate the same scene in different
   styles (watercolor, oil painting, anime).

5. **Memory optimization**: Measure VRAM usage with different
   optimization techniques. Start with no optimization and
   progressively add float16, attention slicing, and CPU offload.
   Record the VRAM usage and generation time for each.

---

**Next**: [Lesson 09 - Vision Transformers](./09-vision-transformers.md)
