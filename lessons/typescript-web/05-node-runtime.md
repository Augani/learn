# Lesson 05: Node.js Runtime

## What Is Node.js?

Node.js is V8 (Chrome's JS engine) plus system APIs. Think of it as
Go's runtime but for JavaScript — single-threaded with non-blocking I/O.

```
  NODE.JS ARCHITECTURE
  ====================

  +-------------------+
  | Your TypeScript   |  <-- tsc compiles to JS
  +-------------------+
           |
  +-------------------+
  | V8 Engine         |  <-- executes JavaScript
  +-------------------+
           |
  +-------------------+
  | libuv             |  <-- async I/O (like Go's netpoller)
  +-------------------+
           |
  +-------------------+
  | OS (files, net)   |
  +-------------------+
```

## The Event Loop (Detailed)

```
  EVENT LOOP PHASES
  =================

  +-> timers (setTimeout, setInterval)
  |       |
  |   pending callbacks (I/O callbacks)
  |       |
  |   idle, prepare (internal)
  |       |
  |   poll (incoming I/O events)  <--- most time spent here
  |       |
  |   check (setImmediate)
  |       |
  +-- close callbacks (socket.on('close'))

  Each phase has a FIFO queue of callbacks to execute.
  Node processes ALL callbacks in a phase before moving on.
```

Unlike Go's goroutine scheduler, Node is truly single-threaded for JS code.
Heavy computation blocks everything. Use `Worker Threads` for CPU-bound work.

## Module Systems: ESM vs CommonJS

```
  CommonJS (old)              ESM (modern, use this)
  ==============              ======================
  const fs = require('fs')    import fs from 'fs'
  module.exports = { foo }    export { foo }
  module.exports = bar        export default bar

  Synchronous loading          Async, static analysis
  Dynamic imports              import() for dynamic
  No tree shaking              Tree-shakeable
```

Configure your project for ESM in `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "outDir": "./dist",
    "rootDir": "./src"
  }
}
```

And in `package.json`:

```json
{
  "type": "module"
}
```

## Package Management: npm vs pnpm

```
  npm                          pnpm
  ===                          ====
  npm install                  pnpm install
  npm add lodash               pnpm add lodash
  npm run build                pnpm build
  node_modules (flat)          node_modules (symlinked)
  ~300MB for medium project    ~100MB (content-addressable store)

  pnpm is faster and uses less disk space.
  Think of it as: npm is apt, pnpm is nix.
```

### package.json Essentials

```json
{
  "name": "my-app",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest"
  },
  "dependencies": {
    "zod": "^3.22.0"
  },
  "devDependencies": {
    "typescript": "^5.3.0",
    "tsx": "^4.7.0",
    "vitest": "^1.2.0"
  }
}
```

```
  DEPENDENCY TYPES
  ================

  dependencies     --> shipped to production (like Cargo.toml [dependencies])
  devDependencies  --> build/test only (like Cargo.toml [dev-dependencies])
  peerDependencies --> "you must also install X" (plugin pattern)
```

## Built-in APIs: File System

```typescript
import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

async function processFiles(dir: string): Promise<void> {
  const outputDir = join(dir, "output");
  if (!existsSync(outputDir)) {
    await mkdir(outputDir, { recursive: true });
  }

  const files = await readdir(dir);
  const textFiles = files.filter((f) => f.endsWith(".txt"));

  for (const file of textFiles) {
    const content = await readFile(join(dir, file), "utf-8");
    const processed = content.toUpperCase();
    await writeFile(join(outputDir, file), processed, "utf-8");
  }
}
```

## Built-in APIs: Path

```typescript
import { join, resolve, basename, dirname, extname } from "node:path";

const full = join("/users", "alice", "docs", "file.txt");
const abs = resolve("./relative/path");
const name = basename("/path/to/file.txt");
const dir = dirname("/path/to/file.txt");
const ext = extname("file.txt");
```

```
  PATH OPERATIONS
  ===============

  join("a", "b", "c.txt")     --> "a/b/c.txt"
  resolve("./src")             --> "/absolute/path/to/src"
  basename("/a/b/file.txt")    --> "file.txt"
  dirname("/a/b/file.txt")     --> "/a/b"
  extname("file.txt")          --> ".txt"
```

## Built-in APIs: HTTP Server

```typescript
import { createServer, IncomingMessage, ServerResponse } from "node:http";

const server = createServer(
  (req: IncomingMessage, res: ServerResponse) => {
    const url = new URL(req.url ?? "/", `http://${req.headers.host}`);

    if (url.pathname === "/api/health" && req.method === "GET") {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    res.writeHead(404);
    res.end("Not Found");
  }
);

