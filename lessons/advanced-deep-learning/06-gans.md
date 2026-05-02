# Lesson 06: GANs (Generative Adversarial Networks)

> **Analogy**: A counterfeiter tries to make fake money good
> enough to fool a detective. The detective keeps getting better
> at spotting fakes. The counterfeiter keeps improving. Eventually
> the fakes are indistinguishable from real currency. That's a GAN.

---

## The Core Idea

Two networks trained against each other:

```
                  Real images
                      |
                      v
Random noise ---> GENERATOR ---> Fake images
                                     |
                                     v
                              DISCRIMINATOR ---> Real or Fake?
                                     ^
                                     |
                                Real images

Generator:     "Make fakes good enough to fool the discriminator"
Discriminator: "Get better at telling real from fake"
```

```
Training loop:

  Step 1: Train Discriminator
  - Show it real images, label = 1
  - Show it fake images (from generator), label = 0
  - Update discriminator to classify better

  Step 2: Train Generator
  - Generate fake images
  - Ask discriminator to judge them
  - Update generator to make discriminator say "real"
  - (Do NOT update discriminator in this step)
```

---

## Simple GAN Implementation

```python
import torch
import torch.nn as nn
from torchvision import datasets, transforms
from torch.utils.data import DataLoader


class Generator(nn.Module):
    def __init__(self, latent_dim=100, img_dim=784):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(latent_dim, 256),
            nn.LeakyReLU(0.2),
            nn.Linear(256, 512),
            nn.LeakyReLU(0.2),
            nn.Linear(512, 1024),
            nn.LeakyReLU(0.2),
            nn.Linear(1024, img_dim),
            nn.Tanh(),
        )

    def forward(self, z):
        return self.net(z)


class Discriminator(nn.Module):
    def __init__(self, img_dim=784):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(img_dim, 512),
            nn.LeakyReLU(0.2),
            nn.Dropout(0.3),
            nn.Linear(512, 256),
            nn.LeakyReLU(0.2),
            nn.Dropout(0.3),
            nn.Linear(256, 1),
            nn.Sigmoid(),
        )

    def forward(self, x):
        return self.net(x)
```

---

## The Training Loop

```python
latent_dim = 100
generator = Generator(latent_dim)
discriminator = Discriminator()

opt_g = torch.optim.Adam(generator.parameters(), lr=2e-4, betas=(0.5, 0.999))
opt_d = torch.optim.Adam(discriminator.parameters(), lr=2e-4, betas=(0.5, 0.999))

criterion = nn.BCELoss()

transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.5,), (0.5,)),
])
train_ds = datasets.MNIST("./data", train=True, download=True, transform=transform)
train_loader = DataLoader(train_ds, batch_size=128, shuffle=True)

for epoch in range(50):
    for real_images, _ in train_loader:
        batch_size = real_images.size(0)
        real_flat = real_images.view(batch_size, -1)

        real_labels = torch.ones(batch_size, 1)
        fake_labels = torch.zeros(batch_size, 1)

        z = torch.randn(batch_size, latent_dim)
        fake_images = generator(z)

        d_real = discriminator(real_flat)
        d_fake = discriminator(fake_images.detach())
        d_loss = criterion(d_real, real_labels) + criterion(d_fake, fake_labels)

        opt_d.zero_grad()
        d_loss.backward()
        opt_d.step()

        z = torch.randn(batch_size, latent_dim)
        fake_images = generator(z)
        d_fake = discriminator(fake_images)
        g_loss = criterion(d_fake, real_labels)

        opt_g.zero_grad()
        g_loss.backward()
        opt_g.step()

    print(f"Epoch {epoch+1}: D_loss={d_loss.item():.4f}, G_loss={g_loss.item():.4f}")
```

---

## Why GANs Are Hard to Train

```
The delicate balance:

  Discriminator too strong:
  +------+     +------+
  |  D   | >>> |  G   |     Generator gets no useful gradient.
  | 99%  |     |  1%  |     "Everything you make is garbage"
  +------+     +------+     = no learning signal.

  Generator too strong:
  +------+     +------+
  |  D   | <<< |  G   |     Discriminator gives up.
  | 50%  |     | 95%  |     Generator stops improving.
  +------+     +------+

  Just right:
  +------+     +------+
  |  D   | === |  G   |     Both push each other to improve.
  | 70%  |     | 65%  |     This is the sweet spot.
  +------+     +------+
```

