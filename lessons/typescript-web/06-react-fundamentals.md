# Lesson 06: React Fundamentals

## What Is React?

React is a library for building UIs from components. Think of components
like Rust structs that implement `Display` — they describe what to render
based on their data.

```
  REACT MENTAL MODEL
  ==================

  Component = f(props, state) => UI

  +------------+     +----------+     +--------+
  | Props      |---->|          |---->| Virtual |---->  DOM
  | (input)    |     | Component|     | DOM     |     (screen)
  +------------+     |          |     +--------+
  | State      |---->|          |
  | (internal) |     +----------+
  +------------+

  Like a pure function: same inputs = same output.
  React diffs the virtual DOM and patches the real DOM.
```

## JSX: HTML in TypeScript

JSX looks like HTML but compiles to function calls.
Think of it as a template DSL embedded in TypeScript.

```tsx
function Greeting({ name }: { name: string }): JSX.Element {
  return (
    <div>
      <h1>Hello, {name}!</h1>
      <p>Welcome to React.</p>
    </div>
  );
}
```

What JSX compiles to:

```typescript
React.createElement("div", null,
  React.createElement("h1", null, "Hello, ", name, "!"),
  React.createElement("p", null, "Welcome to React.")
);
```

## Components and Props

Props are like function arguments. They flow down, never up.

```tsx
interface ButtonProps {
  label: string;
  variant: "primary" | "secondary" | "danger";
  disabled?: boolean;
  onClick: () => void;
}

function Button({ label, variant, disabled = false, onClick }: ButtonProps): JSX.Element {
  const baseClass = "px-4 py-2 rounded font-medium";
  const variantClass: Record<ButtonProps["variant"], string> = {
    primary: "bg-blue-500 text-white",
    secondary: "bg-gray-200 text-gray-800",
    danger: "bg-red-500 text-white",
  };

  return (
    <button
      className={`${baseClass} ${variantClass[variant]}`}
      disabled={disabled}
      onClick={onClick}
    >
      {label}
    </button>
  );
}
```

```
  PROPS FLOW (one-way data flow)
  ==============================

  Parent
    |
    +--[props]--> Child A
    |               |
    |               +--[props]--> Grandchild
    |
    +--[props]--> Child B

  Data flows DOWN. Events flow UP (via callback props).
```

## Children Props

```tsx
interface CardProps {
  title: string;
  children: React.ReactNode;
}

function Card({ title, children }: CardProps): JSX.Element {
  return (
    <div className="border rounded-lg p-4 shadow">
      <h2 className="text-xl font-bold mb-2">{title}</h2>
      <div>{children}</div>
    </div>
  );
}

function App(): JSX.Element {
  return (
    <Card title="User Profile">
      <p>Name: Alice</p>
      <p>Role: Admin</p>
    </Card>
  );
}
```

## useState: Managing State

State is component-local data that persists across renders.
Like a mutable variable inside a struct, but each change triggers re-render.

```tsx
import { useState } from "react";

function Counter(): JSX.Element {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>Increment</button>
      <button onClick={() => setCount((prev) => prev - 1)}>Decrement</button>
      <button onClick={() => setCount(0)}>Reset</button>
    </div>
  );
}
```

```
  useState FLOW
  =============

  const [value, setValue] = useState(initialValue)
         |         |
         |         +-- function to update (triggers re-render)
         |
         +-- current value (read-only reference)

  setValue(newValue)      <-- replace
  setValue(prev => ...)   <-- update based on previous (preferred)
```

### Typed State