server.listen(3000, () => {
  console.log("Server running on http://localhost:3000");
});
```

## Environment Variables

```typescript
import { env } from "node:process";

interface AppConfig {
  port: number;
  databaseUrl: string;
  apiKey: string;
  nodeEnv: "development" | "production" | "test";
}

function loadConfig(): AppConfig {
  const port = parseInt(env.PORT ?? "3000", 10);
  if (isNaN(port)) {
    throw new Error("PORT must be a valid number");
  }

  const databaseUrl = env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required");
  }

  const apiKey = env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is required");
  }

  const nodeEnv = env.NODE_ENV ?? "development";
  if (!["development", "production", "test"].includes(nodeEnv)) {
    throw new Error("NODE_ENV must be development, production, or test");
  }

  return {
    port,
    databaseUrl,
    apiKey,
    nodeEnv: nodeEnv as AppConfig["nodeEnv"],
  };
}
```

## Streams

Node streams are like Rust's `AsyncRead`/`AsyncWrite` or Go's `io.Reader`/`io.Writer`.

```typescript
import { createReadStream, createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";

async function compressFile(input: string, output: string): Promise<void> {
  await pipeline(
    createReadStream(input),
    createGzip(),
    createWriteStream(output)
  );
}
```

```
  STREAM PIPELINE
  ===============

  ReadStream --> Transform --> WriteStream
  (file.txt)    (gzip)        (file.txt.gz)

  Data flows in chunks, never loading the whole file into memory.
  Like Unix pipes: cat file.txt | gzip > file.txt.gz
```

## Process and Child Processes

```typescript
import { exec, spawn } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

async function runCommand(cmd: string): Promise<string> {
  const { stdout, stderr } = await execAsync(cmd);
  if (stderr) {
    console.warn("stderr:", stderr);
  }
  return stdout.trim();
}

async function main(): Promise<void> {
  const nodeVersion = await runCommand("node --version");
  console.log("Node:", nodeVersion);

  process.on("SIGINT", () => {
    console.log("Shutting down gracefully...");
    process.exit(0);
  });
}
```

## Running TypeScript Directly

Use `tsx` to run TypeScript without a build step (like `go run`):

```bash
pnpm add -D tsx
npx tsx src/index.ts
npx tsx watch src/index.ts
```

## Exercises

1. Build a CLI tool that reads all `.json` files in a directory, validates them with a Zod schema, and writes a summary report. Use `node:fs/promises` and `node:path`.

2. Create an HTTP server with three endpoints: `GET /health`, `POST /echo` (returns the body), and `GET /time`. Use only `node:http`.

3. Write a file watcher that monitors a directory for changes and logs additions, modifications, and deletions. Use `node:fs.watch`.

4. Implement a simple task queue that processes async jobs with a configurable concurrency limit. Test it by simulating API calls with `setTimeout`.

5. Build a stream pipeline that reads a large CSV file line by line, transforms each row, and writes the output to a new file — without loading the entire file into memory.

---

[← Lesson 04](./04-async-typescript.md) | [Next: Lesson 06 - React Fundamentals →](./06-react-fundamentals.md)
