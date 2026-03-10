# Lesson 08: Composite and Bridge

> **The one thing to remember**: Composite lets you treat a group of
> objects the same way you treat a single object (like how a folder
> can contain files AND other folders, but you can "open" either one).
> Bridge separates WHAT something does from HOW it does it, so the
> two can change independently.

---

## Composite Pattern

### The File System Analogy

On your computer, a folder can contain files and other folders.
When you calculate the size of a folder, you sum up all the files
inside it — including files in sub-folders. The key insight: both
files and folders support the same operation ("what's your size?"),
even though one is a leaf and the other is a container.

```
COMPOSITE: TREE STRUCTURES

  Root Folder (150 KB total)
  ├── readme.txt (10 KB)           ← leaf
  ├── Images/ (90 KB total)        ← composite (contains leaves)
  │   ├── photo.jpg (50 KB)        ← leaf
  │   └── icon.png (40 KB)         ← leaf
  └── src/ (50 KB total)           ← composite
      ├── main.ts (30 KB)          ← leaf
      └── utils.ts (20 KB)         ← leaf

  Both files and folders answer: "what's your size?"
  A file returns its own size.
  A folder sums its children's sizes.
  Same interface, different behavior.
```

### When You Need Composite

- You have tree-structured data (menus, org charts, file systems)
- You want to treat individual objects and groups uniformly
- Operations on the whole tree should work recursively
- Users shouldn't need to know if they're dealing with a leaf or
  a container

### Composite in TypeScript

```typescript
interface FileSystemNode {
  name: string;
  size(): number;
  display(indent?: number): string;
}

class File implements FileSystemNode {
  constructor(
    public name: string,
    private bytes: number
  ) {}

  size(): number {
    return this.bytes;
  }

  display(indent: number = 0): string {
    const prefix = "  ".repeat(indent);
    return `${prefix}${this.name} (${this.bytes} bytes)`;
  }
}

class Directory implements FileSystemNode {
  private children: FileSystemNode[] = [];

  constructor(public name: string) {}

  add(node: FileSystemNode): void {
    this.children.push(node);
  }

  remove(name: string): void {
    this.children = this.children.filter((c) => c.name !== name);
  }

  size(): number {
    return this.children.reduce((total, child) => total + child.size(), 0);
  }

  display(indent: number = 0): string {
    const prefix = "  ".repeat(indent);
    const header = `${prefix}${this.name}/ (${this.size()} bytes)`;
    const contents = this.children
      .map((child) => child.display(indent + 1))
      .join("\n");
    return `${header}\n${contents}`;
  }
}

const root = new Directory("project");
const src = new Directory("src");
src.add(new File("main.ts", 3000));
src.add(new File("utils.ts", 1500));
root.add(src);
root.add(new File("README.md", 500));

console.log(root.display());
console.log(`Total: ${root.size()} bytes`);
```

### Composite for UI Components

Composite is everywhere in UI frameworks. A container holds widgets,
and a widget can be a button (leaf) or a panel (container of more
widgets).

```typescript
interface UIComponent {
  render(): string;
  width(): number;
  height(): number;
}

class Button implements UIComponent {
  constructor(private label: string) {}
  render(): string { return `<button>${this.label}</button>`; }
  width(): number { return 80; }
  height(): number { return 30; }
}

class TextBox implements UIComponent {
  constructor(private placeholder: string) {}
  render(): string { return `<input placeholder="${this.placeholder}">`; }
  width(): number { return 200; }
  height(): number { return 30; }
}

class Panel implements UIComponent {
  private children: UIComponent[] = [];

  add(component: UIComponent): void {
    this.children.push(component);
  }

  render(): string {
    const inner = this.children.map((c) => c.render()).join("\n");
    return `<div>\n${inner}\n</div>`;
  }

  width(): number {
    return Math.max(...this.children.map((c) => c.width()), 0);
  }

  height(): number {
    return this.children.reduce((sum, c) => sum + c.height(), 0);
  }
}
```

### Composite in Python

```python
from abc import ABC, abstractmethod

class MenuItem(ABC):
    @abstractmethod
    def price(self) -> float: ...

    @abstractmethod
    def description(self) -> str: ...

class SingleItem(MenuItem):
    def __init__(self, name: str, cost: float):
        self._name = name
        self._cost = cost

    def price(self) -> float:
        return self._cost

    def description(self) -> str:
        return f"{self._name}: ${self._cost:.2f}"

class ComboMeal(MenuItem):
    def __init__(self, name: str, discount: float = 0.0):
        self._name = name
        self._items: list[MenuItem] = []
        self._discount = discount

    def add(self, item: MenuItem) -> None:
        self._items.append(item)

    def price(self) -> float:
        total = sum(item.price() for item in self._items)
        return total * (1 - self._discount)

    def description(self) -> str:
        items = "\n  ".join(item.description() for item in self._items)
        return f"{self._name} (${self.price():.2f}):\n  {items}"

burger = SingleItem("Burger", 8.99)
fries = SingleItem("Fries", 3.99)
drink = SingleItem("Drink", 1.99)

combo = ComboMeal("Value Meal", discount=0.15)
combo.add(burger)
combo.add(fries)
combo.add(drink)
```

