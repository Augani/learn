# Reference: Common React Patterns

## Component Patterns

### Compound Components

```tsx
import { createContext, useContext, useState, type ReactNode } from "react";

interface TabsContextType {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

function useTabs(): TabsContextType {
  const context = useContext(TabsContext);
  if (!context) throw new Error("useTabs must be used within Tabs");
  return context;
}

function Tabs({ defaultTab, children }: { defaultTab: string; children: ReactNode }) {
  const [activeTab, setActiveTab] = useState(defaultTab);
  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div>{children}</div>
    </TabsContext.Provider>
  );
}

function TabList({ children }: { children: ReactNode }) {
  return <div role="tablist" className="flex gap-2 border-b">{children}</div>;
}

function Tab({ value, children }: { value: string; children: ReactNode }) {
  const { activeTab, setActiveTab } = useTabs();
  return (
    <button
      role="tab"
      aria-selected={activeTab === value}
      onClick={() => setActiveTab(value)}
      className={activeTab === value ? "border-b-2 border-blue-500 font-bold" : ""}
    >
      {children}
    </button>
  );
}

function TabPanel({ value, children }: { value: string; children: ReactNode }) {
  const { activeTab } = useTabs();
  if (activeTab !== value) return null;
  return <div role="tabpanel">{children}</div>;
}

// Usage:
// <Tabs defaultTab="overview">
//   <TabList>
//     <Tab value="overview">Overview</Tab>
//     <Tab value="settings">Settings</Tab>
//   </TabList>
//   <TabPanel value="overview">Overview content</TabPanel>
//   <TabPanel value="settings">Settings content</TabPanel>
// </Tabs>
```

### Render Props

```tsx
interface DataFetcherProps<T> {
  url: string;
  children: (data: {
    data: T | undefined;
    loading: boolean;
    error: Error | null;
  }) => ReactNode;
}

function DataFetcher<T>({ url, children }: DataFetcherProps<T>) {
  const [data, setData] = useState<T>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    fetch(url)
      .then((res) => res.json())
      .then(setData)
      .catch(setError)
      .finally(() => setLoading(false));
  }, [url]);

  return <>{children({ data, loading, error })}</>;
}

// Usage:
// <DataFetcher<User[]> url="/api/users">
//   {({ data, loading, error }) => {
//     if (loading) return <Spinner />;
//     if (error) return <Error message={error.message} />;
//     return <UserList users={data!} />;
//   }}
// </DataFetcher>
```

### Polymorphic Components

```tsx
type AsProp<C extends React.ElementType> = { as?: C };

type PropsToOmit<C extends React.ElementType, P> = keyof (AsProp<C> & P);

type PolymorphicProps<
  C extends React.ElementType,
  Props = object,
> = Props &
  AsProp<C> &
  Omit<React.ComponentPropsWithoutRef<C>, PropsToOmit<C, Props>>;

interface TextOwnProps {
  size?: "sm" | "md" | "lg";
  weight?: "normal" | "bold";
}

function Text<C extends React.ElementType = "span">({
  as,
  size = "md",
  weight = "normal",
  className = "",
  ...props
}: PolymorphicProps<C, TextOwnProps>) {
  const Component = as ?? "span";
  const sizeClass = { sm: "text-sm", md: "text-base", lg: "text-lg" }[size];
  const weightClass = { normal: "font-normal", bold: "font-bold" }[weight];

  return (
    <Component
      className={`${sizeClass} ${weightClass} ${className}`}
      {...props}
    />
  );
}

// <Text>Default span</Text>
// <Text as="h1" size="lg" weight="bold">Heading</Text>
// <Text as="a" href="/about">Link</Text>
```

## Hook Patterns

### Custom Hook with Return Type

```tsx
function useToggle(initial = false) {
  const [value, setValue] = useState(initial);

  const toggle = useCallback(() => setValue((v) => !v), []);
  const setTrue = useCallback(() => setValue(true), []);
  const setFalse = useCallback(() => setValue(false), []);

  return { value, toggle, setTrue, setFalse } as const;
}

function useLocalStorage<T>(key: string, initialValue: T) {
  const [stored, setStored] = useState<T>(() => {
    if (typeof window === "undefined") return initialValue;
    const item = window.localStorage.getItem(key);
    return item ? (JSON.parse(item) as T) : initialValue;
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setStored((prev) => {
        const next = value instanceof Function ? value(prev) : value;
        window.localStorage.setItem(key, JSON.stringify(next));
        return next;
      });
    },
    [key]
  );

  return [stored, setValue] as const;
}
```

### Debounced Value Hook

```tsx
function useDebounce<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);

    function handler(e: MediaQueryListEvent) {
      setMatches(e.matches);
    }

    media.addEventListener("change", handler);
    return () => media.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
```

