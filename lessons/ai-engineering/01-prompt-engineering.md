# 01 - Prompt Engineering

Think of an LLM like a brilliant new hire on their first day.
They know a lot, but they need clear instructions to do what
YOU need. Prompt engineering is writing those instructions.

---

## The Anatomy of a Prompt

```
+---------------------------------------------------+
|  SYSTEM PROMPT                                     |
|  "Who you are, how you behave"                     |
+---------------------------------------------------+
|  USER MESSAGE                                      |
|  "What I need right now"                           |
+---------------------------------------------------+
|  ASSISTANT RESPONSE                                |
|  "Here's what I produced"                          |
+---------------------------------------------------+
```

Like a job description (system) vs a task assignment (user).

---

## System Prompts

The system prompt sets the stage. It's the employee handbook
your AI reads before every conversation.

```python
from openai import OpenAI

client = OpenAI()

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[
        {
            "role": "system",
            "content": (
                "You are a senior Python developer. "
                "Give concise answers with code examples. "
                "Always mention edge cases."
            ),
        },
        {
            "role": "user",
            "content": "How do I merge two dictionaries?",
        },
    ],
)

print(response.choices[0].message.content)
```

**Good system prompts include:**

```
+------------------------+----------------------------------+
| Element                | Example                          |
+------------------------+----------------------------------+
| Role                   | "You are a tax accountant"       |
| Behavior rules         | "Always cite sources"            |
| Output format          | "Respond in bullet points"       |
| Constraints            | "Never give medical advice"      |
| Tone                   | "Be friendly but professional"   |
+------------------------+----------------------------------+
```

---

## Few-Shot Prompting

Instead of explaining what you want, SHOW the model examples.
Like training a dog: "Sit" + push butt down = learns "sit".

```python
from openai import OpenAI

client = OpenAI()

messages = [
    {
        "role": "system",
        "content": "Extract the product and sentiment from reviews.",
    },
    {
        "role": "user",
        "content": "The new MacBook Pro is incredible, best laptop I've owned.",
    },
    {
        "role": "assistant",
        "content": '{"product": "MacBook Pro", "sentiment": "positive"}',
    },
    {
        "role": "user",
        "content": "My AirPods died after 3 months. Total waste of money.",
    },
    {
        "role": "assistant",
        "content": '{"product": "AirPods", "sentiment": "negative"}',
    },
    {
        "role": "user",
        "content": "The iPad is okay I guess, nothing special.",
    },
]

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=messages,
)

print(response.choices[0].message.content)
```

**How many examples do you need?**

```
0-shot:  "Classify this review" ............... Works for simple tasks
1-shot:  One example .......................... Gets the format right
3-shot:  Three examples ....................... Handles edge cases
5+ shot: Five or more examples ................ Complex/nuanced tasks

More examples = more tokens = more cost
         Find the sweet spot
```

---

## Chain-of-Thought (CoT)

Asking the model to "think step by step" is like asking
someone to show their work on a math test. They make fewer
mistakes when they reason out loud.

```python
from openai import OpenAI

client = OpenAI()

bad_prompt = "Is 17 * 23 + 45 greater than 500?"

good_prompt = (
    "Is 17 * 23 + 45 greater than 500? "
    "Think through this step by step."
)

response = client.chat.completions.create(
    model="gpt-4o-mini",
    messages=[{"role": "user", "content": good_prompt}],
)

print(response.choices[0].message.content)
```

**When CoT helps most:**

```
+----------------------+----------+
| Task                 | CoT Help |
+----------------------+----------+
| Math problems        | +++      |
| Logic puzzles        | +++      |
| Multi-step reasoning | +++      |
| Simple classification| +        |
| Creative writing     | +        |
| Translation          | -        |
+----------------------+----------+
```

---

## Role Prompting

Give the model a character to play. A model told it's a
"senior security engineer" catches more vulnerabilities than
one told it's a "helpful assistant."

```python
from openai import OpenAI

client = OpenAI()

roles = [
    "You are a junior developer writing their first code review.",
    "You are a senior staff engineer with 20 years of experience.",
    "You are a security-focused code reviewer at a bank.",
]

code_to_review = """
def login(username, password):
    user = db.query(f"SELECT * FROM users WHERE name='{username}'")
    if user and user.password == password:
        return create_session(user)
    return None
"""

for role in roles:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": role},
            {
                "role": "user",
                "content": f"Review this code:\n{code_to_review}",
            },
        ],
    )
    print(f"\n{'='*50}")
    print(f"ROLE: {role[:50]}...")
    print(response.choices[0].message.content[:300])
```

---

## Prompt Templates

Don't hardcode prompts. Build reusable templates.

```python
from string import Template

REVIEW_TEMPLATE = Template(
    "You are a $role.\n"
    "Review the following $language code for $focus.\n"
    "Rate severity as: low, medium, high, critical.\n"
    "Format: JSON array of issues.\n\n"
    "Code:\n$code"
)

prompt = REVIEW_TEMPLATE.substitute(
    role="senior security engineer",
    language="Python",
    focus="SQL injection and authentication flaws",
    code="def login(u, p): ...",
)

print(prompt)
```

---

## The Prompt Engineering Ladder

```
Level 1: "Do the thing"
   |
   v
Level 2: "Do the thing, here's context"
   |
   v
Level 3: "You are X. Do the thing. Format it like Y."
   |
   v
Level 4: "You are X. Here are examples. Think step by step.
          Format like Y. Handle edge case Z."
   |
   v
Level 5: Automated prompt testing + version control
          (see Lesson 04)
```

---

## Common Patterns That Work

**Constraint stacking:**
```
Respond in exactly 3 bullet points.
Each bullet must be under 20 words.
Use no jargon.
```

**Output anchoring:**
```
Start your response with "ANALYSIS:" followed by...
```

**Negative constraints:**
```
Do NOT include disclaimers.
Do NOT use the word "delve".
Do NOT repeat the question back.
```

---

## Exercises

**Exercise 1: System Prompt Design**
Build three system prompts for:
- A customer support bot for a SaaS product
- A code reviewer that focuses on performance
- A writing assistant that matches a specific tone

Test each with 5 different user inputs. Which patterns
produce the most consistent outputs?

**Exercise 2: Few-Shot Classifier**
Build a sentiment classifier using few-shot prompting.
Give it 3 examples each of positive, negative, and neutral.
Test on 10 unlabeled reviews. Compare 3-shot vs 5-shot accuracy.

**Exercise 3: Chain-of-Thought vs Direct**
Take 10 word math problems. Run each through the model twice:
once with "answer directly" and once with "think step by step."
Track accuracy for both. What's the difference?

**Exercise 4: Build a Prompt Library**
Create a Python module `prompt_library.py` with:
- A `PromptTemplate` class that supports variables
- At least 5 reusable templates for common tasks
- A function to render a template with given variables

---

Next: [02 - Structured Outputs](02-structured-outputs.md)
