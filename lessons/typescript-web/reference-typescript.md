# Reference: TypeScript Cheat Sheet for Systems Programmers

## Type Annotations (Rust/C++ Equivalents)

```typescript
let name: string = "hello";        // let name: String
let count: number = 42;            // let count: i64
let active: boolean = true;        // let active: bool
let items: string[] = [];          // let items: Vec<String>
let pair: [string, number];        // (String, i64) tuple
let id: string | number;           // enum with String or i64 variant
let maybe: string | null;          // Option<String>
```

## Enums and Unions

```typescript
// Rust-like enums (discriminated unions)
type Result<T, E> =
  | { ok: true; value: T }
  | { ok: false; error: E };

type Shape =
  | { kind: "circle"; radius: number }
  | { kind: "rectangle"; width: number; height: number }
  | { kind: "triangle"; base: number; height: number };

function area(shape: Shape): number {
  switch (shape.kind) {
    case "circle":
      return Math.PI * shape.radius ** 2;
    case "rectangle":
      return shape.width * shape.height;
    case "triangle":
      return (shape.base * shape.height) / 2;
  }
}

// Exhaustiveness checking
function assertNever(x: never): never {
  throw new Error(`Unexpected value: ${x}`);
}
```

## Interfaces and Types

```typescript
// Interface (like a trait definition)
interface Serializable {
  serialize(): string;
  deserialize(data: string): void;
}

// Type alias (like type alias in Rust)
type UserId = string;
type Handler = (req: Request) => Promise<Response>;
type Nullable<T> = T | null;

// Extending (like trait inheritance)
interface Animal {
  name: string;
  sound(): string;
}

interface Pet extends Animal {
  owner: string;
}

// Intersection (like implementing multiple traits)
type AdminUser = User & { permissions: string[] };
```

## Generics

```typescript
// Generic function (like fn<T>)
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

// Generic with constraints (like where T: Display)
function longest<T extends { length: number }>(a: T, b: T): T {
  return a.length >= b.length ? a : b;
}

// Generic interface
interface Repository<T> {
  findById(id: string): Promise<T | null>;
  findAll(): Promise<T[]>;
  create(item: Omit<T, "id">): Promise<T>;
  update(id: string, item: Partial<T>): Promise<T>;
  delete(id: string): Promise<void>;
}

// Multiple generics
type Either<L, R> = { tag: "left"; value: L } | { tag: "right"; value: R };
```

## Utility Types

```
+---------------------+------------------------------------------+
| Utility Type        | What It Does                             |
+---------------------+------------------------------------------+
| Partial<T>          | All fields optional                      |
| Required<T>         | All fields required                      |
| Readonly<T>         | All fields readonly                      |
| Pick<T, K>          | Select specific fields                   |
| Omit<T, K>          | Remove specific fields                   |
| Record<K, V>        | Object type with keys K, values V        |
| Exclude<T, U>       | Remove types from union                  |
| Extract<T, U>       | Keep types from union                    |
| NonNullable<T>      | Remove null and undefined                |
| ReturnType<F>       | Get function return type                 |
| Parameters<F>       | Get function parameter types             |
| Awaited<T>          | Unwrap Promise type                      |
+---------------------+------------------------------------------+
```

```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: "admin" | "user";
  createdAt: Date;
}

type CreateUser = Omit<User, "id" | "createdAt">;
type UpdateUser = Partial<Pick<User, "name" | "email" | "role">>;
type PublicUser = Pick<User, "id" | "name">;
type UserMap = Record<string, User>;
```

## Error Handling

```typescript
// Result pattern (like Rust's Result)
type Result<T, E = Error> =
  | { success: true; data: T }
  | { success: false; error: E };

function parseJson<T>(raw: string): Result<T> {
  try {
    return { success: true, data: JSON.parse(raw) as T };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err : new Error(String(err)),
    };
  }
}

// Custom error types
class AppError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number
  ) {
    super(message);
    this.name = "AppError";
  }
}

class NotFoundError extends AppError {
  constructor(resource: string, id: string) {
    super(`${resource} ${id} not found`, "NOT_FOUND", 404);
  }
}

class ValidationError extends AppError {
  constructor(
    message: string,
    public fields: Record<string, string[]>
  ) {
    super(message, "VALIDATION_ERROR", 400);
  }
}
```

## Async Patterns

```typescript
// Async/await (similar to Rust async)
async function fetchUser(id: string): Promise<User> {
  const response = await fetch(`/api/users/${id}`);
  if (!response.ok) throw new NotFoundError("User", id);
  return response.json();
}

// Promise.all (like join! in Rust)
const [user, posts, comments] = await Promise.all([
  fetchUser(id),
  fetchPosts(id),
  fetchComments(id),
]);

// Promise.allSettled (handle individual failures)
const results = await Promise.allSettled([
  fetchUser("1"),
  fetchUser("2"),
  fetchUser("3"),
]);

const users = results
  .filter((r): r is PromiseFulfilledResult<User> => r.status === "fulfilled")
  .map((r) => r.value);
```

## Type Guards

```typescript
// Type narrowing (like pattern matching)
function isString(value: unknown): value is string {
  return typeof value === "string";
}

function isUser(value: unknown): value is User {
  return (
    typeof value === "object" &&
    value !== null &&
    "id" in value &&
    "email" in value
  );
}

// Zod for runtime validation
import { z } from "zod";

const UserSchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "user"]),
});

type User = z.infer<typeof UserSchema>;
```

## Common Patterns

```typescript
// Builder pattern
class QueryBuilder<T> {
  private filters: Array<(item: T) => boolean> = [];
  private sortFn?: (a: T, b: T) => number;
  private limitCount?: number;

  where(fn: (item: T) => boolean): this {
    this.filters.push(fn);
    return this;
  }

  orderBy(fn: (a: T, b: T) => number): this {
    this.sortFn = fn;
    return this;
  }

  limit(n: number): this {
    this.limitCount = n;
    return this;
  }

  execute(items: T[]): T[] {
    let result = items.filter((item) =>
      this.filters.every((fn) => fn(item))
    );
    if (this.sortFn) result.sort(this.sortFn);
    if (this.limitCount) result = result.slice(0, this.limitCount);
    return result;
  }
}

// Branded types (like newtype in Rust)
type Brand<T, B> = T & { __brand: B };
type UserId = Brand<string, "UserId">;
type PostId = Brand<string, "PostId">;

function createUserId(id: string): UserId {
  return id as UserId;
}
```

## tsconfig.json Strict Settings

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true
  }
}
```
