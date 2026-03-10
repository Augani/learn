# Lesson 16: Web Performance

## The Big Analogy: Restaurant Speed

```
PERFORMANCE = RESTAURANT SPEED

  First Contentful Paint (FCP)     = First bread on the table
  Largest Contentful Paint (LCP)   = Main course arrives
  Cumulative Layout Shift (CLS)    = Waiter bumping your table
  Interaction to Next Paint (INP)  = How fast waiter responds
  Time to First Byte (TTFB)       = How fast kitchen acknowledges order

  Core Web Vitals:
  +----------+----------+----------+
  |   LCP    |   INP    |   CLS    |
  | < 2.5s   | < 200ms  | < 0.1   |
  |  Good    |  Good    |  Good    |
  +----------+----------+----------+
  | 2.5-4s   | 200-500ms| 0.1-0.25|
  | Needs    | Needs    | Needs    |
  | improve  | improve  | improve  |
  +----------+----------+----------+
  | > 4s     | > 500ms  | > 0.25  |
  |  Poor    |  Poor    |  Poor    |
  +----------+----------+----------+
```

## Measuring Performance

```typescript
import { onCLS, onINP, onLCP, onFCP, onTTFB, type Metric } from "web-vitals";

function sendToAnalytics(metric: Metric): void {
  const body = JSON.stringify({
    id: metric.id,
    name: metric.name,
    value: metric.value,
    rating: metric.rating,
    delta: metric.delta,
    navigationType: metric.navigationType,
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon("/api/analytics/vitals", body);
  }
}

onCLS(sendToAnalytics);
onINP(sendToAnalytics);
onLCP(sendToAnalytics);
onFCP(sendToAnalytics);
onTTFB(sendToAnalytics);
```

## Lazy Loading and Code Splitting

```
CODE SPLITTING

  WITHOUT splitting:               WITH splitting:
  +------------------------+       +----------+
  | bundle.js (500 KB)     |       | main.js  |  (100 KB) loaded immediately
  | - React                |       +----------+
  | - Dashboard            |
  | - Charts               |       +----------+
  | - Admin panel          |       | charts.js|  (150 KB) loaded on demand
  | - Settings             |       +----------+
  | - Everything           |
  +------------------------+       +----------+
                                   | admin.js |  (120 KB) loaded on demand
  User downloads ALL code          +----------+
  even if they visit one page.
                                   User downloads only what they need.
```

```tsx
import dynamic from "next/dynamic";
import { Suspense, lazy } from "react";

const Chart = dynamic(() => import("@/components/Chart"), {
  loading: () => <div className="h-64 animate-pulse bg-gray-200 rounded" />,
  ssr: false,
});

const AdminPanel = dynamic(() => import("@/components/AdminPanel"), {
  loading: () => <p>Loading admin panel...</p>,
});

const HeavyEditor = lazy(() => import("@/components/HeavyEditor"));

function Dashboard({ isAdmin }: { isAdmin: boolean }) {
  return (
    <div>
      <h1>Dashboard</h1>

      <Suspense fallback={<div>Loading chart...</div>}>
        <Chart data={[]} />
      </Suspense>

      {isAdmin && (
        <Suspense fallback={<div>Loading admin...</div>}>
          <AdminPanel />
        </Suspense>
      )}

      <Suspense fallback={<div>Loading editor...</div>}>
        <HeavyEditor />
      </Suspense>
    </div>
  );
}
```

## Image Optimization

```
IMAGE OPTIMIZATION PIPELINE

  Original: photo.jpg (2.5 MB, 4000x3000)
       |
       v
  Next.js Image Component
       |
       +-- Desktop: 1200w WebP (45 KB)
       +-- Tablet:  768w WebP  (28 KB)
       +-- Mobile:  400w WebP  (15 KB)
       +-- Fallback: JPEG
       |
       v
  Lazy loaded (only when near viewport)
  Proper width/height (no layout shift)
  CDN cached
```

```tsx
import Image from "next/image";

function HeroSection() {
  return (
    <section>
      <Image
        src="/hero.jpg"
        alt="Product showcase"
        width={1200}
        height={600}
        priority
        sizes="100vw"
        className="w-full h-auto"
      />
    </section>
  );
}

function ProductGrid({ products }: { products: Product[] }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {products.map((product) => (
        <div key={product.id}>
          <Image
            src={product.imageUrl}
            alt={product.name}
            width={300}
            height={300}
            sizes="(max-width: 768px) 50vw, 25vw"
            className="rounded-lg"
            loading="lazy"
            placeholder="blur"
            blurDataURL={product.blurHash}
          />
          <p>{product.name}</p>
        </div>
      ))}
    </div>
  );
}
```

