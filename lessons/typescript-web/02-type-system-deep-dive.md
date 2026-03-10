# Lesson 02: Type System Deep Dive

## Generics: Type Parameters

Generics in TypeScript work like Rust generics but without trait bounds — you use
`extends` instead.

Think of generics like a shipping container. The container doesn't care what's
inside. It just guarantees the shape stays consistent.

```typescript
function first<T>(arr: T[]): T | undefined {
  return arr[0];
}

const n = first([1, 2, 3]);
const s = first(["a", "b"]);
```

```
  GENERIC RESOLUTION
  ==================

  first<T>(arr: T[])
       |
       +-- first([1, 2, 3])  -->  T = number  -->  returns number | undefined
       +-- first(["a", "b"]) -->  T = string  -->  returns string | undefined
```

## Constrained Generics

Like Rust's trait bounds (`T: Display`), use `extends`:

```typescript
interface HasId {
  id: number;
}

function findById<T extends HasId>(items: T[], id: number): T | undefined {
  return items.find((item) => item.id === id);
}

interface User extends HasId {
  name: string;
}

const users: User[] = [
  { id: 1, name: "Alice" },
  { id: 2, name: "Bob" },
];

const found = findById(users, 1);
```

```
  Rust:   fn find<T: HasId>(items: &[T], id: u64) -> Option<&T>
  TS:     function findById<T extends HasId>(items: T[], id: number): T | undefined

  Same concept, different syntax.
```

## Multiple Type Parameters

```typescript
function zip<A, B>(as: A[], bs: B[]): [A, B][] {
  const length = Math.min(as.length, bs.length);
  const result: [A, B][] = [];
  for (let i = 0; i < length; i++) {
    result.push([as[i], bs[i]]);
  }
  return result;
}

const pairs = zip([1, 2, 3], ["a", "b", "c"]);
```

## Union Types

Unions are TypeScript's answer to Rust enums. Think of a union as a door
that accepts multiple key types.

```typescript
type StringOrNumber = string | number;

function display(value: StringOrNumber): string {
  if (typeof value === "string") {
    return value.toUpperCase();
  }
  return value.toFixed(2);
}
```

## Discriminated Unions (Tagged Unions)

This is the closest to Rust's `enum` with data. The "tag" field
acts like the variant name.

```typescript
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
```

```
  DISCRIMINATED UNION LAYOUT
  ==========================

  Shape
    |
    +-- kind: "circle"    ----> { radius }
    |
    +-- kind: "rectangle" ----> { width, height }
    |
    +-- kind: "triangle"  ----> { base, height }

  The "kind" field = discriminant (like Rust enum variant tag)
  TypeScript narrows the type automatically in each branch.
```

## Result Type (Rust-Style)

```typescript
type Result<T, E = Error> =
  | { ok: true; value: T }
  | { ok: false; error: E };

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) {
    return { ok: false, error: "Division by zero" };
  }
  return { ok: true, value: a / b };
}

const result = divide(10, 3);
if (result.ok) {
  console.log(result.value);
} else {
  console.error(result.error);
}
```

## Intersection Types

Where unions say "A or B", intersections say "A and B".
Like embedding structs in Go:

```typescript
type Timestamped = {
  createdAt: Date;
  updatedAt: Date;
};

type SoftDeletable = {
  deletedAt: Date | null;
};

type User = {
  id: number;
  name: string;
} & Timestamped & SoftDeletable;
```

## Mapped Types

Mapped types transform every property of a type. Think of them as a
`map()` function but for types instead of arrays.

```typescript
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

type Optional<T> = {
  [K in keyof T]?: T[K];
};

type Nullable<T> = {
  [K in keyof T]: T[K] | null;
};

interface Config {
  host: string;
  port: number;
  debug: boolean;
}

type ReadonlyConfig = Readonly<Config>;
type PartialConfig = Optional<Config>;
```

```
  MAPPED TYPE FLOW
  ================

  Input: Config { host: string; port: number; debug: boolean }
                    |
                    v
  [K in keyof T]:  K iterates over "host" | "port" | "debug"
                    |
                    v
  Readonly<T>:     { readonly host: string; readonly port: number; readonly debug: boolean }
```

## Conditional Types

Conditional types are if/else for the type system.
Like Rust's where clauses but more flexible.

```typescript
type IsString<T> = T extends string ? "yes" : "no";

type A = IsString<string>;
type B = IsString<number>;

type Flatten<T> = T extends Array<infer U> ? U : T;

type C = Flatten<string[]>;
type D = Flatten<number>;
```

```
  CONDITIONAL TYPE LOGIC
  ======================

  IsString<string>
    string extends string?  --> YES --> "yes"

  IsString<number>
    number extends string?  --> NO  --> "no"

  Flatten<string[]>
    string[] extends Array<infer U>?  --> YES, U = string --> string

  Flatten<number>
    number extends Array<infer U>?    --> NO --> number
```

## The `infer` Keyword

`infer` extracts types from inside other types. Like pattern matching
on type structure:

```typescript
type ReturnType<T> = T extends (...args: any[]) => infer R ? R : never;

type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;

type A = ReturnType<() => string>;
type B = UnwrapPromise<Promise<number>>;
type C = UnwrapPromise<string>;
```

## Template Literal Types

Build string types from other types:

```typescript
type HTTPMethod = "GET" | "POST" | "PUT" | "DELETE";
type APIVersion = "v1" | "v2";
type Endpoint = `/${APIVersion}/${string}`;

type EventName = `on${Capitalize<"click" | "focus" | "blur">}`;

function emitEvent(name: EventName): void {
  console.log(`Emitting: ${name}`);
}

emitEvent("onClick");
emitEvent("onFocus");
```

## Distributive Conditional Types

When a conditional type receives a union, it distributes over each member:

```typescript
type ToArray<T> = T extends unknown ? T[] : never;

type Result = ToArray<string | number>;
```

```
  DISTRIBUTION
  ============

  ToArray<string | number>
    = ToArray<string> | ToArray<number>
    = string[] | number[]

  NOT (string | number)[]  -- that would be a mixed array
```

## Recursive Types

Types can reference themselves, just like recursive data structures:

```typescript
type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

type TreeNode<T> = {
  value: T;
  children: TreeNode<T>[];
};

const tree: TreeNode<string> = {
  value: "root",
  children: [
    { value: "child1", children: [] },
    { value: "child2", children: [{ value: "grandchild", children: [] }] },
  ],
};
```

## Exercises

1. Write a generic `Stack<T>` type with `push`, `pop`, and `peek` operations. Implement it as a class with proper typing.

2. Create a discriminated union `APIResponse<T>` with variants: `loading`, `success` (with `data: T`), and `error` (with `message: string` and `code: number`). Write a function that renders each state.

3. Write a conditional type `DeepReadonly<T>` that makes all properties (including nested objects) readonly.

4. Create a mapped type `Validators<T>` that transforms `{ name: string; age: number }` into `{ name: (val: string) => boolean; age: (val: number) => boolean }`.

5. Using template literal types, create an `CSSProperty` type that generates all combinations like `"margin-top"`, `"margin-bottom"`, `"padding-left"`, etc.

---

[← Lesson 01](./01-typescript-for-systems-devs.md) | [Next: Lesson 03 - Utility Types →](./03-utility-types.md)
