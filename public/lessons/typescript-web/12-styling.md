# Lesson 12: Styling — Tailwind CSS, CSS Modules, Responsive Design

## The Big Analogy: Getting Dressed

```
STYLING APPROACHES = WARDROBE STRATEGIES

  Tailwind CSS               CSS Modules              Global CSS
  = Pre-made outfit cards    = Custom tailor           = Shared closet

  "Blue shirt, slim jeans,   Each piece made           Everything in one
   white sneakers"           specifically for you.     closet. Anyone can
  Pick from catalog.         Unique names so no        grab anything.
  Fast, consistent.          one else wears the same.  Easy conflicts.

  className="text-blue-500   import styles from        .button { ... }
   font-bold p-4"            './Button.module.css'     .card { ... }
                              className={styles.btn}    Beware clashes!
```

## Tailwind CSS Fundamentals

```
TAILWIND MENTAL MODEL

  Traditional CSS:                Tailwind:
  .card {                         <div class="bg-white rounded-lg
    background: white;                       shadow-md p-6 m-4">
    border-radius: 0.5rem;
    box-shadow: 0 4px 6px...;    No separate CSS file.
    padding: 1.5rem;             Classes ARE the styles.
    margin: 1rem;                Consistent design tokens.
  }

  SPACING SCALE:
  p-0  = 0px        m-1  = 0.25rem (4px)
  p-2  = 0.5rem     m-4  = 1rem (16px)
  p-6  = 1.5rem     m-8  = 2rem (32px)
  p-12 = 3rem       m-16 = 4rem (64px)
```

### Tailwind Configuration

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#eff6ff",
          100: "#dbeafe",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
          900: "#1e3a5f",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      spacing: {
        "18": "4.5rem",
        "88": "22rem",
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-in-out",
        "slide-up": "slideUp 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { transform: "translateY(10px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
```

### Building Components with Tailwind

```tsx
import { type ComponentPropsWithoutRef } from "react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ComponentPropsWithoutRef<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-brand-600 text-white hover:bg-brand-700 focus:ring-brand-500",
  secondary:
    "bg-gray-100 text-gray-900 hover:bg-gray-200 focus:ring-gray-500",
  danger:
    "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  ghost:
    "bg-transparent text-gray-700 hover:bg-gray-100 focus:ring-gray-500",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center
        rounded-lg font-medium
        transition-colors duration-200
        focus:outline-none focus:ring-2 focus:ring-offset-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variantStyles[variant]}
        ${sizeStyles[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </button>
  );
}
```

## CSS Modules

```tsx
import styles from "./Card.module.css";

interface CardProps {
  title: string;
  children: React.ReactNode;
  highlighted?: boolean;
}

function Card({ title, children, highlighted = false }: CardProps) {
  return (
    <div
      className={`${styles.card} ${highlighted ? styles.highlighted : ""}`}
    >
      <h2 className={styles.title}>{title}</h2>
      <div className={styles.content}>{children}</div>
    </div>
  );
}
```

```css
/* Card.module.css */
.card {
  background: var(--color-surface);
  border-radius: 0.75rem;
  padding: 1.5rem;
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.1);
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 12px rgb(0 0 0 / 0.15);
}

.highlighted {
  border-left: 4px solid var(--color-brand);
}

.title {
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 0.75rem;
}

.content {
  color: var(--color-text-secondary);
  line-height: 1.6;
}
```

## Responsive Design

```
TAILWIND BREAKPOINTS

  sm:640px   md:768px   lg:1024px   xl:1280px   2xl:1536px

  Mobile First: base styles = mobile
  Then add breakpoint prefixes for larger screens.

  LAYOUT EXAMPLES:

  Mobile (base)        Tablet (md:)         Desktop (lg:)
  +------------+       +------+------+      +----+--------+----+
  |   Header   |       | Side | Main |      |Side|  Main  |Side|
  +------------+       +------+------+      +----+--------+----+
  |   Main     |
  +------------+
  |   Sidebar  |
  +------------+
```

```tsx
function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm px-4 py-3 md:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <span className="text-xl font-bold">Dashboard</span>
          <button className="md:hidden">Menu</button>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 py-6">
        <div className="flex flex-col md:flex-row gap-6">
          <aside className="w-full md:w-64 lg:w-72 shrink-0">
            <div className="bg-white rounded-lg shadow-sm p-4">
              Sidebar
            </div>
          </aside>

          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

function CardGrid({ items }: { items: { id: string; title: string }[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((item) => (
        <div
          key={item.id}
          className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
        >
          {item.title}
        </div>
      ))}
    </div>
  );
}
```

## Dark Mode

```
DARK MODE STRATEGY

  <html class="dark">          Tailwind checks this class
       |
  <body class="bg-white        base: light styles
               dark:bg-gray-900  dark: prefix overrides
               text-gray-900
               dark:text-gray-100">
```

```tsx
import { useEffect, useState } from "react";

type Theme = "light" | "dark" | "system";

function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === "undefined") return "system";
    return (localStorage.getItem("theme") as Theme) ?? "system";
  });

  useEffect(() => {
    const root = document.documentElement;
    const systemDark = window.matchMedia("(prefers-color-scheme: dark)");

    function applyTheme() {
      const isDark =
        theme === "dark" || (theme === "system" && systemDark.matches);
      root.classList.toggle("dark", isDark);
    }

    applyTheme();
    systemDark.addEventListener("change", applyTheme);
    localStorage.setItem("theme", theme);

    return () => systemDark.removeEventListener("change", applyTheme);
  }, [theme]);

  return { theme, setTheme };
}

function ThemeSelector() {
  const { theme, setTheme } = useTheme();

  return (
    <select
      value={theme}
      onChange={(e) => setTheme(e.target.value as Theme)}
      className="bg-white dark:bg-gray-800 border rounded-md px-3 py-1.5
                 text-gray-900 dark:text-gray-100"
    >
      <option value="light">Light</option>
      <option value="dark">Dark</option>
      <option value="system">System</option>
    </select>
  );
}
```

## CSS Variables for Design Tokens

```css
/* globals.css */
:root {
  --color-brand: #3b82f6;
  --color-surface: #ffffff;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --radius-sm: 0.375rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
}

.dark {
  --color-brand: #60a5fa;
  --color-surface: #1f2937;
  --color-text-primary: #f9fafb;
  --color-text-secondary: #9ca3af;
}
```

## Exercises

1. Build a responsive navigation bar with Tailwind that: shows a hamburger menu on mobile, horizontal links on desktop, supports dark mode, and has a smooth mobile menu animation.

2. Create a reusable Card component system with Tailwind: Card, CardHeader, CardBody, CardFooter. Support variants (default, outlined, elevated) and sizes.

3. Implement a complete dark mode toggle that persists to localStorage, respects system preference as default, and smoothly transitions colors.

4. Build a responsive data table that: shows as a traditional table on desktop, converts to card layout on mobile, supports sorting headers, and highlights rows on hover.

5. Create a design token system using CSS variables that Tailwind extends. Include color scales, spacing, typography, and shadows that work in both light and dark mode.

## Key Takeaways

```
+-------------------------------------------+
| STYLING BEST PRACTICES                    |
|                                           |
| 1. Tailwind for rapid, consistent UI     |
| 2. CSS Modules when you need isolation   |
| 3. Mobile-first responsive design        |
| 4. Dark mode with class strategy         |
| 5. Design tokens via CSS variables       |
| 6. Extract component variants, not CSS   |
+-------------------------------------------+
```
