# Lesson 14: CLI Tools

## Go: The CLI Language

Many of the best CLI tools are written in Go: Terraform, Docker CLI,
GitHub CLI (gh), kubectl, Hugo. Go's single binary output and fast
startup time make it perfect for command-line tools.

Think of a CLI like a Swiss Army knife — one tool, multiple blades
(subcommands), each with its own options.

```
mytool
  |
  +-- list      [flags]
  +-- create    [flags] [args]
  +-- delete    [flags] [args]
  +-- version
```

---

## The flag Package (Stdlib)

Good enough for simple tools:

```go
package main

import (
    "flag"
    "fmt"
)

func main() {
    name := flag.String("name", "World", "name to greet")
    count := flag.Int("count", 1, "number of greetings")
    verbose := flag.Bool("verbose", false, "enable verbose output")

    flag.Parse()

    for i := 0; i < *count; i++ {
        if *verbose {
            fmt.Printf("[%d/%d] ", i+1, *count)
        }
        fmt.Printf("Hello, %s!\n", *name)
    }
}
```

```bash
go run main.go -name=Alice -count=3 -verbose
```

`flag` uses single dash: `-name` not `--name`. For POSIX-style
double dashes, use a third-party library.

---

## Cobra: The Industry Standard

Cobra powers kubectl, Hugo, Docker CLI, and GitHub CLI. It gives
you subcommands, flag parsing, auto-generated help, and shell
completions.

```bash
go get github.com/spf13/cobra@latest
```

### Basic Cobra Structure

```
mycli/
  go.mod
  main.go
  cmd/
    root.go
    list.go
    create.go
    version.go
```

```go
package main

import "mycli/cmd"

func main() {
    cmd.Execute()
}
```

```go
package cmd

import (
    "fmt"
    "os"

    "github.com/spf13/cobra"
)

var verbose bool

var rootCmd = &cobra.Command{
    Use:   "mycli",
    Short: "A demo CLI tool",
    Long:  "mycli demonstrates building CLI tools with Go and Cobra.",
}

func Execute() {
    if err := rootCmd.Execute(); err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
}

func init() {
    rootCmd.PersistentFlags().BoolVarP(&verbose, "verbose", "v", false, "verbose output")
}
```

### Adding Subcommands

```go
package cmd

import (
    "fmt"

    "github.com/spf13/cobra"
)

var listAll bool

var listCmd = &cobra.Command{
    Use:   "list",
    Short: "List resources",
    RunE: func(cmd *cobra.Command, args []string) error {
        if listAll {
            fmt.Println("Listing ALL resources...")
        } else {
            fmt.Println("Listing active resources...")
        }
        return nil
    },
}

func init() {
    listCmd.Flags().BoolVarP(&listAll, "all", "a", false, "include inactive")
    rootCmd.AddCommand(listCmd)
}
```

```go
package cmd

import (
    "fmt"

    "github.com/spf13/cobra"
)

var createCmd = &cobra.Command{
    Use:   "create [name]",
    Short: "Create a new resource",
    Args:  cobra.ExactArgs(1),
    RunE: func(cmd *cobra.Command, args []string) error {
        name := args[0]
        fmt.Printf("Creating resource: %s\n", name)
        return nil
    },
}

func init() {
    rootCmd.AddCommand(createCmd)
}
```

```bash
mycli list --all
mycli create my-resource
mycli --help
```

Cobra auto-generates help text:

```
A demo CLI tool

Usage:
  mycli [command]

Available Commands:
  create      Create a new resource
  help        Help about any command
  list        List resources

Flags:
  -h, --help      help for mycli
  -v, --verbose   verbose output
```

---

## Structured Output

Good CLIs support multiple output formats:

```go
package main

import (
    "encoding/json"
    "fmt"
    "os"
    "text/tabwriter"
)

type Item struct {
    Name   string `json:"name"`
    Status string `json:"status"`
    Count  int    `json:"count"`
}

func printTable(items []Item) {
    w := tabwriter.NewWriter(os.Stdout, 0, 0, 2, ' ', 0)
    fmt.Fprintln(w, "NAME\tSTATUS\tCOUNT")
    fmt.Fprintln(w, "----\t------\t-----")
    for _, item := range items {
        fmt.Fprintf(w, "%s\t%s\t%d\n", item.Name, item.Status, item.Count)
    }
    w.Flush()
}

func printJSON(items []Item) {
    encoder := json.NewEncoder(os.Stdout)
    encoder.SetIndent("", "  ")
    encoder.Encode(items)
}

func main() {
    items := []Item{
        {Name: "web-server", Status: "running", Count: 3},
        {Name: "database", Status: "running", Count: 1},
        {Name: "cache", Status: "stopped", Count: 0},
    }

    format := "table"
    if len(os.Args) > 1 && os.Args[1] == "--json" {
        format = "json"
    }

    switch format {
    case "json":
        printJSON(items)
    default:
        printTable(items)
    }
}
```

