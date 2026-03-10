# Lesson 13: Testing APIs

> An untested API is a liability.
> Every endpoint is a promise — tests prove you keep it.

---

## The Testing Pyramid for APIs

```
  LEAST <----- number of tests -----> MOST

              /\
             /  \
            / E2E\        End-to-end (few)
           /------\       Full request through real infra
          /Integr. \      Integration (moderate)
         /----------\     Test against real DB/services
        /  Contract   \   Contract (moderate)
       /--------------\   Verify API shape and behavior
      /   Unit Tests    \  Unit (many)
     /------------------\ Test handlers, validators, logic
```

---

## Unit Testing API Handlers

Test the handler logic WITHOUT making HTTP requests.

```python
import json
from dataclasses import dataclass
from typing import Optional

@dataclass
class User:
    id: int
    name: str
    email: str

class UserRepository:
    def __init__(self):
        self.users = {}

    def get(self, user_id: int) -> Optional[User]:
        return self.users.get(user_id)

    def create(self, name: str, email: str) -> User:
        user_id = len(self.users) + 1
        user = User(id=user_id, name=name, email=email)
        self.users[user_id] = user
        return user

class UserHandler:
    def __init__(self, repo: UserRepository):
        self.repo = repo

    def get_user(self, user_id: int) -> dict:
        user = self.repo.get(user_id)
        if user is None:
            return {"status": 404, "body": {"error": "User not found"}}
        return {"status": 200, "body": {"id": user.id, "name": user.name, "email": user.email}}

    def create_user(self, data: dict) -> dict:
        if "name" not in data or not data["name"].strip():
            return {"status": 422, "body": {"error": "Name is required"}}
        if "email" not in data or "@" not in data.get("email", ""):
            return {"status": 422, "body": {"error": "Valid email is required"}}
        user = self.repo.create(data["name"], data["email"])
        return {"status": 201, "body": {"id": user.id, "name": user.name, "email": user.email}}


def test_get_user_found():
    repo = UserRepository()
    repo.create("Alice", "alice@example.com")
    handler = UserHandler(repo)
    result = handler.get_user(1)
    assert result["status"] == 200
    assert result["body"]["name"] == "Alice"

def test_get_user_not_found():
    repo = UserRepository()
    handler = UserHandler(repo)
    result = handler.get_user(999)
    assert result["status"] == 404

def test_create_user_valid():
    repo = UserRepository()
    handler = UserHandler(repo)
    result = handler.create_user({"name": "Bob", "email": "bob@test.com"})
    assert result["status"] == 201
    assert result["body"]["name"] == "Bob"

def test_create_user_missing_name():
    repo = UserRepository()
    handler = UserHandler(repo)
    result = handler.create_user({"email": "bob@test.com"})
    assert result["status"] == 422

def test_create_user_invalid_email():
    repo = UserRepository()
    handler = UserHandler(repo)
    result = handler.create_user({"name": "Bob", "email": "notanemail"})
    assert result["status"] == 422

test_get_user_found()
test_get_user_not_found()
test_create_user_valid()
test_create_user_missing_name()
test_create_user_invalid_email()
print("All unit tests passed")
```

---

## Integration Testing

Test against real HTTP endpoints with a real (or test) database.

```python
import requests

BASE_URL = "http://localhost:8080/api/v1"

def test_full_user_lifecycle():
    response = requests.post(f"{BASE_URL}/users", json={
        "name": "Alice",
        "email": "alice@test.com",
    })
    assert response.status_code == 201
    user = response.json()
    user_id = user["id"]
    assert user["name"] == "Alice"

    response = requests.get(f"{BASE_URL}/users/{user_id}")
    assert response.status_code == 200
    assert response.json()["email"] == "alice@test.com"

    response = requests.put(f"{BASE_URL}/users/{user_id}", json={
        "name": "Alice Updated",
        "email": "alice@test.com",
    })
    assert response.status_code == 200
    assert response.json()["name"] == "Alice Updated"

    response = requests.delete(f"{BASE_URL}/users/{user_id}")
    assert response.status_code == 204

    response = requests.get(f"{BASE_URL}/users/{user_id}")
    assert response.status_code == 404
```

---

## Contract Testing

Verify the API's SHAPE matches what consumers expect.
If the shape changes, the contract test fails.

