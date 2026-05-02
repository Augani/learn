# Lesson 14: Authentication

## The Big Analogy: Hotel Key Cards

```
AUTHENTICATION FLOW = HOTEL CHECK-IN

  1. Show ID at front desk        = Login with credentials
  2. Get a key card               = Receive session/JWT
  3. Key card opens your room     = Token grants access
  4. Card expires at checkout     = Session/token expiration
  5. Lost card? Get a new one     = Refresh token

  SESSION-BASED                   TOKEN-BASED (JWT)
  = Physical key card             = Wristband with your info
  Hotel tracks who has which key  Wristband has your name/room
  Must check with hotel desk      Anyone can read the wristband
  Revocable immediately           Valid until it expires
```

## Auth.js (NextAuth) Setup

```
AUTH.JS FLOW

  Browser                 Next.js Server           Provider (Google, etc.)
     |                         |                         |
     |-- Click "Sign in" ---->|                         |
     |                         |-- Redirect to -------->|
     |                         |                         |
     |                         |   User logs in          |
     |                         |                         |
     |                         |<-- Callback + code -----|
     |                         |                         |
     |                         |-- Exchange for tokens ->|
     |                         |<-- Access + ID token ---|
     |                         |                         |
     |<-- Set session cookie --|                         |
     |                         |                         |
     |-- Subsequent requests ->|                         |
     |   (cookie attached)     |-- Verify session        |
     |<-- Protected content ---|                         |
```

### Configuration

```typescript
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import GitHub from "next-auth/providers/github";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export const { handlers, signIn, signOut, auth } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    GitHub({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
        });

        if (!user?.hashedPassword) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password as string,
          user.hashedPassword
        );

        if (!isValid) {
          return null;
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    authorized: async ({ auth, request }) => {
      const isProtected = request.nextUrl.pathname.startsWith("/dashboard");
      if (isProtected && !auth) {
        return false;
      }
      return true;
    },
    jwt: async ({ token, user }) => {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub!;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/auth/error",
  },
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
});
```

### Route Handlers

```typescript
import { handlers } from "@/auth";

export const { GET, POST } = handlers;
```

### Type Augmentation

```typescript
import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
  }
}
```

## Session Management

### Server Components

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

async function DashboardPage() {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  return (
    <div>
      <h1>Welcome, {session.user.name}</h1>
      <p>Role: {session.user.role}</p>
    </div>
  );
}
```

### Client Components

```tsx
"use client";

import { useSession } from "next-auth/react";

function UserMenu() {
  const { data: session, status } = useSession();

  if (status === "loading") {
    return <div>Loading...</div>;
  }

  if (status === "unauthenticated") {
    return <a href="/login">Sign In</a>;
  }

  return (
    <div>
      <span>{session?.user?.name}</span>
      <button onClick={() => signOut()}>Sign Out</button>
    </div>
  );
}
```

## Protected Routes

### Middleware-Based Protection

```typescript
import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnDashboard = req.nextUrl.pathname.startsWith("/dashboard");
  const isOnAdmin = req.nextUrl.pathname.startsWith("/admin");
  const isAdmin = req.auth?.user?.role === "admin";

  if (isOnAdmin && !isAdmin) {
    return NextResponse.redirect(new URL("/unauthorized", req.url));
  }

  if (isOnDashboard && !isLoggedIn) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/dashboard/:path*", "/admin/:path*", "/api/protected/:path*"],
};
```

### Role-Based Access Component

```tsx
import { auth } from "@/auth";
import { redirect } from "next/navigation";

type Role = "admin" | "editor" | "viewer";

async function requireRole(allowedRoles: Role[]) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  if (!allowedRoles.includes(session.user.role as Role)) {
    redirect("/unauthorized");
  }

  return session;
}

async function AdminPage() {
  const session = await requireRole(["admin"]);

  return <div>Admin panel for {session.user.name}</div>;
}

async function EditorPage() {
  const session = await requireRole(["admin", "editor"]);

  return <div>Editor tools for {session.user.name}</div>;
}
```

## Login Page

```tsx
"use client";

import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

function LoginPage() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/dashboard";
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(event.currentTarget);

    const result = await signIn("credentials", {
      email: formData.get("email"),
      password: formData.get("password"),
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError("Invalid email or password");
      return;
    }

    window.location.href = callbackUrl;
  }

  return (
    <div>
      <h1>Sign In</h1>

      {error && <p role="alert">{error}</p>}

      <form onSubmit={handleSubmit}>
        <label htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required />

        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required />

        <button type="submit" disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>

      <div>
        <button onClick={() => signIn("google", { callbackUrl })}>
          Continue with Google
        </button>
        <button onClick={() => signIn("github", { callbackUrl })}>
          Continue with GitHub
        </button>
      </div>
    </div>
  );
}
```

## Exercises

1. Set up Auth.js with Google and GitHub providers in a Next.js app. Configure the PrismaAdapter and test the full sign-in flow.

2. Implement role-based access control with three roles: admin, editor, viewer. Create middleware that restricts routes based on roles.

3. Build a complete login page with: email/password form, OAuth buttons, error handling, loading states, and redirect after login.

4. Create a `useRequireAuth` hook for client components that redirects to login if unauthenticated and optionally checks roles.

5. Implement session refresh: detect when a session is about to expire, silently refresh it, and handle the case where refresh fails.

## Key Takeaways

```
+-------------------------------------------+
| AUTHENTICATION ESSENTIALS                 |
|                                           |
| 1. Auth.js handles OAuth complexity      |
| 2. JWT strategy for serverless           |
| 3. Middleware for route protection        |
| 4. Server components: use auth()         |
| 5. Client components: use useSession()   |
| 6. Always validate roles server-side     |
+-------------------------------------------+
```
