# Lesson 11: Iterator and Template Method

> **The one thing to remember**: Iterator gives you a way to walk
> through a collection one item at a time without knowing how the
> collection stores its data — like flipping through pages of a book
> without knowing how the printing press works. Template Method
> defines the skeleton of an algorithm and lets subclasses fill in
> specific steps — like a recipe that says "add seasoning" but lets
> each chef choose which spices.

---

## Iterator Pattern

### The Playlist Analogy

Think about a music playlist. You press "next" to go to the next
song. You don't care whether the playlist is stored as an array, a
linked list, a database query, or streamed from the cloud. All you
need is: "give me the next song" and "are there more songs?"

```
ITERATOR: WALK THROUGH ANY COLLECTION

  Array:       [A] [B] [C] [D]
                → → → →

  Linked List: A → B → C → D
                → → → →

  Tree:            A
                  / \
                 B   C       → A → B → D → E → C
                / \
               D   E

  Database:    SELECT * FROM songs
               Row 1 → Row 2 → Row 3 → ...

  All four use the same interface:
    next()    → gives you the next item
    hasNext() → tells you if there are more items
```

### When You Need Iterator

- You want to traverse a collection without exposing its internals
- You need multiple ways to traverse the same collection (forward,
  backward, filtered, sorted)
- You want a uniform interface across different collection types
- You're building lazy evaluation (items computed on demand)

### Iterator in TypeScript

```typescript
interface Iterator<T> {
  next(): { value: T; done: boolean };
  hasNext(): boolean;
}

class RangeIterator implements Iterator<number> {
  private current: number;

  constructor(
    private start: number,
    private end: number,
    private step: number = 1
  ) {
    this.current = start;
  }

  hasNext(): boolean {
    return this.current < this.end;
  }

  next(): { value: number; done: boolean } {
    if (!this.hasNext()) {
      return { value: 0, done: true };
    }
    const value = this.current;
    this.current += this.step;
    return { value, done: false };
  }
}

const evens = new RangeIterator(0, 20, 2);
while (evens.hasNext()) {
  console.log(evens.next().value);
}
```

TypeScript (and JavaScript) have built-in iterator support via the
`Symbol.iterator` protocol:

```typescript
class Fibonacci {
  *[Symbol.iterator]() {
    let a = 0;
    let b = 1;
    while (true) {
      yield a;
      [a, b] = [b, a + b];
    }
  }
}

for (const num of new Fibonacci()) {
  if (num > 100) break;
  console.log(num);
}
```

### Iterator in Python

Python's iterator protocol is built into the language with `__iter__`
and `__next__`. Generators make it even simpler:

```python
class FileLineIterator:
    def __init__(self, path: str):
        self._file = open(path, "r")

    def __iter__(self):
        return self

    def __next__(self) -> str:
        line = self._file.readline()
        if not line:
            self._file.close()
            raise StopIteration
        return line.strip()

for line in FileLineIterator("data.txt"):
    print(line)
```

Generators are the Pythonic way to create iterators:

```python
def paginated_fetch(url: str, page_size: int = 100):
    page = 1
    while True:
        response = fetch(f"{url}?page={page}&size={page_size}")
        items = response.json()["items"]
        if not items:
            return
        for item in items:
            yield item
        page += 1

for user in paginated_fetch("https://api.example.com/users"):
    process(user)
```

This fetches pages lazily. It doesn't load all users into memory
at once — it fetches the next page only when needed.

### Iterator in Rust

Rust's iterator system is one of its strongest features. The
`Iterator` trait provides dozens of adapter methods:

```rust
struct Counter {
    start: u64,
    end: u64,
    current: u64,
}

impl Counter {
    fn new(start: u64, end: u64) -> Self {
        Self { start, end, current: start }
    }
}

impl Iterator for Counter {
    type Item = u64;

    fn next(&mut self) -> Option<u64> {
        if self.current >= self.end {
            return None;
        }
        let value = self.current;
        self.current += 1;
        Some(value)
    }
}

let sum: u64 = Counter::new(1, 101)
    .filter(|n| n % 2 == 0)
    .map(|n| n * n)
    .sum();
```

Rust iterators are **zero-cost abstractions** — the compiler
optimizes them to be as fast as hand-written loops.

### Iterator in Go

Go doesn't have a formal iterator interface, but uses channels
or the newer `iter` package pattern:

