# 16 - Function Calling & MCP

LLMs are great at thinking but can't DO anything alone.
Function calling gives them hands. MCP gives them a
universal adapter for any tool. Like giving a brain
access to arms, legs, and a toolbox.

---

## The Problem

```
  WITHOUT FUNCTION CALLING:
  User: "What's the weather in Tokyo?"
  LLM:  "I don't have real-time data, but typically..."
        (useless)

  WITH FUNCTION CALLING:
  User: "What's the weather in Tokyo?"
  LLM:  [calls get_weather("Tokyo")]
  Tool:  {"temp": 22, "condition": "cloudy"}
  LLM:  "It's 22C and cloudy in Tokyo right now."
        (actually useful)

  ┌────────────────────────────────────────────┐
  │  Function calling = LLM decides WHAT to    │
  │  call and with WHAT arguments.             │
  │  Your code actually EXECUTES the function. │
  │  LLM never runs code directly.             │
  └────────────────────────────────────────────┘
```

---

## How Function Calling Works

```
  STEP BY STEP
  ============

  1. You define available tools (JSON schema)
  2. User sends a message
  3. LLM decides to call a function (or not)
  4. LLM returns: function name + arguments (JSON)
  5. YOUR CODE executes the function
  6. You send the result back to the LLM
  7. LLM generates a natural language response

  ┌──────┐    ┌─────┐    ┌──────┐    ┌─────┐
  │ User │───>│ LLM │───>│ Your │───>│Tool │
  │      │    │     │    │ Code │    │     │
  │      │<───│     │<───│      │<───│     │
  └──────┘    └─────┘    └──────┘    └─────┘
               decides    executes    returns
               what       the call    data
```

---

## Defining Tool Schemas

```python
from openai import OpenAI
import json

client = OpenAI()

tools = [
    {
        "type": "function",
        "function": {
            "name": "get_weather",
            "description": "Get current weather for a city",
            "parameters": {
                "type": "object",
                "properties": {
                    "city": {
                        "type": "string",
                        "description": "City name, e.g. 'Tokyo' or 'San Francisco'",
                    },
                    "units": {
                        "type": "string",
                        "enum": ["celsius", "fahrenheit"],
                        "description": "Temperature units",
                    },
                },
                "required": ["city"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_database",
            "description": "Search the product database",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {"type": "string", "description": "Search query"},
                    "max_results": {"type": "integer", "description": "Max results to return"},
                    "category": {
                        "type": "string",
                        "enum": ["electronics", "clothing", "food", "other"],
                    },
                },
                "required": ["query"],
            },
        },
    },
]
```

---

## Executing Function Calls

```python
from openai import OpenAI
import json

client = OpenAI()

TOOL_REGISTRY = {
    "get_weather": lambda city, units="celsius": {
        "city": city,
        "temperature": 22 if units == "celsius" else 72,
        "condition": "partly cloudy",
        "units": units,
    },
    "search_database": lambda query, max_results=5, category=None: {
        "results": [
            {"name": f"Result {i+1} for '{query}'", "price": 9.99 + i * 10}
            for i in range(min(max_results, 3))
        ],
    },
}


def handle_tool_call(tool_call):
    func_name = tool_call.function.name
    args = json.loads(tool_call.function.arguments)

    func = TOOL_REGISTRY.get(func_name)
    if func is None:
        return json.dumps({"error": f"Unknown function: {func_name}"})

    try:
        result = func(**args)
        return json.dumps(result)
    except Exception as exc:
        return json.dumps({"error": str(exc)})


def chat_with_tools(user_message: str) -> str:
    messages = [{"role": "user", "content": user_message}]

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        tools=tools,
    )

    message = response.choices[0].message

    if message.tool_calls:
        messages.append(message)

        for tool_call in message.tool_calls:
            result = handle_tool_call(tool_call)
            messages.append({
                "role": "tool",
                "tool_call_id": tool_call.id,
                "content": result,
            })

        follow_up = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=tools,
        )
        return follow_up.choices[0].message.content

    return message.content


print(chat_with_tools("What's the weather in Tokyo?"))
print(chat_with_tools("Search for wireless headphones"))
```

---

## MCP: Model Context Protocol

```
  THE PROBLEM WITH FUNCTION CALLING
  ==================================

  Every LLM provider has a different tool format:
  - OpenAI: tools=[{...}]
  - Anthropic: tools=[{...}]  (slightly different)
  - Gemini: function_declarations=[{...}]

  Every tool needs custom integration code.
  N models * M tools = N*M integrations.

  MCP SOLUTION
  ============

  Universal protocol. Write a tool server ONCE,
  any MCP client can use it.

  ┌────────┐     ┌─────────────┐     ┌────────────┐
  │ Claude │────>│ MCP Protocol │────>│ Tool Server│
  │ GPT-4  │────>│  (standard)  │────>│ (any tool) │
  │ Llama  │────>│             │────>│            │
  └────────┘     └─────────────┘     └────────────┘

  N models + M tools = N + M integrations (not N*M)
```

---

## MCP Architecture

```
  MCP CLIENT                    MCP SERVER
  (LLM application)             (tool provider)
  ┌─────────────────┐           ┌─────────────────┐
  │                 │           │                 │
  │  Discovers      │  JSON-RPC │  Exposes        │
  │  available ────────────────>│  tools          │
  │  tools          │           │  resources      │
  │                 │           │  prompts        │
  │  Calls tools ──────────────>│                 │
  │                 │           │  Executes and   │
  │  Gets results <─────────────  returns results│
  │                 │           │                 │
  └─────────────────┘           └─────────────────┘

  Transport: stdio (local) or HTTP+SSE (remote)
```

