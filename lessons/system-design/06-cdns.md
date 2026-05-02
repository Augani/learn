# Content Delivery Networks (CDNs)

A CDN is like a pizza franchise. Imagine you own the best pizza shop in
New York. People in California are ordering your pizza, but by the time it
arrives, it's cold and the crust is soggy. You could buy faster delivery
trucks (more bandwidth), but the pizza still has to travel 3,000 miles.

The real solution: open pizza shops in every major city. Each franchise makes
the same pizza using your recipe. Customers in LA get their pizza in 10 minutes
instead of 10 hours. The original New York shop (your origin server) only needs
to handle local orders and send the recipe (content) to franchises when it changes.

That's exactly what a CDN does with your content.

---

## What a CDN Actually Does

A CDN is a network of servers distributed around the world. When a user requests
content, the CDN serves it from the server closest to them instead of making
them go all the way to your origin.

```
WITHOUT CDN:

  User in Tokyo ──────── 200ms ────────▶ Origin in Virginia
  User in London ─────── 100ms ────────▶ Origin in Virginia
  User in São Paulo ──── 150ms ────────▶ Origin in Virginia

WITH CDN:

  User in Tokyo ──── 10ms ────▶ CDN Edge (Tokyo)
  User in London ─── 10ms ────▶ CDN Edge (London)
  User in São Paulo ─ 10ms ───▶ CDN Edge (São Paulo)

                                         │
                           Cache miss?    │
                                         ▼
                              CDN Edge ──────▶ Origin (Virginia)
                              fetches content,
                              caches it locally
```

### The Numbers

| Route | Without CDN | With CDN |
|---|---|---|
| Same region | 5-20ms | 1-5ms |
| Cross-country | 30-70ms | 5-15ms |
| Cross-continent | 100-200ms | 10-30ms |
| Cross-Pacific | 150-300ms | 15-40ms |

For a page that loads 50 assets (images, CSS, JS), the difference is:

```
Without CDN: 50 assets × 150ms = 7.5 seconds (perceived load time)
With CDN:    50 assets × 15ms  = 0.75 seconds

That's a 10x improvement in user experience.
```

---

## Push vs Pull CDN

There are two fundamental approaches to getting content onto CDN edge servers.

### Pull CDN (Origin Pull)

The CDN fetches content from your origin server the first time someone requests
it. After that, it's cached at the edge.

```
First request for image.jpg:

  User ──▶ CDN Edge ──▶ "I don't have this" ──▶ Origin
                                                   │
                                              image.jpg
                                                   │
  User ◀── CDN Edge ◀── caches a copy ◀───────────┘

All subsequent requests:

  User ──▶ CDN Edge ──▶ "I have this cached!" ──▶ User
           (no origin contact needed)
```

**Pros:**
- Zero setup for content. Just point DNS at the CDN.
- Only caches content that's actually requested (efficient).
- No need to pre-upload content to CDN.

**Cons:**
- First request to each edge is slow (origin fetch).
- Origin must stay online for cache misses.
- Cold start after cache purge.

**Use when:** Most web applications. This is the default approach.

### Push CDN

You manually upload content to the CDN before anyone requests it. The CDN
serves it directly without ever contacting your origin.

```
You upload:

  Your Server ──push──▶ CDN Storage
                          │
                     Distributed to
                     all edge servers
                          │
              ┌───────────┼───────────┐
              ▼           ▼           ▼
         Edge Tokyo   Edge London  Edge NYC

All requests:

  User ──▶ CDN Edge ──▶ "I already have this!" ──▶ User
```

**Pros:**
- No cold start — content is pre-loaded everywhere.
- Origin can go offline. CDN is fully self-sufficient.
- Predictable performance — every request is a cache hit.

**Cons:**
- You must manage the upload/sync process.
- Pays for storage of ALL content on CDN, not just requested content.
- Content updates require explicit re-push.

**Use when:** Video streaming platforms, large media libraries, or when you
need guaranteed availability independent of origin.

### Comparison

| Aspect | Pull CDN | Push CDN |
|---|---|---|
| Setup complexity | Low (just DNS) | Higher (upload pipeline) |
| First request | Slow (origin fetch) | Fast (pre-loaded) |
| Storage cost | Pay for what's requested | Pay for everything |
| Origin dependency | Required for misses | Not required after push |
| Best for | Web apps, APIs | Video, large media, static sites |
| Examples | Cloudflare, CloudFront default | S3+CloudFront, video platforms |

---

## What to Put on a CDN

### Definitely CDN

