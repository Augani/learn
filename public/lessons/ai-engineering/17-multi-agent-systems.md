# 17 - Multi-Agent Systems

One agent is useful. Multiple agents working together can
tackle problems none could solve alone. Like a team of
specialists vs one generalist.

---

## Why Multiple Agents?

```
  SINGLE AGENT:                MULTI-AGENT:
  =============                ============

  One LLM does everything:     Specialized workers:
  - Research                   ┌──────────┐
  - Write code                 │ Researcher│ -> finds info
  - Review code                └──────────┘
  - Test code                  ┌──────────┐
  - Deploy                     │  Coder   │ -> writes code
                               └──────────┘
  Gets confused on complex     ┌──────────┐
  tasks. Context window fills  │ Reviewer │ -> reviews code
  up. Quality degrades.        └──────────┘
                               ┌──────────┐
                               │  Tester  │ -> runs tests
                               └──────────┘

  Each agent: focused prompt, right tools, clear role
```

---

## Agent Communication Patterns

```
  1. SEQUENTIAL (Pipeline)
  ========================
  Agent A -> Agent B -> Agent C -> Result

  Example: Research -> Draft -> Edit -> Publish

  2. HIERARCHICAL (Manager + Workers)
  ====================================
       ┌──────────┐
       │ Manager  │
       └──┬───┬───┘
          │   │
     ┌────┘   └────┐
     v             v
  ┌──────┐    ┌──────┐
  │Worker│    │Worker│
  │  A   │    │  B   │
  └──────┘    └──────┘

  3. COLLABORATIVE (Peer-to-Peer)
  ================================
  ┌──────┐ <---> ┌──────┐
  │Agent │       │Agent │
  │  A   │ <---> │  B   │
  └──────┘       └──────┘
      ^              ^
      |              |
      v              v
  ┌──────┐       ┌──────┐
  │Agent │ <---> │Agent │
  │  C   │       │  D   │
  └──────┘       └──────┘

  4. DEBATE (Adversarial)
  ========================
  Agent A argues FOR
  Agent B argues AGAINST
  Judge agent decides
```

---

## Sequential Pipeline

```python
from openai import OpenAI
import json

client = OpenAI()


def create_agent(name: str, system_prompt: str, model: str = "gpt-4o-mini"):
    def run(user_input: str) -> str:
        response = client.chat.completions.create(
            model=model,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_input},
            ],
        )
        result = response.choices[0].message.content
        print(f"[{name}] completed")
        return result
    return run


researcher = create_agent(
    "Researcher",
    "You are a research agent. Given a topic, provide key facts, "
    "statistics, and insights. Output structured bullet points.",
)

writer = create_agent(
    "Writer",
    "You are a technical writer. Given research notes, write a clear, "
    "engaging article. Use headers, examples, and analogies.",
)

editor = create_agent(
    "Editor",
    "You are a strict editor. Review the article for accuracy, clarity, "
    "and engagement. Fix issues and return the improved version.",
)


def content_pipeline(topic: str) -> str:
    research = researcher(f"Research this topic: {topic}")
    draft = writer(f"Write an article based on these notes:\n\n{research}")
    final = editor(f"Edit and improve this article:\n\n{draft}")
    return final


result = content_pipeline("How transformers work in AI")
print(result[:500])
```

---

## Hierarchical: Manager + Workers

```python
from openai import OpenAI
import json

client = OpenAI()


def manager_agent(task: str, worker_descriptions: list[dict]) -> list[dict]:
    worker_list = "\n".join(
        f"- {w['name']}: {w['description']}" for w in worker_descriptions
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {
                "role": "system",
                "content": (
                    "You are a project manager. Break the task into subtasks "
                    "and assign each to the best worker. Output JSON:\n"
                    '{"assignments": [{"worker": "name", "subtask": "description"}]}'
                ),
            },
            {
                "role": "user",
                "content": f"Task: {task}\n\nAvailable workers:\n{worker_list}",
            },
        ],
    )

    result = json.loads(response.choices[0].message.content)
    return result.get("assignments", [])


def worker_agent(name: str, expertise: str, subtask: str) -> str:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {
                "role": "system",
                "content": f"You are {name}, an expert in {expertise}. "
                           "Complete the assigned task thoroughly.",
            },
            {"role": "user", "content": subtask},
        ],
    )
    return response.choices[0].message.content


def run_hierarchical(task: str) -> dict:
    workers = [
        {"name": "DataAnalyst", "description": "Analyzes data, creates charts, finds patterns"},
        {"name": "MLEngineer", "description": "Builds and trains ML models"},
        {"name": "TechWriter", "description": "Writes documentation and reports"},
    ]

    assignments = manager_agent(task, workers)
    print(f"Manager created {len(assignments)} subtasks")

    results = {}
    for assignment in assignments:
        worker_name = assignment["worker"]
        subtask = assignment["subtask"]
        print(f"  {worker_name}: {subtask[:60]}...")

        worker = next((w for w in workers if w["name"] == worker_name), None)
        if worker is None:
            results[worker_name] = "Error: unknown worker"
            continue

        results[worker_name] = worker_agent(
            worker_name, worker["description"], subtask
        )

    return results


results = run_hierarchical("Analyze customer churn data and build a prediction model")
for worker, result in results.items():
    print(f"\n--- {worker} ---")
    print(result[:200])
```

