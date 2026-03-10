# Lesson 10: Command and State

> **The one thing to remember**: Command turns an action into an
> object you can store, queue, undo, or replay — like writing
> instructions on a card instead of just saying them out loud.
> State lets an object change its behavior when its internal
> condition changes — like how a vending machine acts differently
> depending on whether you've inserted coins.

---

## Command Pattern

### The Restaurant Order Analogy

When you order at a restaurant, the server doesn't cook your food.
They write your order on a slip of paper and pass it to the kitchen.
That slip IS the command: it describes what needs to happen, can be
queued, and can be cancelled before cooking starts.

```
COMMAND: ACTION AS AN OBJECT

  Without Command:
  Customer → directly tells Chef to cook   (tightly coupled)

  With Command:
  Customer → writes Order Slip → goes to Queue → Chef reads & cooks

  The order slip (command) can be:
  ✓ Queued        (line up orders)
  ✓ Prioritized   (rush orders first)
  ✓ Cancelled     (before cooking starts)
  ✓ Logged        (track what was ordered)
  ✓ Replayed      (re-order the same thing)
```

### When You Need Command

- Undo/redo functionality
- Queueing and scheduling operations
- Logging operations for replay or audit
- Macro recording (sequence of commands played back)
- Remote execution (serialize a command and send it)

### Command for Undo/Redo in TypeScript

```typescript
interface Command {
  execute(): void;
  undo(): void;
  description(): string;
}

class InsertTextCommand implements Command {
  constructor(
    private document: TextDocument,
    private position: number,
    private text: string
  ) {}

  execute(): void {
    this.document.insert(this.position, this.text);
  }

  undo(): void {
    this.document.delete(this.position, this.text.length);
  }

  description(): string {
    return `Insert "${this.text}" at position ${this.position}`;
  }
}

class DeleteTextCommand implements Command {
  private deletedText = "";

  constructor(
    private document: TextDocument,
    private position: number,
    private length: number
  ) {}

  execute(): void {
    this.deletedText = this.document.getText(this.position, this.length);
    this.document.delete(this.position, this.length);
  }

  undo(): void {
    this.document.insert(this.position, this.deletedText);
  }

  description(): string {
    return `Delete ${this.length} chars at position ${this.position}`;
  }
}

class CommandHistory {
  private undoStack: Command[] = [];
  private redoStack: Command[] = [];

  execute(command: Command): void {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
  }

  undo(): void {
    const command = this.undoStack.pop();
    if (command) {
      command.undo();
      this.redoStack.push(command);
    }
  }

  redo(): void {
    const command = this.redoStack.pop();
    if (command) {
      command.execute();
      this.undoStack.push(command);
    }
  }

  history(): string[] {
    return this.undoStack.map((cmd) => cmd.description());
  }
}

const doc = new TextDocument();
const history = new CommandHistory();

history.execute(new InsertTextCommand(doc, 0, "Hello "));
history.execute(new InsertTextCommand(doc, 6, "World"));
// doc = "Hello World"

history.undo();
// doc = "Hello "

history.redo();
// doc = "Hello World"
```

### Command in Python

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

class Command(ABC):
    @abstractmethod
    def execute(self) -> None: ...

    @abstractmethod
    def undo(self) -> None: ...

@dataclass
class MoveUnitCommand(Command):
    unit: GameUnit
    dx: int
    dy: int
    _prev_x: int = field(default=0, init=False)
    _prev_y: int = field(default=0, init=False)

    def execute(self) -> None:
        self._prev_x = self.unit.x
        self._prev_y = self.unit.y
        self.unit.x += self.dx
        self.unit.y += self.dy

    def undo(self) -> None:
        self.unit.x = self._prev_x
        self.unit.y = self._prev_y

@dataclass
class AttackCommand(Command):
    attacker: GameUnit
    target: GameUnit
    _damage_dealt: int = field(default=0, init=False)

    def execute(self) -> None:
        self._damage_dealt = calculate_damage(self.attacker, self.target)
        self.target.health -= self._damage_dealt

    def undo(self) -> None:
        self.target.health += self._damage_dealt

