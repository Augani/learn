# Grammar Notation Cheat Sheet

This is your reference card for reading and writing formal grammars. Keep it open while
working through the parser lessons.

---

## How to Read This (For Someone Who's Never Seen Formal Grammars)

Imagine you're writing a recipe. A recipe has rules:

- A **sandwich** is bread + filling + bread
- A **filling** is cheese OR ham OR (cheese AND ham)
- **bread** is a literal, physical thing — you don't define it further

Formal grammars work exactly the same way. They define **rules** for how smaller pieces
combine into bigger pieces. The "physical things" (like bread) are called **terminals** —
they're the actual characters or tokens in your source code. The "concepts" (like sandwich
or filling) are called **non-terminals** — they're defined by combining other things.

When you see a grammar rule like:

```
expression = term "+" term
```

Read it as: "An expression IS a term, followed by a plus sign, followed by another term."

The `=` (or `::=`) means "is defined as." Everything in quotes is a literal token that
appears in the source code. Everything without quotes is a reference to another rule.

---

## Terminals vs Non-Terminals

**Terminals** are the atomic tokens — the raw building blocks that come out of your lexer.
They can't be broken down further by the grammar. Think of them as the ingredients you
buy at the store.

Examples: `+`, `-`, `*`, `if`, `let`, `return`, `123`, `"hello"`, `(`, `)`, `;`

In grammar notation, terminals are usually written in **quotes** or **bold**.

**Non-terminals** are the rules — they describe how terminals combine. Think of them as
the recipes that tell you how to combine ingredients.

Examples: `expression`, `statement`, `program`, `function_declaration`

In grammar notation, non-terminals are usually written in *italics* or `<angle brackets>`.

**Quick test**: Can you break it down further using grammar rules?
- Yes → it's a non-terminal
- No, it's a raw token → it's a terminal

---

## BNF (Backus-Naur Form)

BNF is the original notation, invented in the 1960s to describe ALGOL. It's verbose but
explicit.

### Syntax

```
<rule-name> ::= definition
```

- `::=` means "is defined as"
- `<angle-brackets>` wrap non-terminal names
- `"quotes"` or bare text for terminals
- `|` means "or" (alternative)

### Example: Simple Arithmetic

```bnf
<expression>  ::= <term> | <expression> "+" <term> | <expression> "-" <term>
<term>        ::= <factor> | <term> "*" <factor> | <term> "/" <factor>
<factor>      ::= <number> | "(" <expression> ")"
<number>      ::= <digit> | <number> <digit>
<digit>       ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
```

Read the first line as: "An expression is either a term, OR an expression followed by
plus followed by a term, OR an expression followed by minus followed by a term."

### The Problem with BNF

BNF has no way to express "zero or more" or "optional" — you have to use recursion for
everything. That's why `<number>` is defined as `<digit> | <number> <digit>` instead of
just saying "one or more digits." This gets tedious fast.

---

## EBNF (Extended BNF)

EBNF adds convenience operators so you don't have to express everything through recursion.
This is what you'll see in most modern language specs (including Go's).

### Additional Syntax

| Notation      | Meaning              | Analogy                          |
|---------------|----------------------|----------------------------------|
| `{ ... }`     | Zero or more         | "Repeat as many times as you want" |
| `[ ... ]`     | Optional (zero or one) | "Include if you want"           |
| `( ... )`     | Grouping             | "Treat this as one unit"         |
| `\|`          | Alternative          | "Or"                             |
| `"..."`       | Terminal string      | "Literally this"                 |
| `;` or `.`    | End of rule          | "Period at end of sentence"      |

Some specs use `*` for zero-or-more and `?` for optional (regex-style). Context matters.

### Example: Simple Arithmetic (EBNF)

```ebnf
expression = term { ("+" | "-") term } ;
term       = factor { ("*" | "/") factor } ;
factor     = number | "(" expression ")" ;
number     = digit { digit } ;
digit      = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
```

Compare this to the BNF version above. The `{ ... }` notation eliminates the recursive
definitions for repetition. `{ ("+" | "-") term }` means "zero or more occurrences of
a plus-or-minus followed by a term."

### Example: If Statement

```ebnf
if_statement    = "if" "(" expression ")" block [ "else" block ] ;
block           = "{" { statement } "}" ;
statement       = let_statement | return_statement | expression_statement ;
expression_statement = expression ";" ;
```

