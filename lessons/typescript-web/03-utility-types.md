# Lesson 03: Utility Types

## The Standard Toolbox

TypeScript ships with built-in utility types — think of them as the standard
library for your type system. Like how Rust has `Option`, `Vec`, and `Iterator`,
TypeScript has `Partial`, `Pick`, `Omit`, and friends.

```
  UTILITY TYPES CHEAT SHEET
  =========================

  Input Type:  { id: number; name: string; email: string; role: string }

  Partial<T>     -->  all fields optional
  Required<T>    -->  all fields required
  Readonly<T>    -->  all fields readonly
  Pick<T, K>     -->  subset of fields
  Omit<T, K>     -->  exclude fields
  Record<K, V>   -->  key-value map
  Extract<T, U>  -->  members assignable to U
  Exclude<T, U>  -->  members NOT assignable to U
  NonNullable<T> -->  remove null/undefined
  ReturnType<T>  -->  return type of function
  Parameters<T>  -->  parameter types as tuple
```

## Partial and Required

`Partial` makes everything optional — perfect for update operations.
Like a form where you only fill in what changed.

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
}

function updateUser(id: number, updates: Partial<User>): User {
  const existing: User = { id, name: "Alice", email: "a@b.com", role: "user" };
  return { ...existing, ...updates };
}

updateUser(1, { name: "Bob" });
updateUser(1, { email: "bob@example.com", role: "admin" });
```

`Required` does the opposite — makes all optional fields required:

```typescript
interface Config {
  host?: string;
  port?: number;
  debug?: boolean;
}

function startServer(config: Required<Config>): void {
  console.log(`Starting on ${config.host}:${config.port}`);
}

startServer({ host: "localhost", port: 3000, debug: false });
```

## Pick and Omit

`Pick` selects specific fields — like choosing toppings from a menu.
`Omit` removes fields — like saying "everything except anchovies."

```typescript
interface Product {
  id: number;
  name: string;
  price: number;
  description: string;
  sku: string;
  createdAt: Date;
}

type ProductPreview = Pick<Product, "id" | "name" | "price">;

type CreateProduct = Omit<Product, "id" | "createdAt">;
```

```
  PICK vs OMIT
  ============

  Product:  { id, name, price, description, sku, createdAt }

  Pick<Product, "id" | "name" | "price">
  Result:   { id, name, price }
            ^^^^^^^^^^^^^^^^^^^
            ONLY these fields

  Omit<Product, "id" | "createdAt">
  Result:   { name, price, description, sku }
            ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
            EVERYTHING EXCEPT these fields
```

## Record

`Record` creates a dictionary type. Like Go's `map[string]T` or Rust's `HashMap<K, V>`.

```typescript
type UserRole = "admin" | "editor" | "viewer";

interface Permissions {
  canRead: boolean;
  canWrite: boolean;
  canDelete: boolean;
}

const rolePermissions: Record<UserRole, Permissions> = {
  admin: { canRead: true, canWrite: true, canDelete: true },
  editor: { canRead: true, canWrite: true, canDelete: false },
  viewer: { canRead: true, canWrite: false, canDelete: false },
};
```

```
  Record<K, V>  ===  { [key in K]: V }

  Record<string, number>  ~=  Go's map[string]int
  Record<"a"|"b", T>      =   { a: T; b: T }  (exhaustive!)
```

## Extract and Exclude

These filter union types. `Extract` keeps what matches. `Exclude` removes what matches.
Think of them as `filter` and `reject` for types.

```typescript
type AllEvents = "click" | "focus" | "blur" | "keydown" | "keyup";

type KeyEvents = Extract<AllEvents, "keydown" | "keyup">;

type NonKeyEvents = Exclude<AllEvents, "keydown" | "keyup">;

type Primitive = string | number | boolean | null | undefined;
type NonNullPrimitive = NonNullable<Primitive>;
```

## ReturnType and Parameters

Extract type information from functions:

```typescript
function createUser(name: string, age: number): { id: number; name: string; age: number } {
  return { id: Math.random(), name, age };
}

type UserReturn = ReturnType<typeof createUser>;

type UserParams = Parameters<typeof createUser>;

function wrapCreateUser(...args: Parameters<typeof createUser>): ReturnType<typeof createUser> {
  console.log("Creating user...");
  return createUser(...args);
}
```

## Awaited

Unwraps Promise types — crucial for async code:

```typescript
type A = Awaited<Promise<string>>;
type B = Awaited<Promise<Promise<number>>>;