class TurnManager:
    def __init__(self):
        self._commands: list[Command] = []

    def do(self, command: Command) -> None:
        command.execute()
        self._commands.append(command)

    def undo_last(self) -> None:
        if self._commands:
            self._commands.pop().undo()

    def undo_all(self) -> None:
        while self._commands:
            self._commands.pop().undo()
```

### Command in Rust

```rust
trait Command {
    fn execute(&mut self, state: &mut AppState);
    fn undo(&mut self, state: &mut AppState);
}

struct AddItemCommand {
    item: String,
    index: Option<usize>,
}

impl Command for AddItemCommand {
    fn execute(&mut self, state: &mut AppState) {
        state.items.push(self.item.clone());
        self.index = Some(state.items.len() - 1);
    }

    fn undo(&mut self, state: &mut AppState) {
        if let Some(idx) = self.index {
            state.items.remove(idx);
        }
    }
}

struct RemoveItemCommand {
    index: usize,
    removed: Option<String>,
}

impl Command for RemoveItemCommand {
    fn execute(&mut self, state: &mut AppState) {
        if self.index < state.items.len() {
            self.removed = Some(state.items.remove(self.index));
        }
    }

    fn undo(&mut self, state: &mut AppState) {
        if let Some(item) = &self.removed {
            state.items.insert(self.index, item.clone());
        }
    }
}

struct History {
    commands: Vec<Box<dyn Command>>,
}

impl History {
    fn execute(&mut self, mut cmd: Box<dyn Command>, state: &mut AppState) {
        cmd.execute(state);
        self.commands.push(cmd);
    }

    fn undo(&mut self, state: &mut AppState) {
        if let Some(mut cmd) = self.commands.pop() {
            cmd.undo(state);
        }
    }
}
```

### Command in Go

```go
type Command interface {
    Execute(state *AppState)
    Undo(state *AppState)
}

type SetValueCommand struct {
    Key      string
    NewValue string
    oldValue string
}

func (c *SetValueCommand) Execute(state *AppState) {
    c.oldValue = state.Get(c.Key)
    state.Set(c.Key, c.NewValue)
}

func (c *SetValueCommand) Undo(state *AppState) {
    state.Set(c.Key, c.oldValue)
}

type CommandQueue struct {
    pending []Command
}

func (q *CommandQueue) Add(cmd Command) {
    q.pending = append(q.pending, cmd)
}

func (q *CommandQueue) ExecuteAll(state *AppState) {
    for _, cmd := range q.pending {
        cmd.Execute(state)
    }
    q.pending = nil
}
```

---

## State Pattern

### The Vending Machine Analogy

A vending machine behaves differently depending on its state:

- **Idle**: waiting for coins. Pressing "dispense" does nothing.
- **Has money**: coins inserted. Pressing "dispense" gives you a snack.
- **Dispensing**: delivering a snack. Can't insert more coins.
- **Out of stock**: rejects coins, shows "SOLD OUT."

Each state responds to the same actions (insert coin, press button)
differently. The State pattern makes each state its own object.

```
STATE: BEHAVIOR CHANGES WITH CONDITION

  ┌─────────────────────────────────────────────┐
  │                Vending Machine               │
  │  current_state: ─────→ [IdleState]           │
  │                                              │
  │  insertCoin()  → delegates to current_state  │
  │  pressButton() → delegates to current_state  │
  └─────────────────────────────────────────────┘

  IdleState:
    insertCoin()  → accept coin, switch to HasMoneyState
    pressButton() → display "Insert coin first"

  HasMoneyState:
    insertCoin()  → add to balance
    pressButton() → dispense item, switch to DispensingState

  DispensingState:
    insertCoin()  → return coin, display "Please wait"
    pressButton() → display "Already dispensing"

  Same methods. Different behavior. Depends on the state.