Read it: "An if statement is the keyword 'if', an open paren, an expression, a close
paren, a block, and optionally the keyword 'else' followed by another block."

### Example: Function Declaration

```ebnf
function_literal = "fn" "(" [ parameter_list ] ")" block ;
parameter_list   = identifier { "," identifier } ;
identifier       = letter { letter | digit | "_" } ;
letter           = "a" | "b" | ... | "z" | "A" | ... | "Z" ;
```

Read it: "A function literal is 'fn', open paren, an optional parameter list, close
paren, and a block. A parameter list is an identifier, followed by zero or more
comma-then-identifier pairs."

---

## Production Rules

A **production rule** is a single rule in the grammar. Each rule says "this non-terminal
can be replaced by this sequence of symbols."

```ebnf
let_statement = "let" identifier "=" expression ";" ;
```

This is one production rule. It says: wherever you need a `let_statement`, you can
produce one by writing `let`, then an identifier, then `=`, then an expression, then `;`.

When the parser sees the token `let`, it knows to apply this production rule and expect
an identifier, equals sign, expression, and semicolon to follow.

### Multiple Productions for One Rule

A non-terminal can have multiple productions (alternatives):

```ebnf
statement = let_statement
          | return_statement
          | expression_statement ;
```

This means: "A statement can be produced in three different ways." The parser looks at
the current token to decide which alternative to try (if it sees `let`, try
`let_statement`; if it sees `return`, try `return_statement`; otherwise, try
`expression_statement`).

---

## Common Grammar Patterns

### Left Recursion

A rule is **left-recursive** when the non-terminal appears as the first symbol on the
right side:

```bnf
<expression> ::= <expression> "+" <term> | <term>
```

This says "an expression is an expression plus a term, or just a term." It's logically
correct but **breaks recursive descent parsers**. Why? The parser function for
`expression` would call itself immediately, before consuming any tokens, creating an
infinite loop.

Analogy: it's like a recipe that says "To make soup, first make soup, then add salt."
You can never start.

### Eliminating Left Recursion

Transform left-recursive rules into right-recursive or iterative form:

**Before (left-recursive, broken for recursive descent):**
```bnf
<expression> ::= <expression> "+" <term> | <term>
```

**After (iterative EBNF, works perfectly):**
```ebnf
expression = term { "+" term } ;
```

**After (right-recursive BNF, also works):**
```bnf
<expression>  ::= <term> <expression'>
<expression'> ::= "+" <term> <expression'> | ε
```

(The `ε` means "empty" — the rule can produce nothing.)

The EBNF version is what you'll actually use. It reads naturally: "An expression is a
term, optionally followed by more plus-term pairs."

### Operator Precedence via Grammar Structure

This is one of the cleverest tricks in language design. Instead of using a lookup table
for precedence, you encode it directly in the grammar's structure.

**Principle**: Lower-precedence operators appear higher in the grammar (closer to the
start rule). Higher-precedence operators appear lower (deeper in the grammar).

```ebnf
expression = equality ;
equality   = comparison { ("==" | "!=") comparison } ;
comparison = addition { (">" | "<" | ">=" | "<=") addition } ;
addition   = multiplication { ("+" | "-") multiplication } ;
multiplication = unary { ("*" | "/") unary } ;
unary      = ("-" | "!") unary | primary ;
primary    = number | identifier | "(" expression ")" ;
```

For `1 + 2 * 3`:
1. `expression` calls `equality`, which calls `comparison`, which calls `addition`
2. `addition` parses `1` as a `multiplication` (which resolves to `primary` → `1`)
3. `addition` sees `+`, so it continues: parse another `multiplication`
4. `multiplication` parses `2`, sees `*`, parses `3`, builds `2 * 3`
5. Back in `addition`, we build `1 + (2 * 3)`

Because `*` is handled at a deeper level than `+`, it binds tighter. The grammar
structure IS the precedence table.

### Associativity

**Left-associative** operators group from the left: `1 - 2 - 3` = `(1 - 2) - 3`

The iterative EBNF form naturally gives you left associativity:
```ebnf
expression = term { "+" term } ;
```

Parsing `1 + 2 + 3`: you get term `1`, then `+ 2` makes `(1 + 2)`, then `+ 3` makes
`((1 + 2) + 3)`. Left-associative.

