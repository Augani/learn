# Lesson 10: Forms & Validation

## The Validation Pyramid

Think of validation like airport security. Multiple checkpoints,
each catching different problems.

```
  VALIDATION LAYERS
  =================

  +---------------------------+
  | Client-side (instant)     |  <-- HTML5 attributes, JS checks
  +---------------------------+
              |
  +---------------------------+
  | Schema validation (Zod)   |  <-- structured, reusable rules
  +---------------------------+
              |
  +---------------------------+
  | Server-side (authority)   |  <-- the only one you can trust
  +---------------------------+
              |
  +---------------------------+
  | Database constraints      |  <-- last line of defense
  +---------------------------+

  RULE: Never trust client validation alone.
  A user can bypass JS. The server is the source of truth.
```

## Zod: Schema Validation

Zod is like Rust's `serde` + validation in one. Define the shape,
get parsing and type inference for free.

```typescript
import { z } from "zod";

const UserSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  age: z.number().int().min(13).max(150),
  role: z.enum(["admin", "user", "editor"]),
  bio: z.string().max(500).optional(),
});

type User = z.infer<typeof UserSchema>;

const result = UserSchema.safeParse({
  name: "Alice",
  email: "alice@example.com",
  age: 30,
  role: "admin",
});

if (result.success) {
  console.log(result.data.name);
} else {
  console.error(result.error.flatten());
}
```

```
  ZOD PARSE FLOW
  ==============

  Input (unknown) --> Schema.safeParse() --> Result
                                              |
                                   +----------+----------+
                                   |                     |
                              { success: true       { success: false
                                data: T }             error: ZodError }

  Like Rust: parse() = unwrap (throws), safeParse() = Result<T, E>
```

## Advanced Zod Schemas

```typescript
import { z } from "zod";

const AddressSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().length(2),
  zip: z.string().regex(/^\d{5}(-\d{4})?$/),
});

const CreateUserSchema = z
  .object({
    name: z.string().min(2),
    email: z.string().email(),
    password: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/),
    confirmPassword: z.string(),
    address: AddressSchema.optional(),
    tags: z.array(z.string()).max(10).default([]),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

type CreateUserInput = z.infer<typeof CreateUserSchema>;

const UpdateUserSchema = CreateUserSchema.partial().omit({
  password: true,
  confirmPassword: true,
});
```

## React Hook Form

React Hook Form manages form state efficiently — no re-renders on every keystroke.
Think of it as a controlled form that acts like an uncontrolled one.

```tsx
"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const ContactSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  message: z.string().min(10, "Message must be at least 10 characters").max(1000),
  priority: z.enum(["low", "medium", "high"]),
});

type ContactForm = z.infer<typeof ContactSchema>;

export default function ContactPage(): JSX.Element {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
  } = useForm<ContactForm>({
    resolver: zodResolver(ContactSchema),
    defaultValues: {
      priority: "medium",
    },
  });

  const onSubmit = async (data: ContactForm): Promise<void> => {
    const response = await fetch("/api/contact", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });

    if (response.ok) {
      reset();
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <div>
        <label htmlFor="name">Name</label>
        <input id="name" {...register("name")} />
        {errors.name && <span className="text-red-500">{errors.name.message}</span>}
      </div>

      <div>
        <label htmlFor="email">Email</label>
        <input id="email" type="email" {...register("email")} />
        {errors.email && <span className="text-red-500">{errors.email.message}</span>}
      </div>

      <div>
        <label htmlFor="message">Message</label>
        <textarea id="message" {...register("message")} rows={4} />
        {errors.message && <span className="text-red-500">{errors.message.message}</span>}
      </div>

      <div>
        <label htmlFor="priority">Priority</label>
        <select id="priority" {...register("priority")}>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Sending..." : "Send Message"}
      </button>
    </form>
  );
}
```

## Server-Side Validation with Server Actions

```tsx
"use server";

import { z } from "zod";

const TodoSchema = z.object({
  title: z.string().min(1, "Title is required").max(200),
  description: z.string().max(1000).optional(),
  priority: z.enum(["low", "medium", "high"]),
});

interface ActionResult {
  success: boolean;
  errors?: Record<string, string[]>;
  message?: string;
}

export async function createTodo(formData: FormData): Promise<ActionResult> {
  const raw = {
    title: formData.get("title"),
    description: formData.get("description"),
    priority: formData.get("priority"),
  };

  const parsed = TodoSchema.safeParse(raw);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.flatten().fieldErrors as Record<string, string[]>,
    };
  }

  await fetch("https://api.example.com/todos", {
    method: "POST",
    body: JSON.stringify(parsed.data),
  });

  return { success: true, message: "Todo created!" };
}
```

