# Lesson 18: Capstone — Build a Full-Stack AI Web App

## The Project: Document Q&A Application

```
ARCHITECTURE

  User
   |
   v
  +------------+
  | Next.js    |     React frontend + API routes
  | App Router |
  +-----+------+
        |
   +----+----+----+
   |         |    |
   v         v    v
  +----+  +----+ +--------+
  |Auth|  |tRPC| |AI SDK  |
  |.js |  |    | |Streaming|
  +----+  +----+ +--------+
              |        |
              v        v
          +------+  +--------+
          |Prisma|  |OpenAI  |
          |  DB  |  |Embeddings|
          +------+  +--------+
                        |
                        v
                    +--------+
                    |Vector  |
                    |DB (pgvector)|
                    +--------+

  Upload documents -> Chunk & embed -> Store vectors
  Ask question -> Embed query -> Semantic search -> LLM answer
```

## Project Setup

```bash
npx create-next-app@latest ai-qa-app --typescript --tailwind --app --src-dir
cd ai-qa-app
npm install ai @ai-sdk/openai @trpc/server @trpc/client @trpc/react-query
npm install @prisma/client zod zustand @tanstack/react-query
npm install next-auth@beta @auth/prisma-adapter
npm install -D prisma @types/node
npx prisma init
```

## Database Schema

```prisma
generator client {
  provider        = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

datasource db {
  provider   = "postgresql"
  url        = env("DATABASE_URL")
  extensions = [vector]
}

model User {
  id            String     @id @default(cuid())
  name          String?
  email         String     @unique
  emailVerified DateTime?
  image         String?
  accounts      Account[]
  sessions      Session[]
  documents     Document[]
  chats         Chat[]
  createdAt     DateTime   @default(now())
}

model Document {
  id        String   @id @default(cuid())
  title     String
  content   String
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  chunks    Chunk[]
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

model Chunk {
  id         String                    @id @default(cuid())
  content    String
  embedding  Unsupported("vector(1536)")?
  documentId String
  document   Document                  @relation(fields: [documentId], references: [id], onDelete: Cascade)
  position   Int
  createdAt  DateTime                  @default(now())

  @@index([documentId])
}

model Chat {
  id        String    @id @default(cuid())
  title     String
  userId    String
  user      User      @relation(fields: [userId], references: [id])
  messages  Message[]
  createdAt DateTime  @default(now())
  updatedAt DateTime  @updatedAt
}

model Message {
  id        String   @id @default(cuid())
  role      String
  content   String
  chatId    String
  chat      Chat     @relation(fields: [chatId], references: [id], onDelete: Cascade)
  createdAt DateTime @default(now())
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?
  user              User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
}
```

## Document Processing Pipeline

```typescript
import { openai } from "@ai-sdk/openai";
import { embedMany } from "ai";
import { prisma } from "@/lib/prisma";

const CHUNK_SIZE = 1000;
const CHUNK_OVERLAP = 200;

function splitIntoChunks(text: string): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    let end = start + CHUNK_SIZE;

    if (end < text.length) {
      const lastPeriod = text.lastIndexOf(".", end);
      const lastNewline = text.lastIndexOf("\n", end);
      const breakPoint = Math.max(lastPeriod, lastNewline);

      if (breakPoint > start + CHUNK_SIZE / 2) {
        end = breakPoint + 1;
      }
    }

    chunks.push(text.slice(start, end).trim());
    start = end - CHUNK_OVERLAP;
  }

  return chunks.filter((chunk) => chunk.length > 50);
}

async function processDocument(
  documentId: string,
  content: string
): Promise<void> {
  const chunks = splitIntoChunks(content);

  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: chunks,
  });

  const chunkData = chunks.map((chunk, index) => ({
    content: chunk,
    position: index,
    documentId,
  }));

  await prisma.chunk.createMany({ data: chunkData });

  for (let i = 0; i < chunks.length; i++) {
    const embedding = embeddings[i];
    const vectorStr = `[${embedding.join(",")}]`;

    await prisma.$executeRaw`
      UPDATE "Chunk"
      SET embedding = ${vectorStr}::vector
      WHERE "documentId" = ${documentId}
      AND position = ${i}
    `;
  }
}

async function searchSimilarChunks(
  query: string,
  userId: string,
  limit: number = 5
): Promise<{ content: string; documentTitle: string; score: number }[]> {
  const { embeddings } = await embedMany({
    model: openai.embedding("text-embedding-3-small"),
    values: [query],
  });

  const queryEmbedding = embeddings[0];
  const vectorStr = `[${queryEmbedding.join(",")}]`;

  const results = await prisma.$queryRaw<
    { content: string; title: string; score: number }[]
  >`
    SELECT c.content, d.title, 1 - (c.embedding <=> ${vectorStr}::vector) as score
    FROM "Chunk" c
    JOIN "Document" d ON c."documentId" = d.id
    WHERE d."userId" = ${userId}
    AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${vectorStr}::vector
    LIMIT ${limit}
  `;

  return results.map((r) => ({
    content: r.content,
    documentTitle: r.title,
    score: r.score,
  }));
}
```

