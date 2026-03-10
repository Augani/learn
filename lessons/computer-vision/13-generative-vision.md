# Lesson 13 — Generative Vision

## Creating Images from Nothing

All previous lessons analyzed existing images. Now we flip the script —
generating new images from scratch. It's the difference between being an art
critic and being an artist.

## GANs — Generative Adversarial Networks

Two networks play a game. The **Generator** creates fake images. The
**Discriminator** tries to tell fakes from reals. They push each other to
improve.

```
  The Counterfeiter vs. The Detective

  Random noise z          Real images
       |                       |
       v                       v
  +===========+          +-----------+
  | Generator |          |           |
  | (creates  |--------->| Discrimin-|----> Real or Fake?
  | fakes)    |          | ator      |
  +===========+          +-----------+
       ^                       |
       |                       |
       +--- learn from feedback +

  G wants: D to say "real" for fakes
  D wants: correctly label real vs. fake
  Over time: G produces increasingly realistic images
```

```python
import torch
import torch.nn as nn

class Generator(nn.Module):
    def __init__(self, latent_dim=100, img_channels=1, feature_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.ConvTranspose2d(latent_dim, feature_dim * 8, 4, 1, 0),
            nn.BatchNorm2d(feature_dim * 8),
            nn.ReLU(True),
            nn.ConvTranspose2d(feature_dim * 8, feature_dim * 4, 4, 2, 1),
            nn.BatchNorm2d(feature_dim * 4),
            nn.ReLU(True),
            nn.ConvTranspose2d(feature_dim * 4, feature_dim * 2, 4, 2, 1),
            nn.BatchNorm2d(feature_dim * 2),
            nn.ReLU(True),
            nn.ConvTranspose2d(feature_dim * 2, img_channels, 4, 2, 1),
            nn.Tanh(),
        )

    def forward(self, z):
        return self.net(z.view(z.size(0), -1, 1, 1))


class Discriminator(nn.Module):
    def __init__(self, img_channels=1, feature_dim=64):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(img_channels, feature_dim, 4, 2, 1),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(feature_dim, feature_dim * 2, 4, 2, 1),
            nn.BatchNorm2d(feature_dim * 2),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(feature_dim * 2, feature_dim * 4, 4, 2, 1),
            nn.BatchNorm2d(feature_dim * 4),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(feature_dim * 4, 1, 4, 1, 0),
            nn.Sigmoid(),
        )

    def forward(self, img):
        return self.net(img).view(-1)
```

## GAN Training Loop

```python
def train_gan(generator, discriminator, dataloader, epochs=50,
              latent_dim=100, device="cpu"):
    criterion = nn.BCELoss()
    opt_g = torch.optim.Adam(generator.parameters(), lr=2e-4,
                              betas=(0.5, 0.999))
    opt_d = torch.optim.Adam(discriminator.parameters(), lr=2e-4,
                              betas=(0.5, 0.999))

    for epoch in range(epochs):
        for real_imgs, _ in dataloader:
            batch_size = real_imgs.size(0)
            real_imgs = real_imgs.to(device)

            real_labels = torch.ones(batch_size, device=device)
            fake_labels = torch.zeros(batch_size, device=device)

            z = torch.randn(batch_size, latent_dim, device=device)
            fake_imgs = generator(z)

            d_real = discriminator(real_imgs)
            d_fake = discriminator(fake_imgs.detach())
            loss_d = criterion(d_real, real_labels) + criterion(d_fake, fake_labels)

            opt_d.zero_grad()
            loss_d.backward()
            opt_d.step()

            d_fake = discriminator(fake_imgs)
            loss_g = criterion(d_fake, real_labels)

            opt_g.zero_grad()
            loss_g.backward()
            opt_g.step()
```

## Diffusion Models — The New King

Diffusion models learn to reverse a noise-adding process. Start with pure
noise, gradually denoise step by step.

```
  Forward process (training): add noise gradually

  Clean image --> Slightly noisy --> More noisy --> ... --> Pure noise
  x0              x1                 x2                    xT

  Reverse process (generation): remove noise gradually

  Pure noise --> Less noisy --> Less noisy --> ... --> Clean image
  xT             xT-1           xT-2                  x0

  The model learns to predict the noise at each step.
  Given noisy image xt, predict the noise that was added.
```

```
  Step-by-step denoising:

  t=1000     t=750       t=500       t=250       t=0
  +------+   +------+   +------+   +------+   +------+
  |//////|   |//// /|   | / // |   |  __  |   | (oo) |
  |//////|   |// / /|   | // / |   | /  \ |   | /  \ |
  |//////|   |/ ////|   |  /   |   | |  | |   | |  | |
  +------+   +------+   +------+   +------+   +------+
  Pure noise  Hints of   Shape      Almost     Clear
              structure  emerging   there      image
```

## Simple Diffusion Training

