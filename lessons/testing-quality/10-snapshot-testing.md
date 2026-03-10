# Lesson 10: Snapshot and Golden File Testing

> **The one thing to remember**: Snapshot testing is like taking a photo
> of your code's output and putting it in an album. Next time you run
> the test, it takes a new photo and compares. If something changed, the
> test fails and asks: "This output looks different — is this change
> intentional or a bug?"

---

## The Before-and-After Photo Analogy

Imagine you're renovating a house. You take a photo before you start.
After each change, you take a new photo and compare:

```
SNAPSHOT TESTING CONCEPT

  First run:
    Run code → generate output → SAVE as "snapshot" file

  Subsequent runs:
    Run code → generate output → COMPARE with saved snapshot

    Match?     → Test PASSES (nothing changed)
    Different? → Test FAILS (something changed!)

    If the change is INTENTIONAL:
      Update the snapshot → new baseline

    If the change is a BUG:
      Fix the code → output matches snapshot again
```

---

## How Snapshot Tests Work

### TypeScript (Vitest)

```typescript
import { describe, it, expect } from "vitest";

function formatUserProfile(user: {
  name: string;
  email: string;
  role: string;
  joinDate: string;
}): string {
  return [
    `Name: ${user.name}`,
    `Email: ${user.email}`,
    `Role: ${user.role}`,
    `Member since: ${user.joinDate}`,
  ].join("\n");
}

describe("formatUserProfile", () => {
  it("formats profile correctly", () => {
    const profile = formatUserProfile({
      name: "Alice Johnson",
      email: "alice@example.com",
      role: "Admin",
      joinDate: "2024-01-15",
    });

    expect(profile).toMatchInlineSnapshot(`
      "Name: Alice Johnson
      Email: alice@example.com
      Role: Admin
      Member since: 2024-01-15"
    `);
  });
});
```

The first time you run this, Vitest fills in the inline snapshot
automatically. If the output changes later, the test fails.

### Python (pytest-snapshot or syrupy)

```python
def generate_report(sales):
    lines = ["Sales Report", "=" * 40]
    total = 0
    for item in sales:
        line = f"  {item['product']:.<30} ${item['amount']:>8.2f}"
        lines.append(line)
        total += item["amount"]
    lines.append("=" * 40)
    lines.append(f"  {'Total':.<30} ${total:>8.2f}")
    return "\n".join(lines)

def test_report_format(snapshot):
    sales = [
        {"product": "Widget A", "amount": 29.99},
        {"product": "Widget B", "amount": 49.99},
        {"product": "Service Plan", "amount": 99.00},
    ]
    report = generate_report(sales)
    assert report == snapshot
```

The snapshot is stored in a separate file (usually a `__snapshots__`
directory). Updating is typically done with a flag:

```
pytest --snapshot-update    # Python (syrupy)
npx vitest -u              # TypeScript (Vitest)
npx jest -u                # TypeScript (Jest)
```

---

## When Snapshots Help

```
GREAT USE CASES FOR SNAPSHOTS

  1. COMPLEX OUTPUT FORMATS
     HTML templates, formatted reports, CLI output
     Too tedious to assert every field manually

  2. SERIALIZATION
     JSON/XML output from your API
     Catches unexpected field additions/removals

  3. ERROR MESSAGES
     Compiler or linter output
     Ensures error messages don't silently degrade

  4. AST / CODE GENERATION
     Parser output, code generators
     Complex tree structures that are hard to assert

  5. CONFIGURATION OUTPUT
     Generated config files
     Database migration SQL
```

### Example: Testing API Response Shape

```typescript
describe("GET /api/users/:id", () => {
  it("returns user in expected format", async () => {
    const response = await request(app).get("/api/users/1");

    expect(response.body).toMatchSnapshot({
      id: expect.any(Number),
      createdAt: expect.any(String),
    });
  });
});
```

The `expect.any()` matcher lets you ignore values that change (like
timestamps and IDs) while still snapshotting the *structure*.

---

## Snapshot Fatigue: The Antipattern

The biggest problem with snapshots is **snapshot fatigue** — when
developers blindly update snapshots without reviewing the changes.

```
THE SNAPSHOT FATIGUE CYCLE

  1. Tests fail because snapshots are outdated
  2. Developer runs "update all snapshots"
  3. 47 snapshot files update
  4. Developer doesn't review the diff
  5. A real bug hides in one of those 47 changes
  6. Bug ships to production

  The test existed but provided ZERO protection.
```

```
PREVENTING SNAPSHOT FATIGUE

  DO:
    ✓ Review snapshot diffs in code review (treat them like code)
    ✓ Keep snapshots small and focused
    ✓ Use inline snapshots for short outputs
    ✓ Name snapshot files clearly
    ✓ Update snapshots ONE AT A TIME, verifying each

  DON'T:
    ✗ Auto-update all snapshots without review
    ✗ Create 500-line snapshot files
    ✗ Snapshot entire HTML pages (too much noise)
    ✗ Snapshot non-deterministic output (timestamps, random IDs)
```

