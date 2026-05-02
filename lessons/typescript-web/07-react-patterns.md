# Lesson 07: React Patterns

## Custom Hooks: Reusable Logic

Custom hooks extract stateful logic into reusable functions.
Think of them like Go's middleware pattern — wrap behavior, not UI.

```
  CUSTOM HOOK PATTERN
  ===================

  Component A ---+
                 |
  Component B ---+---> useCustomHook() ---> shared logic
                 |
  Component C ---+

  Same logic, different UIs. The hook manages state;
  each component decides how to render it.
```

### useFetch Hook

```tsx
import { useState, useEffect, useCallback } from "react";

interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

function useFetch<T>(url: string): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const result: T = await response.json();
      setData(result);
    } catch (err) {
      if (err instanceof Error && err.name !== "AbortError") {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }

    return () => controller.abort();
  }, [url]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}

function UserList(): JSX.Element {
  const { data, loading, error } = useFetch<{ name: string }[]>("/api/users");

  if (loading) return <p>Loading...</p>;
  if (error) return <p>Error: {error}</p>;
  if (!data) return <p>No data</p>;

  return (
    <ul>
      {data.map((user, i) => (
        <li key={i}>{user.name}</li>
      ))}
    </ul>
  );
}
```

### useLocalStorage Hook

```tsx
import { useState, useEffect } from "react";

function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T) => void] {
  const [stored, setStored] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item !== null ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(key, JSON.stringify(stored));
    } catch {
      console.error("Failed to write to localStorage");
    }
  }, [key, stored]);

  return [stored, setStored];
}

function Settings(): JSX.Element {
  const [theme, setTheme] = useLocalStorage<"light" | "dark">("theme", "light");

  return (
    <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>
      Current: {theme}
    </button>
  );
}
```

### useDebounce Hook

```tsx
import { useState, useEffect } from "react";

function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}

function Search(): JSX.Element {
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebounce(query, 300);

  useEffect(() => {
    if (debouncedQuery) {
      console.log("Searching for:", debouncedQuery);
    }
  }, [debouncedQuery]);

  return (
    <input
      value={query}
      onChange={(e) => setQuery(e.target.value)}
      placeholder="Search..."
    />
  );
}
```

## Context: Dependency Injection

Context is React's dependency injection. Like Go's `context.Context` but for
component trees. Avoids "prop drilling" — passing props through many layers.

```
  WITHOUT CONTEXT (prop drilling)     WITH CONTEXT
  ===============================     ============

  App [theme]                         App
    |                                   |
    +--Layout [theme]                  ThemeProvider [theme]
         |                               |
         +--Sidebar [theme]             Layout
              |                           |
              +--Button [theme]          Sidebar
                                          |
                                         Button <-- useContext(ThemeCtx)
```

```tsx
import { createContext, useContext, useState, ReactNode } from "react";

interface ThemeContextType {
  theme: "light" | "dark";
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function useTheme(): ThemeContextType {
  const context = useContext(ThemeContext);
  if (context === null) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}

function ThemeProvider({ children }: { children: ReactNode }): JSX.Element {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const toggle = (): void => {
    setTheme((prev) => (prev === "light" ? "dark" : "light"));
  };

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

function ThemedButton(): JSX.Element {
  const { theme, toggle } = useTheme();

  return (
    <button
      onClick={toggle}
      className={theme === "dark" ? "bg-gray-800 text-white" : "bg-white text-black"}
    >
      Toggle ({theme})
    </button>
  );
}
```

## Compound Components

Compound components share implicit state. Think of `<select>` and `<option>` —
they work together without explicit wiring.

```tsx
import { createContext, useContext, useState, ReactNode } from "react";

interface AccordionContextType {
  openIndex: number | null;
  toggle: (index: number) => void;
}

const AccordionContext = createContext<AccordionContextType | null>(null);

function useAccordion(): AccordionContextType {
  const ctx = useContext(AccordionContext);
  if (!ctx) throw new Error("Must be inside Accordion");
  return ctx;
}

function Accordion({ children }: { children: ReactNode }): JSX.Element {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  const toggle = (index: number): void => {
    setOpenIndex((prev) => (prev === index ? null : index));
  };

  return (
    <AccordionContext.Provider value={{ openIndex, toggle }}>
      <div className="divide-y">{children}</div>
    </AccordionContext.Provider>
  );
}

function AccordionItem({
  index,
  title,
  children,
}: {
  index: number;
  title: string;
  children: ReactNode;
}): JSX.Element {
  const { openIndex, toggle } = useAccordion();
  const isOpen = openIndex === index;

  return (
    <div>
      <button onClick={() => toggle(index)} className="w-full text-left p-4 font-medium">
        {title} {isOpen ? "▲" : "▼"}
      </button>
      {isOpen && <div className="p-4">{children}</div>}
    </div>
  );
}

function App(): JSX.Element {
  return (
    <Accordion>
      <AccordionItem index={0} title="Section 1">
        <p>Content for section 1</p>
      </AccordionItem>
      <AccordionItem index={1} title="Section 2">
        <p>Content for section 2</p>
      </AccordionItem>
    </Accordion>
  );
}
```