```python
import torch
import torch.nn.functional as F

def linear_beta_schedule(timesteps, beta_start=1e-4, beta_end=0.02):
    return torch.linspace(beta_start, beta_end, timesteps)

def forward_diffusion(x0, t, noise, sqrt_alphas_cumprod,
                      sqrt_one_minus_alphas_cumprod):
    sqrt_alpha = sqrt_alphas_cumprod[t].view(-1, 1, 1, 1)
    sqrt_one_minus = sqrt_one_minus_alphas_cumprod[t].view(-1, 1, 1, 1)
    return sqrt_alpha * x0 + sqrt_one_minus * noise


timesteps = 1000
betas = linear_beta_schedule(timesteps)
alphas = 1.0 - betas
alphas_cumprod = torch.cumprod(alphas, dim=0)
sqrt_alphas_cumprod = torch.sqrt(alphas_cumprod)
sqrt_one_minus_alphas_cumprod = torch.sqrt(1.0 - alphas_cumprod)
```

## Style Transfer

Apply the artistic style of one image to the content of another. The
classic algorithm uses a pretrained CNN's feature representations.

```
  Content Image     Style Image        Result
  (photo)           (painting)

  +----------+     +----------+      +----------+
  |  Bridge  |  +  | Starry   |  =   | Bridge   |
  |  photo   |     | Night    |      | in Van   |
  |          |     | (Van Gogh)|     | Gogh     |
  +----------+     +----------+      | style    |
                                     +----------+
```

```python
import torchvision.models as models

vgg = models.vgg19(weights="DEFAULT").features.eval()

def get_features(image, model, layers=None):
    if layers is None:
        layers = {"0": "conv1_1", "5": "conv2_1", "10": "conv3_1",
                  "19": "conv4_1", "21": "conv4_2", "28": "conv5_1"}
    features = {}
    x = image
    for name, layer in model._modules.items():
        x = layer(x)
        if name in layers:
            features[layers[name]] = x
    return features


def gram_matrix(tensor):
    b, c, h, w = tensor.size()
    features = tensor.view(b, c, h * w)
    gram = torch.bmm(features, features.transpose(1, 2))
    return gram / (c * h * w)
```

## Super-Resolution

Upscale low-resolution images. The network hallucinates plausible high-
frequency details.

```
  Low-res (64x64)          Super-res (256x256)

  +------+                 +------------------+
  |      |    model        |                  |
  | blur |  ==========>    |  sharp details   |
  |      |                 |  hallucinated    |
  +------+                 +------------------+

  Not recovering lost data — generating plausible details.
```

```python
import torch

model = torch.hub.load("pytorch/vision", "resnet18", weights=None)

from torchvision.transforms import functional as TF

def basic_super_resolve(lr_image, scale_factor=4):
    upscaled = TF.resize(lr_image,
                          [lr_image.shape[-2] * scale_factor,
                           lr_image.shape[-1] * scale_factor],
                          interpolation=TF.InterpolationMode.BICUBIC)
    return upscaled
```

For real super-resolution, use dedicated models like ESRGAN:

```python
from basicsr.archs.rrdbnet_arch import RRDBNet
from realesrgan import RealESRGANer

model = RRDBNet(num_in_ch=3, num_out_ch=3, num_feat=64,
                num_block=23, num_grow_ch=32, scale=4)
```

## GAN vs. Diffusion Comparison

```
  +------------------+------------------+------------------+
  | Property         | GANs             | Diffusion        |
  +------------------+------------------+------------------+
  | Training         | Unstable         | Stable           |
  | Mode collapse    | Common problem   | Rare             |
  | Generation speed | Fast (1 pass)    | Slow (many steps)|
  | Image quality    | Good             | Excellent        |
  | Diversity        | Can be limited   | High             |
  | Control          | Limited          | Guidance, CFG    |
  +------------------+------------------+------------------+
```

## Classifier-Free Guidance

Diffusion models can be steered with a guidance scale that controls how
strongly the model follows the text prompt.

```
  guidance_scale = 1.0   -> follows prompt loosely (creative)
  guidance_scale = 7.5   -> balanced (default)
  guidance_scale = 20.0  -> follows prompt strictly (less diverse)

  noise_pred = noise_uncond + scale * (noise_cond - noise_uncond)
```

## Exercises

1. Train a DCGAN on MNIST. Generate a grid of 64 fake digit images after
   50 epochs. Are they recognizable?

2. Implement the forward diffusion process. Start with a clean CIFAR-10
   image and visualize it at t=0, 250, 500, 750, 1000. Does it look like
   pure noise at t=1000?

3. Implement neural style transfer using VGG-19 features and Gram matrices.
   Apply Van Gogh's style to a photo of your choice. Experiment with the
   content/style weight ratio.

4. Compare bicubic upsampling to a pretrained super-resolution model on the
   same low-res image. Calculate PSNR for both against the original hi-res.

5. Use a pretrained Stable Diffusion model (via diffusers library) to
   generate images from 5 different text prompts. Vary the guidance scale
   from 1 to 20 and observe how the outputs change.

---

**Next: [Lesson 14 — Video Analysis](14-video-analysis.md)**
