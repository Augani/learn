# Lesson 05: Autoencoders & VAEs

> **Analogy**: Teaching someone to draw a cat by DESCRIBING it,
> not copying it. An autoencoder learns to compress a cat photo
> into a short description (latent code) and reconstruct the
> cat from that description. A VAE goes further -- it makes the
> descriptions follow a pattern, so you can invent NEW descriptions
> and generate cats that never existed.

---

## The Autoencoder Architecture

```
Input          Bottleneck         Output
(784 dims)     (32 dims)          (784 dims)

 xxxxxxxx        xx               xxxxxxxx
 xxxxxxxx   -->  xx          -->  xxxxxxxx
 xxxxxxxx        xx               xxxxxxxx
 xxxxxxxx                         xxxxxxxx

 ENCODER      LATENT SPACE       DECODER
 (compress)   (description)      (reconstruct)

Goal: output should match input as closely as possible
Loss: MSE(input, output) or BCE(input, output)
```

Like summarizing a book into a tweet, then trying to
rewrite the book from just the tweet. The bottleneck
forces the network to learn what matters.

---

## Simple Autoencoder

```python
import torch
import torch.nn as nn


class Autoencoder(nn.Module):
    def __init__(self, input_dim=784, latent_dim=32):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
            nn.Linear(128, latent_dim),
        )
        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 256),
            nn.ReLU(),
            nn.Linear(256, input_dim),
            nn.Sigmoid(),
        )

    def forward(self, x):
        z = self.encoder(x)
        return self.decoder(z)


model = Autoencoder()
criterion = nn.MSELoss()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)
```

---

## Training an Autoencoder

```python
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

transform = transforms.Compose([
    transforms.ToTensor(),
])

train_ds = datasets.MNIST("./data", train=True, download=True, transform=transform)
train_loader = DataLoader(train_ds, batch_size=128, shuffle=True)

for epoch in range(20):
    total_loss = 0
    for images, _ in train_loader:
        flat = images.view(images.size(0), -1)

        reconstructed = model(flat)
        loss = criterion(reconstructed, flat)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()

        total_loss += loss.item()

    avg_loss = total_loss / len(train_loader)
    print(f"Epoch {epoch+1}: loss = {avg_loss:.4f}")
```

---

## What Lives in the Latent Space?

```
2D latent space of MNIST (each dot = one digit):

  +4 |       7 7 7
     |     7 7
  +2 |  1 1 1        9 9 9
     |  1 1        9 9
   0 |        0 0 0       4 4
     |      0 0 0      4 4 4
  -2 |   3 3 3     8 8 8
     |  3 3       8 8
  -4 |  2 2 2    6 6 6     5 5
     +---------------------------
     -4  -2   0   +2   +4

Similar digits cluster together!
The latent space organizes itself.
```

---

## Convolutional Autoencoder

For images, use conv layers instead of linear.

```python
class ConvAutoencoder(nn.Module):
    def __init__(self):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Conv2d(1, 32, 3, stride=2, padding=1),
            nn.ReLU(),
            nn.Conv2d(32, 64, 3, stride=2, padding=1),
            nn.ReLU(),
            nn.Conv2d(64, 128, 3, stride=2, padding=1),
            nn.ReLU(),
        )
        self.decoder = nn.Sequential(
            nn.ConvTranspose2d(128, 64, 3, stride=2, padding=1, output_padding=0),
            nn.ReLU(),
            nn.ConvTranspose2d(64, 32, 3, stride=2, padding=1, output_padding=1),
            nn.ReLU(),
            nn.ConvTranspose2d(32, 1, 3, stride=2, padding=1, output_padding=1),
            nn.Sigmoid(),
        )

    def forward(self, x):
        z = self.encoder(x)
        return self.decoder(z)
```

---

## The Problem with Regular Autoencoders

```
Regular Autoencoder latent space:

  +---+     +---+
  | 3 |     | 7 |     Clusters are spread randomly
  +---+     +---+     with gaps between them.
        +---+
        | 1 |          If you sample a point in the gap,
        +---+          you get garbage output.
               +---+
               | 9 |   Can't generate new data!
               +---+

We need the latent space to be SMOOTH and CONTINUOUS.
Enter the VAE.
```

---

## Variational Autoencoder (VAE)

Instead of encoding to a single point, encode to a
**distribution** (mean + variance).

```
Autoencoder:                    VAE:

Input --> [z = 2.5, -1.3]      Input --> [mu = 2.5, sigma = 0.3]
                                          [mu = -1.3, sigma = 0.2]
          ^                               ^
          A single point                  A distribution!
                                          Sample z from it

This means nearby points in latent space
produce similar outputs = SMOOTH SPACE
```

```
VAE Architecture:

  Input
    |
    v
  ENCODER
    |
    +--> mu (mean)
    |           \
    +--> logvar  +---> z = mu + sigma * epsilon
    (log variance)     (reparameterization trick)
                       |
                       v
                    DECODER
                       |
                       v
                    Output
```

---

## The Reparameterization Trick

We can't backprop through random sampling. The trick:
instead of sampling z ~ N(mu, sigma), compute:

```
z = mu + sigma * epsilon    where epsilon ~ N(0, 1)

The randomness (epsilon) is external to the computation.
Gradients flow through mu and sigma, NOT through epsilon.

  mu --------+
              |
              v
  epsilon --> [z = mu + sigma * eps] --> decoder --> loss
              ^
  sigma ------+

  Gradients flow through mu and sigma. Done!
```

---

## VAE Implementation

```python
class VAE(nn.Module):
    def __init__(self, input_dim=784, latent_dim=32):
        super().__init__()
        self.encoder = nn.Sequential(
            nn.Linear(input_dim, 256),
            nn.ReLU(),
            nn.Linear(256, 128),
            nn.ReLU(),
        )
        self.fc_mu = nn.Linear(128, latent_dim)
        self.fc_logvar = nn.Linear(128, latent_dim)

        self.decoder = nn.Sequential(
            nn.Linear(latent_dim, 128),
            nn.ReLU(),
            nn.Linear(128, 256),
            nn.ReLU(),
            nn.Linear(256, input_dim),
            nn.Sigmoid(),
        )

    def encode(self, x):
        h = self.encoder(x)
        return self.fc_mu(h), self.fc_logvar(h)

    def reparameterize(self, mu, logvar):
        std = torch.exp(0.5 * logvar)
        eps = torch.randn_like(std)
        return mu + std * eps

    def decode(self, z):
        return self.decoder(z)

    def forward(self, x):
        mu, logvar = self.encode(x)
        z = self.reparameterize(mu, logvar)
        return self.decode(z), mu, logvar
```

---

## VAE Loss: Reconstruction + KL Divergence

```
VAE Loss = Reconstruction Loss + beta * KL Divergence

Reconstruction: How well does the output match the input?
  = MSE(output, input) or BCE(output, input)

KL Divergence: How close is the learned distribution to N(0,1)?
  = forces the latent space to be smooth and continuous

  KL = -0.5 * sum(1 + logvar - mu^2 - exp(logvar))
```

```python
def vae_loss(recon_x, x, mu, logvar, beta=1.0):
    recon_loss = nn.functional.mse_loss(recon_x, x, reduction="sum")
    kl_loss = -0.5 * torch.sum(1 + logvar - mu.pow(2) - logvar.exp())
    return recon_loss + beta * kl_loss


model = VAE()
optimizer = torch.optim.Adam(model.parameters(), lr=1e-3)

for epoch in range(20):
    total_loss = 0
    for images, _ in train_loader:
        flat = images.view(images.size(0), -1)
        recon, mu, logvar = model(flat)
        loss = vae_loss(recon, flat, mu, logvar)

        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
        total_loss += loss.item()

    print(f"Epoch {epoch+1}: loss = {total_loss / len(train_ds):.4f}")
```

---

## Generating New Data with a VAE

```python
model.eval()
with torch.no_grad():
    z = torch.randn(16, 32)
    generated = model.decode(z)
    generated = generated.view(16, 1, 28, 28)
```

```
Sample from N(0,1) --> Decoder --> New image!

Because KL forced the latent space to be N(0,1),
random samples produce valid outputs.

z = [0.5, -0.2, ...]  -->  a "3"-like digit
z = [0.6, -0.1, ...]  -->  very similar "3"
z = [-1.0, 0.8, ...]  -->  a "7"-like digit

SMOOTH interpolation between digits!
```

---

## Beta-VAE: Controlling the Trade-off

```
beta < 1:  Better reconstruction, messier latent space
beta = 1:  Standard VAE
beta > 1:  Blurrier reconstruction, more disentangled latent space

"Disentangled" = each latent dimension controls one thing:
  z[0] = digit identity (0-9)
  z[1] = slant angle
  z[2] = stroke width
  z[3] = size
  ...
```

---

## Applications

```
+---------------------+------------------------------------+
| Application         | How It Works                       |
+---------------------+------------------------------------+
| Denoising           | Train on noisy->clean pairs        |
+---------------------+------------------------------------+
| Anomaly detection   | High reconstruction error = anomaly|
+---------------------+------------------------------------+
| Data generation     | Sample from latent space           |
+---------------------+------------------------------------+
| Compression         | Latent code is the compressed form |
+---------------------+------------------------------------+
| Interpolation       | Walk through latent space          |
+---------------------+------------------------------------+
```

---

## Exercises

1. **Basic autoencoder**: Train an autoencoder on MNIST.
   Visualize the original vs reconstructed digits. Try
   latent dimensions of 2, 8, 32, and 128. How does
   reconstruction quality change?

2. **Denoising autoencoder**: Add Gaussian noise to MNIST
   inputs, train to reconstruct clean images. Test on
   noisy images the model has never seen.

3. **VAE generation**: Train a VAE on MNIST with latent_dim=2.
   Sample a grid of points from the 2D latent space and
   visualize the decoded images. You should see smooth
   transitions between digits.

4. **Beta-VAE**: Train VAEs with beta=0.1, 1.0, and 4.0.
   Compare reconstruction quality and latent space structure.

5. **Interpolation**: Take two MNIST digits, encode them,
   linearly interpolate between their latent codes in 10
   steps, and decode each step. Watch one digit morph into
   another.

---

**Next**: [Lesson 06 - GANs](./06-gans.md)