| Content Type | Why | TTL |
|---|---|---|
| Images (JPEG, PNG, WebP) | Large, static, requested frequently | Days to months |
| CSS and JavaScript bundles | Fingerprinted files never change | 1 year (immutable) |
| Fonts (WOFF2) | Same for every user, large-ish | 1 year (immutable) |
| Videos | Massive files, bandwidth-intensive | Hours to days |
| PDFs and downloads | Static, bandwidth-intensive | Days |
| Favicon, logos | Tiny but requested on every page | Months |

### Maybe CDN (With Careful Configuration)

| Content Type | Consideration | TTL |
|---|---|---|
| API responses (public) | Product catalog, public feeds | 1-60 seconds |
| HTML pages (public) | Blog posts, landing pages | 5-60 seconds |
| Search results | If query patterns are predictable | 10-30 seconds |
| Thumbnails/avatars | User-generated but frequently accessed | Hours |

### Not on a CDN

| Content Type | Why Not |
|---|---|
| User-specific data | Different for every user. Cache hit rate ≈ 0% |
| Real-time data | Chat messages, live scores. Stale data is useless |
| Authenticated API responses | Sensitive data. Must not be served to wrong user |
| Checkout/payment pages | Security concern. Must always be fresh |
| Large file uploads | CDN is for egress (serving), not ingress (receiving) |

---

## Cache-Control Headers

Cache-Control headers are how you tell the browser AND the CDN how to cache
your content. Master these headers and you control the entire caching chain.

### The Headers That Matter

```
                        ┌──────────────┐
    Cache-Control ─────▶│   Browser    │ private, max-age
    headers tell        │    Cache     │
    each layer how      └──────┬───────┘
    to behave                  │
                        ┌──────┴───────┐
    Cache-Control ─────▶│     CDN      │ s-maxage, public
    headers tell        │    Cache     │
    each layer how      └──────┬───────┘
    to behave                  │
                        ┌──────┴───────┐
                        │   Origin     │
                        │   Server     │
                        └──────────────┘
```

### Common Cache-Control Patterns

**Static assets with content hashing (CSS, JS bundles):**
```
Cache-Control: public, max-age=31536000, immutable
```
- `public`: CDN can cache this
- `max-age=31536000`: Cache for 1 year (365 days in seconds)
- `immutable`: Never revalidate. The URL contains a hash — if content changes,
  the URL changes.

**API responses that can be cached briefly:**
```
Cache-Control: public, max-age=0, s-maxage=30, stale-while-revalidate=60
```
- `public`: CDN can cache this
- `max-age=0`: Browser should always revalidate
- `s-maxage=30`: CDN can cache for 30 seconds
- `stale-while-revalidate=60`: CDN can serve stale content for 60s while
  fetching fresh content in the background

**Private user data:**
```
Cache-Control: private, no-store
```
- `private`: Only the browser can cache (CDN must not)
- `no-store`: Don't store this anywhere. For sensitive data.

**HTML pages:**
```
Cache-Control: public, max-age=0, must-revalidate
```
- `max-age=0`: Always check for fresh version
- `must-revalidate`: If you have a cached version, check with origin before using

### Setting Headers in Go

```go
func staticFileHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
    http.ServeFile(w, r, filepath.Join("static", r.URL.Path))
}

func apiHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Cache-Control", "public, s-maxage=30, stale-while-revalidate=60")
    w.Header().Set("CDN-Cache-Control", "max-age=30")

    data := fetchData()
    json.NewEncoder(w).Encode(data)
}

func privateDataHandler(w http.ResponseWriter, r *http.Request) {
    w.Header().Set("Cache-Control", "private, no-store")

    userData := fetchUserData(r)
    json.NewEncoder(w).Encode(userData)
}
```

### Setting Headers in TypeScript (Express)

```typescript
app.use('/static', express.static('public', {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res) => {
        res.set('Cache-Control', 'public, max-age=31536000, immutable');
    },
}));

app.get('/api/products', (req, res) => {
    res.set('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=120');
    res.json(products);
});

app.get('/api/me', (req, res) => {
    res.set('Cache-Control', 'private, no-store');
    res.json(req.user);
});
```

### The Vary Header

When the same URL returns different content based on a header (like
Accept-Encoding or Accept-Language), use `Vary` to tell the CDN to cache
separate versions.

```
Vary: Accept-Encoding

This tells the CDN:
  GET /api/data (Accept-Encoding: gzip) → cache version A (compressed)
  GET /api/data (Accept-Encoding: br)   → cache version B (brotli)
  GET /api/data (no encoding)           → cache version C (raw)
```

