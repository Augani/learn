# Lesson 15: API Routes and Type-Safe APIs

## The Big Analogy: Restaurant Ordering Systems

```
API ROUTE APPROACHES

  REST API Routes              tRPC
  = Paper order pad            = Direct kitchen intercom

  Waiter writes order          Chef and waiter speak
  on paper, walks to           directly. Both know
  kitchen. Chef reads it.      the menu by heart.

  Any waiter, any kitchen.     Tightly coupled but
  Standard format.             zero miscommunication.
  Could misread order.         Type-safe end to end.

  fetch("/api/orders", {       trpc.orders.create({
    method: "POST",              items: ["pizza"],
    body: JSON.stringify(...)    table: 5
  })                           })
```

## Next.js API Routes (App Router)

```
ROUTE HANDLER FILE CONVENTIONS

  app/
  +-- api/
      +-- users/
      |   +-- route.ts          GET/POST  /api/users
      |   +-- [id]/
      |       +-- route.ts      GET/PUT/DELETE  /api/users/:id
      |
      +-- posts/
          +-- route.ts          GET/POST  /api/posts
          +-- [slug]/
              +-- route.ts      GET  /api/posts/:slug
```

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";

const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
});

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = request.nextUrl;
  const page = parseInt(searchParams.get("page") ?? "1", 10);
  const limit = parseInt(searchParams.get("limit") ?? "20", 10);
  const search = searchParams.get("search") ?? "";

  const safePage = Math.max(1, page);
  const safeLimit = Math.min(100, Math.max(1, limit));

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { email: { contains: search, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip: (safePage - 1) * safeLimit,
      take: safeLimit,
      select: { id: true, name: true, email: true, role: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.user.count({ where }),
  ]);

  return NextResponse.json({
    data: users,
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.ceil(total / safeLimit),
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const parsed = createUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const existing = await prisma.user.findUnique({
    where: { email: parsed.data.email },
  });

  if (existing) {
    return NextResponse.json(
      { error: "Email already in use" },
      { status: 409 }
    );
  }

  const user = await prisma.user.create({
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ data: user }, { status: 201 });
}
```

### Dynamic Route Parameters

```typescript
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  role: z.enum(["admin", "editor", "viewer"]).optional(),
});

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ data: user });
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const { id } = await params;
  const body = await request.json();
  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: { id: true, name: true, email: true, role: true },
  });

  return NextResponse.json({ data: user });
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const { id } = await params;

  await prisma.user.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
```

## tRPC: End-to-End Type Safety

```
tRPC ARCHITECTURE

  Client (React)              Server (Next.js)
  +----------------+          +------------------+
  |                |          |                  |
  | trpc.user      | <=====> | userRouter       |
  |  .getById      |  types  |  .getById        |
  |  .useQuery()   | shared  |  .query()        |
  |                |          |                  |
  | trpc.post      | <=====> | postRouter       |
  |  .create       |  types  |  .create         |
  |  .useMutation()|  shared |  .mutation()     |
  +----------------+          +------------------+

  Change a return type on the server?
  TypeScript error shows INSTANTLY in the client.
  No code generation. No OpenAPI spec. Just types.
```

### tRPC Server Setup

```typescript
import { initTRPC, TRPCError } from "@trpc/server";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import superjson from "superjson";

interface Context {
  session: Awaited<ReturnType<typeof auth>>;
}

async function createContext(): Promise<Context> {
  const session = await auth();
  return { session };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

const publicProcedure = t.procedure;

const authedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({ code: "UNAUTHORIZED" });
  }
  return next({
    ctx: { session: ctx.session },
  });
});

const adminProcedure = authedProcedure.use(async ({ ctx, next }) => {
  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
  return next({ ctx });
});

const userRouter = t.router({
  list: authedProcedure
    .input(
      z.object({
        page: z.number().min(1).default(1),
        limit: z.number().min(1).max(100).default(20),
        search: z.string().optional(),
      })
    )
    .query(async ({ input }) => {
      const where = input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: "insensitive" as const } },
              { email: { contains: input.search, mode: "insensitive" as const } },
            ],
          }
        : {};

      const [users, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip: (input.page - 1) * input.limit,
          take: input.limit,
          select: { id: true, name: true, email: true, role: true },
        }),
        prisma.user.count({ where }),
      ]);

      return { users, total, totalPages: Math.ceil(total / input.limit) };
    }),

  getById: authedProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ input }) => {
      const user = await prisma.user.findUnique({
        where: { id: input.id },
        select: { id: true, name: true, email: true, role: true },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      return user;
    }),

  create: adminProcedure
    .input(
      z.object({
        name: z.string().min(1).max(100),
        email: z.string().email(),
        role: z.enum(["admin", "editor", "viewer"]).default("viewer"),
      })
    )
    .mutation(async ({ input }) => {
      return prisma.user.create({
        data: input,
        select: { id: true, name: true, email: true, role: true },
      });
    }),
});

export const appRouter = t.router({
  user: userRouter,
});

export type AppRouter = typeof appRouter;
```

### tRPC Client Usage

```tsx
"use client";

import { trpc } from "@/lib/trpc";
import { useState } from "react";

function UserListPage() {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const { data, isPending, error } = trpc.user.list.useQuery({
    page,
    limit: 20,
    search: search || undefined,
  });

  const createUser = trpc.user.create.useMutation({
    onSuccess: () => {
      utils.user.list.invalidate();
    },
  });

  const utils = trpc.useUtils();

  if (isPending) return <p>Loading...</p>;
  if (error) return <p>Error: {error.message}</p>;

  return (
    <div>
      <input
        value={search}
        onChange={(e) => {
          setSearch(e.target.value);
          setPage(1);
        }}
        placeholder="Search users..."
      />

      <ul>
        {data.users.map((user) => (
          <li key={user.id}>
            {user.name} ({user.email}) - {user.role}
          </li>
        ))}
      </ul>

      <div>
        <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page} of {data.totalPages}</span>
        <button onClick={() => setPage((p) => p + 1)} disabled={page >= data.totalPages}>
          Next
        </button>
      </div>
    </div>
  );
}
```

## Exercises

1. Build a complete REST API with Next.js route handlers for a blog: CRUD for posts, pagination, search, and proper error handling with Zod validation.

2. Set up tRPC in a Next.js app with: router definition, client provider, and three procedures (query, mutation, subscription-like polling).

3. Create a type-safe API client wrapper around `fetch` that: infers response types, handles errors consistently, adds auth headers, and supports request cancellation.

4. Implement rate limiting middleware for API routes using an in-memory store (or Redis). Return proper 429 responses with Retry-After headers.

5. Build an API route that handles file uploads, validates file type and size, stores to S3, and returns the URL.

## Key Takeaways

```
+-------------------------------------------+
| API ROUTES & TYPE SAFETY                  |
|                                           |
| 1. Route handlers for REST-style APIs    |
| 2. Zod validates at the boundary         |
| 3. tRPC for full type safety e2e         |
| 4. Always validate inputs server-side    |
| 5. Handle errors with proper status codes|
| 6. Auth check on every protected route   |
+-------------------------------------------+
```
