# Career Tracks & New Topics — Design

## Summary

Add 9 curated career tracks (Backend Engineer, ML Engineer, etc.) that guide learners through existing + new topics in order. Add 6 new topic areas to fill gaps. Add verified book recommendations to every topic. Design lessons to be comprehensive enough that books are supplementary, not required.

## Data Model

```typescript
interface CareerTrack {
  id: string;
  title: string;
  description: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  icon: string;
  color: string;
  estimatedHours: number;
  topicIds: string[];
  books: { title: string; author: string; year: number; free?: boolean }[];
}

interface Manifest {
  tracks: Track[];           // existing topic tracks (unchanged)
  careerTracks: CareerTrack[];
  totalLessons: number;
  generatedAt: string;
}
```

Progress is global — completedLessons in localStorage, shared across all career tracks.

## Navigation

```
Landing Page
├── Career Tracks section (9 cards at top)
│   └── Career Track Detail page
│       ├── Description + difficulty + book recommendations
│       ├── Ordered list of topics with progress bars
│       └── Click topic → existing topic view → lessons
├── "Explore All Topics" section (existing grid below)
│   └── Topic → Lessons (unchanged)
└── Settings (unchanged)
```

Hash routing:
- `#/` — landing page
- `#/career/backend-engineer` — career track detail
- `#/rust` — topic view (unchanged)
- `#/rust/01-ownership` — lesson view (unchanged)

## New Topics (6)

| Topic ID | Lessons | Coverage |
|---|---|---|
| ci-cd-pipelines | 16 | Git workflows, GitHub Actions, build/test/deploy, blue-green, canary, feature flags |
| testing-quality | 18 | Unit/integration/e2e, TDD, mocking, property-based, mutation testing, test architecture |
| design-patterns | 18 | SOLID, GoF essentials, DI, clean architecture, hexagonal, DDD |
| infrastructure-as-code | 15 | Terraform fundamentals through advanced, state, modules, policy-as-code |
| message-queues-streaming | 16 | Kafka, RabbitMQ, pub/sub, event-driven, stream processing, exactly-once |
| authentication-authorization | 16 | OAuth 2.0, OIDC, JWT, sessions, RBAC/ABAC, SSO, passkeys, MFA |

## Career Tracks (9)

### Backend Engineer (Beginner→Intermediate)
cs-fundamentals, data-structures, databases, go, networking, api-design, linux-fundamentals, testing-quality, design-patterns, concurrency-parallelism, ci-cd-pipelines, authentication-authorization, message-queues-streaming, system-design, docker, security-cryptography

### ML Engineer (Intermediate→Advanced)
python-for-ai, math-for-ai, data-structures, ml-fundamentals, advanced-deep-learning, llms-transformers, applied-ml, testing-quality, ci-cd-pipelines, mlops, docker, kubernetes, cloud-architecture, data-engineering

### Systems Programmer (Intermediate→Advanced)
cs-fundamentals, data-structures, c-cpp-for-ml, rust, os-concepts, concurrency-parallelism, networking, compilers-interpreters, linux-fundamentals, discrete-math

### Cloud / DevOps Engineer (Beginner→Intermediate)
linux-fundamentals, networking, docker, kubernetes, ci-cd-pipelines, infrastructure-as-code, cloud-architecture, sre-observability, security-cryptography, message-queues-streaming, databases

### Full-Stack Developer (Beginner→Intermediate)
cs-fundamentals, data-structures, typescript-web, databases, api-design, testing-quality, ci-cd-pipelines, authentication-authorization, networking, linux-fundamentals, docker, security-cryptography, system-design

### AI Engineer (Intermediate)
python-for-ai, ml-fundamentals, llms-transformers, nlp, ai-engineering, applied-ml, testing-quality, api-design, databases, docker, cloud-architecture, ci-cd-pipelines

### Data Engineer (Intermediate)
python-for-ai, databases, data-engineering, linux-fundamentals, message-queues-streaming, docker, kubernetes, infrastructure-as-code, cloud-architecture, distributed-systems, ci-cd-pipelines

### Security Engineer (Intermediate→Advanced)
cs-fundamentals, networking, linux-fundamentals, os-concepts, security-cryptography, authentication-authorization, docker, kubernetes, cloud-architecture, api-design, databases, ci-cd-pipelines

### Site Reliability Engineer (Intermediate→Advanced)
linux-fundamentals, networking, os-concepts, databases, docker, kubernetes, ci-cd-pipelines, infrastructure-as-code, cloud-architecture, sre-observability, message-queues-streaming, distributed-systems, system-design, security-cryptography

## Book Recommendations

Added to each topic's 00-roadmap.md as a "Recommended Reading" section. Only verified, real books. Free resources marked. Lessons are comprehensive enough that books are supplementary.

## Design Principles

- Lessons replace books for people who can't afford them
- Every concept explained with analogies first, then technical details
- Real code examples in relevant languages
- ASCII diagrams for visual learners
- No jargon without explanation