### Composite in Rust

```rust
enum Expression {
    Number(f64),
    Add(Box<Expression>, Box<Expression>),
    Multiply(Box<Expression>, Box<Expression>),
}

impl Expression {
    fn evaluate(&self) -> f64 {
        match self {
            Expression::Number(n) => *n,
            Expression::Add(left, right) => left.evaluate() + right.evaluate(),
            Expression::Multiply(left, right) => left.evaluate() * right.evaluate(),
        }
    }

    fn display(&self) -> String {
        match self {
            Expression::Number(n) => n.to_string(),
            Expression::Add(l, r) => format!("({} + {})", l.display(), r.display()),
            Expression::Multiply(l, r) => format!("({} * {})", l.display(), r.display()),
        }
    }
}

let expr = Expression::Add(
    Box::new(Expression::Number(3.0)),
    Box::new(Expression::Multiply(
        Box::new(Expression::Number(4.0)),
        Box::new(Expression::Number(5.0)),
    )),
);

assert_eq!(expr.evaluate(), 23.0);
```

Rust's enum-based approach is particularly clean for Composite
because the compiler forces you to handle every variant.

### Composite in Go

```go
type Graphic interface {
    Draw()
    BoundingBox() Rectangle
}

type Circle struct {
    X, Y, Radius float64
}

func (c *Circle) Draw() { fmt.Printf("Circle at (%v,%v)\n", c.X, c.Y) }
func (c *Circle) BoundingBox() Rectangle {
    return Rectangle{c.X - c.Radius, c.Y - c.Radius,
                     c.Radius * 2, c.Radius * 2}
}

type Group struct {
    children []Graphic
}

func (g *Group) Add(child Graphic)    { g.children = append(g.children, child) }
func (g *Group) Draw() {
    for _, child := range g.children {
        child.Draw()
    }
}
func (g *Group) BoundingBox() Rectangle {
    if len(g.children) == 0 {
        return Rectangle{}
    }
    box := g.children[0].BoundingBox()
    for _, child := range g.children[1:] {
        box = box.Union(child.BoundingBox())
    }
    return box
}
```

---

## Bridge Pattern

### The Remote Control Analogy

Think about TVs and remote controls. You can have different types
of remotes (basic, advanced) and different types of TVs (Sony,
Samsung, LG). Without Bridge, you'd need: BasicSonyRemote,
BasicSamsungRemote, AdvancedSonyRemote, AdvancedSamsungRemote...

Bridge says: keep remotes and TVs as separate hierarchies, connected
by a "bridge" (an interface).

```
WITHOUT BRIDGE: class explosion

  BasicSonyRemote
  BasicSamsungRemote
  BasicLGRemote
  AdvancedSonyRemote
  AdvancedSamsungRemote
  AdvancedLGRemote
  → 2 remote types × 3 TV brands = 6 classes
  → 5 remote types × 10 brands = 50 classes!

WITH BRIDGE: two independent hierarchies

  Remote hierarchy          TV hierarchy
  ┌──────────────┐          ┌──────────────┐
  │   Remote     │─────────→│   Device     │ ← bridge (interface)
  └──────┬───────┘          └──────┬───────┘
         │                         │
    ┌────┴────┐              ┌─────┴─────┐
    │         │              │     │     │
  Basic   Advanced         Sony Samsung LG

  → 2 + 3 = 5 classes (instead of 6)
  → 5 + 10 = 15 classes (instead of 50)
```

### When You Need Bridge

- You have two dimensions of variation (what × how)
- You want to extend both dimensions independently
- You want to avoid a combinatorial explosion of classes
- You need to swap implementations at runtime

### Bridge in TypeScript

```typescript
interface Renderer {
  renderCircle(x: number, y: number, radius: number): void;
  renderRect(x: number, y: number, width: number, height: number): void;
}

class SvgRenderer implements Renderer {
  renderCircle(x: number, y: number, radius: number): void {
    console.log(`<circle cx="${x}" cy="${y}" r="${radius}"/>`);
  }
  renderRect(x: number, y: number, width: number, height: number): void {
    console.log(`<rect x="${x}" y="${y}" width="${width}" height="${height}"/>`);
  }
}

class CanvasRenderer implements Renderer {
  constructor(private ctx: CanvasRenderingContext2D) {}

  renderCircle(x: number, y: number, radius: number): void {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }
  renderRect(x: number, y: number, width: number, height: number): void {
    this.ctx.fillRect(x, y, width, height);
  }
}

abstract class Shape {
  constructor(protected renderer: Renderer) {}
  abstract draw(): void;
}

class CircleShape extends Shape {
  constructor(renderer: Renderer, private x: number,
              private y: number, private radius: number) {
    super(renderer);
  }

  draw(): void {
    this.renderer.renderCircle(this.x, this.y, this.radius);
  }
}

const svgCircle = new CircleShape(new SvgRenderer(), 10, 20, 5);
svgCircle.draw();
```

