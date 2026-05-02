# Lesson 11: State Management

## The Big Analogy: Restaurant Kitchen Organization

```
STATE MANAGEMENT = KITCHEN ORGANIZATION

  Local State (useState)           Server State (TanStack Query)
  = Chef's cutting board           = The pantry/fridge
  Private to one station           Shared inventory, fetched
  Disappears when done             as needed, can go stale

  Global State (Zustand/Jotai)     URL State (searchParams)
  = The order ticket rail          = The menu board
  Visible to all stations          Customers and staff see it
  Source of truth for orders       Shareable, bookmarkable
```

## When to Use What

```
DECISION TREE

  Is the state from a server/API?
       |
       YES --> TanStack Query (React Query)
       |
       NO
       |
  Does only one component need it?
       |
       YES --> useState / useReducer
       |
       NO
       |
  Is it in the URL (filter, page, search)?
       |
       YES --> URL search params
       |
       NO
       |
  Is it shared across many components?
       |
       YES --> Zustand (simple) or Jotai (atomic)
       |
       NO --> Lift state up to nearest parent
```

## Zustand: Simple Global State

```
ZUSTAND MENTAL MODEL

  +---------------------+
  |      STORE          |
  | {                   |
  |   count: 0,         |      Component A
  |   items: [],        | <--- useStore(s => s.count)
  |   increment() {},   |
  |   addItem() {}      |      Component B
  | }                   | <--- useStore(s => s.items)
  +---------------------+
                                Component C
  No Provider needed!     <--- useStore(s => s.increment)
  No boilerplate!
  Subscribe to slices = re-render only when YOUR slice changes
```

```typescript
import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

interface CartItem {
  id: string;
  name: string;
  price: number;
  quantity: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: Omit<CartItem, "quantity">) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
  clearCart: () => void;
  totalPrice: () => number;
  totalItems: () => number;
}

const useCartStore = create<CartStore>()(
  devtools(
    persist(
      (set, get) => ({
        items: [],

        addItem: (item) =>
          set((state) => {
            const existing = state.items.find((i) => i.id === item.id);
            if (existing) {
              return {
                items: state.items.map((i) =>
                  i.id === item.id
                    ? { ...i, quantity: i.quantity + 1 }
                    : i
                ),
              };
            }
            return { items: [...state.items, { ...item, quantity: 1 }] };
          }),

        removeItem: (id) =>
          set((state) => ({
            items: state.items.filter((i) => i.id !== id),
          })),

        updateQuantity: (id, quantity) =>
          set((state) => ({
            items:
              quantity <= 0
                ? state.items.filter((i) => i.id !== id)
                : state.items.map((i) =>
                    i.id === id ? { ...i, quantity } : i
                  ),
          })),

        clearCart: () => set({ items: [] }),

        totalPrice: () =>
          get().items.reduce(
            (sum, item) => sum + item.price * item.quantity,
            0
          ),

        totalItems: () =>
          get().items.reduce((sum, item) => sum + item.quantity, 0),
      }),
      { name: "cart-storage" }
    )
  )
);
```

### Using Zustand in Components

```tsx
function CartIcon() {
  const totalItems = useCartStore((state) => state.totalItems());
  return (
    <button>
      Cart ({totalItems})
    </button>
  );
}

function CartPage() {
  const items = useCartStore((state) => state.items);
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const totalPrice = useCartStore((state) => state.totalPrice());

  return (
    <div>
      {items.map((item) => (
        <div key={item.id}>
          <span>{item.name} - ${item.price} x {item.quantity}</span>
          <button onClick={() => updateQuantity(item.id, item.quantity - 1)}>
            -
          </button>
          <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>
            +
          </button>
          <button onClick={() => removeItem(item.id)}>Remove</button>
        </div>
      ))}
      <p>Total: ${totalPrice.toFixed(2)}</p>
    </div>
  );
}
```

## Jotai: Atomic State

```
JOTAI MENTAL MODEL

  Atoms are independent pieces of state.
  Derived atoms compute from other atoms.
  Components subscribe to specific atoms.

  [countAtom] --------+
                      |
  [nameAtom]  ----+   +--> [summaryAtom] (derived)
                  |
                  +--> [greetingAtom] (derived)

  Like a spreadsheet: cells reference other cells.
```

