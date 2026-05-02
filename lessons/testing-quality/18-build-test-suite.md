# Lesson 18: Capstone — Build a Complete Test Suite

> **The one thing to remember**: This lesson ties everything together.
> You'll build a comprehensive test suite for a REST API, covering unit,
> integration, and E2E tests. Think of it as building a complete safety
> system for a building — smoke detectors (unit tests), sprinklers
> (integration tests), and fire drills (E2E tests). Each layer catches
> different dangers.

---

## The Project: A Bookstore API

We'll test a simple bookstore API with these endpoints:

```
BOOKSTORE API SPECIFICATION

  POST   /api/books        Create a book
  GET    /api/books         List all books (with optional ?genre= filter)
  GET    /api/books/:id     Get a single book
  PUT    /api/books/:id     Update a book
  DELETE /api/books/:id     Delete a book
  POST   /api/orders        Place an order (decrements stock)
  GET    /api/orders/:id    Get order details

  Business Rules:
  - Book price must be > 0
  - Stock cannot go negative
  - Orders fail if insufficient stock
  - Deleting a book with pending orders is forbidden
```

```
ARCHITECTURE

  ┌──────────────┐     ┌────────────────┐     ┌──────────────┐
  │   HTTP Layer  │────→│  Service Layer  │────→│  Repository  │
  │  (Routes)     │     │  (Business      │     │  (Database)  │
  │               │     │   Logic)        │     │              │
  └──────────────┘     └────────────────┘     └──────────────┘

  Unit tests:        Service layer (mocked repository)
  Integration tests: Repository + real database
  E2E tests:         Full HTTP requests
```

---

## Layer 1: Unit Tests (Service Layer)

Test the business logic with mocked dependencies.

### Python

```python
import pytest
from unittest.mock import Mock, patch

class BookService:
    def __init__(self, repository):
        self.repo = repository

    def create_book(self, title, author, price, stock, genre):
        if not title or not title.strip():
            raise ValueError("Title is required")
        if price <= 0:
            raise ValueError("Price must be positive")
        if stock < 0:
            raise ValueError("Stock cannot be negative")

        book = {
            "title": title.strip(),
            "author": author.strip(),
            "price": round(price, 2),
            "stock": stock,
            "genre": genre,
        }
        return self.repo.create(book)

    def place_order(self, book_id, quantity):
        if quantity <= 0:
            raise ValueError("Quantity must be positive")

        book = self.repo.find_by_id(book_id)
        if book is None:
            raise ValueError("Book not found")
        if book["stock"] < quantity:
            raise ValueError(
                f"Insufficient stock: {book['stock']} available, {quantity} requested"
            )

        self.repo.update_stock(book_id, book["stock"] - quantity)

        order = {
            "book_id": book_id,
            "quantity": quantity,
            "total": round(book["price"] * quantity, 2),
            "status": "confirmed",
        }
        return self.repo.create_order(order)

class TestCreateBook:
    def test_creates_book_with_valid_data(self):
        repo = Mock()
        repo.create.return_value = {"id": 1, "title": "Clean Code", "price": 29.99}
        service = BookService(repo)

        result = service.create_book("Clean Code", "Robert Martin", 29.99, 10, "Programming")

        assert result["title"] == "Clean Code"
        repo.create.assert_called_once()

    def test_rejects_empty_title(self):
        service = BookService(Mock())

        with pytest.raises(ValueError, match="Title is required"):
            service.create_book("", "Author", 9.99, 1, "Fiction")

    def test_rejects_whitespace_title(self):
        service = BookService(Mock())

        with pytest.raises(ValueError, match="Title is required"):
            service.create_book("   ", "Author", 9.99, 1, "Fiction")

    def test_rejects_zero_price(self):
        service = BookService(Mock())

        with pytest.raises(ValueError, match="Price must be positive"):
            service.create_book("Title", "Author", 0, 1, "Fiction")

    def test_rejects_negative_price(self):
        service = BookService(Mock())

        with pytest.raises(ValueError, match="Price must be positive"):
            service.create_book("Title", "Author", -5.99, 1, "Fiction")

    def test_rejects_negative_stock(self):
        service = BookService(Mock())

        with pytest.raises(ValueError, match="Stock cannot be negative"):
            service.create_book("Title", "Author", 9.99, -1, "Fiction")

    def test_strips_whitespace_from_title(self):
        repo = Mock()
        repo.create.return_value = {"id": 1, "title": "Clean Code"}
        service = BookService(repo)

        service.create_book("  Clean Code  ", "Robert Martin", 29.99, 10, "Programming")

        call_args = repo.create.call_args[0][0]
        assert call_args["title"] == "Clean Code"

    def test_rounds_price_to_two_decimals(self):
        repo = Mock()
        repo.create.return_value = {"id": 1}
        service = BookService(repo)

        service.create_book("Title", "Author", 9.999, 1, "Fiction")

        call_args = repo.create.call_args[0][0]
        assert call_args["price"] == 10.00


class TestPlaceOrder:
    def setup_method(self):
        self.repo = Mock()
        self.service = BookService(self.repo)

    def test_places_order_successfully(self):
        self.repo.find_by_id.return_value = {
            "id": 1, "title": "Clean Code", "price": 29.99, "stock": 10
        }
        self.repo.create_order.return_value = {
            "id": 1, "book_id": 1, "quantity": 2, "total": 59.98, "status": "confirmed"
        }

        order = self.service.place_order(book_id=1, quantity=2)

        assert order["total"] == 59.98
        assert order["status"] == "confirmed"
        self.repo.update_stock.assert_called_once_with(1, 8)

    def test_rejects_zero_quantity(self):
        with pytest.raises(ValueError, match="Quantity must be positive"):
            self.service.place_order(1, 0)

    def test_rejects_nonexistent_book(self):
        self.repo.find_by_id.return_value = None

        with pytest.raises(ValueError, match="Book not found"):
            self.service.place_order(999, 1)

    def test_rejects_insufficient_stock(self):
        self.repo.find_by_id.return_value = {
            "id": 1, "title": "Rare Book", "price": 99.99, "stock": 2
        }

        with pytest.raises(ValueError, match="Insufficient stock"):
            self.service.place_order(1, 5)

    def test_calculates_total_correctly(self):
        self.repo.find_by_id.return_value = {
            "id": 1, "price": 15.50, "stock": 100
        }
        self.repo.create_order.return_value = {"total": 46.50}

        order = self.service.place_order(1, 3)

        created_order = self.repo.create_order.call_args[0][0]
        assert created_order["total"] == 46.50
```