**Right-associative** operators group from the right: `x = y = 5` → `x = (y = 5)`

Use explicit recursion on the right side:
```ebnf
assignment = identifier "=" assignment | equality ;
```

Because the rule calls itself on the RIGHT side (after the `=`), it groups to the right.
Parsing `x = y = 5`: identifier `x`, `=`, then recursively parse `y = 5` first.

---

## Reading Real-World Grammars

### Go's Grammar (from the spec)

Go uses EBNF. Here's a real excerpt:

```
FunctionDecl = "func" FunctionName Signature [ FunctionBody ] .
FunctionName = identifier .
Signature    = Parameters [ Result ] .
Result       = Parameters | Type .
Parameters   = "(" [ ParameterList [ "," ] ] ")" .
```

Note: Go uses `.` to end rules (instead of `;`). The `[ "," ]` means an optional
trailing comma is allowed.

### TypeScript's Grammar

TypeScript's grammar (in the spec) uses a modified BNF:

```
VariableStatement:
    var VariableDeclarationList ;

VariableDeclarationList:
    VariableDeclaration
    VariableDeclarationList , VariableDeclaration
```

Note: uses `:` instead of `::=`, and lists alternatives on separate lines instead of
using `|`.

### Reading Tips

1. Find the **start symbol** — usually `program` or `source_file`
2. Follow it top-down: program contains statements, statements contain expressions, etc.
3. When you see a non-terminal, jump to its rule
4. `{ ... }` = "zero or more" — this handles lists and repetition
5. `[ ... ]` = "optional" — this handles things like `else` clauses
6. `|` = "or" — the parser picks one based on the current token

---

## Quick Reference Card

```
BNF:
    <rule> ::= definition              Rule definition
    |                                   Alternative (or)
    "text"                              Terminal (literal token)
    <name>                              Non-terminal (another rule)

EBNF (adds these):
    { ... }                             Zero or more (repeat)
    [ ... ]                             Optional (zero or one)
    ( ... )                             Grouping
    ; or .                              End of rule

Precedence Trick:
    Lower precedence  = higher in grammar = parsed first, wraps outer
    Higher precedence = lower in grammar  = parsed last, wraps inner

Associativity:
    Left:  rule = operand { op operand }        (iterative)
    Right: rule = operand op rule | operand      (recursive on right)

Left Recursion Fix:
    BROKEN:  expr = expr "+" term | term
    FIXED:   expr = term { "+" term }
```

---

## Grammar for Our Monkey Language

This is the complete grammar for the language we'll build in this module:

```ebnf
program          = { statement } ;

statement        = let_statement
                 | return_statement
                 | expression_statement ;

let_statement    = "let" identifier "=" expression ";" ;
return_statement = "return" expression ";" ;
expression_statement = expression ";" ;

expression       = equality ;
equality         = comparison { ("==" | "!=") comparison } ;
comparison       = addition { (">" | "<") addition } ;
addition         = multiplication { ("+" | "-") multiplication } ;
multiplication   = prefix { ("*" | "/") prefix } ;
prefix           = ("-" | "!") prefix | postfix ;
postfix          = primary { call_or_index } ;
call_or_index    = "(" [ expression_list ] ")"
                 | "[" expression "]" ;

primary          = integer_literal
                 | string_literal
                 | boolean_literal
                 | identifier
                 | "(" expression ")"
                 | if_expression
                 | function_literal
                 | array_literal
                 | hash_literal ;

if_expression    = "if" "(" expression ")" block [ "else" block ] ;
function_literal = "fn" "(" [ parameter_list ] ")" block ;
array_literal    = "[" [ expression_list ] "]" ;
hash_literal     = "{" [ hash_pair { "," hash_pair } ] "}" ;
hash_pair        = expression ":" expression ;
block            = "{" { statement } "}" ;

parameter_list   = identifier { "," identifier } ;
expression_list  = expression { "," expression } ;

integer_literal  = digit { digit } ;
string_literal   = '"' { character } '"' ;
boolean_literal  = "true" | "false" ;
identifier       = letter { letter | digit | "_" } ;
```

Refer back to this grammar as you build the parser. Every rule here becomes either a
parsing function or a branch in a parsing function.
