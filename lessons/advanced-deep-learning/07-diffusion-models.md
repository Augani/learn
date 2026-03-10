# Lesson 07: Diffusion Models

> **Analogy**: Restoring a vandalized painting stroke by stroke.
> Someone smeared paint over the Mona Lisa in 1000 steps until
> it was pure noise. A diffusion model learns to reverse each
> step -- removing a little noise at a time until the painting
> is restored. Once it learns this, it can start from ANY noise
> and create a new painting.

---

## The Core Idea

```
FORWARD PROCESS (destroy):

  Clean image --> add noise --> add noise --> ... --> Pure noise
  x_0            x_1            x_2                  x_T

  Step 0         Step 1         Step 2       ...     Step T
  [clear]        [slightly      [more                [static]
                  noisy]         noisy]

REVERSE PROCESS (create):

  Pure noise --> remove noise --> remove noise --> ... --> Clean image
  x_T            x_{T-1}         x_{T-2}                 x_0

  The model learns to predict and remove the noise
  at each step. That's it. That's the whole idea.
```

### Why This Works: The Denoising Score Matching Insight

**Analogy — a sculptor vs a painter:**

A GAN is like a painter who tries to create a masterpiece from a blank canvas in one stroke. They need to learn the entire distribution of "what a good painting looks like" all at once. This is hard — sometimes they paint the same face over and over (mode collapse), and their training is unstable (the art critic keeps changing their standards).

A diffusion model is like a sculptor who starts with a rough stone (noise) and chips away at it gradually. Each chip is a tiny, easy decision: "should this spot be slightly lighter or darker?" After a thousand tiny chips, a masterpiece emerges. The sculptor never needs to envision the whole piece at once — just the next small improvement.

```
GAN training:         Diffusion training:

Random noise ──→ ???  Clean image + random noise = noisy image
               ↓     Model predicts: "this noise was added"
          Generator   Loss: how wrong was the noise prediction?
               ↓
          Fake image  That's literally it. No adversary.
               ↓     No minimax game. Just regression.
          Discriminator
               ↓
          "Real or fake?"
          (unstable!)
```

---

## Why Not Just Denoise in One Step?

```
One-step denoising:
  Pure noise --> [model] --> Image
  Too hard! The mapping is too complex.

Multi-step denoising (diffusion):
  Noise --> [slightly less noisy] --> [less noisy] --> ... --> Image
  Each step is EASY. Just remove a tiny bit of noise.

Like cleaning a messy room:
  - "Clean the whole room" = overwhelming
  - "Pick up one item" x 100 = manageable
```

### The Connection to Thermodynamics

The name "diffusion" comes from physics. When you drop a blob of ink into water, the ink molecules **diffuse** — they spread out randomly until evenly distributed (maximum entropy). This is the forward process: structured data → uniform noise.

The reverse process is like filming the ink diffusing and playing the video backward — order emerging from disorder. In physics this is impossible (second law of thermodynamics). But a neural network can learn the statistical reverse because it's seen millions of examples of the forward process.

**Analogy — unscrambling an egg:**

You can't unscramble a physical egg. But if you watched a million eggs being scrambled (and recorded exactly how the yolk moved at each moment), you could learn the STATISTICAL pattern of "what does an egg look like one step before this level of scrambling?" Apply that knowledge step by step, and you can approximately reconstruct the egg.

```
Physics:  Can't reverse diffusion (entropy always increases)
ML:       CAN learn the statistical reverse
          (because it's trained on the forward process)

This is the key insight of score-based generative models:
  The "score" = gradient of log probability density
  ∇_x log p(x)  ← "which direction makes x more probable?"

At each denoising step, the model asks:
  "Which direction should I nudge each pixel to make
   this image look more like a real image?"
```

---

## The Math (Simplified)