```go
type TreeNode struct {
    Value    int
    Left     *TreeNode
    Right    *TreeNode
}

func (n *TreeNode) InOrder() <-chan int {
    ch := make(chan int)
    go func() {
        defer close(ch)
        n.inOrderWalk(ch)
    }()
    return ch
}

func (n *TreeNode) inOrderWalk(ch chan<- int) {
    if n == nil {
        return
    }
    n.Left.inOrderWalk(ch)
    ch <- n.Value
    n.Right.inOrderWalk(ch)
}

tree := buildTree()
for value := range tree.InOrder() {
    fmt.Println(value)
}
```

A simpler approach using a callback:

```go
func (n *TreeNode) ForEach(fn func(int)) {
    if n == nil {
        return
    }
    n.Left.ForEach(fn)
    fn(n.Value)
    n.Right.ForEach(fn)
}

tree.ForEach(func(v int) {
    fmt.Println(v)
})
```

---

## Template Method Pattern

### The Recipe Analogy

A recipe for "baked dish" has a fixed structure:

1. Preheat oven
2. **Prepare ingredients** ← varies by dish
3. **Season** ← varies by dish
4. Place in oven
5. Bake for a time
6. **Garnish** ← varies by dish
7. Serve

Steps 1, 4, 5, 7 are always the same. Steps 2, 3, 6 change
depending on whether you're making lasagna or roasted chicken.
Template Method defines the fixed skeleton and lets subclasses
override the variable steps.

```
TEMPLATE METHOD: ALGORITHM SKELETON

  ┌─────────────────────────────────┐
  │  BakedDish (template)           │
  │                                 │
  │  cook() {                       │   ← the template method
  │    preheatOven()                │   ← fixed step
  │    prepareIngredients()  ←──────│── abstract (override me)
  │    season()              ←──────│── abstract (override me)
  │    bake()                       │   ← fixed step
  │    garnish()             ←──────│── abstract (override me)
  │    serve()                      │   ← fixed step
  │  }                              │
  └─────────────────────────────────┘
         ↑                  ↑
    ┌─────────┐        ┌─────────┐
    │ Lasagna │        │ Chicken │
    │         │        │         │
    │ prepare │        │ prepare │
    │ season  │        │ season  │
    │ garnish │        │ garnish │
    └─────────┘        └─────────┘
```

### When You Need Template Method

- Multiple classes follow the same algorithm but differ in specific
  steps
- You want to control the overall flow while allowing customization
- You want to avoid code duplication across similar algorithms
- The order of steps matters and shouldn't be changed by subclasses

### Template Method in TypeScript

```typescript
abstract class DataMiner {
  mine(source: string): AnalysisResult {
    const rawData = this.extractData(source);
    const cleanData = this.cleanData(rawData);
    const parsed = this.parseData(cleanData);
    const analyzed = this.analyzeData(parsed);
    return this.generateReport(analyzed);
  }

  protected abstract extractData(source: string): string;

  protected cleanData(data: string): string {
    return data.trim().replace(/\s+/g, " ");
  }

  protected abstract parseData(data: string): Record<string, unknown>[];

  protected analyzeData(
    data: Record<string, unknown>[]
  ): AnalysisSummary {
    return {
      rowCount: data.length,
      columns: Object.keys(data[0] ?? {}),
    };
  }

  protected abstract generateReport(summary: AnalysisSummary): AnalysisResult;
}

class CsvMiner extends DataMiner {
  protected extractData(source: string): string {
    return fs.readFileSync(source, "utf-8");
  }

  protected parseData(data: string): Record<string, unknown>[] {
    const [header, ...rows] = data.split("\n");
    const columns = header.split(",");
    return rows.map((row) => {
      const values = row.split(",");
      return Object.fromEntries(columns.map((col, i) => [col, values[i]]));
    });
  }

  protected generateReport(summary: AnalysisSummary): AnalysisResult {
    return { format: "text", summary };
  }
}

class ApiMiner extends DataMiner {
  protected extractData(source: string): string {
    return httpGet(source);
  }

  protected parseData(data: string): Record<string, unknown>[] {
    return JSON.parse(data);
  }

  protected generateReport(summary: AnalysisSummary): AnalysisResult {
    return { format: "json", summary };
  }
}
```

### Template Method in Python

