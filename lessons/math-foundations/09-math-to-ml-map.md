# Lesson 09: The Math-to-ML Map — Connecting Every Concept

This lesson is your navigation aid. Every math concept from Lessons 01–08
maps to specific places in the ML/AI curriculum where it is used.
Bookmark this page. Come back to it whenever you encounter math in a
later track and want to review the foundation.

---

## The Complete Map

### Linear Algebra (Lessons 01–04)

| Math Concept | Where It Appears | How It's Used |
|---|---|---|
| Vectors | [Track 7, Lesson 13: Embeddings](../ml-fundamentals/13-embeddings.md) | Word and token embeddings are vectors in high-dimensional space |
| Vectors | [Track 8, Lesson 05: Self-Attention](../llms-transformers/05-self-attention.md) | Query, key, and value vectors in attention |
| Matrix shapes | [Track 7, Lesson 06: Neural Networks](../ml-fundamentals/06-neural-networks.md) | Weight matrices connect layers; shape determines network architecture |
| Dot product | [Track 8, Lesson 05: Self-Attention](../llms-transformers/05-self-attention.md) | Attention scores = dot product of query and key vectors |
| Dot product | [Track 7, Lesson 13: Embeddings](../ml-fundamentals/13-embeddings.md) | Cosine similarity between embeddings |
| Cosine similarity | [AI Engineering, Lesson 05: Embeddings in Practice](../ai-engineering/05-embeddings-in-practice.md) | Semantic search and retrieval in RAG systems |
| Matrix multiplication | [Track 7, Lesson 06: Neural Networks](../ml-fundamentals/06-neural-networks.md) | Forward pass: output = input @ weights + bias |
| Matrix multiplication | [Track 8, Lesson 05: Self-Attention](../llms-transformers/05-self-attention.md) | Attention computation: Q @ K^T and attention_weights @ V |
| Matrix multiplication | [Track 8, Lesson 07: Transformer Architecture](../llms-transformers/07-transformer-architecture.md) | Feed-forward layers in transformers |
| Batch operations | [Track 7, Lesson 08: Training in Practice](../ml-fundamentals/08-training-practice.md) | Mini-batch training processes multiple inputs simultaneously |
| Transpose | [Track 8, Lesson 05: Self-Attention](../llms-transformers/05-self-attention.md) | Attention scores = Q @ K^**T** / √d |
| Eigenvalues | [Applied ML, Lesson 11: Dimensionality Reduction](../applied-ml/11-dimensionality-reduction.md) | PCA uses eigenvalues to find principal components |
| SVD | [Applied ML, Lesson 11: Dimensionality Reduction](../applied-ml/11-dimensionality-reduction.md) | SVD-based dimensionality reduction and matrix factorization |

### Calculus (Lessons 05–06)

| Math Concept | Where It Appears | How It's Used |
|---|---|---|
| Derivatives | [Track 7, Lesson 03: Gradient Descent](../ml-fundamentals/03-gradient-descent.md) | Computing how loss changes with respect to each parameter |
| Partial derivatives | [Track 7, Lesson 03: Gradient Descent](../ml-fundamentals/03-gradient-descent.md) | Gradient = vector of partial derivatives for all parameters |
| Gradient vector | [Track 7, Lesson 03: Gradient Descent](../ml-fundamentals/03-gradient-descent.md) | Direction of steepest ascent; go opposite to minimize loss |
| Gradient descent | [Track 7, Lesson 03: Gradient Descent](../ml-fundamentals/03-gradient-descent.md) | The core optimization algorithm: θ = θ - α∇L |
| Gradient descent | [Advanced Deep Learning, Lesson 02: Advanced Optimizers](../advanced-deep-learning/02-advanced-optimizers.md) | Adam, RMSProp, and other optimizers build on gradient descent |
| Chain rule | [Track 7, Lesson 07: Backpropagation](../ml-fundamentals/07-backpropagation.md) | Backpropagation IS the chain rule applied through the network |
| Computational graphs | [Track 7, Lesson 07: Backpropagation](../ml-fundamentals/07-backpropagation.md) | PyTorch autograd builds computational graphs for automatic differentiation |
| Numerical derivatives | [Track 7, Lesson 07: Backpropagation](../ml-fundamentals/07-backpropagation.md) | Gradient checking: verify backprop with numerical approximation |

### Probability & Statistics (Lessons 07–08)

