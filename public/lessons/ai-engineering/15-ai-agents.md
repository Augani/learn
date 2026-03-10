# 15 - AI Agents

An AI agent is an LLM that can DECIDE what to do and then
DO it. Regular LLMs answer questions. Agents take action.
It's the difference between a GPS that gives directions
and a self-driving car.

---

## Agent vs Chatbot

```
CHATBOT:                        AGENT:
User: "Book me a flight"        User: "Book me a flight"
Bot:  "Sure! Go to              Agent: [searches flights]
       expedia.com and..."             [compares prices]
                                       [selects best option]
                                       [fills booking form]
                                       "Done. Booked Delta
                                        flight 472 for $289."

Chatbot = TALKS about doing     Agent = DOES the thing
```

---

## The Agent Loop

```
+----------+
| Observe  |  <-- What does the world look like?
+----+-----+
     |
     v
+----------+
| Think    |  <-- What should I do next?
+----+-----+
     |
     v
+----------+
| Act      |  <-- Execute a tool/action
+----+-----+
     |
     v
+----------+
| Evaluate |  <-- Did it work? Am I done?
+----+-----+
     |
     +-------> If not done, go back to Observe
```

---

## The ReAct Pattern

ReAct = Reasoning + Acting. The model thinks out loud, then
acts, then observes the result. Like a detective narrating
their investigation.

```python
from openai import OpenAI
import json

client = OpenAI()

TOOLS = {
    "search": lambda q: f"Results for '{q}': Python was created by Guido van Rossum in 1991.",
    "calculate": lambda expr: str(eval(expr)),
    "get_date": lambda _: "2026-03-10",
}

TOOL_DESCRIPTIONS = [
    {
        "type": "function",
        "function": {
            "name": "search",
            "description": "Search for information",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "calculate",
            "description": "Evaluate a math expression",
            "parameters": {
                "type": "object",
                "properties": {"expression": {"type": "string"}},
                "required": ["expression"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_date",
            "description": "Get today's date",
            "parameters": {
                "type": "object",
                "properties": {},
            },
        },
    },
]

SYSTEM_PROMPT = (
    "You are a helpful agent that can use tools to answer questions. "
    "Think step by step. Use tools when you need information you "
    "don't have. Combine tool results to give a complete answer."
)


def run_agent(question: str, max_steps: int = 5) -> str:
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": question},
    ]

    for step in range(max_steps):
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=TOOL_DESCRIPTIONS,
        )

        choice = response.choices[0]

        if choice.finish_reason == "stop":
            return choice.message.content

        if choice.message.tool_calls:
            messages.append(choice.message)

            for tool_call in choice.message.tool_calls:
                func_name = tool_call.function.name
                args = json.loads(tool_call.function.arguments)

                print(f"  Step {step + 1}: {func_name}({args})")

                first_arg = next(iter(args.values()), "")
                tool_fn = TOOLS.get(func_name)

                if tool_fn is None:
                    result = f"Error: Unknown tool '{func_name}'"
                else:
                    try:
                        result = tool_fn(first_arg)
                    except Exception as exc:
                        result = f"Error: {exc}"

                messages.append({
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "content": result,
                })

    return "Agent reached max steps without completing."


answer = run_agent("How old is Python the programming language?")
print(f"\nAnswer: {answer}")
```

---

## Planning

Complex tasks need a plan before execution. Like a project
manager who breaks work into tasks before assigning them.

```python
from openai import OpenAI
import json

client = OpenAI()

PLANNER_PROMPT = """Break down this task into a numbered list of steps.
Each step should be a single, concrete action.
Output JSON: {"steps": ["step 1", "step 2", ...]}"""


def create_plan(task: str) -> list[str]:
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        response_format={"type": "json_object"},
        messages=[
            {"role": "system", "content": PLANNER_PROMPT},
            {"role": "user", "content": task},
        ],
    )

    result = json.loads(response.choices[0].message.content)
    return result.get("steps", [])


class PlanningAgent:
    def __init__(self):
        self.client = OpenAI()
        self.plan: list[str] = []
        self.completed: list[dict] = []

    def run(self, task: str) -> str:
        self.plan = create_plan(task)

        print("Plan:")
        for i, step in enumerate(self.plan):
            print(f"  {i + 1}. {step}")

        for i, step in enumerate(self.plan):
            print(f"\nExecuting step {i + 1}: {step}")
            result = self._execute_step(step)
            self.completed.append({"step": step, "result": result})
            print(f"  Result: {result[:100]}")

        return self._synthesize()

    def _execute_step(self, step: str) -> str:
        context = "\n".join(
            f"- {c['step']}: {c['result'][:100]}"
            for c in self.completed
        )

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Execute this step. Use previous results as context.",
                },
                {
                    "role": "user",
                    "content": f"Previous results:\n{context}\n\nCurrent step: {step}",
                },
            ],
        )

        return response.choices[0].message.content

    def _synthesize(self) -> str:
        all_results = "\n".join(
            f"Step: {c['step']}\nResult: {c['result']}"
            for c in self.completed
        )

        response = self.client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {
                    "role": "system",
                    "content": "Synthesize all step results into a final answer.",
                },
                {"role": "user", "content": all_results},
            ],
        )

        return response.choices[0].message.content
```

