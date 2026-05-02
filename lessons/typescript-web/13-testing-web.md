# Lesson 13: Testing Web Applications

## The Big Analogy: Quality Control in Manufacturing

```
TESTING PYRAMID

             /\
            /  \          E2E (Playwright)
           / E2E\         Test the whole factory output
          /------\        Slow, expensive, catches big issues
         /Integr- \
        / ation    \      Integration (RTL + MSW)
       /------------\     Test components working together
      /    Unit      \
     /    Tests       \   Unit (Vitest)
    /------------------\  Test individual parts
                          Fast, cheap, catches small issues

  More tests at the bottom, fewer at the top.
  Bottom = fast + cheap. Top = slow + thorough.
```

## Vitest: Unit Testing

```
VITEST vs JEST

  Jest:                  Vitest:
  - Older, battle-tested - Vite-native, fast
  - Separate config      - Uses vite.config.ts
  - CommonJS first       - ESM first
  - Slower transforms    - Instant transforms
  - Same API!            - Drop-in replacement

  If you know Jest, you know Vitest.
```

### Configuration

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: ["node_modules/", "src/test/"],
    },
  },
});
```

```typescript
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => {
  cleanup();
});
```

### Unit Tests

```typescript
import { describe, it, expect } from "vitest";

interface CartItem {
  id: string;
  price: number;
  quantity: number;
}

