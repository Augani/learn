# Lesson 07: End-to-End Testing

> **The one thing to remember**: End-to-end tests are like a mystery
> shopper visiting your restaurant. They walk in, read the menu, order
> food, eat it, pay the bill, and report back. They test the *entire
> experience* — not just one dish or one waiter, but everything working
> together from start to finish.

---

## The Mystery Shopper Analogy

```
MYSTERY SHOPPER REPORT

  1. Entered the restaurant               → Opened the browser
  2. Was greeted and seated                → Homepage loaded correctly
  3. Read the menu                         → Navigation works
  4. Ordered a steak and salad             → Filled in a form, clicked submit
  5. Food arrived in 15 minutes            → Response came back in time
  6. Steak was cooked correctly            → Data displayed correctly
  7. Paid with credit card                 → Payment flow works
  8. Got a receipt                         → Confirmation page shown
  9. Left satisfied                        → User journey complete

  If ANY step fails, the experience fails — even if each
  individual component (kitchen, waiter, register) works fine alone.
```

---

## What E2E Tests Actually Do

An E2E test drives a real browser, clicking buttons and filling forms
just like a human would:

```
E2E TEST ARCHITECTURE

  ┌──────────────────┐
  │  Test Script     │  "Go to /login, type email, click submit"
  │  (Playwright/    │
  │   Cypress)       │
  └────────┬─────────┘
           │ Controls
           v
  ┌──────────────────┐
  │  Real Browser    │  Chrome, Firefox, Safari, etc.
  │  (headless or    │
  │   visible)       │
  └────────┬─────────┘
           │ HTTP requests
           v
  ┌──────────────────┐
  │  Your App        │  Frontend → Backend → Database
  │  (fully running) │  Everything is real. Nothing is mocked.
  └──────────────────┘
```

### Basic Playwright Example

```typescript
import { test, expect } from "@playwright/test";

test("user can sign up and see dashboard", async ({ page }) => {
  await page.goto("/signup");

  await page.fill('[data-testid="name-input"]', "Alice Johnson");
  await page.fill('[data-testid="email-input"]', "alice@example.com");
  await page.fill('[data-testid="password-input"]', "SecurePass123!");
  await page.click('[data-testid="signup-button"]');

  await expect(page).toHaveURL("/dashboard");
  await expect(page.locator('[data-testid="welcome-message"]')).toContainText(
    "Welcome, Alice"
  );
});

test("user cannot sign up with invalid email", async ({ page }) => {
  await page.goto("/signup");

  await page.fill('[data-testid="email-input"]', "not-an-email");
  await page.fill('[data-testid="password-input"]', "SecurePass123!");
  await page.click('[data-testid="signup-button"]');

  await expect(page.locator('[data-testid="error-message"]')).toContainText(
    "valid email"
  );
  await expect(page).toHaveURL("/signup");
});
```

### Basic Cypress Concepts

```typescript
describe("Shopping Cart", () => {
  beforeEach(() => {
    cy.visit("/");
    cy.login("testuser@example.com", "password123");
  });

  it("adds item to cart and checks out", () => {
    cy.get('[data-testid="product-card"]').first().click();
    cy.get('[data-testid="add-to-cart"]').click();

    cy.get('[data-testid="cart-icon"]').click();
    cy.get('[data-testid="cart-items"]').should("have.length", 1);

    cy.get('[data-testid="checkout-button"]').click();
    cy.get('[data-testid="order-confirmation"]').should("be.visible");
  });
});
```

---

## Choosing What to E2E Test

E2E tests are expensive. Be strategic about what you test.

```
THE E2E TEST SELECTION MATRIX

  HIGH VALUE (Always E2E test these):
  ┌────────────────────────────────────┐
  │ - User signup / login flow          │
  │ - Core purchase / checkout flow     │
  │ - Main feature happy paths          │
  │ - Payment processing                │
  │ - Critical data submission forms    │
  └────────────────────────────────────┘

  MEDIUM VALUE (E2E test if time permits):
  ┌────────────────────────────────────┐
  │ - Search functionality              │
  │ - Navigation between main sections  │
  │ - Error recovery flows              │
  │ - Multi-step wizards                │
  └────────────────────────────────────┘

  LOW VALUE (Don't E2E test):
  ┌────────────────────────────────────┐
  │ - Individual form validation        │  ← Unit test instead
  │ - Styling / visual appearance       │  ← Visual regression tools
  │ - Tooltip text                      │  ← Not worth the cost
  │ - Every permutation of a feature    │  ← Integration test instead
  └────────────────────────────────────┘
```

**Rule of thumb**: Write E2E tests for the paths that make you money.
If the signup flow breaks, you lose *all* new users. If a tooltip is
wrong, nobody notices for weeks.

---

## The Flaky Test Problem

The biggest challenge with E2E tests is **flakiness** — tests that
sometimes pass and sometimes fail for no obvious reason.

```
WHY E2E TESTS FLAKE

  TIMING ISSUES (most common):
    Test clicks a button before it's rendered
    Test reads text before data finishes loading
    Animation is still playing when test checks result

  ENVIRONMENT ISSUES:
    Test database has leftover data from a previous run
    Third-party service is slow or down
    Different browser version behaves differently

  ORDER DEPENDENCY:
    Test B fails because Test A didn't clean up
    Parallel tests modify the same data
```

### Fixing Flaky Tests

```
STRATEGY 1: WAIT FOR ELEMENTS (not arbitrary time)

  BAD:
    await page.click("#submit");
    await page.waitForTimeout(3000);    ← Arbitrary 3-second wait
    const text = await page.textContent("#result");

  GOOD:
    await page.click("#submit");
    await page.waitForSelector("#result", { state: "visible" });
    const text = await page.textContent("#result");
```