---

## Building an MCP Server

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("my-tools")


@mcp.tool()
def get_weather(city: str, units: str = "celsius") -> dict:
    """Get current weather for a city."""
    temp = 22 if units == "celsius" else 72
    return {
        "city": city,
        "temperature": temp,
        "condition": "partly cloudy",
        "units": units,
    }


@mcp.tool()
def calculate(expression: str) -> dict:
    """Evaluate a mathematical expression safely."""
    allowed_chars = set("0123456789+-*/().% ")
    if not all(c in allowed_chars for c in expression):
        return {"error": "Invalid characters in expression"}

    try:
        result = eval(expression)
        return {"expression": expression, "result": result}
    except Exception as exc:
        return {"error": str(exc)}


@mcp.tool()
def search_files(directory: str, pattern: str) -> dict:
    """Search for files matching a pattern."""
    from pathlib import Path

    path = Path(directory)
    if not path.exists():
        return {"error": f"Directory not found: {directory}"}

    matches = list(path.rglob(pattern))[:20]
    return {"matches": [str(m) for m in matches], "count": len(matches)}


if __name__ == "__main__":
    mcp.run()
```

---

## MCP Resources and Prompts

```python
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("data-server")


@mcp.resource("config://app")
def get_app_config() -> str:
    """Application configuration."""
    return '{"debug": false, "version": "1.0.0", "max_retries": 3}'


@mcp.resource("data://users/{user_id}")
def get_user(user_id: str) -> str:
    """Get user data by ID."""
    import json
    users = {"1": {"name": "Alice", "role": "admin"}, "2": {"name": "Bob", "role": "user"}}
    user = users.get(user_id, {"error": "User not found"})
    return json.dumps(user)


@mcp.prompt()
def code_review(code: str, language: str = "python") -> str:
    """Generate a code review prompt."""
    return f"""Review this {language} code for:
1. Bugs and potential errors
2. Performance issues
3. Security vulnerabilities
4. Style and best practices

Code:
```{language}
{code}
```"""
```

---

## Tool Design Best Practices

```
  GOOD TOOL DESIGN
  ================

  1. CLEAR DESCRIPTIONS
     Bad:  "search" -> too vague
     Good: "Search product catalog by name, category, or price range"

  2. TYPED PARAMETERS
     Bad:  {"data": "anything"} -> LLM guesses format
     Good: {"city": "string", "units": "celsius|fahrenheit"}

  3. CONSTRAINED OUTPUTS
     Bad:  return entire database row
     Good: return only relevant fields

  4. ERROR MESSAGES FOR THE LLM
     Bad:  {"error": "SQLSTATE[42000]"}
     Good: {"error": "No products found matching 'xyz'. Try broader terms."}

  5. IDEMPOTENT WHEN POSSIBLE
     GET operations: always safe to retry
     POST operations: include dedup keys

  ┌───────────────────────────────────────────┐
  │  The LLM reads your tool descriptions     │
  │  to decide when and how to use them.      │
  │  Better descriptions = better tool use.   │
  └───────────────────────────────────────────┘
```

---

## Parallel and Sequential Tool Calls

```python
from openai import OpenAI
import json

client = OpenAI()


def process_tool_calls(response, tool_registry):
    message = response.choices[0].message

    if not message.tool_calls:
        return message.content, []

    results = []
    for tool_call in message.tool_calls:
        func_name = tool_call.function.name
        args = json.loads(tool_call.function.arguments)
        func = tool_registry.get(func_name)

        if func is None:
            result = {"error": f"Unknown tool: {func_name}"}
        else:
            try:
                result = func(**args)
            except Exception as exc:
                result = {"error": str(exc)}

        results.append({
            "role": "tool",
            "tool_call_id": tool_call.id,
            "content": json.dumps(result),
        })

    return None, results
```

---

## Security Considerations

```
  TOOL SECURITY CHECKLIST
  =======================
  ┌───┬──────────────────────────────────────────┐
  │ 1 │ Validate ALL inputs from the LLM         │
  │ 2 │ Never pass raw LLM output to eval/exec   │
  │ 3 │ Rate limit tool calls                     │
  │ 4 │ Sandbox file system access                │
  │ 5 │ Log all tool executions                   │
  │ 6 │ Use allowlists, not blocklists            │
  │ 7 │ Require confirmation for destructive ops  │
  │ 8 │ Set timeouts on all tool executions       │
  └───┴──────────────────────────────────────────┘
```

---

## Exercises

**Exercise 1: Multi-Tool Agent**
Build a function-calling agent with 5 tools: weather, calculator,
web search (mock), file reader, and note saver. Test with queries
that require combining multiple tools.

**Exercise 2: MCP Server**
Create an MCP server that exposes a SQLite database with tools
for querying, inserting, and summarizing data. Connect it to
Claude Desktop and test.

**Exercise 3: Tool Schema Design**
Design tool schemas for an e-commerce assistant: product search,
cart management, order tracking, and returns. Focus on clear
descriptions and proper typing.

**Exercise 4: Safety Layer**
Add a confirmation layer that intercepts destructive tool calls
(delete, update, send) and requires user approval before executing.

---

Next: [17 - Multi-Agent Systems](17-multi-agent-systems.md)
