# Lesson 09: Next.js Data

## Data Fetching in Server Components

Server components can fetch data directly — no `useEffect`, no loading hooks.
Like writing a Go handler that queries a DB and returns HTML.

```
  DATA FLOW IN NEXT.JS
  ====================

  Browser Request
       |
       v
  +--Server Component--+
  |                     |
  |  await fetch(...)   |  <-- runs on server
  |  await db.query()   |
  |                     |
  +--------+------------+
           |
           v
  HTML sent to browser (fast, no JS needed)
```

```tsx
interface Post {
  id: number;
  title: string;
  body: string;
}

export default async function BlogPage(): Promise<JSX.Element> {
  const posts: Post[] = await fetch("https://jsonplaceholder.typicode.com/posts", {
    cache: "force-cache",
  }).then((r) => r.json());

  return (
    <div>
      <h1>Blog</h1>
      <ul>
        {posts.slice(0, 10).map((post) => (
          <li key={post.id}>
            <h2>{post.title}</h2>
            <p>{post.body.slice(0, 100)}...</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## Caching Strategies

```
  FETCH CACHING OPTIONS
  =====================

  fetch(url, { cache: "force-cache" })    --> cached indefinitely (default)
  fetch(url, { cache: "no-store" })       --> always fresh (like no-cache)
  fetch(url, { next: { revalidate: 60 }}) --> cache for 60 seconds

  +----------+     +---------+     +--------+
  | Request  |---->| Cache   |---->| Origin |
  |          |     | Hit?    |     | Server |
  +----------+     +----+----+     +--------+
                        |
                   YES: return cached
                   NO:  fetch, cache, return
```

```tsx
async function RealtimePrice(): Promise<JSX.Element> {
  const data = await fetch("https://api.example.com/price", {
    cache: "no-store",
  }).then((r) => r.json());

  return <span>${data.price}</span>;
}

async function BlogPost({ slug }: { slug: string }): Promise<JSX.Element> {
  const post = await fetch(`https://api.example.com/posts/${slug}`, {
    next: { revalidate: 3600 },
  }).then((r) => r.json());

  return <article>{post.title}</article>;
}
```

## Server Actions

Server Actions are functions that run on the server, called from the client.
Like defining a Go RPC endpoint but with automatic serialization.

```
  SERVER ACTION FLOW
  ==================

  Client (browser)                    Server
  ================                    ======
  <form action={createPost}>
    [user fills form]
    [clicks submit]
         |
         +--- HTTP POST (automatic) ---->  async function createPost(formData)
                                           {
                                             // runs on server
                                             // can access DB, env vars
                                             // validates input
                                             // returns result
                                           }
         <--- response ------------------+
    [page updates]
```

### Form Actions

```tsx
import { revalidatePath } from "next/cache";

async function createTodo(formData: FormData): Promise<void> {
  "use server";

  const title = formData.get("title");
  if (typeof title !== "string" || title.trim() === "") {
    throw new Error("Title is required");
  }

  await fetch("https://api.example.com/todos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title: title.trim() }),
  });

  revalidatePath("/todos");
}

export default function TodoForm(): JSX.Element {
  return (
    <form action={createTodo}>
      <input name="title" placeholder="New todo..." required />
      <button type="submit">Add</button>
    </form>
  );
}
```

### Server Actions with useActionState

```tsx
"use client";

import { useActionState } from "react";

interface FormState {
  message: string;
  success: boolean;
}

async function submitForm(
  prevState: FormState,
  formData: FormData
): Promise<FormState> {
  "use server";

  const email = formData.get("email");
  if (typeof email !== "string" || !email.includes("@")) {
    return { message: "Invalid email", success: false };
  }

  await fetch("https://api.example.com/subscribe", {
    method: "POST",
    body: JSON.stringify({ email }),
  });

  return { message: "Subscribed!", success: true };
}

export default function SubscribeForm(): JSX.Element {
  const [state, formAction, isPending] = useActionState(submitForm, {
    message: "",
    success: false,
  });

  return (
    <form action={formAction}>
      <input name="email" type="email" placeholder="your@email.com" />
      <button type="submit" disabled={isPending}>
        {isPending ? "Subscribing..." : "Subscribe"}
      </button>
      {state.message && (
        <p className={state.success ? "text-green-500" : "text-red-500"}>
          {state.message}
        </p>
      )}
    </form>
  );
}
```

## Revalidation

```
  REVALIDATION STRATEGIES
  =======================

  1. Time-based:  revalidate: 60  (stale after 60s)
  2. On-demand:   revalidatePath('/blog')
  3. Tag-based:   revalidateTag('posts')

  Time-based:
  t=0     t=60    t=61
  |-------|-------|
  cached   stale   revalidates on next request

  On-demand (after mutation):
  create post --> revalidatePath('/blog') --> next request gets fresh data