## Data Fetching Patterns

### Optimistic Updates

```tsx
function useOptimisticTodos() {
  const queryClient = useQueryClient();

  const toggleMutation = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const res = await fetch(`/api/todos/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ completed }),
      });
      return res.json();
    },
    onMutate: async ({ id, completed }) => {
      await queryClient.cancelQueries({ queryKey: ["todos"] });
      const previous = queryClient.getQueryData<Todo[]>(["todos"]);

      queryClient.setQueryData<Todo[]>(["todos"], (old) =>
        old?.map((t) => (t.id === id ? { ...t, completed } : t))
      );

      return { previous };
    },
    onError: (_err, _vars, context) => {
      queryClient.setQueryData(["todos"], context?.previous);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
    },
  });

  return { toggleMutation };
}
```

### Infinite Scroll

```tsx
function useInfiniteProducts() {
  return useInfiniteQuery({
    queryKey: ["products"],
    queryFn: async ({ pageParam }) => {
      const res = await fetch(`/api/products?cursor=${pageParam}&limit=20`);
      return res.json() as Promise<{
        items: Product[];
        nextCursor: string | null;
      }>;
    },
    initialPageParam: "",
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
}

function ProductList() {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useInfiniteProducts();

  const observerRef = useRef<IntersectionObserver>();
  const lastElementRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (isFetchingNextPage) return;
      if (observerRef.current) observerRef.current.disconnect();

      observerRef.current = new IntersectionObserver((entries) => {
        if (entries[0]?.isIntersecting && hasNextPage) {
          fetchNextPage();
        }
      });

      if (node) observerRef.current.observe(node);
    },
    [isFetchingNextPage, hasNextPage, fetchNextPage]
  );

  const products = data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <div>
      {products.map((product, index) => (
        <div
          key={product.id}
          ref={index === products.length - 1 ? lastElementRef : undefined}
        >
          {product.name}
        </div>
      ))}
      {isFetchingNextPage && <p>Loading more...</p>}
    </div>
  );
}
```

## Form Patterns

### Controlled Form with Validation

```tsx
import { useForm, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const formSchema = z.object({
  name: z.string().min(1, "Required").max(100),
  email: z.string().email("Invalid email"),
  role: z.enum(["admin", "editor", "viewer"]),
  bio: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof formSchema>;

function UserForm({ onSubmit }: { onSubmit: SubmitHandler<FormValues> }) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { role: "viewer" },
  });

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" {...register("name")} />
        {errors.name && <span role="alert">{errors.name.message}</span>}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register("email")} />
        {errors.email && <span role="alert">{errors.email.message}</span>}
      </div>

      <div>
        <label htmlFor="role">Role</label>
        <select id="role" {...register("role")}>
          <option value="viewer">Viewer</option>
          <option value="editor">Editor</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
```

## Error Boundary

```tsx
import { Component, type ReactNode } from "react";

interface ErrorBoundaryProps {
  fallback: ReactNode | ((error: Error) => ReactNode);
  children: ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  render() {
    if (this.state.error) {
      const { fallback } = this.props;
      return typeof fallback === "function"
        ? fallback(this.state.error)
        : fallback;
    }
    return this.props.children;
  }
}

// <ErrorBoundary fallback={(err) => <p>Error: {err.message}</p>}>
//   <RiskyComponent />
// </ErrorBoundary>
```

## Layout Patterns

```tsx
function PageLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen flex flex-col">
      <header className="h-16 border-b flex items-center px-6">
        <nav>Navigation</nav>
      </header>
      <main className="flex-1 container mx-auto px-4 py-8">{children}</main>
      <footer className="h-16 border-t flex items-center justify-center">
        Footer
      </footer>
    </div>
  );
}

function SidebarLayout({
  sidebar,
  children,
}: {
  sidebar: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      <aside className="w-64 border-r p-4 hidden md:block">{sidebar}</aside>
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
```

## Quick Reference Table

```
+----------------------+------------------------------------------+
| Pattern              | When to Use                              |
+----------------------+------------------------------------------+
| Compound Components  | Related components that share state      |
| Render Props         | Flexible rendering with shared logic     |
| Custom Hooks         | Reusable stateful logic                  |
| Polymorphic          | Components that render different elements|
| Error Boundary       | Catching render errors gracefully        |
| Optimistic Updates   | Fast UI feedback before server confirms  |
| Infinite Scroll      | Large lists loaded incrementally         |
| Controlled Forms     | Complex validation and submission        |
| Context + Reducer    | Complex shared state without libs        |
| Compound Layout      | Page structure with slots                |
+----------------------+------------------------------------------+
```