```
  CONTRACT = agreement between producer and consumer

  Producer (User Service):
  "GET /users/{id} returns {id, name, email}"

  Consumer (Order Service):
  "I expect GET /users/{id} to have 'name' and 'email' fields"

  CONTRACT TEST:
  +-------------------+
  | Consumer defines  |
  | expected response |
  | shape (contract)  |
  +-------------------+
         |
         v
  +-------------------+
  | Run contract test |
  | against producer  |
  +-------------------+
         |
    PASS: producer matches contract
    FAIL: producer broke the contract (breaking change!)
```

```python
from dataclasses import dataclass
from typing import Dict, List, Any

@dataclass
class ContractExpectation:
    method: str
    path: str
    expected_status: int
    required_fields: List[str]
    field_types: Dict[str, type]

class ContractValidator:
    def __init__(self):
        self.contracts: List[ContractExpectation] = []

    def add_contract(self, contract: ContractExpectation):
        self.contracts.append(contract)

    def validate_response(self, contract: ContractExpectation, status: int, body: dict) -> List[str]:
        errors = []
        if status != contract.expected_status:
            errors.append(
                f"Expected status {contract.expected_status}, got {status}"
            )
        for field in contract.required_fields:
            if field not in body:
                errors.append(f"Missing required field: {field}")
        for field, expected_type in contract.field_types.items():
            if field in body and not isinstance(body[field], expected_type):
                errors.append(
                    f"Field '{field}' expected {expected_type.__name__}, "
                    f"got {type(body[field]).__name__}"
                )
        return errors


validator = ContractValidator()

user_contract = ContractExpectation(
    method="GET",
    path="/users/{id}",
    expected_status=200,
    required_fields=["id", "name", "email"],
    field_types={"id": int, "name": str, "email": str},
)

good_response = {"id": 1, "name": "Alice", "email": "alice@test.com"}
errors = validator.validate_response(user_contract, 200, good_response)
assert errors == [], f"Unexpected errors: {errors}"

bad_response = {"id": "not-a-number", "name": "Alice"}
errors = validator.validate_response(user_contract, 200, bad_response)
assert len(errors) == 2
print(f"Contract violations found: {errors}")
```

---

## Mocking External Services

```
  YOUR API calls external services.
  You don't want tests to depend on those services.

  TEST DOUBLE TYPES:
  +----------+-------------------------------------------+
  | Stub     | Returns fixed data. No verification.      |
  | Mock     | Returns data AND verifies it was called.  |
  | Fake     | Working implementation (in-memory DB).    |
  | Spy      | Wraps real service, records calls.         |
  +----------+-------------------------------------------+

  WHEN TO USE WHAT:
  Unit test -> Stubs/Mocks (fast, isolated)
  Integration test -> Fakes (in-memory DB, test containers)
  E2E test -> Real services (slow but realistic)
```

```python
from unittest.mock import MagicMock, patch

class PaymentGateway:
    def charge(self, amount: float, card_token: str) -> dict:
        raise NotImplementedError("Real implementation calls Stripe")

class OrderService:
    def __init__(self, payment: PaymentGateway):
        self.payment = payment

    def place_order(self, amount: float, card_token: str) -> dict:
        if amount <= 0:
            return {"success": False, "error": "Invalid amount"}
        result = self.payment.charge(amount, card_token)
        if result["status"] == "succeeded":
            return {"success": True, "order_id": "ORD-123"}
        return {"success": False, "error": result.get("error", "Payment failed")}


def test_place_order_success():
    mock_payment = MagicMock()
    mock_payment.charge.return_value = {"status": "succeeded", "charge_id": "ch_123"}

    service = OrderService(mock_payment)
    result = service.place_order(50.00, "tok_visa")

    assert result["success"] is True
    mock_payment.charge.assert_called_once_with(50.00, "tok_visa")

def test_place_order_payment_fails():
    mock_payment = MagicMock()
    mock_payment.charge.return_value = {"status": "failed", "error": "Card declined"}

    service = OrderService(mock_payment)
    result = service.place_order(50.00, "tok_visa")

    assert result["success"] is False
    assert "declined" in result["error"]

def test_place_order_invalid_amount():
    mock_payment = MagicMock()
    service = OrderService(mock_payment)
    result = service.place_order(-10.00, "tok_visa")

    assert result["success"] is False
    mock_payment.charge.assert_not_called()

test_place_order_success()
test_place_order_payment_fails()
test_place_order_invalid_amount()
print("All mock tests passed")
```