```

### Why Not Just Use If/Else?

```
THE IF/ELSE PROBLEM

  insertCoin() {
    if (state === "idle") { ... }
    else if (state === "has_money") { ... }
    else if (state === "dispensing") { ... }
    else if (state === "out_of_stock") { ... }
  }

  pressButton() {
    if (state === "idle") { ... }
    else if (state === "has_money") { ... }
    else if (state === "dispensing") { ... }
    else if (state === "out_of_stock") { ... }
  }

  Every method has the same if/else chain.
  Adding a new state means editing EVERY method.
  Easy to forget one. Easy to introduce bugs.
```

### State in TypeScript

```typescript
interface PlayerState {
  play(player: MusicPlayer): void;
  pause(player: MusicPlayer): void;
  stop(player: MusicPlayer): void;
  display(): string;
}

class StoppedState implements PlayerState {
  play(player: MusicPlayer): void {
    player.startPlayback();
    player.setState(new PlayingState());
  }

  pause(player: MusicPlayer): void {
    // do nothing — already stopped
  }

  stop(player: MusicPlayer): void {
    // do nothing — already stopped
  }

  display(): string {
    return "Stopped";
  }
}

class PlayingState implements PlayerState {
  play(player: MusicPlayer): void {
    player.restartTrack();
  }

  pause(player: MusicPlayer): void {
    player.pausePlayback();
    player.setState(new PausedState());
  }

  stop(player: MusicPlayer): void {
    player.stopPlayback();
    player.setState(new StoppedState());
  }

  display(): string {
    return "Playing";
  }
}

class PausedState implements PlayerState {
  play(player: MusicPlayer): void {
    player.resumePlayback();
    player.setState(new PlayingState());
  }

  pause(player: MusicPlayer): void {
    // do nothing — already paused
  }

  stop(player: MusicPlayer): void {
    player.stopPlayback();
    player.setState(new StoppedState());
  }

  display(): string {
    return "Paused";
  }
}

class MusicPlayer {
  private state: PlayerState = new StoppedState();

  setState(state: PlayerState): void { this.state = state; }
  play(): void { this.state.play(this); }
  pause(): void { this.state.pause(this); }
  stop(): void { this.state.stop(this); }

  startPlayback(): void { /* audio system call */ }
  pausePlayback(): void { /* audio system call */ }
  resumePlayback(): void { /* audio system call */ }
  stopPlayback(): void { /* audio system call */ }
  restartTrack(): void { /* audio system call */ }
}
```

### State in Python

```python
from abc import ABC, abstractmethod

class OrderState(ABC):
    @abstractmethod
    def confirm(self, order: "Order") -> None: ...

    @abstractmethod
    def ship(self, order: "Order") -> None: ...

    @abstractmethod
    def deliver(self, order: "Order") -> None: ...

    @abstractmethod
    def cancel(self, order: "Order") -> None: ...

class PendingState(OrderState):
    def confirm(self, order: "Order") -> None:
        order.set_state(ConfirmedState())

    def ship(self, order: "Order") -> None:
        raise InvalidTransition("Cannot ship a pending order")

    def deliver(self, order: "Order") -> None:
        raise InvalidTransition("Cannot deliver a pending order")

    def cancel(self, order: "Order") -> None:
        order.set_state(CancelledState())

class ConfirmedState(OrderState):
    def confirm(self, order: "Order") -> None:
        pass

    def ship(self, order: "Order") -> None:
        order.set_state(ShippedState())

    def cancel(self, order: "Order") -> None:
        order.set_state(CancelledState())

    def deliver(self, order: "Order") -> None:
        raise InvalidTransition("Must ship before delivering")

class ShippedState(OrderState):
    def confirm(self, order: "Order") -> None:
        pass

    def ship(self, order: "Order") -> None:
        pass

    def deliver(self, order: "Order") -> None:
        order.set_state(DeliveredState())

    def cancel(self, order: "Order") -> None:
        raise InvalidTransition("Cannot cancel shipped order")

