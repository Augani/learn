# Lesson 01: TypeScript for Systems Devs

## Why TypeScript Exists

Think of JavaScript as a sports car with no seatbelts. Fast, fun, deadly.
TypeScript adds seatbelts, airbags, and lane assist — without changing the engine.

```
  JavaScript                    TypeScript
  ==========                    ==========
  let x = "hello"              let x: string = "hello"
  x = 42  // fine, YOLO        x = 42  // ERROR at compile time
  obj.foo.bar  // runtime 💥    obj?.foo?.bar  // type-checked
```

TypeScript compiles to JavaScript. Every browser, every server runs JS.
The types vanish at runtime — they exist only to catch bugs early.

## TS vs Rust vs Go: A Comparison

```
  FEATURE            RUST           GO             TYPESCRIPT
  ===============    ===========    ===========    ==============
  Type system        Algebraic      Structural     Structural
  Null handling      Option<T>      nil + ok       T | undefined
  Error handling     Result<T,E>    (val, err)     try/catch
  Generics           Yes            Yes (1.18+)    Yes
  Runtime            Native         GC runtime     JS engine (V8)
  Concurrency        async/Tokio    goroutines     event loop
  Memory             Ownership      GC             GC
  Compile target     Machine code   Machine code   JavaScript
  Ecosystem          crates.io      pkg.go.dev     npmjs.com
```

## The Type System: Structural Typing

Rust and Go use nominal typing (mostly). TypeScript uses structural typing.
Think of it like a restaurant: Rust checks your ID. TypeScript checks if you're wearing shoes.

```typescript
interface Dog {
  name: string;
  bark(): void;
}

interface NoisyThing {
  name: string;
  bark(): void;
}

const rex: Dog = { name: "Rex", bark: () => console.log("Woof!") };
const thing: NoisyThing = rex;
```

No `implements`, no `as`. If the shape fits, it works.
In Rust you'd need explicit trait implementations. Here, structure is everything.

## Primitive Types

```typescript
const name: string = "Alice";
const age: number = 30;
const active: boolean = true;
const nothing: null = null;
const missing: undefined = undefined;
const big: bigint = 9007199254740991n;
const id: symbol = Symbol("id");
```

Compare to Rust:

```
  Rust        TypeScript     Notes
  ========    ===========    =========================
  i32/u64     number         One number type (f64 under hood)
  String      string         Primitive, not object
  bool        boolean        Same concept
  ()          void           Unit type / no return
  !           never          Function never returns
  Option<T>   T | undefined  Nullable via union
```

## Object Types and Interfaces

```typescript
interface User {
  id: number;
  name: string;
  email: string;
  role: "admin" | "user";
}

type Point = {
  x: number;
  y: number;
};
```

`interface` and `type` are nearly interchangeable. Convention:
- `interface` for object shapes (extendable)
- `type` for unions, tuples, computed types

## Type Aliases vs Interfaces

```
  INTERFACE                          TYPE ALIAS
  =========                          ==========
  interface Foo {                    type Foo = {
    bar: string;                       bar: string;
  }                                  };

  interface Foo {                    // ERROR: duplicate
    baz: number;    <-- merges!
  }

  extends other interfaces           intersections with &
  cannot do unions                   type A = B | C  <-- works
```

## Enums and Literal Types

Rust enums are powerful algebraic types. TS enums are simpler.
Prefer string literal unions — they're more idiomatic:

```typescript
type Direction = "north" | "south" | "east" | "west";

function move(dir: Direction): void {
  switch (dir) {
    case "north": break;
    case "south": break;
    case "east": break;
    case "west": break;
  }
}
```

If you miss Rust's `match` exhaustiveness, use the `never` trick:

```typescript
function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${value}`);
}

function move(dir: Direction): void {
  switch (dir) {
    case "north": return;
    case "south": return;
    case "east": return;
    case "west": return;
    default: assertNever(dir);
  }
}
```

## Arrays and Tuples

```typescript
const nums: number[] = [1, 2, 3];
const names: Array<string> = ["Alice", "Bob"];

const pair: [string, number] = ["age", 30];
const rgb: [number, number, number] = [255, 128, 0];

const record: readonly [string, number] = ["fixed", 42];
```

## Functions

```typescript
function add(a: number, b: number): number {
  return a + b;
}

const multiply = (a: number, b: number): number => a * b;

type MathFn = (a: number, b: number) => number;
const divide: MathFn = (a, b) => {
  if (b === 0) throw new Error("Division by zero");
  return a / b;
};
```

## Type Narrowing (Pattern Matching Lite)

```typescript
function process(input: string | number | null): string {
  if (input === null) {
    return "nothing";
  }
  if (typeof input === "string") {
    return input.toUpperCase();
  }
  return input.toFixed(2);
}
```

```
  TYPE NARROWING FLOW
  ===================

  input: string | number | null
       |
       +-- null check -----> null removed
       |                     input: string | number
       +-- typeof "string" -> string branch
       |                      input: string
       +-- else -----------> number branch
                              input: number
```

## Your First TypeScript Program

```typescript
interface Task {
  id: number;
  title: string;
  done: boolean;
}

function createTask(title: string, id: number): Task {
  return { id, title, done: false };
}

function toggleTask(task: Task): Task {
  return { ...task, done: !task.done };
}

function summarize(tasks: Task[]): string {
  const done = tasks.filter((t) => t.done).length;
  return `${done}/${tasks.length} tasks complete`;
}

const tasks: Task[] = [
  createTask("Learn TS", 1),
  createTask("Build app", 2),
];

const updated = tasks.map((t) => (t.id === 1 ? toggleTask(t) : t));
console.log(summarize(updated));
```

## Exercises

1. Define a `Vehicle` interface with `make`, `model`, `year`, and an optional `color` field. Write a function `describe(v: Vehicle): string` that returns a formatted description.

2. Create a `Shape` type that is a union of `Circle` (with `radius`) and `Rectangle` (with `width` and `height`). Write an `area` function that handles both using type narrowing.

3. Write a `Result<T, E>` type alias (like Rust's) using a discriminated union. Implement `ok<T>(value: T)` and `err<E>(error: E)` constructor functions.

4. Convert this Go-style function to idiomatic TypeScript:
   ```go
   func divide(a, b float64) (float64, error) {
       if b == 0 {
           return 0, fmt.Errorf("division by zero")
       }
       return a / b, nil
   }
   ```

---

[← Back to Roadmap](./00-roadmap.md) | [Next: Lesson 02 - Type System Deep Dive →](./02-type-system-deep-dive.md)
