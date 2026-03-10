# Lesson 13: Feature Flags

> **The one thing to remember**: Feature flags are like light switches
> for your code. The wiring (code) is installed and always there, but
> you choose when to flip the switch and turn the feature on — for
> everyone, for some users, or for nobody. And if the light starts
> flickering, you flip it off instantly. No rewiring needed.

---

## The Light Switch Analogy

```
WITHOUT FEATURE FLAGS                  WITH FEATURE FLAGS

  To add a feature:                    To add a feature:
  1. Write code on branch              1. Write code behind a flag
  2. Merge branch (deploy code)        2. Merge to main (flag OFF)
  3. Feature is live instantly         3. Deploy (feature invisible)
  4. Bug? Revert and redeploy         4. Flip flag ON for 5% of users
     (5-15 min to fix)                5. Monitor
                                       6. Bug? Flip flag OFF (instant)
                                          No deploy needed!

  Deploy = Release                     Deploy ≠ Release
  (scary, coupled)                     (separated, controlled)
```

The key insight: **feature flags decouple deployment from release**.
You deploy code to production anytime. You release the feature to
users when YOU decide, independently of the deployment.

```
SEPARATION OF CONCERNS

  Before flags:
  ┌──────────────────────────┐
  │    Deploy + Release      │  One scary event
  └──────────────────────────┘

  After flags:
  ┌────────────┐  ┌────────────┐
  │   Deploy   │  │  Release   │  Two independent events
  │ (push code)│  │ (flip flag)│
  └────────────┘  └────────────┘
       Tuesday         Thursday
       (boring)        (controlled)
```

---

## How Feature Flags Work

At its simplest, a feature flag is an if statement:

```javascript
// The simplest feature flag possible
if (process.env.ENABLE_NEW_CHECKOUT === 'true') {
  renderNewCheckout();
} else {
  renderOldCheckout();
}
```

But in practice, you want more control. Here's a proper implementation:

```javascript
// featureFlags.ts
interface FeatureFlag {
  name: string;
  enabled: boolean;
  percentage?: number;
  allowedUsers?: string[];
}

const flags: Record<string, FeatureFlag> = {
  newCheckout: {
    name: 'newCheckout',
    enabled: true,
    percentage: 10,
  },
  darkMode: {
    name: 'darkMode',
    enabled: true,
    allowedUsers: ['user-123', 'user-456'],
  },
  betaSearch: {
    name: 'betaSearch',
    enabled: false,
  },
};

function isEnabled(flagName: string, userId?: string): boolean {
  const flag = flags[flagName];
  if (!flag || !flag.enabled) return false;

  if (flag.allowedUsers && userId) {
    return flag.allowedUsers.includes(userId);
  }

  if (flag.percentage !== undefined) {
    const hash = simpleHash(userId || 'anonymous');
    return (hash % 100) < flag.percentage;
  }

  return flag.enabled;
}

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}
```

```
FEATURE FLAG DECISION TREE

  isEnabled("newCheckout", userId)
       |
       v
  Flag exists?
       |         |
      YES        NO → return false
       |
       v
  Flag enabled?
       |         |
      YES        NO → return false
       |
       v
  Has allowedUsers list?
       |              |
      YES             NO
       |               |
       v               v
  User in list?    Has percentage?
  |       |        |          |
  YES     NO      YES         NO → return true
  |       |        |
  true    false    hash(userId) % 100 < percentage?
                   |              |
                  YES             NO
                  true            false
```

---

## Types of Feature Flags

```
FEATURE FLAG TYPES

  Type              Lifespan      Purpose                  Example
  -------------------------------------------------------------------
  Release flag      Days-weeks    Gate unfinished features  New checkout
  Experiment flag   Days-weeks    A/B testing               Button color
  Ops flag          Permanent     Control operations        Rate limiting
  Permission flag   Permanent     Control access            Premium features
  Kill switch       Permanent     Emergency shutoff         Disable payments
```

### Release Flags (Temporary)

```javascript
if (isEnabled('newCheckout')) {
  return <NewCheckoutPage />;
}
return <OldCheckoutPage />;
```

**Lifecycle:**
1. Flag created (OFF)
2. Code deployed behind flag
3. Flag turned ON for internal team
4. Flag turned ON for 10% of users
5. Flag turned ON for 100% of users
6. Old code and flag REMOVED (important!)

### Kill Switches (Permanent)

```javascript
if (!isEnabled('paymentsEnabled')) {
  return <ServiceUnavailablePage message="Payments temporarily disabled" />;
}
return <PaymentPage />;
```

A kill switch lets you disable critical features instantly without a
deploy. When your payment provider goes down at 2 AM, you flip one
switch instead of emergency-deploying code changes.

### Experiment Flags (A/B Tests)

```javascript
if (isEnabled('biggerBuyButton', userId)) {
  return <BigBuyButton />;
}
return <SmallBuyButton />;
```

50% of users see the big button, 50% see the small button. After a
week, check which group had more purchases.

---

## Feature Flags + Trunk-Based Development

Feature flags unlock trunk-based development. Without flags, you need
long-lived branches to hide incomplete features. With flags, you merge
to main daily — the flag keeps unfinished work invisible.

```
WITHOUT FLAGS: Long-lived branches

  main:    ──●──●──────────────────────●──●───>
                \                      /
  feature:       ●──●──●──●──●──●──●──●
                 (3 weeks of divergence)
                 (massive merge conflicts)

WITH FLAGS: Trunk-based + flags

  main:    ──●──●──●──●──●──●──●──●──●──●──●──●───>
              |     |     |     |     |     |
              v     v     v     v     v     v
             All commits merged daily (flag OFF)

  When ready: flip flag ON
  No branch, no merge conflicts, no "big bang" merge
```