```typescript
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";

const darkModeAtom = atom(false);
const fontSizeAtom = atom(16);

const themeAtom = atom((get) => ({
  isDark: get(darkModeAtom),
  fontSize: get(fontSizeAtom),
  backgroundColor: get(darkModeAtom) ? "#1a1a1a" : "#ffffff",
  textColor: get(darkModeAtom) ? "#ffffff" : "#000000",
}));

const toggleDarkModeAtom = atom(null, (get, set) => {
  set(darkModeAtom, !get(darkModeAtom));
});

function ThemeToggle() {
  const toggleDarkMode = useSetAtom(toggleDarkModeAtom);
  const isDark = useAtomValue(darkModeAtom);

  return (
    <button onClick={toggleDarkMode}>
      {isDark ? "Light Mode" : "Dark Mode"}
    </button>
  );
}

function ThemedContent() {
  const theme = useAtomValue(themeAtom);

  return (
    <div
      style={{
        backgroundColor: theme.backgroundColor,
        color: theme.textColor,
        fontSize: theme.fontSize,
      }}
    >
      Themed content
    </div>
  );
}
```

## TanStack Query: Server State

```
TANSTACK QUERY MENTAL MODEL

  Component                    Cache                     Server
     |                           |                         |
     |-- useQuery("todos") ---->|                         |
     |                           |-- Is cache fresh? --+  |
     |                           |                     |  |
     |                           |  YES: return cached |  |
     |<-- cached data -----------|                     |  |
     |                           |                     |  |
     |                           |  NO: refetch -------+->|
     |                           |<--- fresh data --------|
     |<-- updated data ---------|                         |
     |                           |                         |

  Handles: loading, error, caching, refetching,
           pagination, optimistic updates, prefetching
```

```typescript
import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";

interface Todo {
  id: string;
  title: string;
  completed: boolean;
}

async function fetchTodos(): Promise<Todo[]> {
  const response = await fetch("/api/todos");
  if (!response.ok) {
    throw new Error(`Failed to fetch: ${response.status}`);
  }
  return response.json();
}

async function createTodo(title: string): Promise<Todo> {
  const response = await fetch("/api/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  });
  if (!response.ok) {
    throw new Error(`Failed to create: ${response.status}`);
  }
  return response.json();
}

function TodoList() {
  const queryClient = useQueryClient();

  const { data: todos, isPending, error } = useQuery({
    queryKey: ["todos"],
    queryFn: fetchTodos,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  const createMutation = useMutation({
    mutationFn: createTodo,
    onMutate: async (newTitle) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const previous = queryClient.getQueryData<Todo[]>(["todos"]);

      queryClient.setQueryData<Todo[]>(["todos"], (old) => [
        ...(old ?? []),
        { id: "temp", title: newTitle, completed: false },
      ]);

      return { previous };
    },
    onError: (_err, _newTitle, context) => {
      queryClient.setQueryData(["todos"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  if (isPending) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <button onClick={() => createMutation.mutate("New todo")}>
        Add Todo
      </button>
      {todos?.map((todo) => (
        <div key={todo.id}>{todo.title}</div>
      ))}
    </div>
  );
}
```

## Comparing Approaches

```
+--------------------+----------+----------+----------+----------+
| Feature            | useState | Zustand  | Jotai    | TanStack |
+--------------------+----------+----------+----------+----------+
| Scope              | Local    | Global   | Global   | Server   |
| Boilerplate        | Minimal  | Low      | Low      | Medium   |
| DevTools           | React    | Yes      | Yes      | Yes      |
| Persistence        | Manual   | Middleware| Plugin  | Cache    |
| SSR Support        | Built-in | Yes      | Yes      | Yes      |
| Bundle Size        | 0 KB     | ~1 KB    | ~2 KB    | ~12 KB   |
| Learning Curve     | None     | Low      | Low      | Medium   |
| Best For           | UI state | App state| Atomic   | API data |
+--------------------+----------+----------+----------+----------+
```

## Exercises

1. Build a Zustand store for a music player with: current track, playlist, play/pause/skip, volume, and shuffle mode. Components should only re-render when their subscribed slice changes.

2. Create a Jotai atom-based theme system with atoms for: color scheme, font size, spacing, and a derived atom that computes CSS variables.

3. Implement a TanStack Query setup for a blog: fetch posts list, fetch single post, create post with optimistic update, and infinite scroll pagination.

4. Refactor a component that uses `useState` for 5+ pieces of state into a `useReducer` with typed actions and a discriminated union.

5. Build a search feature: URL params store the query, TanStack Query fetches results, and Zustand stores UI preferences (view mode, sort order).

## Key Takeaways

```
+-------------------------------------------+
| STATE MANAGEMENT RULES                    |
|                                           |
| 1. Server state != client state           |
| 2. TanStack Query for anything from API  |
| 3. useState until you need more          |
| 4. Zustand when multiple components share|
| 5. URL state for shareable/bookmarkable  |
| 6. Don't put everything in global state  |
+-------------------------------------------+
```