---

## Golden File Testing

Golden file testing is the broader pattern — comparing output against a
saved "golden" reference file. It's used outside of testing frameworks
too.

```
GOLDEN FILE TESTING

  Source Code ──→ Your Function ──→ Actual Output
                                         │
                                    Compare ←── Golden File
                                         │       (saved reference)
                                    Match?
                                    Yes → PASS
                                    No  → FAIL (show diff)
```

### Go: Built-in Golden File Pattern

```go
func TestRenderTemplate(t *testing.T) {
    data := PageData{
        Title: "Welcome",
        Items: []string{"Apple", "Banana", "Cherry"},
    }

    var buf bytes.Buffer
    err := renderTemplate(&buf, data)
    if err != nil {
        t.Fatalf("render failed: %v", err)
    }
    actual := buf.Bytes()

    golden := filepath.Join("testdata", "welcome.golden")

    if *update {
        os.WriteFile(golden, actual, 0644)
        return
    }

    expected, err := os.ReadFile(golden)
    if err != nil {
        t.Fatalf("failed to read golden file: %v", err)
    }

    if !bytes.Equal(actual, expected) {
        t.Errorf("output doesn't match golden file.\nGot:\n%s\nWant:\n%s",
            actual, expected)
    }
}
```

Run with `-update` flag to regenerate golden files:
```
go test -run TestRenderTemplate -update
```

### Rust: insta Crate

```rust
use insta::assert_snapshot;

fn format_address(street: &str, city: &str, state: &str, zip: &str) -> String {
    format!("{}\n{}, {} {}", street, city, state, zip)
}

#[test]
fn test_format_address() {
    let address = format_address("123 Main St", "Springfield", "IL", "62704");
    assert_snapshot!(address, @r###"
    123 Main St
    Springfield, IL 62704
    "###);
}
```

Rust's `insta` crate provides a review workflow:
```
cargo insta test       # Run tests
cargo insta review     # Interactively review changes
```

---

## Approval Testing

Approval testing is a variant of snapshot testing where a human
explicitly "approves" each change. Instead of auto-updating, you review
each diff:

```
APPROVAL TESTING WORKFLOW

  1. Run tests → output differs from approved version
  2. Tool shows you a DIFF:

     - Name: Alice Johnson        (was this)
     + Name: Alice M. Johnson     (now this)
       Email: alice@example.com
     - Role: User                 (was this)
     + Role: Admin                (now this)

  3. You review:
     "Middle initial added — correct, they updated their name"
     "Role changed to Admin — wait, that's wrong!"

  4. REJECT the change → fix the bug → re-run
```

This workflow forces conscious review of every output change.

---

## Snapshot Test Best Practices

```
SNAPSHOT SIZE GUIDE

  GOOD: Small, focused snapshots

    expect(formatCurrency(1234.5)).toMatchInlineSnapshot('"$1,234.50"');
    expect(formatDate(date)).toMatchInlineSnapshot('"January 15, 2024"');

  BAD: Huge snapshots nobody will review

    expect(entirePageHTML).toMatchSnapshot();  // 500+ lines
    expect(fullAPIResponse).toMatchSnapshot(); // nested objects galore
```

```
DETERMINISTIC OUTPUT CHECKLIST

  Before snapshotting, ensure output doesn't contain:

  □ Timestamps (mock the clock)
  □ Random IDs (use deterministic IDs in tests)
  □ File paths (use relative paths or placeholders)
  □ Memory addresses
  □ Process IDs
  □ Locale-dependent formatting

  If you can't avoid them, use matchers:
    expect(output).toMatchSnapshot({
      id: expect.any(String),
      createdAt: expect.any(String),
    });
```

---

## When NOT to Use Snapshots

```
USE ASSERTIONS INSTEAD WHEN:

  You care about specific values:
    assert user.age == 25             ← Clear intent
    vs.
    assert user == snapshot            ← What exactly are we checking?

  The output is simple:
    assert len(results) == 3          ← Obvious
    vs.
    expect(results).toMatchSnapshot() ← Overkill

  You want to document behavior:
    assert calculate_tax(100, 0.08) == 8.00  ← Self-documenting
    vs.
    expect(tax).toMatchSnapshot()     ← Need to open snapshot file
```

---

## Exercises

1. **Write a snapshot test**: Pick a function that generates formatted
   output (a report, an email template, a CLI table). Write a snapshot
   test for it.

2. **Snapshot review**: Update a snapshot test's source code to change
   the output. Run the test, review the diff. Would you approve the
   change?

3. **Golden file in Go**: Implement the golden file pattern for a
   function that generates a configuration file. Include the `-update`
   flag workflow.

4. **Determinism audit**: Take an existing snapshot test. Does the
   output contain timestamps, random IDs, or other non-deterministic
   values? Fix them using mocks or matchers.

---

[Next: Lesson 11 - Fixtures, Factories, and Builders](./11-fixtures-factories.md)