---

## Feature Flag Services

For production use, dedicated services provide dashboards, targeting
rules, and analytics:

```
FEATURE FLAG SERVICES

  Service          Free Tier     Key Features
  ---------------------------------------------------------
  LaunchDarkly     No            Enterprise-grade, real-time,
                                 SDKs for every language
  Unleash          Yes (OSS)     Self-hosted, open source
  Flagsmith        Yes           Open source, hosted option
  ConfigCat        Yes (10 flags) Simple, affordable
  Split.io         Yes (limited) Feature + experimentation
  PostHog          Yes           Combines analytics + flags
```

### LaunchDarkly Example

```javascript
import * as LaunchDarkly from 'launchdarkly-node-server-sdk';

const client = LaunchDarkly.init('sdk-key-here');

await client.waitForInitialization();

const user = {
  key: 'user-123',
  email: 'alice@example.com',
  custom: {
    plan: 'premium',
    country: 'US',
  },
};

const showNewCheckout = await client.variation(
  'new-checkout',
  user,
  false
);

if (showNewCheckout) {
  renderNewCheckout();
} else {
  renderOldCheckout();
}
```

### Simple DIY with Config File

For small projects, a config file is enough:

```json
{
  "flags": {
    "newCheckout": {
      "enabled": true,
      "percentage": 25,
      "description": "New checkout flow with Apple Pay"
    },
    "darkMode": {
      "enabled": true,
      "allowedUsers": ["team-member-1", "team-member-2"],
      "description": "Dark mode theme"
    },
    "maintenanceMode": {
      "enabled": false,
      "description": "Kill switch for maintenance page"
    }
  }
}
```

Store this in a database or config service so you can update it without
deploying code.

---

## Feature Flag Best Practices

### 1. Clean Up Old Flags

Feature flags are temporary (except ops/kill switches). If you never
remove them, your code becomes:

```javascript
// This is what happens when you don't clean up flags
if (isEnabled('newCheckout')) {
  if (isEnabled('checkoutV2Improvements')) {
    if (isEnabled('checkoutV3Redesign')) {
      renderCheckoutV3(); // Which checkout are we even on?
    } else {
      renderCheckoutV2();
    }
  } else {
    renderNewCheckout();
  }
} else {
  renderOldCheckout(); // Is this code even reachable anymore?
}
```

```
FLAG LIFECYCLE

  Created  →  Tested  →  Rolled out  →  100%  →  REMOVED
  (Day 1)    (Day 3)    (Day 5-10)    (Day 14)   (Day 21)
                                                    ↑
                                               Don't forget this!

  Rule of thumb: Remove flags within 2 weeks of 100% rollout.
  Track flag cleanup as a regular task.
```

### 2. Default to OFF

New flags should default to OFF (false). This means if the flag
system fails or the flag is missing, the old behavior runs.

### 3. Test Both Paths

```javascript
// Test with flag ON
describe('NewCheckout', () => {
  beforeEach(() => setFlag('newCheckout', true));

  it('renders new checkout when flag is on', () => {
    render(<Checkout />);
    expect(screen.getByText('Express Checkout')).toBeVisible();
  });
});

// Test with flag OFF
describe('OldCheckout', () => {
  beforeEach(() => setFlag('newCheckout', false));

  it('renders old checkout when flag is off', () => {
    render(<Checkout />);
    expect(screen.getByText('Standard Checkout')).toBeVisible();
  });
});
```

### 4. Keep Flag Logic at the Edges

```
BAD: Flags scattered throughout code

  // In component
  if (isEnabled('newCheckout')) { ... }
  // In API handler
  if (isEnabled('newCheckout')) { ... }
  // In utility function
  if (isEnabled('newCheckout')) { ... }

GOOD: Flag checked once, at the entry point

  // In router (one place)
  const CheckoutPage = isEnabled('newCheckout')
    ? NewCheckout
    : OldCheckout;

  // NewCheckout and OldCheckout are independent components
  // No flag checks inside them
```

---

## Feature Flags in CI/CD

```yaml
# Test both flag states in CI
jobs:
  test-flags-off:
    runs-on: ubuntu-latest
    env:
      FEATURE_NEW_CHECKOUT: 'false'
      FEATURE_DARK_MODE: 'false'
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test

  test-flags-on:
    runs-on: ubuntu-latest
    env:
      FEATURE_NEW_CHECKOUT: 'true'
      FEATURE_DARK_MODE: 'true'
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm test
```

---

## Exercises

1. **Build a flag system**: Create a simple feature flag module with
   `isEnabled(flagName, userId)`. Support boolean flags and percentage
   rollouts.

2. **Trunk-based with flags**: On a project, create a new feature
   entirely behind a flag. Merge to main with the flag OFF. Then turn
   it ON and verify the feature appears.

3. **Kill switch**: Add a kill switch to your application's most
   critical feature. Practice turning it off and on. Measure how fast
   you can disable the feature (should be seconds).

4. **Flag cleanup**: Audit your codebase for any existing feature flags.
   Are any of them fully rolled out but never removed? Clean them up.

5. **A/B test**: Create a flag that shows two different button designs
   to 50/50 users. Track which version gets more clicks.

---

[Next: Lesson 14 — Monitoring Deployments](./14-monitoring-deployments.md)
