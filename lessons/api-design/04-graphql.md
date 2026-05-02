# Lesson 04: GraphQL

## The Buffet vs A La Carte

REST is a fixed menu -- each endpoint gives you a set meal. GraphQL is
a buffet -- you pick exactly what you want from a schema of everything
available.

```
  REST:                          GRAPHQL:
  GET /users/42                  query {
  -> { id, name, email,           user(id: 42) {
       bio, avatar, phone,          name
       settings, prefs, ... }       email
                                  }
  GET /users/42/orders           }
  -> { orders: [...] }
                                 -> { "user": { "name": "Alice",
  Two requests, lots of                         "email": "..." } }
  unused fields
                                 One request, exactly what you need
```

## Schema-First Design

GraphQL starts with a **schema** -- a typed contract. Think of it as a
blueprint. The schema defines every type, query, and mutation available.

```graphql
type User {
  id: ID!
  name: String!
  email: String!
  posts: [Post!]!
}

type Post {
  id: ID!
  title: String!
  body: String!
  author: User!
  comments: [Comment!]!
}

type Comment {
  id: ID!
  text: String!
  author: User!
}

type Query {
  user(id: ID!): User
  posts(limit: Int, offset: Int): [Post!]!
}

type Mutation {
  createPost(title: String!, body: String!): Post!
  addComment(postId: ID!, text: String!): Comment!
}

type Subscription {
  commentAdded(postId: ID!): Comment!
}
```

```
  SCHEMA STRUCTURE:
  +--------------------------------------------------+
  |                                                  |
  |  Types          Define your data shapes          |
  |  -----          (User, Post, Comment)            |
  |                                                  |
  |  Query          Read operations                  |
  |  -----          "What can I fetch?"              |
  |                                                  |
  |  Mutation        Write operations                |
  |  --------        "What can I change?"            |
  |                                                  |
  |  Subscription    Real-time streams               |
  |  ------------    "What can I watch?"             |
  |                                                  |
  +--------------------------------------------------+
```

## Queries: Ask for Exactly What You Need

```
  Query:                              Response:
  {                                   {
    user(id: "42") {                    "data": {
      name                                "user": {
      posts {                               "name": "Alice",
        title                               "posts": [
        comments {                            {
          text                                  "title": "GraphQL 101",
        }                                       "comments": [
      }                                           { "text": "Great!" }
    }                                           ]
  }                                           }
                                            ]
                                          }
                                        }
                                      }
```

You can traverse the entire graph in a single request. That's the "Graph"
in GraphQL.

## Mutations: Changing Data

```graphql
mutation {
  createPost(title: "Hello World", body: "My first post") {
    id
    title
  }
}
```

Mutations are like POST/PUT/DELETE in REST. They modify data and return
the result.

## Subscriptions: Real-Time Updates

```graphql
subscription {
  commentAdded(postId: "1") {
    text
    author {
      name
    }
  }
}
```

The server pushes data to the client over a WebSocket when events occur.

## The N+1 Problem

This is GraphQL's biggest trap. Imagine fetching 10 posts with their authors:

```
  Client asks:
  { posts(limit: 10) { title, author { name } } }

  Naive resolver does:
  1 query:  SELECT * FROM posts LIMIT 10          (1)
  10 queries: SELECT * FROM users WHERE id = ?     (N)
                                                   = N+1 queries!

  +------+     +------+     +------+
  | Post | --> | User | --> | DB   |  x10!
  +------+     +------+     +------+
```

### Solution: DataLoader (Batching)

```
  WITHOUT DataLoader:            WITH DataLoader:
  SELECT * FROM users WHERE      SELECT * FROM users WHERE
    id = 1                         id IN (1, 2, 3, 4, 5)
  SELECT * FROM users WHERE
    id = 2                       ONE query instead of TEN
  SELECT * FROM users WHERE
    id = 3
  ... (10 queries)
```

### TypeScript - GraphQL Server with DataLoader

```typescript
import { createSchema, createYoga } from "graphql-yoga";
import DataLoader from "dataloader";

interface User {
  id: string;
  name: string;
  email: string;
}

interface Post {
  id: string;
  title: string;
  body: string;
  authorId: string;
}

const users: User[] = [
  { id: "1", name: "Alice", email: "alice@test.com" },
  { id: "2", name: "Bob", email: "bob@test.com" },
];

const posts: Post[] = [
  { id: "1", title: "GraphQL 101", body: "Intro to GraphQL", authorId: "1" },
  { id: "2", title: "REST vs GraphQL", body: "A comparison", authorId: "1" },
  { id: "3", title: "Go Concurrency", body: "Goroutines", authorId: "2" },
];

const schema = createSchema({
  typeDefs: `
    type User {
      id: ID!
      name: String!
      email: String!
      posts: [Post!]!
    }
    type Post {
      id: ID!
      title: String!
      body: String!
      author: User!
    }
    type Query {
      user(id: ID!): User
      posts: [Post!]!
    }
    type Mutation {
      createPost(title: String!, body: String!, authorId: ID!): Post!
    }
  `,
  resolvers: {
    Query: {
      user: (_: unknown, args: { id: string }) =>
        users.find((u) => u.id === args.id) ?? null,
      posts: () => posts,
    },
    User: {
      posts: (parent: User) =>
        posts.filter((p) => p.authorId === parent.id),
    },
    Post: {
      author: (parent: Post, _: unknown, context: { userLoader: DataLoader<string, User> }) =>
        context.userLoader.load(parent.authorId),
    },
    Mutation: {
      createPost: (_: unknown, args: { title: string; body: string; authorId: string }) => {
        const post: Post = {
          id: String(posts.length + 1),
          title: args.title,
          body: args.body,
          authorId: args.authorId,
        };
        posts.push(post);
        return post;
      },
    },
  },
});

const yoga = createYoga({
  schema,
  context: () => ({
    userLoader: new DataLoader<string, User>(async (ids) => {
      const found = users.filter((u) => (ids as string[]).includes(u.id));
      return ids.map((id) => found.find((u) => u.id === id)!);
    }),
  }),
});

const server = Bun.serve({
  port: 4000,
  fetch: yoga.fetch,
});

console.log(`GraphQL at http://localhost:${server.port}/graphql`);
```

## When to Use GraphQL vs REST

```
  +--------------------+------------------+------------------+
  |                    | REST             | GraphQL          |
  +--------------------+------------------+------------------+
  | Best for           | Simple CRUD      | Complex, nested  |
  | Caching            | HTTP caching     | Needs extra work |
  | Overfetching       | Common problem   | Solved by design |
  | Learning curve     | Low              | Medium-High      |
  | File uploads       | Native           | Needs workaround |
  | Error handling     | HTTP status codes| Always 200 OK    |
  | Real-time          | Needs WebSocket  | Subscriptions    |
  | Mobile clients     | Multiple calls   | One request      |
  +--------------------+------------------+------------------+
```

## Exercises

1. **Write a schema** for a library system: books, authors, genres, borrowers.
   Include queries and mutations.

2. **Run the TypeScript server.** Query it at `/graphql` with:
   ```graphql
   { posts { title author { name } } }
   ```

3. **Explain the N+1 problem** to a non-technical person using a restaurant
   analogy (hint: ordering drinks one at a time vs all at once).

4. **When would you NOT use GraphQL?** List 3 scenarios where REST is simpler.

---

[Next: Lesson 05 - gRPC & Protocol Buffers ->](05-grpc-protobuf.md)