Output:

```
NAME          STATUS   COUNT
----          ------   -----
web-server    running  3
database      running  1
cache         stopped  0
```

---

## Interactive Input

```go
package main

import (
    "bufio"
    "fmt"
    "os"
    "strings"
)

func confirm(prompt string) bool {
    reader := bufio.NewReader(os.Stdin)
    fmt.Printf("%s [y/N]: ", prompt)
    input, _ := reader.ReadString('\n')
    input = strings.TrimSpace(strings.ToLower(input))
    return input == "y" || input == "yes"
}

func main() {
    if confirm("Delete all resources?") {
        fmt.Println("Deleting...")
    } else {
        fmt.Println("Cancelled.")
    }
}
```

---

## Exit Codes and Stderr

```go
package main

import (
    "fmt"
    "os"
)

func run() error {
    if len(os.Args) < 2 {
        return fmt.Errorf("usage: %s <filename>", os.Args[0])
    }

    filename := os.Args[1]
    data, err := os.ReadFile(filename)
    if err != nil {
        return fmt.Errorf("reading %s: %w", filename, err)
    }

    fmt.Print(string(data))
    return nil
}

func main() {
    if err := run(); err != nil {
        fmt.Fprintln(os.Stderr, "error:", err)
        os.Exit(1)
    }
}
```

```
+------+----------------------------+
| Code | Meaning                    |
+------+----------------------------+
| 0    | Success                    |
| 1    | General error              |
| 2    | Misuse of command          |
| 126  | Command not executable     |
| 127  | Command not found          |
+------+----------------------------+
```

Write errors to stderr, output to stdout. This lets users pipe
your tool's output while still seeing errors.

---

## Configuration Files

```go
package main

import (
    "encoding/json"
    "fmt"
    "os"
    "path/filepath"
)

type Config struct {
    Server   string `json:"server"`
    Token    string `json:"token"`
    Verbose  bool   `json:"verbose"`
}

func loadConfig() (*Config, error) {
    home, err := os.UserHomeDir()
    if err != nil {
        return nil, err
    }

    path := filepath.Join(home, ".mycli", "config.json")
    data, err := os.ReadFile(path)
    if err != nil {
        if os.IsNotExist(err) {
            return &Config{Server: "localhost:8080"}, nil
        }
        return nil, err
    }

    var cfg Config
    if err := json.Unmarshal(data, &cfg); err != nil {
        return nil, fmt.Errorf("parse config: %w", err)
    }
    return &cfg, nil
}

func main() {
    cfg, err := loadConfig()
    if err != nil {
        fmt.Fprintln(os.Stderr, err)
        os.Exit(1)
    }
    fmt.Printf("Server: %s\n", cfg.Server)
}
```

---

## CLI Tool Architecture

```
+------------------+
|     main.go      |
| Parse args/flags |
+--------+---------+
         |
+--------+---------+
|    cmd/*.go      |
| Subcommand defs  |
| Flag binding     |
+--------+---------+
         |
+--------+---------+
|   internal/      |
| Business logic   |
| (testable, no    |
|  CLI dependency) |
+--------+---------+
         |
+--------+---------+
|   output/        |
| Table, JSON,     |
| YAML formatters  |
+------------------+
```

Keep business logic separate from CLI wiring. Your `internal/`
package should be testable without cobra or flags.

---

## Exercises

1. Build a CLI with cobra that has `add`, `list`, and `remove`
   subcommands for managing a todo list (stored in a JSON file)

2. Add `--format` flag (table/json) to the `list` command

3. Implement a `config` subcommand that reads/writes
   `~/.mytool/config.json`

4. Build a file search CLI that takes a pattern and directory,
   walks the tree, and prints matches

5. Add shell completion generation to your cobra CLI using
   `cobra.Command.GenBashCompletion`

---

[Next: Lesson 15 - Database Access ->](15-database-access.md)
