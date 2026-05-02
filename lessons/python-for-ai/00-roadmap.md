# Python for AI Engineers - Track Roadmap

> From systems programmer to AI practitioner.
> You already know how to code. This track teaches you Python
> through the lens of someone who's built things in Rust, C, or Go.

```
  Phase 1: Python Fundamentals        Phase 2: Data & Viz
  ┌─────────────────────────┐         ┌─────────────────────────┐
  │ 01 Python for Systems   │         │ 05 NumPy                │
  │ 02 Data Types & Gens    │────────>│ 06 Pandas               │
  │ 03 Classes & Decorators │         │ 07 Matplotlib           │
  │ 04 Type Hints & Modern  │         │ 08 Jupyter Notebooks    │
  └─────────────────────────┘         └─────────────────────────┘
                                                │
                                                v
  Phase 4: Tooling & Ship It          Phase 3: ML & AI
  ┌─────────────────────────┐         ┌─────────────────────────┐
  │ 13 Virtual Environments │         │ 09 Scikit-Learn         │
  │ 14 Testing ML Code      │<────────│ 10 PyTorch Deep Dive    │
  │ 15 Profiling & Optim.   │         │ 11 Hugging Face         │
  │ 16 Packaging & Distrib. │         │ 12 LangChain/LlamaIndex│
  └─────────────────────────┘         └─────────────────────────┘
```

---

## Phase 1: Python Fundamentals (Lessons 1-4)

*Think of this as learning to drive an automatic after years of driving stick.
The car still goes forward, but the controls feel different.*

- [ ] **Lesson 01** - [Python for Systems Programmers](01-python-for-systems-programmers.md)
  - GIL, dynamic typing, memory model, what's different from Rust/C
- [ ] **Lesson 02** - [Data Types, Comprehensions & Generators](02-data-types-comprehensions-generators.md)
  - Lists, dicts, sets, comprehensions, generators, itertools
- [ ] **Lesson 03** - [Classes, Decorators & Context Managers](03-classes-decorators-context-managers.md)
  - OOP, dunder methods, decorators, `with` statements
- [ ] **Lesson 04** - [Type Hints & Modern Python](04-type-hints-modern-python.md)
  - Type annotations, dataclasses, match statements, walrus operator

---

## Phase 2: Data & Visualization (Lessons 5-8)

*Like getting your workshop set up before building furniture.
These tools are what you'll reach for every single day.*

- [ ] **Lesson 05** - [NumPy](05-numpy.md)
  - Arrays, broadcasting, vectorization, why it's fast
- [ ] **Lesson 06** - [Pandas](06-pandas.md)
  - DataFrames, Series, cleaning, groupby, merge
- [ ] **Lesson 07** - [Matplotlib & Visualization](07-matplotlib-visualization.md)
  - Plots, subplots, customization, seeing your data
- [ ] **Lesson 08** - [Jupyter Notebooks](08-jupyter-notebooks.md)
  - The ML workbench, magic commands, best practices

---

## Phase 3: ML & AI (Lessons 9-12)

*Now you're cooking. Phase 1 gave you knife skills,
Phase 2 gave you ingredients. Time to make something.*

- [ ] **Lesson 09** - [Scikit-Learn](09-scikit-learn.md)
  - The classic ML toolkit, pipelines, transformers, estimators
- [ ] **Lesson 10** - [PyTorch Deep Dive](10-pytorch-deep-dive.md)
  - Tensors, autograd, nn.Module, DataLoader, training loops
- [ ] **Lesson 11** - [Hugging Face](11-hugging-face.md)
  - Models, datasets, tokenizers, pipelines, the Hub
- [ ] **Lesson 12** - [LangChain & LlamaIndex](12-langchain-llamaindex.md)
  - Building LLM applications, chains, agents, RAG

---

## Phase 4: Tooling & Ship It (Lessons 13-16)

*A race car is nothing without a pit crew.
These lessons turn experiments into production code.*

- [ ] **Lesson 13** - [Virtual Environments](13-virtual-environments.md)
  - uv, poetry, pip, venv, dependency management
- [ ] **Lesson 14** - [Testing ML Code](14-testing-ml-code.md)
  - pytest, fixtures, testing data pipelines, snapshot tests
- [ ] **Lesson 15** - [Profiling & Optimization](15-profiling-optimization.md)
  - cProfile, line_profiler, making Python fast enough, Cython
- [ ] **Lesson 16** - [Packaging & Distribution](16-packaging-distribution.md)
  - pyproject.toml, building wheels, publishing to PyPI

---

## Reference Materials

- [Quick Reference Cheatsheet](reference-cheatsheet.md) - Python syntax for systems programmers
- [AI/ML Library Guide](reference-libraries.md) - Key libraries and when to use them

---

## How to Use This Track

1. **Already know Python basics?** Skip to Phase 2 or 3
2. **Coming from Rust/C/Go?** Start at Lesson 01
3. **Just need AI tools?** Jump to Lessons 9-12
4. **Each lesson is standalone** but they build on each other
5. **Run every code example** - reading isn't learning

```
Estimated time per lesson: 45-90 minutes
Total track time: ~20-30 hours
Prerequisites: Experience with any compiled language
```

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **Python for Data Analysis** by Wes McKinney (O'Reilly, 3rd Edition 2022) — By the creator of pandas
- **Python Data Science Handbook** by Jake VanderPlas (O'Reilly, 2nd Edition 2023) — NumPy, pandas, matplotlib, scikit-learn

---

[Start the track -> Lesson 01: Python for Systems Programmers](01-python-for-systems-programmers.md)