---

## Common GAN Failure Modes

```
+-------------------+------------------------------------------+
| Problem           | What Happens                             |
+-------------------+------------------------------------------+
| Mode collapse     | Generator makes the same image over and  |
|                   | over. Found one thing that fools D and   |
|                   | sticks with it.                          |
+-------------------+------------------------------------------+
| Training          | Losses oscillate wildly, never converge. |
| instability       | D and G fight without improving.         |
+-------------------+------------------------------------------+
| Vanishing         | D is too good, G gets zero gradient.     |
| gradients         | Training stalls.                         |
+-------------------+------------------------------------------+
```

---

## DCGAN: Convolutional GANs

The first GAN architecture that reliably worked for images.

```
Generator (noise -> image):

  z (100)
    |
    v
  ConvTranspose2d  4x4    (project and reshape)
    |
    v
  ConvTranspose2d  8x8    (upsample)
    |
    v
  ConvTranspose2d  16x16  (upsample)
    |
    v
  ConvTranspose2d  32x32  (final image)
    |
    v
  Tanh()

Discriminator (image -> real/fake):

  Image 32x32
    |
    v
  Conv2d  16x16  (downsample)
    |
    v
  Conv2d  8x8   (downsample)
    |
    v
  Conv2d  4x4   (downsample)
    |
    v
  Flatten -> Linear -> Sigmoid
```

```python
class DCGenerator(nn.Module):
    def __init__(self, latent_dim=100, channels=1):
        super().__init__()
        self.net = nn.Sequential(
            nn.ConvTranspose2d(latent_dim, 256, 4, 1, 0, bias=False),
            nn.BatchNorm2d(256),
            nn.ReLU(True),
            nn.ConvTranspose2d(256, 128, 4, 2, 1, bias=False),
            nn.BatchNorm2d(128),
            nn.ReLU(True),
            nn.ConvTranspose2d(128, 64, 4, 2, 1, bias=False),
            nn.BatchNorm2d(64),
            nn.ReLU(True),
            nn.ConvTranspose2d(64, channels, 4, 2, 1, bias=False),
            nn.Tanh(),
        )

    def forward(self, z):
        return self.net(z.view(z.size(0), -1, 1, 1))


class DCDiscriminator(nn.Module):
    def __init__(self, channels=1):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(channels, 64, 4, 2, 1, bias=False),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(64, 128, 4, 2, 1, bias=False),
            nn.BatchNorm2d(128),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(128, 256, 4, 2, 1, bias=False),
            nn.BatchNorm2d(256),
            nn.LeakyReLU(0.2, inplace=True),
            nn.Conv2d(256, 1, 4, 1, 0, bias=False),
            nn.Sigmoid(),
        )

    def forward(self, x):
        return self.net(x).view(-1, 1)
```

---

## DCGAN Training Tips

```
+-----------------------------------+----------------------------+
| Rule                              | Why                        |
+-----------------------------------+----------------------------+
| Use BatchNorm in both G and D     | Stabilizes training        |
+-----------------------------------+----------------------------+
| Use LeakyReLU in discriminator    | Avoids dead neurons        |
+-----------------------------------+----------------------------+
| Use ReLU in generator             | Standard choice            |
+-----------------------------------+----------------------------+
| Adam lr=2e-4, betas=(0.5, 0.999) | Found empirically          |
+-----------------------------------+----------------------------+
| No fully connected layers         | Use strided convolutions   |
+-----------------------------------+----------------------------+
| Label smoothing (0.9 not 1.0)     | Prevents D from being      |
|                                   | overconfident              |
+-----------------------------------+----------------------------+
```

---

## Wasserstein GAN (WGAN)

Replaces the standard GAN loss with the Wasserstein distance,
which provides smoother gradients.

```
Standard GAN loss:
  D tries to maximize:  log(D(real)) + log(1 - D(fake))
  G tries to minimize:  log(1 - D(fake))

  Problem: when D is perfect, gradient vanishes.

WGAN loss:
  D (called "critic") tries to maximize: D(real) - D(fake)
  G tries to minimize: -D(fake)

  Gradient is ALWAYS useful, even when critic is strong.
```