## React Performance Patterns

```tsx
import { memo, useCallback, useMemo, useTransition } from "react";

interface ListItemProps {
  item: { id: string; name: string; value: number };
  onSelect: (id: string) => void;
}

const ListItem = memo(function ListItem({ item, onSelect }: ListItemProps) {
  return (
    <div onClick={() => onSelect(item.id)}>
      {item.name}: {item.value}
    </div>
  );
});

function ExpensiveList({ items }: { items: ListItemProps["item"][] }) {
  const [filter, setFilter] = useState("");
  const [isPending, startTransition] = useTransition();

  const filteredItems = useMemo(
    () =>
      items.filter((item) =>
        item.name.toLowerCase().includes(filter.toLowerCase())
      ),
    [items, filter]
  );

  const handleSelect = useCallback((id: string) => {
    console.log("Selected:", id);
  }, []);

  function handleFilterChange(value: string) {
    startTransition(() => {
      setFilter(value);
    });
  }

  return (
    <div>
      <input
        onChange={(e) => handleFilterChange(e.target.value)}
        placeholder="Filter..."
      />
      {isPending && <p>Updating...</p>}
      {filteredItems.map((item) => (
        <ListItem key={item.id} item={item} onSelect={handleSelect} />
      ))}
    </div>
  );
}
```

## Server-Side Performance

```
CACHING STRATEGIES IN NEXT.JS

  Request --> Cache hit? --> YES --> Return cached
                |
                NO
                |
                v
  Fetch data --> Generate page --> Cache result --> Return

  CACHE LEVELS:
  1. CDN/Edge Cache (fastest, global)
  2. Full Route Cache (pre-rendered pages)
  3. Data Cache (fetch results)
  4. React Cache (request dedup)
```

```typescript
async function getProducts(): Promise<Product[]> {
  const response = await fetch("https://api.example.com/products", {
    next: { revalidate: 3600 },
  });
  return response.json();
}

async function getUser(id: string): Promise<User> {
  const response = await fetch(`https://api.example.com/users/${id}`, {
    cache: "no-store",
  });
  return response.json();
}

import { unstable_cache } from "next/cache";

const getCachedProducts = unstable_cache(
  async () => {
    return prisma.product.findMany({
      where: { active: true },
      orderBy: { createdAt: "desc" },
    });
  },
  ["products"],
  { revalidate: 3600, tags: ["products"] }
);
```

## Bundle Analysis

```bash
npx @next/bundle-analyzer

NEXT_PUBLIC_ANALYZE=true npm run build
```

```typescript
const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});

module.exports = withBundleAnalyzer({
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "@radix-ui/react-icons",
      "date-fns",
    ],
  },
});
```

## Performance Checklist

```
+--------------------------------------------------+
| WEB PERFORMANCE CHECKLIST                        |
|                                                  |
| Loading:                                         |
| [ ] Images optimized with next/image             |
| [ ] Code split heavy components                  |
| [ ] Fonts preloaded with next/font               |
| [ ] Critical CSS inlined                         |
| [ ] Third-party scripts deferred                 |
|                                                  |
| Runtime:                                         |
| [ ] Lists virtualized if > 100 items            |
| [ ] Expensive renders memoized                   |
| [ ] Transitions for non-urgent updates          |
| [ ] Event handlers debounced where needed        |
|                                                  |
| Server:                                          |
| [ ] Static pages pre-rendered                    |
| [ ] Data cached appropriately                    |
| [ ] API responses compressed                     |
| [ ] Database queries optimized                   |
+--------------------------------------------------+
```

## Exercises

1. Set up web-vitals reporting in a Next.js app. Create an API route that receives metrics and stores them. Build a simple dashboard to visualize LCP, INP, and CLS trends.

2. Implement code splitting for a dashboard with 5 tabs. Only the active tab's component should be loaded. Measure the bundle size reduction.

3. Optimize a product listing page: use `next/image` with proper `sizes`, implement infinite scroll with virtualization, and measure before/after LCP.

4. Profile a slow React component using React DevTools Profiler. Identify unnecessary re-renders and fix them with `memo`, `useCallback`, and `useMemo`.

5. Implement ISR (Incremental Static Regeneration) for a blog. Pages should regenerate every 60 seconds and support on-demand revalidation via an API route.

## Key Takeaways

```
+-------------------------------------------+
| PERFORMANCE ESSENTIALS                    |
|                                           |
| 1. Measure first, optimize second        |
| 2. Core Web Vitals are the scoreboard   |
| 3. Code split everything heavy           |
| 4. next/image for all images             |
| 5. Cache aggressively, invalidate smart  |
| 6. Ship less JavaScript                  |
+-------------------------------------------+
```