```
Forward process (adding noise):

  x_t = sqrt(alpha_t) * x_0 + sqrt(1 - alpha_t) * epsilon

  where epsilon ~ N(0, 1) is random noise
  and alpha_t controls how much noise at step t

  alpha schedule:
  t=0:   alpha = 1.0   (no noise, pure signal)
  t=T/2: alpha = 0.5   (half noise, half signal)
  t=T:   alpha = 0.0   (pure noise)

Reverse process (removing noise):

  The model predicts epsilon (the noise) from x_t and t
  Then we subtract the predicted noise to get x_{t-1}
```

---

## Simple Diffusion Model

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
from torchvision import datasets, transforms
from torch.utils.data import DataLoader
import math


class SinusoidalPosEmb(nn.Module):
    def __init__(self, dim):
        super().__init__()
        self.dim = dim

    def forward(self, t):
        device = t.device
        half_dim = self.dim // 2
        emb = math.log(10000) / (half_dim - 1)
        emb = torch.exp(torch.arange(half_dim, device=device) * -emb)
        emb = t[:, None] * emb[None, :]
        return torch.cat([emb.sin(), emb.cos()], dim=-1)


class SimpleUNet(nn.Module):
    def __init__(self, in_channels=1, time_dim=256):
        super().__init__()
        self.time_mlp = nn.Sequential(
            SinusoidalPosEmb(time_dim),
            nn.Linear(time_dim, time_dim),
            nn.GELU(),
        )

        self.down1 = nn.Sequential(
            nn.Conv2d(in_channels, 64, 3, padding=1),
            nn.GroupNorm(8, 64),
            nn.GELU(),
            nn.Conv2d(64, 64, 3, padding=1),
            nn.GroupNorm(8, 64),
            nn.GELU(),
        )
        self.down2 = nn.Sequential(
            nn.Conv2d(64, 128, 3, stride=2, padding=1),
            nn.GroupNorm(8, 128),
            nn.GELU(),
            nn.Conv2d(128, 128, 3, padding=1),
            nn.GroupNorm(8, 128),
            nn.GELU(),
        )

        self.time_proj = nn.Linear(time_dim, 128)

        self.up1 = nn.Sequential(
            nn.ConvTranspose2d(128, 64, 4, stride=2, padding=1),
            nn.GroupNorm(8, 64),
            nn.GELU(),
        )
        self.up2 = nn.Sequential(
            nn.Conv2d(128, 64, 3, padding=1),
            nn.GroupNorm(8, 64),
            nn.GELU(),
            nn.Conv2d(64, in_channels, 1),
        )

    def forward(self, x, t):
        t_emb = self.time_mlp(t)

        h1 = self.down1(x)
        h2 = self.down2(h1)

        h2 = h2 + self.time_proj(t_emb)[:, :, None, None]

        h = self.up1(h2)
        h = torch.cat([h, h1], dim=1)
        return self.up2(h)
```

---

## The Noise Schedule

```
Linear schedule:
beta
 ^
 |                 ****
 |             ****
 |         ****
 |     ****
 | ****
 +--------------------> t
 0                   T

Cosine schedule (better):
beta
 ^
 |                  ***
 |                **
 |              **
 |           ***
 | **********
 +--------------------> t
 0                   T

Cosine spends more steps in the "interesting"
middle range where signal and noise are mixed.
```

```python
def linear_beta_schedule(timesteps, beta_start=1e-4, beta_end=0.02):
    return torch.linspace(beta_start, beta_end, timesteps)


def cosine_beta_schedule(timesteps, s=0.008):
    steps = torch.arange(timesteps + 1, dtype=torch.float32) / timesteps
    alphas_bar = torch.cos((steps + s) / (1 + s) * math.pi * 0.5) ** 2
    alphas_bar = alphas_bar / alphas_bar[0]
    betas = 1 - (alphas_bar[1:] / alphas_bar[:-1])
    return torch.clamp(betas, 0.0001, 0.999)
```

---

## Training Loop

```
Training is surprisingly simple:

1. Take a clean image x_0
2. Sample a random timestep t
3. Sample random noise epsilon
4. Create noisy image: x_t = sqrt(alpha_bar_t) * x_0 + sqrt(1 - alpha_bar_t) * epsilon
5. Predict the noise: epsilon_pred = model(x_t, t)
6. Loss = MSE(epsilon_pred, epsilon)