```python
def train_wgan_step(critic, generator, real_images, latent_dim, opt_c, opt_g, n_critic=5):
    batch_size = real_images.size(0)

    for _ in range(n_critic):
        z = torch.randn(batch_size, latent_dim)
        fake = generator(z).detach()
        c_loss = -(critic(real_images).mean() - critic(fake).mean())

        opt_c.zero_grad()
        c_loss.backward()
        opt_c.step()

        for p in critic.parameters():
            p.data.clamp_(-0.01, 0.01)

    z = torch.randn(batch_size, latent_dim)
    fake = generator(z)
    g_loss = -critic(fake).mean()

    opt_g.zero_grad()
    g_loss.backward()
    opt_g.step()

    return c_loss.item(), g_loss.item()
```

---

## Conditional GAN (cGAN)

Control WHAT the generator produces by conditioning on a label.

```
Standard GAN:
  noise --> Generator --> random image

Conditional GAN:
  noise + label "3" --> Generator --> image of digit 3
  noise + label "7" --> Generator --> image of digit 7
```

```python
class ConditionalGenerator(nn.Module):
    def __init__(self, latent_dim=100, num_classes=10, img_dim=784):
        super().__init__()
        self.label_embed = nn.Embedding(num_classes, 50)
        self.net = nn.Sequential(
            nn.Linear(latent_dim + 50, 256),
            nn.LeakyReLU(0.2),
            nn.Linear(256, 512),
            nn.LeakyReLU(0.2),
            nn.Linear(512, img_dim),
            nn.Tanh(),
        )

    def forward(self, z, labels):
        label_input = self.label_embed(labels)
        gen_input = torch.cat([z, label_input], dim=1)
        return self.net(gen_input)
```

---

## GAN Applications

```
+---------------------+------------------------------------+
| Application         | Example                            |
+---------------------+------------------------------------+
| Image generation    | StyleGAN faces, bedrooms           |
+---------------------+------------------------------------+
| Image-to-image      | Pix2Pix: sketch -> photo           |
+---------------------+------------------------------------+
| Super resolution    | SRGAN: low-res -> high-res         |
+---------------------+------------------------------------+
| Style transfer      | CycleGAN: horse <-> zebra          |
+---------------------+------------------------------------+
| Data augmentation   | Generate synthetic training data   |
+---------------------+------------------------------------+
| Inpainting          | Fill in missing parts of images    |
+---------------------+------------------------------------+
```

---

## GANs vs VAEs vs Diffusion

```
+----------+------------------+------------------+-----------------+
|          | GANs             | VAEs             | Diffusion       |
+----------+------------------+------------------+-----------------+
| Quality  | Sharp images     | Blurry images    | Best quality    |
+----------+------------------+------------------+-----------------+
| Training | Unstable         | Stable           | Stable          |
+----------+------------------+------------------+-----------------+
| Speed    | Fast generation  | Fast generation  | Slow generation |
+----------+------------------+------------------+-----------------+
| Mode     | Can collapse     | No collapse      | No collapse     |
| coverage |                  |                  |                 |
+----------+------------------+------------------+-----------------+
| Control  | Hard             | Easy (latent)    | Easy (guidance) |
+----------+------------------+------------------+-----------------+
```

---

## Exercises

1. **Basic GAN**: Train a GAN on MNIST. Generate a grid of
   fake digits. How many epochs until they look reasonable?

2. **Mode collapse**: Deliberately cause mode collapse by making
   the discriminator too weak (1 hidden layer, 32 units).
   Observe the generator producing the same digit repeatedly.

3. **DCGAN**: Implement a DCGAN for CIFAR-10. Compare the image
   quality to the simple linear GAN.

4. **Conditional GAN**: Build a cGAN on MNIST. Generate specific
   digits by conditioning on the label.

5. **WGAN comparison**: Implement WGAN-GP (gradient penalty
   instead of weight clipping). Compare training stability
   to standard GAN by plotting D and G losses over time.

---

**Next**: [Lesson 07 - Diffusion Models](./07-diffusion-models.md)