---

## API Testing Tools

```
  +------------------+-------------------------------------------+
  | Tool             | Best For                                  |
  +------------------+-------------------------------------------+
  | Postman          | Manual exploration, collection sharing    |
  | Bruno            | Git-friendly, open source Postman alt     |
  | HTTPie           | CLI HTTP client (dev friendly)            |
  | curl             | Universal, scriptable                     |
  | pytest + httpx   | Python automated API testing              |
  | Supertest        | Node.js in-process API testing            |
  | REST Assured     | Java API testing (BDD style)              |
  | Pact             | Consumer-driven contract testing          |
  | Dredd            | Test against OpenAPI spec automatically   |
  | Schemathesis     | Property-based API testing from spec      |
  +------------------+-------------------------------------------+
```

---

## Testing Against Your OpenAPI Spec

```
  YOUR SPEC SAYS:
  GET /users/{id}
  Response 200:
    schema:
      type: object
      required: [id, name, email]
      properties:
        id: { type: integer }
        name: { type: string }
        email: { type: string, format: email }

  SCHEMATHESIS: auto-generates test cases from your spec.
  Finds edge cases you didn't think of.

  $ schemathesis run http://localhost:8080/openapi.json

  Checks:
  - Response matches declared schema
  - Status codes are documented
  - Required fields are present
  - Types match declarations
  - Edge cases: empty strings, large numbers, special chars
```

---

## What to Test at Each Level

```
  UNIT TESTS (fast, many):
  [x] Input validation (missing fields, bad types, edge cases)
  [x] Business logic (calculations, transformations)
  [x] Error handling (proper error codes and messages)
  [x] Authorization logic (role checks)
  [x] Serialization/deserialization

  INTEGRATION TESTS (moderate, focused):
  [x] Full HTTP request/response cycle
  [x] Database queries work correctly
  [x] Authentication flow (login, token refresh)
  [x] Pagination works (first page, last page, empty)
  [x] Filtering and sorting

  CONTRACT TESTS (moderate):
  [x] Response shape matches consumer expectations
  [x] Required fields always present
  [x] Field types are stable
  [x] No breaking changes in new versions

  E2E TESTS (few, critical paths):
  [x] User signup -> login -> create resource -> logout
  [x] Payment flow end-to-end
  [x] OAuth flow with real provider (or sandbox)
```

---

## Exercises

### Exercise 1: Test Suite for a TODO API

Write a complete test suite for a TODO API with endpoints:
- POST /todos (create)
- GET /todos (list, with pagination)
- GET /todos/{id} (get one)
- PUT /todos/{id} (update)
- DELETE /todos/{id} (delete)

Include: unit tests, integration tests, and edge cases
(empty title, non-existent ID, duplicate creation).

### Exercise 2: Contract Test

Define a consumer contract for an API you depend on.
Write a contract test that validates the response shape.
Simulate a breaking change and verify the test catches it.

### Exercise 3: Mock an External API

Write tests for a service that calls a weather API:
- Mock the weather API to return specific responses
- Test: successful response, timeout, 500 error, invalid JSON
- Verify your service handles each case correctly

### Exercise 4: Property-Based API Testing

Use Schemathesis or a similar tool to:
1. Write an OpenAPI spec for your API
2. Generate random valid requests automatically
3. Run 1000 requests and check for:
   - 500 errors (server bugs)
   - Response schema violations
   - Crashes or timeouts

---

## Key Takeaways

```
  1. Testing pyramid: many unit, moderate integration, few E2E
  2. Unit test handlers WITHOUT HTTP (fast, isolated)
  3. Integration tests verify the full request cycle
  4. Contract tests prevent breaking consumer expectations
  5. Mock external services in unit/integration tests
  6. Use fakes (in-memory DB) for realistic integration tests
  7. Test against your OpenAPI spec for automatic validation
  8. Schemathesis finds edge cases you didn't think of
  9. Test error paths as thoroughly as happy paths
  10. Every status code your API returns should have a test
```

---

Next: [Lesson 14 — Performance](./14-performance.md)
