# Lesson 08: Next.js Fundamentals

## What Is Next.js?

Next.js is a React framework that handles routing, rendering, and deployment.
Think of it like Go's `net/http` + a router + a template engine, but for React.

```
  NEXT.JS = React + Routing + Server Rendering + API Layer

  +-----------------+
  | Your Components |
  +-----------------+
         |
  +-----------------+
  | Next.js         |  <-- routing, rendering, bundling
  +-----------------+
         |
  +-----------------+
  | React           |  <-- UI library
  +-----------------+
         |
  +-----------------+
  | Node.js         |  <-- server runtime
  +-----------------+
```

## App Router: File-Based Routing

Files in `app/` become routes automatically. Like Go's handler registration
but implicit from file structure.

```
  FILE SYSTEM                    URL
  ===========                    ===
  app/
  ├── layout.tsx                 (root layout, wraps everything)
  ├── page.tsx                   /
  ├── about/
  │   └── page.tsx               /about
  ├── blog/
  │   ├── page.tsx               /blog
  │   └── [slug]/
  │       └── page.tsx           /blog/my-post  (dynamic)
  ├── dashboard/
  │   ├── layout.tsx             (nested layout)
  │   ├── page.tsx               /dashboard
  │   └── settings/
  │       └── page.tsx           /dashboard/settings
  └── api/
      └── health/
          └── route.ts           /api/health  (API endpoint)
```

## Page and Layout