**Warning:** `Vary: Cookie` or `Vary: Authorization` effectively disables CDN
caching because every user has different cookies.

---

## CDN Invalidation

When you update content, the CDN might still serve the old version. You need to
invalidate (purge) the cached content.

### Invalidation Methods

| Method | How | Speed | Cost |
|---|---|---|---|
| TTL expiration | Wait for cache to expire | Slow (hours) | Free |
| Purge by URL | API call to purge specific URL | Fast (seconds) | Per-request cost |
| Purge by tag | Tag content, purge by tag | Fast (seconds) | Premium feature |
| Purge all | Nuclear option — clear everything | Fast (seconds) | Causes origin spike |
| URL versioning | Change the URL (cache busting) | Instant | Free |

### URL Versioning (The Best Strategy for Assets)

Instead of invalidating cached content, change the URL so the CDN treats it
as new content.

```
Old: /static/app.css
New: /static/app.a3f2b1c.css (content hash in filename)

Or: /static/app.css?v=1.2.3 (query param, less reliable)
```

Build tools (Webpack, Vite, esbuild) do this automatically with content hashing.
Each build produces unique filenames based on the file's content.

```
Build output:
  /static/app.a3f2b1c.css      ← CSS changed, new hash
  /static/vendor.d4e5f6a.js    ← unchanged, same hash (still cached!)
  /static/main.b7c8d9e.js      ← JS changed, new hash
```

This is the best of both worlds: assets are cached forever (max-age=1 year),
but updated assets get new URLs so users always get fresh content.

### Purge via API (When You Need It)

**Cloudflare:**
```bash
curl -X POST "https://api.cloudflare.com/client/v4/zones/ZONE_ID/purge_cache" \
  -H "Authorization: Bearer API_TOKEN" \
  -H "Content-Type: application/json" \
  --data '{"files":["https://example.com/api/products"]}'
```

**CloudFront:**
```bash
aws cloudfront create-invalidation \
  --distribution-id DIST_ID \
  --paths "/api/products" "/api/products/*"
```

**Fastly (Surrogate-Key / tag-based):**
```
Origin response header: Surrogate-Key: product-123 products
Purge: curl -X POST https://api.fastly.com/service/SVC/purge/product-123
```

Tag-based purging is the most powerful. You tag responses with labels and purge
by label. Update a product? Purge the `product-123` tag. All URLs tagged with
it get invalidated.

---

## Edge Computing

Modern CDNs don't just cache — they run code at the edge.

```
Traditional:
  User → CDN (static cache) → Origin (dynamic logic)

Edge Computing:
  User → CDN Edge (runs your code HERE) → Origin (only if needed)
```

### What Can Run at the Edge?

| Use Case | Example | Why at the Edge? |
|---|---|---|
| A/B testing | Decide which variant to serve | No origin round trip |
| Authentication | Validate JWT tokens | Reject bad requests before origin |
| Redirects | URL shortening, locale routing | No origin needed |
| Image optimization | Resize/compress on the fly | Serve optimal format per device |
| API aggregation | Combine multiple API calls | Reduce client round trips |
| Rate limiting | Throttle by IP/region | Block abuse before hitting origin |
| Geo-routing | Serve region-specific content | Data locality |

### Edge Runtime Platforms

| Platform | CDN | Language | Cold Start |
|---|---|---|---|
| Cloudflare Workers | Cloudflare | JavaScript/WASM | ~0ms (V8 isolates) |
| AWS Lambda@Edge | CloudFront | Node.js, Python | 50-200ms |
| AWS CloudFront Functions | CloudFront | JavaScript (limited) | ~0ms |
| Vercel Edge Functions | Vercel/Cloudflare | JavaScript/TypeScript | ~0ms |
| Fastly Compute | Fastly | WASM (Rust, Go, JS) | ~0ms |
| Deno Deploy | Deno | TypeScript/JavaScript | ~0ms |

**Example: Edge-side A/B testing (Cloudflare Workers):**

```typescript
export default {
    async fetch(request: Request): Promise<Response> {
        const url = new URL(request.url);

        const cookie = request.headers.get('Cookie') || '';
        const match = cookie.match(/ab_variant=(\w+)/);

        let variant = match?.[1];
        if (!variant) {
            variant = Math.random() < 0.5 ? 'control' : 'experiment';
        }

        url.pathname = variant === 'experiment'
            ? url.pathname.replace('/page', '/page-v2')
            : url.pathname;

        const response = await fetch(url.toString(), request);
        const newResponse = new Response(response.body, response);

        if (!match) {
            newResponse.headers.set(
                'Set-Cookie',
                `ab_variant=${variant}; Path=/; Max-Age=604800`
            );
        }

        return newResponse;
    },
};
```