---

## Agent with Memory

Agents that remember previous interactions.

```python
class AgentMemory:
    def __init__(self, max_items: int = 100):
        self.short_term: list[dict] = []
        self.long_term: list[dict] = []
        self.max_items = max_items

    def add_interaction(self, query: str, result: str, importance: float = 0.5):
        entry = {
            "query": query,
            "result": result,
            "importance": importance,
        }
        self.short_term.append(entry)

        if importance > 0.7:
            self.long_term.append(entry)

        if len(self.short_term) > self.max_items:
            self.short_term = self.short_term[-self.max_items:]

    def get_relevant(self, query: str, top_k: int = 3) -> list[dict]:
        query_lower = query.lower()
        scored = []

        for entry in self.short_term + self.long_term:
            overlap = len(
                set(query_lower.split()) & set(entry["query"].lower().split())
            )
            scored.append((entry, overlap))

        scored.sort(key=lambda x: x[1], reverse=True)
        return [entry for entry, _ in scored[:top_k]]

    def get_context_string(self, query: str) -> str:
        relevant = self.get_relevant(query)
        if not relevant:
            return "No previous relevant interactions."

        parts = []
        for entry in relevant:
            parts.append(f"Q: {entry['query']}\nA: {entry['result'][:200]}")

        return "\n---\n".join(parts)
```

---

## Error Recovery

Real agents encounter errors. Good agents recover.

```python
class ResilientAgent:
    def __init__(self, max_retries: int = 3):
        self.client = OpenAI()
        self.max_retries = max_retries

    def execute_with_recovery(
        self,
        task: str,
        tools: dict,
        tool_descriptions: list,
    ) -> str:
        messages = [
            {
                "role": "system",
                "content": (
                    "You are an agent. If a tool call fails, analyze the "
                    "error and try a different approach. Never give up on "
                    "the first failure."
                ),
            },
            {"role": "user", "content": task},
        ]

        for attempt in range(self.max_retries * 3):
            response = self.client.chat.completions.create(
                model="gpt-4o-mini",
                messages=messages,
                tools=tool_descriptions,
            )

            choice = response.choices[0]

            if choice.finish_reason == "stop":
                return choice.message.content

            if choice.message.tool_calls:
                messages.append(choice.message)

                for tc in choice.message.tool_calls:
                    func_name = tc.function.name
                    args = json.loads(tc.function.arguments)
                    tool_fn = tools.get(func_name)

                    if tool_fn is None:
                        result = f"Error: Tool '{func_name}' not found."
                    else:
                        try:
                            result = tool_fn(**args)
                        except Exception as exc:
                            result = (
                                f"Error executing {func_name}: {exc}. "
                                "Try a different approach."
                            )

                    messages.append({
                        "role": "tool",
                        "tool_call_id": tc.id,
                        "content": str(result),
                    })

        return "Agent could not complete the task after multiple attempts."
```

---

## Agent Patterns Summary

```
+------------------+----------------------------------------+
| Pattern          | When to Use                            |
+------------------+----------------------------------------+
| Simple tool loop | Single question, few tools             |
| ReAct            | Need reasoning trace for debugging     |
| Plan-and-execute | Complex multi-step tasks               |
| Self-reflection  | Need quality checking on outputs       |
| Memory-augmented | Long-running conversations             |
+------------------+----------------------------------------+
```

---

## Exercises

**Exercise 1: Research Agent**
Build an agent with tools: web_search, summarize, save_note.
Given a topic, it should search for info, summarize findings,
and save a structured research note.

**Exercise 2: Data Analysis Agent**
Build an agent that takes a CSV file path, plans an analysis,
executes Python code to analyze the data, and returns insights
with numbers.

**Exercise 3: Agent with Guardrails**
Add safety checks to your agent: tool call limits (max 10),
cost tracking (stop at $0.50), and a list of forbidden actions.
Test that the guardrails actually trigger.

**Exercise 4: Agent Evaluator**
Build 10 test tasks for an agent. Run the agent on each.
Score: did it complete the task? How many steps? Any errors?
Create a scorecard.

---

Next: [16 - Function Calling & MCP](16-function-calling-mcp.md)