That's it. The model just learns to predict noise.
```

```python
class DiffusionTrainer:
    def __init__(self, model, timesteps=1000, device="cpu"):
        self.model = model
        self.timesteps = timesteps
        self.device = device

        betas = cosine_beta_schedule(timesteps).to(device)
        alphas = 1.0 - betas
        self.alphas_bar = torch.cumprod(alphas, dim=0)
        self.sqrt_alphas_bar = torch.sqrt(self.alphas_bar)
        self.sqrt_one_minus_alphas_bar = torch.sqrt(1.0 - self.alphas_bar)

        self.betas = betas
        self.alphas = alphas

    def add_noise(self, x_0, t, noise=None):
        if noise is None:
            noise = torch.randn_like(x_0)
        sqrt_ab = self.sqrt_alphas_bar[t][:, None, None, None]
        sqrt_1_ab = self.sqrt_one_minus_alphas_bar[t][:, None, None, None]
        return sqrt_ab * x_0 + sqrt_1_ab * noise, noise

    def train_step(self, x_0, optimizer):
        batch_size = x_0.size(0)
        t = torch.randint(0, self.timesteps, (batch_size,), device=self.device)
        noise = torch.randn_like(x_0)
        x_t, _ = self.add_noise(x_0, t, noise)

        noise_pred = self.model(x_t, t.float())
        loss = F.mse_loss(noise_pred, noise)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        return loss.item()
```

---

## Sampling (Generating Images)

```
Start with pure noise x_T ~ N(0, 1)
For t = T, T-1, ..., 1:
    Predict noise: eps = model(x_t, t)
    Remove predicted noise to get x_{t-1}
    Add a tiny bit of random noise (except at t=0)

Each step cleans the image a little more.
```

```python
@torch.no_grad()
def sample(self, model, shape):
    model.eval()
    x = torch.randn(shape, device=self.device)

    for t in reversed(range(self.timesteps)):
        t_batch = torch.full((shape[0],), t, device=self.device, dtype=torch.float)
        noise_pred = model(x, t_batch)

        alpha = self.alphas[t]
        alpha_bar = self.alphas_bar[t]
        beta = self.betas[t]

        mean = (1 / torch.sqrt(alpha)) * (
            x - (beta / torch.sqrt(1 - alpha_bar)) * noise_pred
        )

        if t > 0:
            noise = torch.randn_like(x)
            x = mean + torch.sqrt(beta) * noise
        else:
            x = mean

    return x
```

---

## Classifier-Free Guidance

The secret sauce behind DALL-E 2 and Stable Diffusion.

```
Without guidance:
  model predicts noise given image + text prompt

With classifier-free guidance:
  noise_cond   = model(x_t, t, text_prompt)
  noise_uncond = model(x_t, t, empty_prompt)
  noise_final  = noise_uncond + scale * (noise_cond - noise_uncond)
                                ^^^^^
                          guidance_scale (typically 7.5)
                          Higher = more faithful to prompt
                          Lower = more diverse

It's like asking: "What would this image look like if it
REALLY matched the prompt vs not matching at all?"
Then amplifying the difference.
```

### Guidance Scale Intuition: The Caricature Effect

**Analogy — asking an artist for a portrait:**

- **Guidance scale 1.0**: "Draw a face." The artist draws a generic, average face. Diverse but not specific.
- **Guidance scale 7.5**: "Draw a face that REALLY looks like this person." The artist captures distinctive features. The sweet spot.
- **Guidance scale 20.0**: "Make it REALLY REALLY look like this person!" The artist draws a caricature — exaggerated features, oversaturated colors. Too much guidance = artifacts.

```
guidance_scale = 1.0    → Diverse, but ignores prompt
guidance_scale = 7.5    → Good balance (the default)
guidance_scale = 15.0   → Very prompt-faithful, less diverse
guidance_scale = 30.0   → Oversaturated, artifacts

