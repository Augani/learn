# Lesson 09: Interpreting Deep Learning Models

> Deep learning models are powerful but opaque — interpretability techniques let you peek inside the black box and ask "what are you looking at?"

---

## The X-Ray Analogy

A doctor can feel a lump and say "something's there," but an X-ray
shows exactly what's inside. Deep learning interpretability is like
giving your model an X-ray — gradient-based methods show which
input regions the model focuses on, attention maps show where it
"looks," and concept-based methods reveal what abstract ideas it
has learned.

```
  DEEP LEARNING INTERPRETABILITY METHODS

  +-----------------+     +-----------------+     +-----------------+
  | Gradient-based  |     | Attention-based |     | Concept-based   |
  | (what pixels    |     | (where the model|     | (what abstract  |
  |  matter?)       |     |  focuses?)      |     |  ideas learned?)|
  +-----------------+     +-----------------+     +-----------------+
  | Saliency maps   |     | Attention       |     | TCAV            |
  | Grad-CAM        |     |  weights        |     | Probing         |
  | Integrated      |     | Attention       |     |  classifiers    |
  |  Gradients      |     |  rollout        |     | Network         |
  +-----------------+     +-----------------+     |  dissection     |
                                                  +-----------------+
```

---

## Gradient-based Methods

### Saliency Maps

The simplest approach: compute the gradient of the output with
respect to the input. Pixels with large gradients are "important"
to the prediction.

```python
import torch
import torch.nn as nn
import torchvision.models as models
import torchvision.transforms as transforms
from PIL import Image
import numpy as np
import matplotlib.pyplot as plt

# Load a pretrained model
model = models.resnet50(pretrained=True)
model.eval()

# Image preprocessing
preprocess = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    ),
])

def compute_saliency(model, input_tensor, target_class):
    """Compute vanilla gradient saliency map."""
    input_tensor.requires_grad_(True)
    output = model(input_tensor)

    # Backpropagate from the target class
    model.zero_grad()
    output[0, target_class].backward()

    # Saliency = absolute value of gradient
    saliency = input_tensor.grad.data.abs()
    # Take max across color channels
    saliency = saliency.squeeze().max(dim=0)[0]

    return saliency.numpy()

# Example usage (with a sample image)
# img = Image.open('cat.jpg')
# input_tensor = preprocess(img).unsqueeze(0)
# saliency = compute_saliency(model, input_tensor, target_class=281)  # tabby cat
```

```
  SALIENCY MAP EXAMPLE

  Original Image          Saliency Map
  +------------------+    +------------------+
  |    ┌──────┐      |    |    ┌──────┐      |
  |    │ CAT  │      |    |    │██████│      |
  |    │ FACE │      |    |    │██████│      |
  |    └──────┘      |    |    └──────┘      |
  |  background      |    |  ░░░░░░░░░░      |
  +------------------+    +------------------+

  Bright regions = high gradient = important for prediction
  The model focuses on the cat's face, not the background.
```

### Grad-CAM (Gradient-weighted Class Activation Mapping)

More informative than raw saliency. Uses gradients flowing into
the last convolutional layer to produce a coarse heatmap showing
which regions of the image are important.

```python
class GradCAM:
    """Grad-CAM implementation for CNN models."""

    def __init__(self, model, target_layer):
        self.model = model
        self.target_layer = target_layer
        self.gradients = None
        self.activations = None

        # Register hooks
        target_layer.register_forward_hook(self._save_activation)
        target_layer.register_full_backward_hook(self._save_gradient)

    def _save_activation(self, module, input, output):
        self.activations = output.detach()

    def _save_gradient(self, module, grad_input, grad_output):
        self.gradients = grad_output[0].detach()

    def generate(self, input_tensor, target_class):
        # Forward pass
        output = self.model(input_tensor)

        # Backward pass for target class
        self.model.zero_grad()
        output[0, target_class].backward()

        # Global average pooling of gradients
        weights = self.gradients.mean(dim=[2, 3], keepdim=True)

        # Weighted combination of activation maps
        cam = (weights * self.activations).sum(dim=1, keepdim=True)
        cam = torch.relu(cam)  # Only positive contributions

        # Normalize to [0, 1]
        cam = cam.squeeze().numpy()
        cam = (cam - cam.min()) / (cam.max() - cam.min() + 1e-8)

        return cam

# Usage
# grad_cam = GradCAM(model, model.layer4[-1])
# heatmap = grad_cam.generate(input_tensor, target_class=281)
```