## AI Chat with Streaming

```typescript
import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages, chatId } = await request.json();
  const lastMessage = messages[messages.length - 1];

  const relevantChunks = await searchSimilarChunks(
    lastMessage.content,
    session.user.id,
    5
  );

  const context = relevantChunks
    .map(
      (chunk) =>
        `[Source: ${chunk.documentTitle}]\n${chunk.content}`
    )
    .join("\n\n---\n\n");

  const systemPrompt = `You are a helpful assistant that answers questions based on the user's documents.
Use the following context to answer questions. If the answer is not in the context, say so.
Always cite the source document when possible.

Context:
${context}`;

  const result = streamText({
    model: openai("gpt-4o"),
    system: systemPrompt,
    messages,
    onFinish: async ({ text }) => {
      await prisma.message.createMany({
        data: [
          { chatId, role: "user", content: lastMessage.content },
          { chatId, role: "assistant", content: text },
        ],
      });
    },
  });

  return result.toDataStreamResponse();
}
```

## Chat UI Component

```tsx
"use client";

import { useChat } from "ai/react";
import { useRef, useEffect } from "react";

function ChatInterface({ chatId }: { chatId: string }) {
  const { messages, input, handleInputChange, handleSubmit, isLoading } =
    useChat({
      api: "/api/chat",
      body: { chatId },
    });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)]">
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center text-gray-500 mt-20">
            <p className="text-lg">Ask a question about your documents</p>
          </div>
        )}

        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${
              message.role === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-2 ${
                message.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800"
              }`}
            >
              <p className="whitespace-pre-wrap">{message.content}</p>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-4 py-2">
              <span className="animate-pulse">Thinking...</span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSubmit} className="border-t p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <input
            value={input}
            onChange={handleInputChange}
            placeholder="Ask about your documents..."
            className="flex-1 rounded-lg border px-4 py-2
                       dark:bg-gray-800 dark:border-gray-700"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg
                       hover:bg-blue-700 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
```

## Document Upload

```tsx
"use client";

import { useState, type ChangeEvent } from "react";

function DocumentUpload() {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState("");

  async function handleUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setProgress("Reading file...");

    const text = await file.text();

    setProgress("Uploading document...");

    const response = await fetch("/api/documents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: file.name,
        content: text,
      }),
    });

    if (!response.ok) {
      setProgress("Upload failed");
      setUploading(false);
      return;
    }

    setProgress("Processing and embedding...");

    const { id } = await response.json();

    const processResponse = await fetch(`/api/documents/${id}/process`, {
      method: "POST",
    });

    if (processResponse.ok) {
      setProgress("Done!");
    } else {
      setProgress("Processing failed");
    }

    setUploading(false);
  }

  return (
    <div className="border-2 border-dashed rounded-lg p-8 text-center">
      <input
        type="file"
        accept=".txt,.md,.csv"
        onChange={handleUpload}
        disabled={uploading}
        className="hidden"
        id="file-upload"
      />
      <label
        htmlFor="file-upload"
        className="cursor-pointer text-blue-600 hover:text-blue-700"
      >
        {uploading ? progress : "Click to upload a document"}
      </label>
    </div>
  );
}
```

## Exercises

1. Build the complete project from this lesson. Set up the database, implement document upload and processing, and get the chat working with streaming responses.

2. Add document management: list documents, delete documents (cascade delete chunks), and show chunk count per document.

3. Implement chat history: list previous chats in a sidebar, load messages when clicking a chat, create new chats, and delete old chats.

4. Add source citations: when the AI references a document chunk, show a collapsible source card below the message with the original text and document name.

5. Deploy the complete application: Dockerize it, set up a CI/CD pipeline, deploy to a cloud provider, and configure a custom domain with HTTPS.

## Key Takeaways

```
+-------------------------------------------+
| AI WEB APP ARCHITECTURE                   |
|                                           |
| 1. RAG = Retrieve + Augment + Generate   |
| 2. Chunk documents for better retrieval  |
| 3. Vector search finds relevant context  |
| 4. Stream responses for better UX        |
| 5. Auth protects user data isolation     |
| 6. Start simple, add features iteratively|
+-------------------------------------------+
```
