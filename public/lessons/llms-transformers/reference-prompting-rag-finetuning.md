# Reference: Prompting vs RAG vs Fine-Tuning

One of the most common LLM product mistakes is using the wrong tool for the
problem.

People often ask:

- "Should I fine-tune?"
- "Should I just prompt better?"
- "Do I need RAG?"

These are different levers. They solve different failures.

---

## The Short Version

| Technique | Best for | Not best for |
|-----------|----------|--------------|
| Prompting | Instructions, output format, behavior nudges | Injecting lots of changing knowledge |
| RAG | Supplying current or private facts at runtime | Changing the model's core writing style |
| Fine-tuning | Repeated behavior/style/task adaptation | Frequently changing factual knowledge |

If you remember one rule, remember this:

- **Prompting** changes what you ask
- **RAG** changes what the model can read right now
- **Fine-tuning** changes the behavior it has learned

---

## Three Everyday Analogies

### Prompting = Giving better instructions to a smart employee

You already hired a capable person. They do better when you give clearer
instructions:

- "Answer in JSON"
- "Be concise"
- "Explain at a 12-year-old reading level"
- "Only use the supplied rubric"

You did not teach them new permanent knowledge. You just asked better.

### RAG = Open-book exam

The model is smart, but it should answer using the specific handbook,
policy doc, or database record you hand it at runtime.

You are not retraining the model. You are letting it look things up.

### Fine-tuning = Training the employee into a specialist

Now you are changing habits:

- how they classify tickets
- how they speak in your brand voice
- how they map messy inputs to structured outputs

This is more durable than prompting, but slower and more expensive to change.

---

## Prompting

### What it is

You put instructions, examples, constraints, and context directly into the
prompt.

Examples:
- "Summarize this in 3 bullets"
- "Return valid JSON matching this schema"
- "You are a support triage assistant"
- "Here are 4 labeled examples; follow the pattern"

### Use prompting when

- The model already knows enough to do the task
- You mainly need better instructions
- You need a specific format or tone
- You want a fast, cheap first version

### Prompting works especially well for

- formatting
- extraction
- summarization
- light classification
- step-by-step instructions
- simple tool orchestration

### Prompting fails when

- the needed facts are not in the model
- the facts are private
- the facts change often
- the task requires highly consistent behavior across many edge cases

---

## RAG (Retrieval-Augmented Generation)

### What it is

At runtime, you retrieve relevant documents or records and add them to the
prompt so the model can answer from those materials.

Typical flow:

1. User asks a question
2. Your system searches docs/vector DB/database
3. You inject the most relevant results
4. The model answers using that context

### Use RAG when

- the knowledge changes often
- the knowledge is proprietary
- the model should cite or ground its answer
- you want answers tied to source material

### RAG works especially well for

- internal docs assistants
- policy and compliance Q&A
- support bots over product manuals
- search + answer systems
- enterprise knowledge assistants

### RAG fails when

- retrieval pulls the wrong chunks
- chunks are too big or too small
- the source documents are poor quality
- you actually needed behavior change, not knowledge injection

**Important:** Many "LLM failures" in RAG systems are really **retrieval failures**.

If the wrong passages are retrieved, the model is being asked to do the wrong
thing with the wrong evidence.

---

## Fine-Tuning

### What it is

You continue training a base model or instruction model on examples from your
task so it learns a more specialized behavior.

### Use fine-tuning when

- the same behavior is needed over and over
- prompt instructions are getting long and brittle
- you need consistent style or labeling behavior
- you have many good input/output examples

### Fine-tuning works especially well for

- classification with stable labels
- extraction with domain-specific formats
- brand voice / response style
- structured transformations
- reducing prompt size for repetitive tasks

### Fine-tuning is usually the wrong tool when

- your main problem is missing facts
- your source knowledge changes daily
- you do not have a clean dataset
- you have not already tried a strong prompt + RAG baseline

Fine-tuning knowledge into weights is like printing a wiki into a textbook.
The moment the wiki changes, the textbook is stale.

---

## Decision Table

| Problem | Best first move | Why |
|---------|-----------------|-----|
| "The answer should use our latest docs" | RAG | The facts are external and changing |
| "The answers are too verbose" | Prompting | This is behavior and formatting |
| "The model ignores our JSON schema sometimes" | Prompting first, then fine-tune if repeated | Start cheap; fine-tune for consistency |
| "We need classification labels to be extremely consistent" | Fine-tuning | Stable mapping from input to output |
| "We need answers over private PDFs" | RAG | The knowledge is private and dynamic |
| "We need the assistant to sound like our support team" | Prompting first, fine-tuning if needed | Style is behavior, not retrieval |
| "The product catalog changes every day" | RAG | Do not bake changing facts into weights |

---

## The Order to Try in Real Products

Most teams should try these in order:

1. **Prompting**
   Cheapest and fastest
2. **Prompting + structured output/tooling**
   Adds reliability without retraining
3. **Prompting + RAG**
   Adds current/private knowledge
4. **Fine-tuning**
   Use when you have clear repeated failures and a dataset

This order saves money and prevents premature complexity.

---

## A Simple Product Example

Imagine you are building a company IT help bot.

### If you only prompt

You can say:

"You are an IT support assistant. Be concise. Use bullet points."

That helps tone and structure, but it does not teach the bot your actual VPN
setup process.

### If you add RAG

Now the bot can read:

- VPN setup docs
- password reset policy
- device enrollment steps
- internal troubleshooting runbooks

This is usually the right next step.

### If you fine-tune

Now you can make the bot consistently:

- classify ticket type
- choose the right escalation category
- produce responses in your team's preferred style

The strongest production systems often use **all three**:

- prompt for role and format
- RAG for facts
- fine-tuning for repeated behavior

---

## Common Anti-Patterns

### Anti-pattern 1: Fine-tuning to add changing facts

Bad fit. Use RAG.

### Anti-pattern 2: Stuffing huge policy manuals into every prompt

Bad fit. Retrieve the relevant pieces instead.

### Anti-pattern 3: Blaming the model when retrieval is bad

If the retrieved context is irrelevant, missing, or contradictory, the model
is downstream of a search problem.

### Anti-pattern 4: Fine-tuning before you have a baseline

If you have not tested:

- a strong prompt
- structured output
- a solid retrieval pipeline

then you do not yet know whether fine-tuning is necessary.

---

## A Good Mental Checklist

Before picking a technique, ask:

1. Is my problem mostly **instructions**, **knowledge**, or **behavior**?
2. Does the needed information change often?
3. Do I need answers grounded in a source document?
4. Do I have a real training dataset, or just a hunch?
5. Am I solving a model problem, or a retrieval/product design problem?

If the answer is:

- **instructions** -> start with prompting
- **knowledge** -> start with RAG
- **stable repeated behavior** -> consider fine-tuning

---

## The Real-World Rule

Prompting, RAG, and fine-tuning are not rivals. They are layers.

- Prompting tells the model how to behave now
- RAG tells the model what evidence to use now
- Fine-tuning shapes how the model tends to behave in general

That framing will keep you out of most beginner mistakes.