```python
def visualize_gradcam(image, heatmap, alpha=0.4):
    """Overlay Grad-CAM heatmap on original image."""
    # Resize heatmap to image size
    import cv2
    heatmap_resized = cv2.resize(heatmap, (image.shape[1], image.shape[0]))

    # Apply colormap
    heatmap_colored = plt.cm.jet(heatmap_resized)[:, :, :3]

    # Overlay
    overlay = alpha * heatmap_colored + (1 - alpha) * image / 255.0
    overlay = np.clip(overlay, 0, 1)

    fig, axes = plt.subplots(1, 3, figsize=(15, 5))
    axes[0].imshow(image)
    axes[0].set_title('Original')
    axes[1].imshow(heatmap_resized, cmap='jet')
    axes[1].set_title('Grad-CAM Heatmap')
    axes[2].imshow(overlay)
    axes[2].set_title('Overlay')

    for ax in axes:
        ax.axis('off')
    plt.tight_layout()
    plt.savefig('gradcam.png', dpi=150)
    plt.show()
```

---

## Attention Visualization

Transformer models use attention mechanisms that can be visualized
to understand what the model "attends to."

```python
from transformers import AutoTokenizer, AutoModel
import torch

# Load a pretrained transformer
tokenizer = AutoTokenizer.from_pretrained('bert-base-uncased')
bert_model = AutoModel.from_pretrained(
    'bert-base-uncased', output_attentions=True
)
bert_model.eval()

def get_attention_maps(text):
    """Extract attention maps from BERT."""
    inputs = tokenizer(text, return_tensors='pt')
    with torch.no_grad():
        outputs = bert_model(**inputs)

    # outputs.attentions: tuple of (batch, heads, seq_len, seq_len)
    # One tensor per layer
    attentions = outputs.attentions
    tokens = tokenizer.convert_ids_to_tokens(inputs['input_ids'][0])

    return attentions, tokens

text = "The bank approved the loan application."
attentions, tokens = get_attention_maps(text)

print(f"Number of layers: {len(attentions)}")
print(f"Attention shape per layer: {attentions[0].shape}")
print(f"Tokens: {tokens}")
```

```python
def plot_attention(attentions, tokens, layer=11, head=0):
    """Plot attention heatmap for a specific layer and head."""
    attention = attentions[layer][0, head].numpy()

    fig, ax = plt.subplots(figsize=(8, 8))
    im = ax.imshow(attention, cmap='Blues')

    ax.set_xticks(range(len(tokens)))
    ax.set_yticks(range(len(tokens)))
    ax.set_xticklabels(tokens, rotation=45, ha='right')
    ax.set_yticklabels(tokens)
    ax.set_title(f'Attention: Layer {layer}, Head {head}')

    plt.colorbar(im, ax=ax)
    plt.tight_layout()
    plt.savefig('attention_map.png', dpi=150)
    plt.show()

plot_attention(attentions, tokens, layer=11, head=0)
```

```
  ATTENTION MAP EXAMPLE

  "The bank approved the loan application"

  From\To   The  bank  approved  the  loan  application
  The       ░░   ██    ░░        ░░   ░░    ░░
  bank      ░░   ░░    ██        ░░   ██    ░░
  approved  ░░   ██    ░░        ░░   ██    ██
  the       ░░   ░░    ░░        ░░   ██    ░░
  loan      ░░   ██    ██        ░░   ░░    ██
  application ░░ ░░    ██        ░░   ██    ░░

  Dark = high attention. "approved" attends to "bank",
  "loan", and "application" — the key context words.
```

---

## The Attention ≠ Explanation Debate

A critical caveat: attention weights show where the model *looks*,
not necessarily what it *uses* for its decision.