---

## Layer 2: Integration Tests (Repository + Database)

Test that SQL queries work with a real database.

```python
import sqlite3
import pytest

class BookRepository:
    def __init__(self, conn):
        self.conn = conn
        self._create_tables()

    def _create_tables(self):
        self.conn.executescript("""
            CREATE TABLE IF NOT EXISTS books (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                author TEXT NOT NULL,
                price REAL NOT NULL,
                stock INTEGER NOT NULL DEFAULT 0,
                genre TEXT
            );
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                book_id INTEGER NOT NULL REFERENCES books(id),
                quantity INTEGER NOT NULL,
                total REAL NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
            );
        """)

    def create(self, book):
        cursor = self.conn.execute(
            "INSERT INTO books (title, author, price, stock, genre) VALUES (?, ?, ?, ?, ?)",
            (book["title"], book["author"], book["price"], book["stock"], book["genre"])
        )
        self.conn.commit()
        book["id"] = cursor.lastrowid
        return book

    def find_by_id(self, book_id):
        row = self.conn.execute(
            "SELECT id, title, author, price, stock, genre FROM books WHERE id = ?",
            (book_id,)
        ).fetchone()
        if row is None:
            return None
        return {
            "id": row[0], "title": row[1], "author": row[2],
            "price": row[3], "stock": row[4], "genre": row[5]
        }

    def find_all(self, genre=None):
        if genre:
            rows = self.conn.execute(
                "SELECT id, title, author, price, stock, genre FROM books WHERE genre = ?",
                (genre,)
            ).fetchall()
        else:
            rows = self.conn.execute(
                "SELECT id, title, author, price, stock, genre FROM books"
            ).fetchall()
        return [
            {"id": r[0], "title": r[1], "author": r[2],
             "price": r[3], "stock": r[4], "genre": r[5]}
            for r in rows
        ]

    def update_stock(self, book_id, new_stock):
        self.conn.execute(
            "UPDATE books SET stock = ? WHERE id = ?", (new_stock, book_id)
        )
        self.conn.commit()

    def create_order(self, order):
        cursor = self.conn.execute(
            "INSERT INTO orders (book_id, quantity, total, status) VALUES (?, ?, ?, ?)",
            (order["book_id"], order["quantity"], order["total"], order["status"])
        )
        self.conn.commit()
        order["id"] = cursor.lastrowid
        return order

    def delete(self, book_id):
        pending = self.conn.execute(
            "SELECT COUNT(*) FROM orders WHERE book_id = ? AND status = 'pending'",
            (book_id,)
        ).fetchone()[0]
        if pending > 0:
            raise ValueError("Cannot delete book with pending orders")
        self.conn.execute("DELETE FROM books WHERE id = ?", (book_id,))
        self.conn.commit()


@pytest.fixture
def repo():
    conn = sqlite3.connect(":memory:")
    repository = BookRepository(conn)
    yield repository
    conn.close()


def make_book(**overrides):
    defaults = {
        "title": "Test Book",
        "author": "Test Author",
        "price": 19.99,
        "stock": 10,
        "genre": "Fiction",
    }
    return {**defaults, **overrides}


class TestBookRepository:
    def test_create_and_find(self, repo):
        book = repo.create(make_book(title="Clean Code"))

        found = repo.find_by_id(book["id"])

        assert found is not None
        assert found["title"] == "Clean Code"
        assert found["price"] == 19.99

    def test_find_nonexistent_returns_none(self, repo):
        assert repo.find_by_id(999) is None

    def test_find_all(self, repo):
        repo.create(make_book(title="Book A"))
        repo.create(make_book(title="Book B"))
        repo.create(make_book(title="Book C"))

        books = repo.find_all()
        assert len(books) == 3

    def test_filter_by_genre(self, repo):
        repo.create(make_book(title="Sci-Fi Book", genre="Science Fiction"))
        repo.create(make_book(title="Mystery Book", genre="Mystery"))
        repo.create(make_book(title="Another Sci-Fi", genre="Science Fiction"))

        scifi = repo.find_all(genre="Science Fiction")
        assert len(scifi) == 2
        assert all(b["genre"] == "Science Fiction" for b in scifi)

    def test_update_stock(self, repo):
        book = repo.create(make_book(stock=10))

        repo.update_stock(book["id"], 7)

        updated = repo.find_by_id(book["id"])
        assert updated["stock"] == 7

    def test_delete_book(self, repo):
        book = repo.create(make_book())

        repo.delete(book["id"])

        assert repo.find_by_id(book["id"]) is None

    def test_cannot_delete_book_with_pending_orders(self, repo):
        book = repo.create(make_book())
        repo.create_order({
            "book_id": book["id"], "quantity": 1,
            "total": 19.99, "status": "pending"
        })

        with pytest.raises(ValueError, match="pending orders"):
            repo.delete(book["id"])

    def test_create_order(self, repo):
        book = repo.create(make_book())

        order = repo.create_order({
            "book_id": book["id"],
            "quantity": 2,
            "total": 39.98,
            "status": "confirmed",
        })

        assert order["id"] is not None
        assert order["total"] == 39.98
```