async function fetchUser(): Promise<{ name: string }> {
  return { name: "Alice" };
}

type FetchResult = Awaited<ReturnType<typeof fetchUser>>;
```

## Template Literal Types

Build string types programmatically. Like string formatting but at the type level.

```typescript
type Color = "red" | "green" | "blue";
type Size = "sm" | "md" | "lg";
type ClassName = `${Size}-${Color}`;

type Getters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
};

interface Person {
  name: string;
  age: number;
}

type PersonGetters = Getters<Person>;
```

```
  TEMPLATE LITERAL EXPANSION
  ==========================

  Color = "red" | "green" | "blue"
  Size  = "sm" | "md" | "lg"

  `${Size}-${Color}` expands to:
    "sm-red"  | "sm-green"  | "sm-blue"  |
    "md-red"  | "md-green"  | "md-blue"  |
    "lg-red"  | "lg-green"  | "lg-blue"

  9 total combinations (3 x 3)
```

## Type Inference with `infer`

Pattern match inside conditional types to extract sub-types:

```typescript
type UnwrapArray<T> = T extends (infer U)[] ? U : T;
type A = UnwrapArray<string[]>;
type B = UnwrapArray<number>;

type FirstArg<T> = T extends (first: infer F, ...rest: any[]) => any ? F : never;
type C = FirstArg<(name: string, age: number) => void>;

type UnwrapPromise<T> = T extends Promise<infer U> ? UnwrapPromise<U> : T;
type D = UnwrapPromise<Promise<Promise<string>>>;
```

## Combining Utility Types

Real-world code chains these together:

```typescript
interface DBUser {
  id: number;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}

type PublicUser = Omit<DBUser, "passwordHash">;

type CreateUserInput = Omit<DBUser, "id" | "createdAt" | "updatedAt" | "passwordHash"> & {
  password: string;
};

type UpdateUserInput = Partial<Pick<DBUser, "name" | "email">>;

type UserResponse = Readonly<PublicUser>;
```

```
  TYPE DERIVATION CHAIN
  =====================

  DBUser (full database record)
    |
    +--[Omit passwordHash]---> PublicUser (safe for API)
    |
    +--[Omit auto fields]----> CreateUserInput (for POST)
    |   +--[& password]
    |
    +--[Pick + Partial]------> UpdateUserInput (for PATCH)
    |
    +--[Readonly]------------> UserResponse (immutable)
```

## Satisfies Operator

`satisfies` validates a type without widening it. Like a type assertion
that doesn't lie:

```typescript
type Route = {
  path: string;
  method: "GET" | "POST" | "PUT" | "DELETE";
};

const routes = {
  home: { path: "/", method: "GET" },
  createUser: { path: "/users", method: "POST" },
  updateUser: { path: "/users/:id", method: "PUT" },
} satisfies Record<string, Route>;

const homeMethod = routes.home.method;
```

## Const Assertions

`as const` makes everything deeply readonly and narrowed to literal types:

```typescript
const config = {
  api: "https://api.example.com",
  retries: 3,
  methods: ["GET", "POST"],
} as const;

type APIUrl = typeof config.api;
type Methods = (typeof config.methods)[number];
```

## Exercises

1. Given an API response type, derive `CreateDTO`, `UpdateDTO`, and `ResponseDTO` types using utility types. The `CreateDTO` should omit `id` and timestamps. The `UpdateDTO` should make all fields optional except `id`. The `ResponseDTO` should be readonly.

2. Write a `DeepPartial<T>` utility type that makes all properties optional recursively, including nested objects.

3. Create a `StrictOmit<T, K>` that only allows omitting keys that actually exist on `T` (unlike built-in `Omit` which accepts any string).

4. Using template literal types and mapped types, create a type that transforms `{ onClick: () => void; onHover: () => void }` into `{ click: () => void; hover: () => void }` (stripping the "on" prefix and lowercasing).

5. Write an `EventMap` utility type that takes `{ click: MouseEvent; keydown: KeyboardEvent }` and produces `{ onClick: (e: MouseEvent) => void; onKeydown: (e: KeyboardEvent) => void }`.

---

[← Lesson 02](./02-type-system-deep-dive.md) | [Next: Lesson 04 - Async TypeScript →](./04-async-typescript.md)