This runs at 300+ edge locations worldwide. The user never hits your origin
for the A/B decision — it happens in under 1ms at the edge.

---

## Multi-CDN Strategies

Big companies don't use just one CDN. They use multiple CDNs for redundancy
and performance optimization.

```
┌───────────────────────────────────────────────────────┐
│                  DNS / Traffic Manager                 │
│              (Route 53, NS1, Cloudflare DNS)          │
└───────────────┬──────────────────┬────────────────────┘
                │                  │
         ┌──────┴──────┐    ┌─────┴──────┐
         │ Cloudflare  │    │ CloudFront │
         │  (Primary)  │    │ (Secondary)│
         │  70% traffic│    │  30% traffic│
         └──────┬──────┘    └─────┬──────┘
                │                  │
                └────────┬─────────┘
                         │
                  ┌──────┴──────┐
                  │   Origin    │
                  └─────────────┘
```

**Why multi-CDN?**
- **Redundancy:** If one CDN has an outage, the other takes over.
- **Performance:** Different CDNs perform differently in different regions.
  CDN A might be faster in Asia, CDN B in Europe.
- **Cost optimization:** Route traffic to the cheapest CDN for each region.
- **Vendor negotiation:** "We can switch to your competitor" is a powerful
  negotiating tool.

**When to use:** You probably don't need multi-CDN until you're at serious
scale (millions of users, global presence) or have strict availability
requirements (99.99%+).

---

## Cost Considerations

CDN pricing is based on bandwidth (data transfer), requests, and premium
features.

### Typical Pricing (2024)

| CDN | Bandwidth (per GB) | Requests (per 10K) | Free Tier |
|---|---|---|---|
| Cloudflare | $0 (free plan!) | $0 (free plan) | Unlimited bandwidth |
| CloudFront | $0.085 (US/EU) | $0.0075 (HTTPS) | 1 TB/month free |
| Fastly | $0.12 (US) | $0.009 | Trial credits |
| Vercel | $0.15 (Pro plan) | Included | 100 GB/month |

### Cost Example

```
Scenario: 10M page views/month, 2 MB average page weight

Total bandwidth: 10M × 2 MB = 20 TB/month

Cloudflare (Pro): $20/month flat (!)
CloudFront: 20,000 GB × $0.085 = ~$1,700/month
Fastly: 20,000 GB × $0.12 = ~$2,400/month

The price difference is staggering.
```

Cloudflare's free/cheap bandwidth is a major reason for its popularity. They
make money on premium features (WAF, bot management, Workers) rather than
bandwidth.

### Hidden Costs to Watch

| Cost | Description |
|---|---|
| Origin egress | Your cloud provider charges for data OUT to the CDN |
| Purge requests | Some CDNs charge per invalidation request |
| SSL certificates | Usually free, but custom certs may cost extra |
| Real-time logs | Premium feature on most CDNs |
| DDoS protection | Basic is free, advanced is premium |
| Edge compute | Per-request pricing (usually cheap but adds up) |

---

## Popular CDNs Compared

| Feature | Cloudflare | CloudFront | Fastly | Vercel Edge |
|---|---|---|---|---|
| Edge locations | 300+ | 400+ | 70+ | 80+ |
| Free tier | Very generous | 1TB/month | Trial | 100GB/month |
| Edge compute | Workers (V8) | Lambda@Edge | Compute (WASM) | Edge Functions |
| Instant purge | Yes | No (~seconds) | Yes (<150ms) | Yes |
| WebSocket support | Yes | Limited | Yes | Limited |
| Best for | General purpose | AWS ecosystem | Performance-critical | Next.js apps |
| Setup complexity | Low | Medium | Medium-High | Low (with Vercel) |

---

## Practical Setup — Adding a CDN to Your Project

### Step 1: Decide What to Cache

```
Your app:
  /                    → HTML (cache briefly or not at all)
  /api/*               → JSON (cache selectively)
  /static/js/*.js      → JavaScript bundles (cache forever with hash)
  /static/css/*.css    → CSS bundles (cache forever with hash)
  /images/*            → User-uploaded images (cache for hours)
  /assets/*            → Logos, icons (cache for months)
```

### Step 2: Set Cache Headers on Your Origin