```typescript
test("loads search results", async ({ page }) => {
  await page.goto("/search");
  await page.fill('[data-testid="search-input"]', "headphones");
  await page.click('[data-testid="search-button"]');

  await page.waitForSelector('[data-testid="results-list"]');

  const resultCount = await page.locator('[data-testid="result-item"]').count();
  expect(resultCount).toBeGreaterThan(0);
});
```

```
STRATEGY 2: ISOLATE TEST DATA

  BAD: All tests share the same database with pre-loaded data

  GOOD: Each test creates its own data

    beforeEach:
      1. Create a fresh test user with unique email
      2. Create test products needed for THIS test
      3. Log in as the test user

    afterEach:
      1. Clean up created data (or use a fresh DB)
```

```
STRATEGY 3: RETRY FLAKY ASSERTIONS

  Playwright built-in auto-retrying:
    await expect(locator).toContainText("Hello")
    // Playwright auto-retries this for up to 5 seconds

  Explicit retry:
    await expect(async () => {
      const count = await page.locator(".item").count();
      expect(count).toBe(5);
    }).toPass({ timeout: 10_000 });
```

---

## Test Selectors: How to Find Elements

```
SELECTOR STRATEGIES (best to worst)

  1. data-testid attributes (BEST)
     <button data-testid="submit-order">Place Order</button>
     page.click('[data-testid="submit-order"]')
     ✓ Won't break when text or styling changes
     ✓ Clear intent: this element is used in tests

  2. ARIA roles and labels (GOOD)
     page.getByRole("button", { name: "Place Order" })
     ✓ Tests accessibility at the same time
     ✓ Resilient to structural changes

  3. Text content (OK for simple cases)
     page.getByText("Place Order")
     ⚠ Breaks if text changes
     ⚠ Ambiguous if multiple elements have same text

  4. CSS classes (AVOID)
     page.click(".btn-primary.submit-btn")
     ✗ Breaks when CSS is refactored
     ✗ Classes are for styling, not testing

  5. XPath (AVOID)
     page.click("//div[3]/form/button[2]")
     ✗ Extremely brittle
     ✗ Unreadable
     ✗ Breaks with any structural change
```

---

## Page Object Pattern

For larger test suites, the **Page Object** pattern keeps tests readable
by encapsulating page interactions:

```typescript
class LoginPage {
  constructor(private page: Page) {}

  async goto() {
    await this.page.goto("/login");
  }

  async login(email: string, password: string) {
    await this.page.fill('[data-testid="email"]', email);
    await this.page.fill('[data-testid="password"]', password);
    await this.page.click('[data-testid="login-button"]');
  }

  async getErrorMessage(): Promise<string> {
    return await this.page.textContent('[data-testid="error"]') ?? "";
  }
}

class DashboardPage {
  constructor(private page: Page) {}

  async getWelcomeText(): Promise<string> {
    return await this.page.textContent('[data-testid="welcome"]') ?? "";
  }

  async isVisible(): Promise<boolean> {
    return await this.page.isVisible('[data-testid="dashboard"]');
  }
}

test("successful login shows dashboard", async ({ page }) => {
  const loginPage = new LoginPage(page);
  const dashboard = new DashboardPage(page);

  await loginPage.goto();
  await loginPage.login("alice@example.com", "password123");

  expect(await dashboard.isVisible()).toBe(true);
  expect(await dashboard.getWelcomeText()).toContain("Alice");
});

test("wrong password shows error", async ({ page }) => {
  const loginPage = new LoginPage(page);

  await loginPage.goto();
  await loginPage.login("alice@example.com", "wrong-password");

  expect(await loginPage.getErrorMessage()).toContain("Invalid credentials");
});
```

The page object encapsulates all the selectors and interactions. If the
login form changes, you update one class instead of fifty tests.

---

## E2E Test Configuration

```
TYPICAL E2E TEST SETUP

  playwright.config.ts:

    ┌─────────────────────────────────────────────────┐
    │  Base URL:     http://localhost:3000              │
    │  Browsers:     Chromium, Firefox, Safari          │
    │  Retries:      2 (in CI), 0 (locally)            │
    │  Workers:      4 (parallel test files)            │
    │  Timeout:      30 seconds per test                │
    │  Screenshots:  On failure only                    │
    │  Video:        On failure only (for debugging)    │
    │  Web Server:   Start app before tests             │
    └─────────────────────────────────────────────────┘
```

```
CI PIPELINE WITH E2E TESTS

  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐
  │  Build   │───→│  Unit    │───→│  Integ.  │───→│   E2E    │
  │  App     │    │  Tests   │    │  Tests   │    │  Tests   │
  │  2 min   │    │  30 sec  │    │  3 min   │    │  10 min  │
  └──────────┘    └──────────┘    └──────────┘    └──────────┘

  If unit tests fail, don't waste time on E2E.
  Fast feedback first, expensive tests last.
```

---

## Exercises

1. **Write your first E2E test**: Pick any web application you use.
   Describe (in pseudocode) an E2E test for its most critical user flow.
   What would you assert at each step?

2. **Fix a flaky test**: This test is flaky. Identify the problem and
   fix it:
   ```typescript
   test("shows results", async ({ page }) => {
     await page.goto("/search");
     await page.fill("#query", "shoes");
     await page.click("#search");
     const count = await page.locator(".result").count();
     expect(count).toBe(10);
   });
   ```

3. **Page object refactor**: Take an E2E test with repeated selectors
   and refactor it to use the Page Object pattern.

4. **Selector audit**: Look at an existing E2E test suite. How many
   tests use CSS class selectors? How would you replace them with
   data-testid or ARIA role selectors?

---

[Next: Lesson 08 - Test-Driven Development](./08-tdd.md)