```
  THE DEBATE

  PRO: Attention = Explanation       CON: Attention ≠ Explanation
  ┌─────────────────────────┐       ┌─────────────────────────┐
  │ Attention correlates    │       │ Attention can be         │
  │ with human intuition    │       │ manipulated without      │
  │                         │       │ changing predictions     │
  │ High attention on       │       │                         │
  │ relevant tokens         │       │ Multiple attention       │
  │                         │       │ patterns produce same    │
  │ Useful for debugging    │       │ output                   │
  │ and understanding       │       │                         │
  └─────────────────────────┘       │ Jain & Wallace (2019):  │
                                    │ "Attention is not        │
                                    │  Explanation"            │
                                    └─────────────────────────┘

  PRACTICAL TAKEAWAY:
  Use attention as a HINT, not a PROOF.
  Combine with other methods for reliable explanations.
```

---

## Concept-based Explanations (TCAV)

Testing with Concept Activation Vectors (TCAV) asks: "How
important is a human-understandable concept (like 'striped') to
the model's prediction (like 'zebra')?"

```
  TCAV: CONCEPT-LEVEL EXPLANATIONS

  Instead of: "Pixel (102, 45) has high gradient"
  TCAV says:  "The concept 'stripes' is important for 'zebra'"

  Step 1: Collect examples of the concept (images with stripes)
  Step 2: Train a linear classifier in activation space
  Step 3: The classifier's normal vector = Concept Activation Vector
  Step 4: Test how much the model's predictions change along this direction

  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │ Concept       │     │ Learn CAV    │     │ Test: does   │
  │ examples      │ --> │ in activation│ --> │ moving along │
  │ (striped imgs)│     │ space        │     │ CAV change   │
  └──────────────┘     └──────────────┘     │ prediction?  │
                                            └──────────────┘
```

```python
# Simplified TCAV concept
# In practice, use the tcav library or captum

def simplified_tcav_score(model, layer_activations, concept_direction,
                          class_idx):
    """
    Compute a simplified TCAV score.

    concept_direction: unit vector in activation space pointing
                       toward the concept
    layer_activations: activations at the target layer for test images
    """
    # Compute gradient of class output w.r.t. layer activations
    # (In practice, this requires backpropagation)

    # TCAV score = fraction of inputs where the directional derivative
    # along the concept direction is positive
    # score > 0.5 means the concept positively influences the class

    # Placeholder for illustration
    directional_derivatives = layer_activations @ concept_direction
    tcav_score = (directional_derivatives > 0).mean()

    return tcav_score

# Example interpretation:
# TCAV('stripes', 'zebra') = 0.92 → stripes strongly influence zebra prediction
# TCAV('stripes', 'car') = 0.48 → stripes don't influence car prediction
```

---

## Choosing the Right Method

```
  DEEP LEARNING INTERPRETABILITY DECISION GUIDE

  Image model (CNN)?
  ├── Quick overview → Saliency maps
  ├── Localized regions → Grad-CAM
  └── Concept-level → TCAV

  Text model (Transformer)?
  ├── Token-level → Attention visualization
  ├── Feature attribution → Integrated Gradients
  └── Concept-level → Probing classifiers

  Any deep model?
  ├── Per-feature attribution → SHAP DeepExplainer
  └── Local explanation → LIME (model-agnostic)

  REMEMBER:
  - No single method tells the whole story
  - Combine multiple methods for robust explanations
  - Attention is a hint, not proof
  - Validate explanations against domain knowledge
```

---

## Exercises

### Exercise 1: Grad-CAM Exploration

Using a pretrained ResNet50:

1. Load 3 different images (animal, vehicle, object)
2. Generate Grad-CAM heatmaps for the predicted class
3. Generate Grad-CAM for a *wrong* class — what does the model
   look at when it's "thinking" about a different category?
4. Compare Grad-CAM from different layers (early vs late)
5. Do the explanations match your intuition?

### Exercise 2: Attention Analysis

Using a pretrained BERT model:

1. Analyze attention patterns for these sentences:
   - "The doctor said she would be back tomorrow"
   - "The nurse said he would be back tomorrow"
2. Do the attention patterns for "she" and "he" differ?
3. What does this suggest about gender associations in the model?
4. Try with different professions and pronouns
5. Write a brief analysis of what you find

---

Next: [Lesson 10: AI Governance Frameworks](./10-ai-governance-frameworks.md)