| Math Concept | Where It Appears | How It's Used |
|---|---|---|
| Probability distributions | [Track 8, Lesson 14: Inference](../llms-transformers/14-inference.md) | LLM output is a probability distribution over the vocabulary |
| Conditional probability | [Track 8, Lesson 01: Language Modeling](../llms-transformers/01-language-modeling.md) | P(next word \| previous words) is the core of language modeling |
| Bayes' theorem | [Track 7, Lesson 04: Classification](../ml-fundamentals/04-classification.md) | Naive Bayes classifier; posterior probability estimation |
| Normal distribution | [Track 7, Lesson 02: Linear Regression](../ml-fundamentals/02-linear-regression.md) | Noise in regression is assumed Gaussian; weight initialization |
| Normal distribution | [Advanced Deep Learning, Lesson 05: Autoencoders & VAEs](../advanced-deep-learning/05-autoencoders-vaes.md) | VAE latent space uses Gaussian distributions |
| Softmax | [Track 7, Lesson 06: Neural Networks](../ml-fundamentals/06-neural-networks.md) | Converts logits to class probabilities |
| Softmax | [Track 8, Lesson 05: Self-Attention](../llms-transformers/05-self-attention.md) | Normalizes attention scores to weights that sum to 1 |
| Temperature | [Track 8, Lesson 14: Inference](../llms-transformers/14-inference.md) | Controls randomness in LLM text generation |
| Sampling | [Track 8, Lesson 14: Inference](../llms-transformers/14-inference.md) | Top-k, top-p, and temperature sampling for text generation |
| Expected value | [Track 7, Lesson 03: Gradient Descent](../ml-fundamentals/03-gradient-descent.md) | Loss function = expected error over the dataset |
| Variance | [Track 7, Lesson 08: Training in Practice](../ml-fundamentals/08-training-practice.md) | Bias-variance tradeoff; batch normalization reduces internal variance |
| Variance | [Advanced Deep Learning, Lesson 01: Regularization](../advanced-deep-learning/01-regularization.md) | Regularization reduces model variance (overfitting) |
| MLE | [Track 7, Lesson 08: Training in Practice](../ml-fundamentals/08-training-practice.md) | Cross-entropy loss = negative log-likelihood (MLE objective) |
| Cross-entropy | [Track 7, Lesson 06: Neural Networks](../ml-fundamentals/06-neural-networks.md) | Standard loss function for classification tasks |
| Cross-entropy | [Track 8, Lesson 12: Pretraining](../llms-transformers/12-pretraining.md) | Next-token prediction loss during LLM pretraining |
| KL divergence | [Advanced Deep Learning, Lesson 05: Autoencoders & VAEs](../advanced-deep-learning/05-autoencoders-vaes.md) | VAE loss includes KL divergence between distributions |

---

## Visual Map: Math → ML Pipeline

```
┌─────────────────────────────────────────────────────────────────┐
│                        MATH FOUNDATIONS                         │
├─────────────────┬──────────────────┬────────────────────────────┤
│  LINEAR ALGEBRA │    CALCULUS      │   PROBABILITY & STATS      │
│                 │                  │                            │
│  Vectors        │  Derivatives     │  Distributions             │
│  Matrices       │  Gradients       │  Bayes' theorem            │
│  Dot products   │  Chain rule      │  Expected value            │
│  Transpose      │                  │  Variance                  │
│  Eigenvalues    │                  │  MLE                       │
└────────┬────────┴────────┬─────────┴──────────────┬─────────────┘
         │                 │                        │
         ▼                 ▼                        ▼
┌─────────────────┐ ┌──────────────┐  ┌────────────────────────┐
│ NEURAL NETWORKS │ │  TRAINING    │  │  MODEL OUTPUT          │
│                 │ │              │  │                        │
│ Weights = matmul│ │ Gradient     │  │ Softmax = probability  │
│ Layers = matmul │ │ descent      │  │ Cross-entropy = MLE    │
│ Attention =     │ │ Backprop =   │  │ Sampling = generation  │
│   dot products  │ │ chain rule   │  │ Temperature = control  │
└────────┬────────┘ └──────┬───────┘  └───────────┬────────────┘
         │                 │                      │
         ▼                 ▼                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ML FUNDAMENTALS (Track 7)                    │
│  Linear regression, neural networks, CNNs, backpropagation     │
├─────────────────────────────────────────────────────────────────┤
│                  LLMs & TRANSFORMERS (Track 8)                  │
│  Attention, transformer architecture, GPT, RLHF, inference     │
├─────────────────────────────────────────────────────────────────┤
│                      APPLIED ML                                 │
│  Feature engineering, dimensionality reduction, evaluation      │
├─────────────────────────────────────────────────────────────────┤
│                  ADVANCED DEEP LEARNING                         │
│  Regularization, optimizers, VAEs, GANs, distributed training  │
├─────────────────────────────────────────────────────────────────┤
│                    AI ENGINEERING                                │
│  Embeddings, RAG, fine-tuning, agents, production deployment   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference: "I'm Stuck on X, What Should I Review?"

| If you're stuck on... | Review this lesson |
|---|---|
| Shape mismatch errors | [Lesson 01: Vectors and Matrices](./01-vectors-matrices.md) |
| Embedding similarity / search | [Lesson 02: Dot Products and Similarity](./02-dot-products-similarity.md) |
| How a forward pass works | [Lesson 03: Matrix Multiplication](./03-matrix-multiplication.md) |
| PCA / dimensionality reduction | [Lesson 04: Transpose, Eigenvalues, and Decomposition](./04-transpose-eigenvalues.md) |
| Why gradient descent works | [Lesson 05: Derivatives and Gradients](./05-derivatives-gradients.md) |
| How backpropagation works | [Lesson 06: The Chain Rule and Backpropagation](./06-chain-rule-backprop.md) |
| Softmax / temperature / sampling | [Lesson 07: Probability and Distributions](./07-probability-distributions.md) |
| Loss functions / why cross-entropy | [Lesson 08: Expectation, Variance, and MLE](./08-expectation-variance-mle.md) |

---

## What Comes Next

You now have the mathematical toolkit for machine learning. Every concept
in this track will appear again — in neural networks, transformers,
training loops, and production systems.

Your next step: **[ML Fundamentals (Track 7)](../ml-fundamentals/00-roadmap.md)** —
where you will build neural networks from scratch using everything you
learned here.

For a deeper dive into any topic, see the full
**[Math for AI track](../math-for-ai/00-roadmap.md)** (18 lessons).

---

## Formula Quick Reference

See the [Formula Cheat Sheet](./reference-formulas.md) for every formula
in this track with NumPy equivalents.