function calculateTotal(items: CartItem[]): number {
  return items.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

function formatCurrency(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

describe("calculateTotal", () => {
  it("returns 0 for empty cart", () => {
    expect(calculateTotal([])).toBe(0);
  });

  it("sums single item correctly", () => {
    const items = [{ id: "1", price: 1000, quantity: 2 }];
    expect(calculateTotal(items)).toBe(2000);
  });

  it("sums multiple items", () => {
    const items = [
      { id: "1", price: 1000, quantity: 2 },
      { id: "2", price: 500, quantity: 3 },
    ];
    expect(calculateTotal(items)).toBe(3500);
  });
});

describe("formatCurrency", () => {
  it("formats cents to dollars", () => {
    expect(formatCurrency(1050)).toBe("$10.50");
  });

  it("handles zero", () => {
    expect(formatCurrency(0)).toBe("$0.00");
  });
});

describe("validateEmail", () => {
  it.each([
    ["user@example.com", true],
    ["name+tag@domain.co.uk", true],
    ["invalid", false],
    ["@missing.com", false],
    ["no@domain", false],
  ])("validates %s as %s", (email, expected) => {
    expect(validateEmail(email)).toBe(expected);
  });
});
```

## React Testing Library: Component Tests

```
RTL PHILOSOPHY

  Traditional:                  RTL:
  Test implementation            Test behavior
  "Does state update?"          "Does the user see the result?"
  "Was handler called?"         "Does clicking do what users expect?"

  Query Priority:
  1. getByRole        (accessible name)
  2. getByLabelText   (form fields)
  3. getByPlaceholder (fallback for forms)
  4. getByText        (visible text)
  5. getByTestId      (last resort)
```

```tsx
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

function TodoItem({
  todo,
  onToggle,
  onDelete,
}: {
  todo: Todo;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <li role="listitem">
      <label>
        <input
          type="checkbox"
          checked={todo.completed}
          onChange={() => onToggle(todo.id)}
        />
        <span style={{ textDecoration: todo.completed ? "line-through" : "none" }}>
          {todo.title}
        </span>
      </label>
      <button aria-label={`Delete ${todo.title}`} onClick={() => onDelete(todo.id)}>
        Delete
      </button>
    </li>
  );
}

describe("TodoItem", () => {
  const todo: Todo = { id: "1", title: "Write tests", completed: false };

  it("renders the todo title", () => {
    render(
      <TodoItem todo={todo} onToggle={vi.fn()} onDelete={vi.fn()} />
    );
    expect(screen.getByText("Write tests")).toBeInTheDocument();
  });

  it("calls onToggle when checkbox clicked", async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();

    render(
      <TodoItem todo={todo} onToggle={onToggle} onDelete={vi.fn()} />
    );

    await user.click(screen.getByRole("checkbox"));
    expect(onToggle).toHaveBeenCalledWith("1");
  });

  it("calls onDelete when delete button clicked", async () => {
    const user = userEvent.setup();
    const onDelete = vi.fn();

    render(
      <TodoItem todo={todo} onToggle={vi.fn()} onDelete={onDelete} />
    );

    await user.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledWith("1");
  });

  it("shows line-through when completed", () => {
    const completedTodo = { ...todo, completed: true };
    render(
      <TodoItem todo={completedTodo} onToggle={vi.fn()} onDelete={vi.fn()} />
    );

    expect(screen.getByText("Write tests")).toHaveStyle({
      textDecoration: "line-through",
    });
  });
});
```

## MSW: Mocking API Calls

```
MSW ARCHITECTURE

  Component --fetch()--> MSW Intercepts --> Returns mock data
                         (no real network)

  Your code thinks it's talking to a real server.
  MSW catches the request and returns controlled responses.
```

```typescript
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

interface User {
  id: string;
  name: string;
  email: string;
}

const mockUsers: User[] = [
  { id: "1", name: "Alice", email: "alice@example.com" },
  { id: "2", name: "Bob", email: "bob@example.com" },
];

const handlers = [
  http.get("/api/users", () => {
    return HttpResponse.json(mockUsers);
  }),

  http.get("/api/users/:id", ({ params }) => {
    const user = mockUsers.find((u) => u.id === params.id);
    if (!user) {
      return new HttpResponse(null, { status: 404 });
    }
    return HttpResponse.json(user);
  }),

  http.post("/api/users", async ({ request }) => {
    const body = (await request.json()) as Omit<User, "id">;
    const newUser: User = { id: "3", ...body };
    return HttpResponse.json(newUser, { status: 201 });
  }),
];

const server = setupServer(...handlers);

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
```

### Testing with MSW

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { describe, it, expect } from "vitest";
import { http, HttpResponse } from "msw";

function UserList() {
  const { data: users, isPending, error } = useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  if (isPending) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <ul>
      {users.map((user: User) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("UserList", () => {
  it("shows loading then users", async () => {
    renderWithProviders(<UserList />);

    expect(screen.getByText("Loading...")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText("Alice")).toBeInTheDocument();
      expect(screen.getByText("Bob")).toBeInTheDocument();
    });
  });

  it("shows error on failure", async () => {
    server.use(
      http.get("/api/users", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    renderWithProviders(<UserList />);
    await waitFor(() => {
      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });
});
```

## Playwright: End-to-End Testing

```typescript
import { test, expect } from "@playwright/test";

test.describe("Authentication", () => {
  test("user can sign in", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("user@example.com");
    await page.getByLabel("Password").fill("password123");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page).toHaveURL("/dashboard");
    await expect(
      page.getByRole("heading", { name: "Dashboard" })
    ).toBeVisible();
  });

  test("shows error for invalid credentials", async ({ page }) => {
    await page.goto("/login");

    await page.getByLabel("Email").fill("wrong@example.com");
    await page.getByLabel("Password").fill("wrong");
    await page.getByRole("button", { name: "Sign In" }).click();

    await expect(page.getByText("Invalid credentials")).toBeVisible();
    await expect(page).toHaveURL("/login");
  });
});

test.describe("Todo App", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/todos");
  });

  test("can add and complete a todo", async ({ page }) => {
    await page.getByPlaceholder("What needs to be done?").fill("Buy milk");
    await page.keyboard.press("Enter");

    const todoItem = page.getByText("Buy milk");
    await expect(todoItem).toBeVisible();

    await todoItem.locator("..").getByRole("checkbox").check();
    await expect(todoItem).toHaveCSS("text-decoration", /line-through/);
  });
});
```

## Exercises

1. Write Vitest unit tests for a `useDebounce` hook that delays value updates by a specified time. Test immediate value, debounced value after timeout, and reset on rapid changes.

2. Create a complete RTL test suite for a search form component: renders correctly, handles input, shows loading state, displays results, shows empty state, handles errors.

3. Set up MSW handlers for a CRUD API and write integration tests for a list component that fetches, creates, updates, and deletes items.

4. Write Playwright E2E tests for a multi-step form: fills step 1, navigates to step 2, goes back to verify step 1 data persists, completes all steps, verifies confirmation page.

5. Achieve 80% code coverage on a React component that has conditional rendering, error states, loading states, and user interactions.

## Key Takeaways

```
+-------------------------------------------+
| TESTING WEB APPS                          |
|                                           |
| 1. Test behavior, not implementation     |
| 2. Vitest for pure logic (fast)          |
| 3. RTL for component behavior            |
| 4. MSW for realistic API mocking         |
| 5. Playwright for critical user flows    |
| 6. More unit tests, fewer E2E tests      |
+-------------------------------------------+
```