Every route needs a `page.tsx`. Layouts wrap pages and persist across navigation.

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element {
  return (
    <html lang="en">
      <body>
        <nav>
          <a href="/">Home</a>
          <a href="/about">About</a>
          <a href="/dashboard">Dashboard</a>
        </nav>
        <main>{children}</main>
        <footer>My App</footer>
      </body>
    </html>
  );
}
```

```tsx
export default function HomePage(): JSX.Element {
  return (
    <div>
      <h1>Welcome</h1>
      <p>This is the home page.</p>
    </div>
  );
}
```

```
  LAYOUT NESTING
  ==============

  RootLayout          <-- wraps ALL pages
    |
    +-- page.tsx      <-- / (home)
    |
    +-- DashLayout    <-- wraps all /dashboard/* pages
         |
         +-- page.tsx           <-- /dashboard
         +-- settings/page.tsx  <-- /dashboard/settings

  Layouts don't re-render on navigation between child routes.
  Like a shell in a terminal — the chrome stays, content swaps.
```

## Server Components vs Client Components

This is the big concept. By default, components are Server Components (SC).
They run on the server, never ship JS to the browser.

```
  SERVER COMPONENT              CLIENT COMPONENT
  ================              ================
  Default in App Router         Opt-in with "use client"
  Runs on server only           Runs on server AND client
  Can access DB/filesystem      Can use hooks (useState, etc.)
  Cannot use hooks              Can handle user events
  Cannot handle events          Ships JS to browser
  Zero client JS                Hydrates on client
  Can async/await directly      Must use useEffect for async
```

```tsx
async function UserList(): Promise<JSX.Element> {
  const users = await fetch("https://api.example.com/users").then((r) =>
    r.json()
  );

  return (
    <ul>
      {users.map((user: { id: number; name: string }) => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}
```

```tsx
"use client";

import { useState } from "react";

export default function Counter(): JSX.Element {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount((c) => c + 1)}>+1</button>
    </div>
  );
}
```

```
  COMPONENT BOUNDARY
  ==================

  Server Component (page.tsx)
    |
    +-- <Header />              (server - static nav)
    |
    +-- <UserList />            (server - fetches data)
    |     |
    |     +-- <SearchFilter />  (client - needs useState)
    |
    +-- <Footer />              (server - static footer)

  "use client" marks the boundary. Everything below it
  becomes a client component (or can be).
```

## Dynamic Routes

```tsx
interface PageProps {
  params: Promise<{ slug: string }>;
}

export default async function BlogPost({ params }: PageProps): Promise<JSX.Element> {
  const { slug } = await params;

  const post = await fetch(`https://api.example.com/posts/${slug}`).then(
    (r) => r.json()
  );

  return (
    <article>
      <h1>{post.title}</h1>
      <p>{post.content}</p>
    </article>
  );
}
```

### Catch-All Routes

```
  app/docs/[...slug]/page.tsx

  /docs/getting-started        --> slug = ["getting-started"]
  /docs/api/reference           --> slug = ["api", "reference"]
  /docs/api/v2/endpoints        --> slug = ["api", "v2", "endpoints"]
```

## Loading and Error States

```
  app/
  ├── dashboard/
  │   ├── page.tsx       <-- the actual page
  │   ├── loading.tsx    <-- shown while page loads
  │   ├── error.tsx      <-- shown on error
  │   └── not-found.tsx  <-- shown for 404
```

```tsx
export default function Loading(): JSX.Element {
  return (
    <div className="animate-pulse">
      <div className="h-8 bg-gray-200 rounded w-1/3 mb-4" />
      <div className="h-4 bg-gray-200 rounded w-full mb-2" />
      <div className="h-4 bg-gray-200 rounded w-2/3" />
    </div>
  );
}
```

```tsx
"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}): JSX.Element {
  return (
    <div>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button onClick={reset}>Try again</button>
    </div>
  );
}
```

## Navigation

```tsx
import Link from "next/link";
import { useRouter } from "next/navigation";

function Nav(): JSX.Element {
  return (
    <nav>
      <Link href="/">Home</Link>
      <Link href="/about">About</Link>
      <Link href={`/blog/${encodeURIComponent("my-post")}`}>My Post</Link>
    </nav>
  );
}
```

```tsx
"use client";

import { useRouter } from "next/navigation";

function LoginForm(): JSX.Element {
  const router = useRouter();

  const handleSubmit = async (): Promise<void> => {
    const success = await login();
    if (success) {
      router.push("/dashboard");
    }
  };

  return <button onClick={handleSubmit}>Login</button>;
}
```

## Metadata

```tsx
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "My App - Dashboard",
  description: "Manage your account and settings",
  openGraph: {
    title: "My App Dashboard",
    description: "Manage your account",
  },
};

export default function DashboardPage(): JSX.Element {
  return <h1>Dashboard</h1>;
}
```

## Route Groups

Organize routes without affecting the URL path:

```
  app/
  ├── (marketing)/
  │   ├── layout.tsx     <-- marketing layout
  │   ├── page.tsx       <-- / (home)
  │   └── about/
  │       └── page.tsx   <-- /about
  ├── (app)/
  │   ├── layout.tsx     <-- app layout (with sidebar)
  │   ├── dashboard/
  │   │   └── page.tsx   <-- /dashboard
  │   └── settings/
  │       └── page.tsx   <-- /settings

  Parentheses = invisible in URL. Just for organization.
```

## Middleware

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest): NextResponse {
  const token = request.cookies.get("session-token");

  if (request.nextUrl.pathname.startsWith("/dashboard") && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/settings/:path*"],
};
```

## Exercises

1. Create a Next.js app with three pages: Home (`/`), About (`/about`), and a dynamic Blog Post page (`/blog/[slug]`). Add a shared layout with navigation.

2. Build a Dashboard section with a nested layout that includes a sidebar. Add sub-pages for Overview, Settings, and Profile.

3. Create a server component that fetches and displays a list of items. Add a client component child for search/filtering. Practice the server/client boundary.

4. Add loading states, error boundaries, and not-found pages for the Dashboard section.

5. Write middleware that redirects unauthenticated users from `/dashboard/*` to `/login` and logs all request paths.

---

[← Lesson 07](./07-react-patterns.md) | [Next: Lesson 09 - Next.js Data →](./09-nextjs-data.md)