## Render Props

Pass rendering logic as a function prop. Useful when a component
manages logic but the parent decides what to show.

```tsx
interface MousePosition {
  x: number;
  y: number;
}

function MouseTracker({
  render,
}: {
  render: (pos: MousePosition) => JSX.Element;
}): JSX.Element {
  const [position, setPosition] = useState<MousePosition>({ x: 0, y: 0 });

  return (
    <div
      onMouseMove={(e) => setPosition({ x: e.clientX, y: e.clientY })}
      style={{ height: "100vh" }}
    >
      {render(position)}
    </div>
  );
}

function App(): JSX.Element {
  return (
    <MouseTracker
      render={({ x, y }) => (
        <p>
          Mouse at ({x}, {y})
        </p>
      )}
    />
  );
}
```

## Higher-Order Components (HOC)

Wrap a component to add behavior. Less common now (hooks are preferred),
but you'll see them in older codebases.

```tsx
function withLoading<P extends object>(
  Component: React.ComponentType<P>
): React.FC<P & { loading: boolean }> {
  return function WithLoadingComponent({ loading, ...props }) {
    if (loading) return <p>Loading...</p>;
    return <Component {...(props as P)} />;
  };
}

function UserCard({ name }: { name: string }): JSX.Element {
  return <div>{name}</div>;
}

const UserCardWithLoading = withLoading(UserCard);
```

## Reducer Pattern: useReducer

For complex state logic, `useReducer` is like a mini Redux.
Think of it as a state machine — events come in, state transitions happen.

```tsx
import { useReducer } from "react";

interface State {
  items: string[];
  input: string;
  filter: "all" | "active" | "done";
}

type Action =
  | { type: "SET_INPUT"; payload: string }
  | { type: "ADD_ITEM" }
  | { type: "REMOVE_ITEM"; payload: number }
  | { type: "SET_FILTER"; payload: State["filter"] };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case "SET_INPUT":
      return { ...state, input: action.payload };
    case "ADD_ITEM":
      if (state.input.trim() === "") return state;
      return { ...state, items: [...state.items, state.input.trim()], input: "" };
    case "REMOVE_ITEM":
      return { ...state, items: state.items.filter((_, i) => i !== action.payload) };
    case "SET_FILTER":
      return { ...state, filter: action.payload };
  }
}

function ItemManager(): JSX.Element {
  const [state, dispatch] = useReducer(reducer, {
    items: [],
    input: "",
    filter: "all",
  });

  return (
    <div>
      <input
        value={state.input}
        onChange={(e) => dispatch({ type: "SET_INPUT", payload: e.target.value })}
      />
      <button onClick={() => dispatch({ type: "ADD_ITEM" })}>Add</button>
      <ul>
        {state.items.map((item, i) => (
          <li key={i}>
            {item}
            <button onClick={() => dispatch({ type: "REMOVE_ITEM", payload: i })}>×</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Exercises

1. Create a `useMediaQuery(query: string): boolean` hook that returns whether a CSS media query matches. Use `window.matchMedia`.

2. Build a compound `Tabs` component with `<Tabs>`, `<TabList>`, `<Tab>`, and `<TabPanel>` sub-components that share state via context.

3. Write a `useAsync<T>(asyncFn: () => Promise<T>)` hook that tracks `data`, `loading`, `error` states and provides a `run` function.

4. Create an `AuthProvider` context that manages user login state, provides `login`, `logout` functions, and protects routes with a `RequireAuth` wrapper component.

5. Implement a notification system using context: `NotificationProvider`, `useNotification` hook, and a `NotificationList` component that auto-dismisses notifications after 5 seconds.

---

[← Lesson 06](./06-react-fundamentals.md) | [Next: Lesson 08 - Next.js Fundamentals →](./08-nextjs-fundamentals.md)