Mathematically:
  ε_guided = ε_uncond + scale × (ε_cond - ε_uncond)
                        ^^^^^
                   This amplifies the "what's different
                   about the conditional prediction"

  When scale = 1: ε_guided = ε_cond (no amplification)
  When scale > 1: amplifies the conditioning signal
  When scale >> 1: over-amplifies → artifacts
```

---

## How Stable Diffusion Works

```
Text: "a cat sitting on a rainbow"

  Text Encoder (CLIP)
       |
       v
  Text embeddings
       |
       +-------------------------------+
       |                               |
       v                               v
  +----------+                  +-------------+
  | U-Net    | <-- timestep --> | Scheduler   |
  | (denoise |                  | (controls   |
  | in latent|                  |  noise      |
  | space)   |                  |  schedule)  |
  +----------+                  +-------------+
       |
       v
  Clean latent (4x64x64)
       |
       v
  VAE Decoder
       |
       v
  Full image (3x512x512)

Key insight: Diffusion happens in LATENT space (small),
not pixel space (huge). This is why it's called a
Latent Diffusion Model (LDM).
```

### Why Latent Space? The Compression Trick

**Analogy — writing a description vs photocopying:**

Doing diffusion in pixel space (512×512×3 = 786,432 values) is like photocopying a painting 1000 times, adding noise each time. Extremely expensive.

Doing diffusion in latent space (64×64×4 = 16,384 values) is like writing a compressed description of the painting, adding noise to the description, and then denoising the description. 48x smaller — 48x faster.

```
Pixel-space diffusion:
  512×512×3 = 786,432 dimensions
  1000 denoising steps × 786K dims = incredibly slow

Latent-space diffusion:
  VAE Encoder: 512×512×3 → 64×64×4 (48x compression)
  Diffuse in latent space: 1000 steps × 16K dims = fast!
  VAE Decoder: 64×64×4 → 512×512×3

The VAE (Variational Autoencoder) was trained separately
to compress/decompress images. The diffusion model never
sees pixels — it only works with the compressed codes.

This is why Stable Diffusion can run on consumer GPUs
while pixel-space diffusion models need supercomputers.
```

---

## Diffusion vs GANs

```
+------------------+------------------+------------------+
| Aspect           | Diffusion        | GAN              |
+------------------+------------------+------------------+
| Training         | Stable, simple   | Unstable, tricky |
+------------------+------------------+------------------+
| Generation speed | Slow (many steps)| Fast (one pass)  |
+------------------+------------------+------------------+
| Quality          | State of the art | Very good        |
+------------------+------------------+------------------+
| Diversity        | High (no mode    | Mode collapse    |
|                  | collapse)        | possible         |
+------------------+------------------+------------------+
| Controllability  | Excellent with   | Harder           |
|                  | guidance         |                  |
+------------------+------------------+------------------+
```

---

## Speeding Up: DDIM Sampling

Standard diffusion needs ~1000 steps. DDIM (Denoising
Diffusion Implicit Models) skips steps:

```
Standard (1000 steps):
  x_1000 -> x_999 -> x_998 -> ... -> x_1 -> x_0

DDIM (50 steps):
  x_1000 -> x_980 -> x_960 -> ... -> x_20 -> x_0

Same quality, 20x faster!
```

---

## Exercises

1. **Simple diffusion**: Implement the diffusion trainer above
   for MNIST. Train for 20 epochs and generate a grid of
   digit images. How many sampling steps do you need for
   recognizable digits?

2. **Noise schedule comparison**: Train the same model with
   linear vs cosine noise schedules. Compare the quality
   of generated images at 10, 20, and 50 sampling steps.

3. **Conditional diffusion**: Add class conditioning to your
   MNIST diffusion model. Generate specific digits on demand.

4. **DDIM sampling**: Implement DDIM sampling and compare
   generation quality at 1000, 100, 50, and 20 steps.

5. **Guidance scale sweep**: If you implemented conditional
   diffusion, try classifier-free guidance with scales of
   1.0, 3.0, 7.5, and 15.0. How does the trade-off between
   quality and diversity change?

---

**Next**: [Lesson 08 - Image Generation Practice](./08-image-generation-practice.md)