```python
from abc import ABC, abstractmethod

class TestFramework(ABC):
    def run_test(self, test_name: str) -> TestResult:
        self.set_up()
        try:
            result = self.execute_test(test_name)
            self.verify_result(result)
            return TestResult(test_name, passed=True)
        except AssertionError as e:
            return TestResult(test_name, passed=False, error=str(e))
        finally:
            self.tear_down()

    def set_up(self) -> None:
        pass

    @abstractmethod
    def execute_test(self, test_name: str) -> object: ...

    @abstractmethod
    def verify_result(self, result: object) -> None: ...

    def tear_down(self) -> None:
        pass

class DatabaseTest(TestFramework):
    def set_up(self) -> None:
        self.db = create_test_database()
        self.db.begin_transaction()

    def execute_test(self, test_name: str) -> object:
        return self.db.execute(f"SELECT * FROM {test_name}")

    def verify_result(self, result: object) -> None:
        assert len(result) > 0, "Query returned no results"

    def tear_down(self) -> None:
        self.db.rollback()
        self.db.close()

class ApiTest(TestFramework):
    def execute_test(self, test_name: str) -> object:
        return http_get(f"/api/{test_name}")

    def verify_result(self, result: object) -> None:
        assert result.status_code == 200
```

### Template Method in Rust

Rust doesn't have inheritance, but traits with default methods
achieve the same thing:

```rust
trait DataPipeline {
    fn run(&self, input: &str) -> Result<String, PipelineError> {
        let raw = self.fetch(input)?;
        let validated = self.validate(&raw)?;
        let transformed = self.transform(&validated)?;
        self.store(&transformed)?;
        Ok(transformed)
    }

    fn fetch(&self, source: &str) -> Result<String, PipelineError>;
    fn validate(&self, data: &str) -> Result<String, PipelineError> {
        if data.is_empty() {
            return Err(PipelineError::EmptyData);
        }
        Ok(data.to_string())
    }
    fn transform(&self, data: &str) -> Result<String, PipelineError>;
    fn store(&self, data: &str) -> Result<(), PipelineError>;
}

struct CsvPipeline {
    output_path: String,
}

impl DataPipeline for CsvPipeline {
    fn fetch(&self, source: &str) -> Result<String, PipelineError> {
        std::fs::read_to_string(source)
            .map_err(|e| PipelineError::FetchError(e.to_string()))
    }

    fn transform(&self, data: &str) -> Result<String, PipelineError> {
        Ok(data.to_uppercase())
    }

    fn store(&self, data: &str) -> Result<(), PipelineError> {
        std::fs::write(&self.output_path, data)
            .map_err(|e| PipelineError::StoreError(e.to_string()))
    }
}
```

### Template Method in Go

Go uses embedded structs and interfaces:

```go
type GameLoader interface {
    Initialize()
    LoadAssets()
    CreateWorld()
    StartLoop()
}

type BaseGame struct {
    loader GameLoader
}

func (g *BaseGame) Start() {
    g.loader.Initialize()
    g.loader.LoadAssets()
    g.loader.CreateWorld()
    g.loader.StartLoop()
}

type PuzzleGame struct{}

func (p *PuzzleGame) Initialize() { fmt.Println("Init puzzle engine") }
func (p *PuzzleGame) LoadAssets()  { fmt.Println("Load puzzle textures") }
func (p *PuzzleGame) CreateWorld() { fmt.Println("Generate puzzle grid") }
func (p *PuzzleGame) StartLoop()   { fmt.Println("Start puzzle loop") }

game := &BaseGame{loader: &PuzzleGame{}}
game.Start()
```

---

## Iterator vs Template Method

```
COMPARISON

  ITERATOR                          TEMPLATE METHOD
  ────────────────────────────      ────────────────────────────
  Abstracts HOW you traverse        Abstracts WHICH STEPS vary
  a collection                      in an algorithm

  Used by: consumers of data        Used by: algorithm designers

  External interface                 Internal structure
  (callers use it)                   (subclasses customize it)

  "Give me items one at a time"      "Run these steps, but let me
                                      customize steps 2 and 4"
```

---

## Exercises

1. **Custom iterator**: Build an iterator that traverses a 2D grid
   in spiral order. Test it with a 4x4 matrix.

2. **Lazy iterator**: Create an iterator that reads a large file
   line by line without loading it all into memory. Add `filter()`
   and `map()` methods that return new iterators.

3. **Template Method**: Build a report generator with the skeleton:
   gather data → validate → format → export. Create implementations
   for PDF and HTML reports.

4. **Combine them**: Create a data processing pipeline (Template
   Method) where one of the steps iterates through records using
   a custom Iterator.

---

[← Previous: Command and State](./10-command-state.md) · [Next: Lesson 12 — Dependency Injection →](./12-dependency-injection.md)