```tsx
"use client";

import { useActionState } from "react";
import { createTodo } from "./actions";

interface FormState {
  success: boolean;
  errors?: Record<string, string[]>;
  message?: string;
}

export default function TodoForm(): JSX.Element {
  const [state, formAction, isPending] = useActionState(
    async (_prev: FormState, formData: FormData) => createTodo(formData),
    { success: false }
  );

  return (
    <form action={formAction}>
      <div>
        <input name="title" placeholder="Todo title" />
        {state.errors?.title && (
          <span className="text-red-500">{state.errors.title[0]}</span>
        )}
      </div>

      <div>
        <textarea name="description" placeholder="Description (optional)" />
      </div>

      <div>
        <select name="priority" defaultValue="medium">
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
        </select>
      </div>

      <button type="submit" disabled={isPending}>
        {isPending ? "Creating..." : "Create Todo"}
      </button>

      {state.success && (
        <p className="text-green-500">{state.message}</p>
      )}
    </form>
  );
}
```

## Dynamic Form Fields

```tsx
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const TeamSchema = z.object({
  teamName: z.string().min(1),
  members: z
    .array(
      z.object({
        name: z.string().min(1),
        email: z.string().email(),
        role: z.enum(["lead", "member"]),
      })
    )
    .min(1, "At least one member required")
    .max(10),
});

type TeamForm = z.infer<typeof TeamSchema>;

export default function TeamBuilder(): JSX.Element {
  const { register, control, handleSubmit, formState: { errors } } =
    useForm<TeamForm>({
      resolver: zodResolver(TeamSchema),
      defaultValues: {
        teamName: "",
        members: [{ name: "", email: "", role: "member" }],
      },
    });

  const { fields, append, remove } = useFieldArray({
    control,
    name: "members",
  });

  const onSubmit = (data: TeamForm): void => {
    console.log(data);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register("teamName")} placeholder="Team name" />

      {fields.map((field, index) => (
        <div key={field.id}>
          <input {...register(`members.${index}.name`)} placeholder="Name" />
          <input {...register(`members.${index}.email`)} placeholder="Email" />
          <select {...register(`members.${index}.role`)}>
            <option value="member">Member</option>
            <option value="lead">Lead</option>
          </select>
          {fields.length > 1 && (
            <button type="button" onClick={() => remove(index)}>Remove</button>
          )}
        </div>
      ))}

      <button type="button" onClick={() => append({ name: "", email: "", role: "member" })}>
        Add Member
      </button>
      <button type="submit">Create Team</button>
    </form>
  );
}
```

## Error Handling Patterns

```
  ERROR DISPLAY PATTERNS
  ======================

  1. Inline (next to field):
     [Name: ________] "Name is required" <-- immediate

  2. Summary (top of form):
     "Please fix 3 errors:"
     - Name is required
     - Email is invalid
     - Password too short

  3. Toast (temporary notification):
     +---------------------------+
     | Error: Invalid form data  |  <-- auto-dismisses
     +---------------------------+
```

```tsx
interface FieldErrorProps {
  error?: { message?: string };
}

function FieldError({ error }: FieldErrorProps): JSX.Element | null {
  if (!error?.message) return null;
  return <p className="text-sm text-red-500 mt-1">{error.message}</p>;
}

interface ErrorSummaryProps {
  errors: Record<string, { message?: string }>;
}

function ErrorSummary({ errors }: ErrorSummaryProps): JSX.Element | null {
  const messages = Object.entries(errors)
    .filter(([_, error]) => error.message)
    .map(([field, error]) => ({ field, message: error.message! }));

  if (messages.length === 0) return null;

  return (
    <div className="bg-red-50 border border-red-200 rounded p-4">
      <p className="font-bold text-red-800">Please fix {messages.length} error(s):</p>
      <ul className="list-disc list-inside">
        {messages.map(({ field, message }) => (
          <li key={field} className="text-red-700">{message}</li>
        ))}
      </ul>
    </div>
  );
}
```

## Exercises

1. Build a registration form with React Hook Form and Zod validation. Fields: name, email, password, confirm password. Show inline errors. Validate that passwords match using `.refine()`.

2. Create a server action that validates a "Create Product" form (name, price, category, description). Return field-level errors and display them in the form.

3. Build a dynamic invoice form with line items (description, quantity, unit price). Calculate totals in real time. Validate with Zod (at least one line item, positive quantities).

4. Implement a multi-step form wizard (Step 1: Personal Info, Step 2: Address, Step 3: Review). Validate each step before proceeding. Use a single Zod schema split across steps.

5. Create a form that uploads a file, validates its type and size client-side, and sends it to a server action. Show upload progress.

---

[← Lesson 09](./09-nextjs-data.md) | [Next: Lesson 11 - State Management →](./11-state-management.md)
