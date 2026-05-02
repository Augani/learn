# Lesson 01: Reading ML Papers

> **Analogy**: Reading a research paper is like scouting an unfamiliar
> city. First pass: look at the map and decide if you want to visit.
> Second pass: walk the main streets and get oriented. Third pass:
> explore every alley. Most cities only deserve the first pass.

---

## Why Read Papers?

Blog posts are summaries of summaries. Library documentation tells
you *how* to call a function, not *why* it exists. If you want to
push beyond what tutorials teach, you need to read the source.

Papers are where ideas are born. Everything else is a downstream
approximation.

```
  Paper (primary source)
    |
    +---> Blog post (someone's interpretation)
    |       |
    |       +---> Twitter thread (telephone game)
    |               |
    |               +---> Stack Overflow answer (fragment)
    |
    +---> Library implementation (may diverge from paper)
```

Every layer adds distortion. Reading the paper removes it.

---

## Anatomy of an ML Paper

Every ML paper follows roughly the same skeleton. Once you see the
pattern, you can navigate any paper in minutes.

```
+-------------------+--------------------------------------------------+
| Section           | What It Tells You                                |
+-------------------+--------------------------------------------------+
| Title + Abstract  | What problem, what solution, what results        |
| Introduction      | Why this matters, what's been tried, what's new  |
| Related Work      | Landscape of prior approaches                    |
| Method            | The actual contribution (math + architecture)    |
| Experiments       | Does it actually work? On what data?             |
| Ablation Studies  | Which parts of the method matter?                |
| Conclusion        | Summary + limitations + future work              |
| Appendix          | Implementation details, hyperparameters, proofs  |
+-------------------+--------------------------------------------------+
```

The most important sections for an engineer:

1. **Abstract** -- Should you keep reading?
2. **Method** -- What did they actually build?
3. **Experiments** -- Does it work? How well?
4. **Appendix** -- The implementation details authors couldn't fit

Related Work is useful when you're surveying a field. Skip it when
you're trying to implement a specific paper.

---

## The Three-Pass Method

This is the single most effective strategy for reading papers. It
comes from S. Keshav's classic guide and it works because it
prevents you from getting stuck in the weeds too early.

### Pass 1: The Scout (5-10 minutes)

Read:
- Title, abstract, introduction (first and last paragraphs)
- Section headings
- Figures and tables (just glance)
- Conclusion

After Pass 1, answer:
- What problem does this solve?
- What's the main idea in one sentence?
- Is this relevant to what I'm working on?

```
Pass 1 Decision Tree:

  Read title + abstract
       |
       v
  Relevant to my work?
       |
   No--+--Yes
   |       |
   v       v
  Stop    Read intro + conclusion
              |
              v
          Novel approach?
              |
          No--+--Yes
          |       |
          v       v
         Stop    Go to Pass 2
```

Most papers stop here. That's fine. You're building a mental index
of what exists, not reading everything cover to cover.

### Pass 2: The Walk-Through (30-60 minutes)

Read the whole paper, but skip dense math derivations. Focus on:
- Figures and diagrams (these encode the core ideas)
- Algorithm boxes and pseudocode
- Experiment setup (datasets, baselines, metrics)
- Results tables

Take notes in your own words. If you can't explain the method
without looking at the paper, you don't understand it yet.

After Pass 2, answer:
- What's the architecture/algorithm?
- What are the key equations?
- How does it compare to baselines?
- What datasets did they use?
- Are the results convincing?

### Pass 3: The Deep Dive (2-4 hours)

Only for papers you plan to implement or that are central to your
research. Read everything including:
- Mathematical derivations (work through them on paper)
- Appendix details (hyperparameters, ablations)
- Referenced papers for unfamiliar concepts

After Pass 3, you should be able to:
- Reimplement the method from memory
- Identify unstated assumptions
- Spot weaknesses the authors didn't mention

```
Time Investment vs Papers Read:

  Pass 1 only:  ~50 papers/month  (broad awareness)
  Pass 1+2:     ~10 papers/month  (working knowledge)
  Pass 1+2+3:   ~2 papers/month   (implementation-ready)

  +-------+-------+-------+-------+
  |       | Pass 1| Pass 2| Pass 3|
  +-------+-------+-------+-------+
  | Time  | 10min | 1hr   | 4hrs  |
  | Depth | Map   | Street| Alley |
  | Use   | Scout | Learn | Build |
  +-------+-------+-------+-------+
```

---

## Where to Find Papers

### Primary Sources

**arXiv** (arxiv.org)
The preprint server where most ML papers land first. Papers appear
here weeks or months before conference publication. Not peer-
reviewed, which means both cutting-edge and crackpot work lives
here side by side.

Tips for arXiv:
- Browse by category: cs.LG (machine learning), cs.CV (computer
  vision), cs.CL (NLP), stat.ML (statistical ML)
- Use the "new" and "recent" tabs for latest submissions
- Subscribe to daily email digests for your categories
- Papers have versions -- always read the latest (v2, v3, etc.)

**Semantic Scholar** (semanticscholar.org)
Better search than arXiv. Shows citation graphs, related papers,
and TLDRs. The "Highly Influential Citations" filter is gold for
finding papers that actually moved the field.

**Google Scholar** (scholar.google.com)
Best for searching specific topics. Set up alerts for keywords
and authors. The "Cited by" count is a rough quality signal (but
not always -- some great papers are under-cited).