```tsx
interface Todo {
  id: number;
  text: string;
  done: boolean;
}

function TodoList(): JSX.Element {
  const [todos, setTodos] = useState<Todo[]>([]);
  const [input, setInput] = useState("");

  const addTodo = (): void => {
    if (input.trim() === "") return;
    const newTodo: Todo = {
      id: Date.now(),
      text: input.trim(),
      done: false,
    };
    setTodos((prev) => [...prev, newTodo]);
    setInput("");
  };

  const toggleTodo = (id: number): void => {
    setTodos((prev) =>
      prev.map((todo) =>
        todo.id === id ? { ...todo, done: !todo.done } : todo
      )
    );
  };

  return (
    <div>
      <div>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addTodo()}
          placeholder="Add a todo..."
        />
        <button onClick={addTodo}>Add</button>
      </div>
      <ul>
        {todos.map((todo) => (
          <li
            key={todo.id}
            onClick={() => toggleTodo(todo.id)}
            style={{ textDecoration: todo.done ? "line-through" : "none" }}
          >
            {todo.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## useEffect: Side Effects

`useEffect` runs code after render — for fetching data, subscriptions,
or DOM manipulation. Think of it as `componentDidMount` + `componentDidUpdate`.

```tsx
import { useState, useEffect } from "react";

interface User {
  id: number;
  name: string;
  email: string;
}

function UserProfile({ userId }: { userId: number }): JSX.Element {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function fetchUser(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/users/${userId}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data: User = await res.json();
        setUser(data);
      } catch (err) {
        if (err instanceof Error && err.name !== "AbortError") {
          setError(err.message);
        }
      } finally {
        setLoading(false);
      }
    }

    fetchUser();
    return () => controller.abort();
  }, [userId]);

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!user) return <p>No user found</p>;

  return (
    <div>
      <h2>{user.name}</h2>
      <p>{user.email}</p>
    </div>
  );
}
```

```
  useEffect LIFECYCLE
  ===================

  useEffect(effectFn, deps)
                |        |
                |        +-- dependency array
                |            [] = run once (mount)
                |            [x] = run when x changes
                |            omitted = run every render
                |
                +-- effect function
                    returns cleanup function (optional)

  Mount:    effect runs
  Update:   cleanup runs, then effect runs
  Unmount:  cleanup runs
```

## useRef: Mutable References

`useRef` holds a value that persists across renders without triggering
re-renders. Like a `&mut T` that doesn't cause recomputation.

```tsx
import { useRef, useEffect } from "react";

function AutoFocusInput(): JSX.Element {
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  return <input ref={inputRef} placeholder="I auto-focus!" />;
}

function StopWatch(): JSX.Element {
  const [elapsed, setElapsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const start = (): void => {
    if (intervalRef.current !== null) return;
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  };

  const stop = (): void => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stop();
  }, []);

  return (
    <div>
      <p>{elapsed}s</p>
      <button onClick={start}>Start</button>
      <button onClick={stop}>Stop</button>
    </div>
  );
}
```

## Conditional Rendering

```tsx
function StatusBadge({ status }: { status: "online" | "offline" | "away" }): JSX.Element {
  return (
    <span>
      {status === "online" && <span className="text-green-500">Online</span>}
      {status === "offline" && <span className="text-gray-500">Offline</span>}
      {status === "away" && <span className="text-yellow-500">Away</span>}
    </span>
  );
}
```

## Lists and Keys

```tsx
interface Item {
  id: string;
  name: string;
}

function ItemList({ items }: { items: Item[] }): JSX.Element {
  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.name}</li>
      ))}
    </ul>
  );
}
```

Keys must be stable, unique identifiers. Never use array index as key
if the list can reorder.

## Exercises

1. Build a `SearchFilter` component with an input field that filters a list of items in real time. Use `useState` for the search term and filter with `.filter()`.

2. Create a `Timer` component that counts up every second, with Start, Stop, and Reset buttons. Use `useState`, `useEffect`, and `useRef`.

3. Build a `FetchList` component that fetches data from a URL prop, shows loading/error states, and renders the results. Include proper cleanup with `AbortController`.

4. Create a `Tabs` component that accepts an array of `{ label: string; content: React.ReactNode }` and renders a tabbed interface. Only the active tab's content should render.

5. Build a `Form` component with name, email, and message fields. Validate on submit (all required, email must contain @). Show inline error messages.

---

[← Lesson 05](./05-node-runtime.md) | [Next: Lesson 07 - React Patterns →](./07-react-patterns.md)