```

```tsx
import { revalidatePath, revalidateTag } from "next/cache";

async function getPost(slug: string): Promise<{ title: string; body: string }> {
  const res = await fetch(`https://api.example.com/posts/${slug}`, {
    next: { tags: [`post-${slug}`] },
  });
  return res.json();
}

async function updatePost(formData: FormData): Promise<void> {
  "use server";

  const slug = formData.get("slug") as string;
  const title = formData.get("title") as string;

  await fetch(`https://api.example.com/posts/${slug}`, {
    method: "PUT",
    body: JSON.stringify({ title }),
  });

  revalidateTag(`post-${slug}`);
  revalidatePath(`/blog/${slug}`);
}
```

## Streaming with Suspense

Streaming lets you send parts of the page as they're ready.
Think of it like HTTP chunked transfer — the browser renders
pieces as they arrive.

```
  STREAMING FLOW
  ==============

  Browser receives:

  t=0ms:   <Layout> + <Nav> + <Loading placeholder>
  t=200ms: <UserProfile> streams in, replaces placeholder
  t=500ms: <RecommendedPosts> streams in

  Without streaming:
  |------------ 500ms wait ------------|  full page

  With streaming:
  |--0ms--|  shell visible
       |--200ms--|  profile visible
            |--500ms--|  posts visible
```

```tsx
import { Suspense } from "react";

async function SlowData(): Promise<JSX.Element> {
  const data = await fetch("https://api.example.com/slow-endpoint", {
    cache: "no-store",
  }).then((r) => r.json());

  return <div>{data.result}</div>;
}

function LoadingSkeleton(): JSX.Element {
  return <div className="animate-pulse h-20 bg-gray-200 rounded" />;
}

export default function Dashboard(): JSX.Element {
  return (
    <div>
      <h1>Dashboard</h1>
      <Suspense fallback={<LoadingSkeleton />}>
        <SlowData />
      </Suspense>
      <Suspense fallback={<LoadingSkeleton />}>
        <AnotherSlowComponent />
      </Suspense>
    </div>
  );
}
```

## Parallel Data Fetching

```tsx
interface DashboardData {
  user: { name: string };
  stats: { views: number };
  notifications: { message: string }[];
}

export default async function Dashboard(): Promise<JSX.Element> {
  const [user, stats, notifications] = await Promise.all([
    fetch("/api/user").then((r) => r.json()),
    fetch("/api/stats").then((r) => r.json()),
    fetch("/api/notifications").then((r) => r.json()),
  ]);

  return (
    <div>
      <h1>Welcome, {user.name}</h1>
      <p>Views: {stats.views}</p>
      <ul>
        {notifications.map((n: { message: string }, i: number) => (
          <li key={i}>{n.message}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Search Params and URL State

```tsx
interface SearchPageProps {
  searchParams: Promise<{ q?: string; page?: string }>;
}

export default async function SearchPage({
  searchParams,
}: SearchPageProps): Promise<JSX.Element> {
  const { q = "", page = "1" } = await searchParams;
  const pageNum = parseInt(page, 10);

  const results = await fetch(
    `https://api.example.com/search?q=${encodeURIComponent(q)}&page=${pageNum}`
  ).then((r) => r.json());

  return (
    <div>
      <h1>Results for "{q}"</h1>
      <ul>
        {results.items.map((item: { id: string; title: string }) => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Generating Static Pages

```tsx
export async function generateStaticParams(): Promise<{ slug: string }[]> {
  const posts = await fetch("https://api.example.com/posts").then((r) =>
    r.json()
  );

  return posts.map((post: { slug: string }) => ({
    slug: post.slug,
  }));
}

export default async function BlogPost({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<JSX.Element> {
  const { slug } = await params;
  const post = await fetch(`https://api.example.com/posts/${slug}`).then(
    (r) => r.json()
  );

  return <article>{post.title}</article>;
}
```

## Exercises

1. Build a blog page that fetches posts from an API in a server component. Add time-based revalidation (every 5 minutes). Show a loading skeleton while streaming.

2. Create a "Create Post" form using server actions with validation. After creating a post, revalidate the blog list page. Show pending state in the form.

3. Build a search page that reads the query from URL search params, fetches results, and displays them. Add pagination with page numbers in the URL.

4. Create a dashboard with three data panels that load in parallel using `Promise.all`. Wrap each in `Suspense` so they stream independently.

5. Implement tag-based revalidation: create, edit, and delete operations on posts should each invalidate only the relevant cached data using `revalidateTag`.

---

[← Lesson 08](./08-nextjs-fundamentals.md) | [Next: Lesson 10 - Forms & Validation →](./10-forms-validation.md)