```go
func setupRoutes(mux *http.ServeMux) {
    mux.HandleFunc("/api/products", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cache-Control", "public, s-maxage=60")
        serveProducts(w, r)
    })

    mux.HandleFunc("/api/me", func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cache-Control", "private, no-store")
        serveUserProfile(w, r)
    })

    fileServer := http.FileServer(http.Dir("./static"))
    mux.Handle("/static/", cacheControl(
        "public, max-age=31536000, immutable",
        http.StripPrefix("/static/", fileServer),
    ))
}

func cacheControl(value string, next http.Handler) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        w.Header().Set("Cache-Control", value)
        next.ServeHTTP(w, r)
    })
}
```

### Step 3: Configure Your CDN

For Cloudflare (the simplest setup):
1. Point your domain's nameservers to Cloudflare
2. Cloudflare automatically proxies traffic
3. It respects your Cache-Control headers
4. Static assets are cached automatically

For CloudFront:
1. Create a distribution pointing to your origin
2. Configure cache behaviors for different URL patterns
3. Set up an SSL certificate
4. Point your DNS CNAME to the CloudFront distribution

### Step 4: Verify It's Working

```bash
curl -I https://yoursite.com/static/app.js

HTTP/2 200
cache-control: public, max-age=31536000, immutable
cf-cache-status: HIT          ← Cloudflare served from cache
age: 3600                     ← Been cached for 1 hour
x-cache: Hit from cloudfront  ← CloudFront equivalent
```

Check `cf-cache-status` (Cloudflare) or `x-cache` (CloudFront):
- `HIT` — Served from CDN cache. Great.
- `MISS` — Cache miss. Origin was contacted. First request to this edge.
- `DYNAMIC` — CDN decided not to cache (usually because of Cache-Control).
- `BYPASS` — CDN was told to skip caching for this request.

---

## Common Mistakes

### 1. Caching User-Specific Data on CDN
```
Bad:  GET /api/dashboard → Cache-Control: public, max-age=60
      User A sees User B's dashboard!

Good: GET /api/dashboard → Cache-Control: private, no-store
```

### 2. Forgetting Vary Headers
```
Bad:  GET /api/data returns gzip for Chrome, brotli for Firefox
      CDN caches gzip version, serves it to everyone

Good: Add Vary: Accept-Encoding
      CDN caches separate versions per encoding
```

### 3. Caching Error Responses
```
Bad:  Origin returns 500 error
      CDN caches the 500 for max-age duration
      All users see the error even after fix

Good: Only cache 200/304 responses
      Set Cache-Control: no-store on error responses
```

### 4. Not Using Content Hashing for Assets
```
Bad:  /static/app.js with max-age=1year
      Update app.js → users still see old version for a year

Good: /static/app.a3b2c1.js with max-age=1year
      Update → new hash → new URL → fresh content
```

---

## Exercises

### Exercise 1: Cache Header Design
For each route in your application, decide the correct Cache-Control header:
1. `GET /` — Home page HTML
2. `GET /api/products` — Public product listing
3. `GET /api/cart` — User's shopping cart
4. `GET /static/logo.svg` — Company logo
5. `GET /static/app.a3f2b1.js` — Hashed JavaScript bundle
6. `GET /api/notifications` — User's notifications (real-time)

### Exercise 2: CDN Cost Estimation
Your application serves:
- 50M page views/month
- Average page: 500 KB HTML + 2 MB assets
- 80% of asset requests are cache hits
- Compare costs on Cloudflare Free vs CloudFront

### Exercise 3: Edge Function
Write a Cloudflare Worker (or equivalent) that:
- Checks for an auth token in the request
- If invalid, returns 401 without hitting origin
- If valid, forwards to origin but adds a custom header
- Caches the origin response for 30 seconds at the edge

---

## Key Takeaways

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  1. Use a CDN for ALL static assets. There's no excuse      │
│     not to — Cloudflare is literally free.                  │
│                                                             │
│  2. Content hash your assets (Webpack/Vite do this).        │
│     Cache forever. New content = new URL.                   │
│                                                             │
│  3. Be explicit with Cache-Control headers.                 │
│     Don't leave caching to CDN defaults.                    │
│                                                             │
│  4. NEVER cache user-specific data on a public CDN.         │
│     Use "private" or "no-store" for authenticated routes.   │
│                                                             │
│  5. Pull CDN is the right default. Push CDN only for        │
│     video/media platforms.                                  │
│                                                             │
│  6. Edge computing is powerful for auth checks, A/B         │
│     testing, and redirects. It's becoming the norm.         │
│                                                             │
│  7. Start with one CDN. Multi-CDN is a later optimization.  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```