### Curated Sources

**Papers With Code** (paperswithcode.com)
Links papers to their implementations and benchmarks. If you're
trying to decide which approach to use, start here. Sort by
"most implemented" for battle-tested methods.

**Conference proceedings**: NeurIPS, ICML, ICLR, CVPR, ACL, EMNLP.
Accepted papers have passed peer review, but review quality varies.
Oral/spotlight papers are usually worth reading.

**Twitter/X and research blogs**: Follow researchers directly. Many
post paper summaries and discussions. Good for staying current, but
verify claims against the actual paper.

---

## Reading Critically

Not every paper is good. Not every result is real. Here's how to
read with healthy skepticism.

### Questions to Ask

```
+--------------------------------+-----------------------------------+
| Question                       | Why It Matters                    |
+--------------------------------+-----------------------------------+
| Is the baseline fair?          | Weak baselines inflate results    |
| Are hyperparameters tuned      | Tuning your method but not the    |
|   equally for all methods?     | baseline is a subtle cheat        |
| Is the dataset representative? | MNIST results mean nothing        |
| Are error bars reported?       | One lucky seed isn't a result     |
| Is the compute budget stated?  | 10x compute isn't a fair fight    |
| Do ablations show each part    | If removing a component doesn't   |
|   matters?                     | hurt, it's dead weight            |
| Is the code available?         | No code = hard to verify          |
+--------------------------------+-----------------------------------+
```

### Red Flags

**No comparison to recent baselines.** If a 2024 paper only
compares to methods from 2019, ask why. Usually because newer
methods are better.

**Cherry-picked examples.** Qualitative results (generated images,
translated text) are easy to cherry-pick. Look for quantitative
metrics on full test sets.

**Unreported compute.** A method that's "better" but requires 100x
the GPU hours isn't better for most use cases. Papers that hide
compute costs are hiding something.

**Only tested on one dataset.** Results should generalize. A method
that only works on CIFAR-10 might not work anywhere else.

**Vague method description.** If you can't figure out what they
actually did after two careful reads, the writing is either bad
or intentionally obscure. Either way, it's a red flag.

**Incremental improvements within noise.** A 0.1% improvement
without confidence intervals is statistical noise, not progress.
Look for improvements that are clearly outside the error bars.

```
Red Flag Severity:

  CRITICAL (probably skip):
    - No code, no reproducibility details
    - Results only on toy datasets
    - Claims that seem too good (>10% jump over SOTA)

  WARNING (read carefully):
    - No error bars or confidence intervals
    - Compute budget not mentioned
    - Only one dataset
    - Baselines are old

  MINOR (note but continue):
    - Writing quality issues
    - Missing ablations for some components
    - Appendix-only implementation details
```

---

## Building a Paper Reading Practice

Reading papers is a skill. Like any skill, it improves with
consistent practice.

### Weekly Routine

```
Monday:    Scan 10-15 new arXiv papers (Pass 1)    ~1 hour
Tuesday:   Deep read 1-2 selected papers (Pass 2)  ~2 hours
Wednesday: Implementation exploration               ~2 hours
Thursday:  Re-read with fresh eyes if needed        ~1 hour
Friday:    Write up notes, update reading log       ~30 min
```

### Paper Reading Notes Template

Keep a simple log for every paper you read past Pass 1:

```
Paper: [Title]
Authors: [Names]
Year: [Year]
Link: [arXiv/URL]
Pass Level: [1/2/3]

Problem: [One sentence]
Method: [One paragraph]
Key Result: [One sentence with numbers]
Strengths: [Bullet points]
Weaknesses: [Bullet points]
Relevance to my work: [One sentence]
Implementation notes: [If applicable]
```

### Managing Your Reading Queue

You'll always have more papers to read than time. Triage ruthlessly.

```python
def should_i_read_this(paper):
    if paper.directly_solves_my_current_problem:
        return "Pass 3 -- implement it"
    if paper.is_foundational_for_my_field:
        return "Pass 2 -- understand it"
    if paper.is_from_a_top_venue and paper.topic_is_adjacent:
        return "Pass 1 -- index it"
    return "Skip -- life is short"
```

---

## Practical Exercise

Pick a paper from the last 6 months in your area of interest.
Apply the three-pass method:

1. **Pass 1** (10 min): Can you explain the main idea in one
   sentence? Write it down before continuing.

2. **Pass 2** (1 hour): Draw the architecture or algorithm from
   memory. Compare to the paper. What did you miss?

3. **Pass 3** (if relevant): List every hyperparameter and
   implementation detail you'd need to reimplement it. How many
   are missing from the paper?

If you found gaps in Pass 3, congratulations -- you've just
discovered why Lesson 02 (Reproducing Results) exists.

---

## Key Takeaways

- Use the three-pass method to avoid wasting time on irrelevant
  papers
- Most papers only deserve Pass 1 -- that's not failure, it's
  efficient triage
- Read critically: check baselines, error bars, compute budgets,
  and dataset choices
- Build a consistent reading practice -- even 3-4 hours per week
  compounds into deep expertise over months
- Keep notes -- your future self will thank you when you need to
  find "that paper about contrastive learning on graphs"

Next lesson: you've found a paper worth pursuing. Now let's
reproduce their results.