---

## Debate Pattern

```python
from openai import OpenAI

client = OpenAI()


def debate(topic: str, rounds: int = 3) -> str:
    advocate = "You argue IN FAVOR of the position. Be persuasive with evidence."
    critic = "You argue AGAINST the position. Find weaknesses and counter-arguments."
    judge_prompt = (
        "You are an impartial judge. Review both sides of the debate "
        "and provide a balanced verdict with your reasoning."
    )

    history = []

    for round_num in range(rounds):
        for_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": advocate},
                {"role": "user", "content": f"Topic: {topic}\n\nDebate history:\n"
                                            + "\n".join(history)
                                            + "\n\nYour argument:"},
            ],
        )
        for_arg = for_response.choices[0].message.content
        history.append(f"FOR (Round {round_num + 1}): {for_arg}")

        against_response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": critic},
                {"role": "user", "content": f"Topic: {topic}\n\nDebate history:\n"
                                            + "\n".join(history)
                                            + "\n\nYour counter-argument:"},
            ],
        )
        against_arg = against_response.choices[0].message.content
        history.append(f"AGAINST (Round {round_num + 1}): {against_arg}")

    verdict = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": judge_prompt},
            {"role": "user", "content": f"Topic: {topic}\n\nFull debate:\n"
                                        + "\n\n".join(history)},
        ],
    )

    return verdict.choices[0].message.content


result = debate("Fine-tuning vs RAG for enterprise knowledge bases")
print(result)
```

---

## Agent State and Handoff

```python
from dataclasses import dataclass, field
from typing import Any


@dataclass
class AgentState:
    task: str
    current_agent: str = ""
    completed_steps: list[str] = field(default_factory=list)
    artifacts: dict[str, Any] = field(default_factory=dict)
    messages: list[dict] = field(default_factory=list)
    status: str = "pending"

    def add_step(self, agent: str, description: str, result: Any = None):
        self.completed_steps.append(f"[{agent}] {description}")
        if result is not None:
            self.artifacts[f"{agent}_{len(self.completed_steps)}"] = result

    def get_context(self, max_chars: int = 2000) -> str:
        context = f"Task: {self.task}\n"
        context += f"Completed steps:\n"
        for step in self.completed_steps:
            context += f"  - {step}\n"
        return context[:max_chars]


def handoff(state: AgentState, from_agent: str, to_agent: str, message: str):
    state.add_step(from_agent, f"Handing off to {to_agent}: {message}")
    state.current_agent = to_agent
    return state
```

---

## When to Use Multi-Agent

```
  USE MULTI-AGENT WHEN:
  ┌────────────────────────────────────────────────┐
  │  Task requires multiple distinct skills        │
  │  Single context window is not enough           │
  │  You need checks and balances (review)         │
  │  Parallel work is possible                     │
  │  Different subtasks need different models       │
  └────────────────────────────────────────────────┘

  USE SINGLE AGENT WHEN:
  ┌────────────────────────────────────────────────┐
  │  Task is straightforward                       │
  │  Latency matters (each agent = more API calls) │
  │  Context fits in one window                    │
  │  Coordination overhead > task complexity       │
  └────────────────────────────────────────────────┘

  COST COMPARISON
  ===============
  Single agent:  1-5 API calls per task
  Multi-agent:   5-50 API calls per task (3-10x cost)

  Use multi-agent only when quality gain justifies cost.
```

---

## Exercises

**Exercise 1: Code Review Pipeline**
Build a 3-agent pipeline: Coder (writes code from spec),
Reviewer (finds bugs and issues), Fixer (applies fixes).
Run it on 3 different coding tasks and measure quality.

**Exercise 2: Research Team**
Build a hierarchical system with a Manager that delegates
research subtasks to specialized agents (WebSearcher,
DataAnalyzer, Summarizer). Test on a complex research question.

**Exercise 3: Debate for Better Answers**
Implement the debate pattern. Compare answer quality between
a single-agent response and a 3-round debate response on
5 controversial technical topics.

**Exercise 4: Agent Routing**
Build a router agent that classifies incoming requests and
routes them to the right specialist agent (CodeAgent,
WritingAgent, AnalysisAgent, GeneralAgent). Measure routing
accuracy on 20 diverse test queries.

---

Next: [18 - Production AI Apps](18-production-ai-apps.md)