### Bridge in Python

```python
from abc import ABC, abstractmethod

class MessageTransport(ABC):
    @abstractmethod
    def send_raw(self, recipient: str, content: str) -> None: ...

class EmailTransport(MessageTransport):
    def send_raw(self, recipient: str, content: str) -> None:
        smtp_send(recipient, content)

class SmsTransport(MessageTransport):
    def send_raw(self, recipient: str, content: str) -> None:
        sms_gateway_send(recipient, content[:160])

class Message(ABC):
    def __init__(self, transport: MessageTransport):
        self._transport = transport

    @abstractmethod
    def send(self, recipient: str) -> None: ...

class UrgentMessage(Message):
    def __init__(self, transport: MessageTransport, body: str):
        super().__init__(transport)
        self._body = body

    def send(self, recipient: str) -> None:
        self._transport.send_raw(recipient, f"URGENT: {self._body}")

class RegularMessage(Message):
    def __init__(self, transport: MessageTransport, body: str):
        super().__init__(transport)
        self._body = body

    def send(self, recipient: str) -> None:
        self._transport.send_raw(recipient, self._body)

urgent_sms = UrgentMessage(SmsTransport(), "Server is down")
urgent_sms.send("+1234567890")
```

### Bridge in Rust

```rust
trait Persistence {
    fn save(&self, key: &str, data: &[u8]) -> Result<(), PersistError>;
    fn load(&self, key: &str) -> Result<Vec<u8>, PersistError>;
}

struct FilePersistence {
    base_path: PathBuf,
}

impl Persistence for FilePersistence {
    fn save(&self, key: &str, data: &[u8]) -> Result<(), PersistError> {
        std::fs::write(self.base_path.join(key), data)?;
        Ok(())
    }

    fn load(&self, key: &str) -> Result<Vec<u8>, PersistError> {
        Ok(std::fs::read(self.base_path.join(key))?)
    }
}

struct S3Persistence {
    bucket: String,
    client: S3Client,
}

impl Persistence for S3Persistence {
    fn save(&self, key: &str, data: &[u8]) -> Result<(), PersistError> {
        self.client.put_object(&self.bucket, key, data)?;
        Ok(())
    }

    fn load(&self, key: &str) -> Result<Vec<u8>, PersistError> {
        Ok(self.client.get_object(&self.bucket, key)?)
    }
}

struct Document<P: Persistence> {
    persistence: P,
    title: String,
    content: String,
}

impl<P: Persistence> Document<P> {
    fn save(&self) -> Result<(), PersistError> {
        let data = format!("{}\n{}", self.title, self.content);
        self.persistence.save(&self.title, data.as_bytes())
    }
}
```

### Bridge in Go

```go
type Renderer interface {
    Render(data []byte) (string, error)
}

type HTMLRenderer struct{}
func (r HTMLRenderer) Render(data []byte) (string, error) {
    return "<html>" + string(data) + "</html>", nil
}

type JSONRenderer struct{}
func (r JSONRenderer) Render(data []byte) (string, error) {
    return `{"content":"` + string(data) + `"}`, nil
}

type Report struct {
    renderer Renderer
    title    string
    content  string
}

func (r *Report) Generate() (string, error) {
    data := []byte(r.title + ": " + r.content)
    return r.renderer.Render(data)
}

htmlReport := &Report{renderer: HTMLRenderer{}, title: "Sales", content: "..."}
jsonReport := &Report{renderer: JSONRenderer{}, title: "Sales", content: "..."}
```

---

## Composite vs Bridge

```
COMPOSITE vs BRIDGE

  COMPOSITE                        BRIDGE
  ─────────────────────────────    ─────────────────────────────
  Part-whole hierarchies           Two independent dimensions

  "A group of shapes IS a shape"   "A shape HAS a renderer"

  Treats leaf and container        Separates abstraction from
  the same way                     implementation

  Use for: trees, nested menus,    Use for: avoiding class
  file systems, UI containers      explosion, swappable backends
```

---

## Exercises

1. **Composite**: Build an organization chart where teams contain
   members and sub-teams. Calculate total salary for any node.

2. **Bridge**: Create a notification system with two dimensions:
   urgency (normal, urgent, critical) and channel (email, SMS,
   Slack). Use Bridge to avoid creating 9 separate classes.

3. **Composite + Visitor**: Extend your file system composite to
   support a "find by extension" operation without modifying the
   node classes.

4. **Identify Bridge**: Think of a real system with two independent
   dimensions of variation. How would Bridge simplify it?

---

[← Previous: Decorator and Proxy](./07-decorator-proxy.md) · [Next: Lesson 09 — Strategy and Observer →](./09-strategy-observer.md)