---

## Layer 3: E2E Tests (Full HTTP)

Test the complete system through HTTP requests.

```typescript
import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";

const BASE_URL = "http://localhost:3000";

async function createBook(data: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/books`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.json() };
}

async function getBook(id: number) {
  const res = await fetch(`${BASE_URL}/api/books/${id}`);
  return { status: res.status, body: await res.json() };
}

async function placeOrder(data: Record<string, unknown>) {
  const res = await fetch(`${BASE_URL}/api/orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return { status: res.status, body: await res.json() };
}

describe("Bookstore E2E", () => {
  describe("Book CRUD", () => {
    it("creates a book and retrieves it", async () => {
      const created = await createBook({
        title: "The Pragmatic Programmer",
        author: "David Thomas",
        price: 39.99,
        stock: 25,
        genre: "Programming",
      });

      expect(created.status).toBe(201);
      expect(created.body.title).toBe("The Pragmatic Programmer");

      const fetched = await getBook(created.body.id);
      expect(fetched.status).toBe(200);
      expect(fetched.body.title).toBe("The Pragmatic Programmer");
      expect(fetched.body.price).toBe(39.99);
    });

    it("returns 400 for invalid book data", async () => {
      const result = await createBook({
        title: "",
        author: "Author",
        price: -5,
        stock: 0,
        genre: "Fiction",
      });

      expect(result.status).toBe(400);
      expect(result.body.error).toBeDefined();
    });

    it("returns 404 for nonexistent book", async () => {
      const result = await getBook(99999);
      expect(result.status).toBe(404);
    });
  });

  describe("Order Flow", () => {
    it("places an order and decrements stock", async () => {
      const book = await createBook({
        title: "Test Book",
        author: "Test Author",
        price: 15.00,
        stock: 10,
        genre: "Fiction",
      });

      const order = await placeOrder({
        bookId: book.body.id,
        quantity: 3,
      });

      expect(order.status).toBe(201);
      expect(order.body.total).toBe(45.00);
      expect(order.body.status).toBe("confirmed");

      const updatedBook = await getBook(book.body.id);
      expect(updatedBook.body.stock).toBe(7);
    });

    it("rejects order when stock is insufficient", async () => {
      const book = await createBook({
        title: "Rare Book",
        author: "Author",
        price: 99.99,
        stock: 2,
        genre: "Fiction",
      });

      const order = await placeOrder({
        bookId: book.body.id,
        quantity: 5,
      });

      expect(order.status).toBe(400);
      expect(order.body.error).toContain("stock");
    });
  });
});
```

---

## Mocking External Services

If the bookstore integrates with an external payment or notification
service:

```python
class NotificationService:
    def __init__(self, api_key):
        self.api_key = api_key

    def send_order_confirmation(self, email, order_details):
        ...

class TestOrderNotification:
    def test_sends_confirmation_on_order(self):
        repo = Mock()
        repo.find_by_id.return_value = {"id": 1, "price": 10, "stock": 5, "title": "Book"}
        repo.create_order.return_value = {"id": 1, "total": 10, "status": "confirmed"}

        notifications = Mock()
        service = BookService(repo, notifications=notifications)

        service.place_order(book_id=1, quantity=1, email="buyer@example.com")

        notifications.send_order_confirmation.assert_called_once_with(
            "buyer@example.com",
            {"book": "Book", "quantity": 1, "total": 10.0}
        )
```

---

## Test Suite Summary

```
COMPLETE TEST SUITE MAP

  UNIT TESTS (fast, isolated)
  ├── TestCreateBook
  │   ├── valid data → creates book
  │   ├── empty title → rejects
  │   ├── negative price → rejects
  │   ├── negative stock → rejects
  │   └── whitespace handling
  ├── TestPlaceOrder
  │   ├── valid order → confirms
  │   ├── zero quantity → rejects
  │   ├── nonexistent book → rejects
  │   ├── insufficient stock → rejects
  │   └── total calculation
  └── TestNotifications
      └── sends confirmation email

  INTEGRATION TESTS (database)
  ├── create and retrieve book
  ├── filter by genre
  ├── update stock
  ├── delete book
  ├── prevent delete with pending orders
  └── create order

  E2E TESTS (full HTTP)
  ├── create book → retrieve it
  ├── invalid data → 400 error
  ├── nonexistent book → 404
  ├── place order → stock decremented
  └── insufficient stock → 400 error

  Total: ~25 tests covering all layers
```

---

## CI Configuration

```
CI PIPELINE FOR THE BOOKSTORE

  Stage 1: Lint + Type Check (30 seconds)
    - ESLint / flake8
    - TypeScript / mypy

  Stage 2: Unit Tests (15 seconds)
    - No external dependencies
    - Run with coverage

  Stage 3: Integration Tests (2 minutes)
    - Start test database
    - Run migrations
    - Run repository tests

  Stage 4: E2E Tests (3 minutes)
    - Build the application
    - Start the server
    - Run HTTP tests

  Stage 5: Quality Gate
    - Coverage > 80%?
    - All tests green?
    - No lint errors?
    → Merge allowed
```

---

## Exercises

1. **Build it**: Implement the bookstore API in your language of choice.
   Write the complete test suite: unit, integration, and E2E.

2. **Add a feature with TDD**: Add a "search by title" endpoint using
   TDD. Write the test first, then implement.

3. **Mock an external service**: Add integration with a fictional
   "inventory check" API. Mock it in unit tests, test the real
   integration path separately.

4. **CI setup**: Configure a CI pipeline for the bookstore. Ensure
   tests run in the correct order and the pipeline fails fast.

5. **Mutation testing**: Run mutation testing on the service layer. What
   mutations survive? Write tests to kill them.

---

## What's Next?

You've covered the full testing curriculum. Here's what to do next:

- **Practice**: Add tests to an existing project. Start with the most
  critical code path.
- **Read**: Pick up one of the books from the [roadmap](./00-roadmap.md).
- **Review**: Use the [testing patterns reference](./reference-testing-patterns.md) and
  [tools reference](./reference-tools.md) as quick lookups.
- **Teach**: The best way to solidify knowledge is to teach someone else.

Testing is a skill that improves with every test you write. The first
100 tests are the hardest. After that, it becomes second nature.

---

[Back to Roadmap](./00-roadmap.md)