class Order:
    def __init__(self):
        self._state: OrderState = PendingState()

    def set_state(self, state: OrderState) -> None:
        self._state = state

    def confirm(self) -> None:
        self._state.confirm(self)

    def ship(self) -> None:
        self._state.ship(self)

    def deliver(self) -> None:
        self._state.deliver(self)

    def cancel(self) -> None:
        self._state.cancel(self)
```

### State in Rust — Using Enums

Rust's enum system makes state machines particularly clean and
type-safe. The compiler ensures you handle every state:

```rust
enum ConnectionState {
    Disconnected,
    Connecting { attempt: u32 },
    Connected { session_id: String },
    Disconnecting,
}

struct Connection {
    state: ConnectionState,
}

impl Connection {
    fn connect(&mut self) {
        self.state = match &self.state {
            ConnectionState::Disconnected => {
                ConnectionState::Connecting { attempt: 1 }
            }
            ConnectionState::Connecting { attempt } if *attempt < 3 => {
                ConnectionState::Connecting { attempt: attempt + 1 }
            }
            ConnectionState::Connecting { .. } => {
                ConnectionState::Disconnected
            }
            _ => return,
        };
    }

    fn on_connected(&mut self, session_id: String) {
        if matches!(self.state, ConnectionState::Connecting { .. }) {
            self.state = ConnectionState::Connected { session_id };
        }
    }

    fn disconnect(&mut self) {
        if matches!(self.state, ConnectionState::Connected { .. }) {
            self.state = ConnectionState::Disconnecting;
        }
    }

    fn on_disconnected(&mut self) {
        self.state = ConnectionState::Disconnected;
    }
}
```

### State in Go

```go
type TrafficLightState interface {
    Next() TrafficLightState
    Display() string
    Duration() time.Duration
}

type GreenState struct{}
func (s GreenState) Next() TrafficLightState   { return YellowState{} }
func (s GreenState) Display() string           { return "GREEN - Go" }
func (s GreenState) Duration() time.Duration   { return 30 * time.Second }

type YellowState struct{}
func (s YellowState) Next() TrafficLightState  { return RedState{} }
func (s YellowState) Display() string          { return "YELLOW - Caution" }
func (s YellowState) Duration() time.Duration  { return 5 * time.Second }

type RedState struct{}
func (s RedState) Next() TrafficLightState     { return GreenState{} }
func (s RedState) Display() string             { return "RED - Stop" }
func (s RedState) Duration() time.Duration     { return 30 * time.Second }

type TrafficLight struct {
    state TrafficLightState
}

func (t *TrafficLight) Tick() {
    t.state = t.state.Next()
}

func (t *TrafficLight) Display() string {
    return t.state.Display()
}
```

---

## Command + State Together

These patterns complement each other. A game engine might use State
for character behavior and Command for player input:

```
GAME ENGINE: COMMAND + STATE

  Player Input                    Character State
  ┌─────────────┐                ┌──────────────┐
  │ MoveCommand │───execute()──→ │  IdleState   │
  │ AttackCmd   │                │  RunningState│
  │ JumpCommand │                │  AttackState │
  └─────────────┘                │  DeadState   │
       │                         └──────────────┘
       │
  CommandHistory                  State determines which
  (undo/redo/replay)              commands are valid
```

---

## Exercises

1. **Command**: Build a spreadsheet with commands for setting cell
   values, formatting cells, and inserting rows. Implement undo/redo.

2. **State**: Model a document lifecycle: Draft → Review → Approved
   → Published. Each state allows different operations.

3. **Combined**: Build a simple drawing app where each stroke is a
   Command (undo removes strokes) and the app has states (Drawing,
   Selecting, Erasing) that interpret mouse events differently.

4. **State machine diagram**: Draw the state diagram for a TCP
   connection (CLOSED, LISTEN, SYN_SENT, ESTABLISHED, etc.).
   Implement it using the State pattern.

---

[← Previous: Strategy and Observer](./09-strategy-observer.md) · [Next: Lesson 11 — Iterator and Template Method →](./11-iterator-template.md)
