# Lesson 4: Formal Grammars — Defining the Rules of a Language

In Lesson 2, you built a lexer that chops source code into tokens. But tokens alone are
just a bag of words. Knowing that `let`, `x`, `=`, `10`, `+`, `20`, `;` are all valid
tokens tells you nothing about whether `let = x 10 ; + 20` is a valid program. You need
rules that say which **sequences** of tokens are legal and what structure they form.

That's what a grammar does. A grammar is the rulebook for your language's syntax.

---

## Why You Need Grammars

When you write TypeScript or Go, you have an intuitive sense of what "looks right." You
know `if (x > 0) { ... }` is valid and `if > x { 0 ) ...` is not. But intuition doesn't
scale. It can't be tested, can't be shared, and can't be fed to a parser.

A formal grammar gives you three things:

**1. Precision.** No ambiguity about what's valid. Every valid program can be derived from
the grammar. Every invalid program cannot.

**2. Communication.** Go's entire syntax fits on a few pages of EBNF. TypeScript's grammar
(in the ECMAScript spec) is the single source of truth that every parser follows.

**3. Implementation blueprint.** Each rule in the grammar maps directly to a function in
your parser. Write the grammar first, and the parser practically writes itself.

Think about it from your experience: TypeScript's `tsconfig.json` has a schema. Go's
`go.mod` has a format specification. A grammar is the same idea, but for source code.

---

## The Recipe Analogy

A grammar is like a recipe book for a restaurant kitchen.

The **ingredients** are your tokens — numbers, strings, keywords like `let` and `fn`,
operators like `+` and `*`. These are fixed, atomic things. You don't define what a `+` is
in the grammar — the lexer already handled that.

The **recipes** are your grammar rules. They tell you exactly how ingredients combine into
dishes. A `let_statement` is the keyword `let`, followed by an identifier, followed by `=`,
followed by an expression, followed by `;`. Specific ingredients, specific order.

The **menu** is the set of all valid programs. Any dish you can make by following the
recipes is valid. Anything you can't is a syntax error.

| Recipe concept | Grammar term     | Example                            |
|----------------|------------------|------------------------------------|
| Ingredients    | **Terminals**    | `+`, `let`, `42`, `(`, `;`         |
| Recipes        | **Non-terminals**| `expression`, `statement`, `block` |
| Recipe steps   | **Productions**  | `let_statement = "let" id "=" expr ";"` |
| The menu       | **The language** | All valid programs                 |

---

## Terminals vs Non-Terminals

**Terminals** are the atomic tokens from your lexer. They're called "terminal" because
they're the end of the road — the grammar doesn't break them down further.

```
Terminals: let, return, if, else, fn, true, false,
           +, -, *, /, =, ==, !=, <, >, !,
           (, ), {, }, [, ], ;, ,,
           <integer>, <string>, <identifier>
```

In grammar notation, terminals are written in `"quotes"`.

**Non-terminals** are the grammar rules — abstract categories defined in terms of other
symbols. They always expand into something else.

```
Non-terminals: program, statement, expression, let_statement,
               if_expression, function_literal, block
```

Non-terminals are written without quotes, in plain text or `<angle brackets>`.

**Quick test**: Can you point to it in source code as a single token? Terminal. Is it a
*concept* composed of multiple parts? Non-terminal.

---

## Context-Free Grammars

The grammar type that matters for programming languages is the **context-free grammar**
(CFG). "Context-free" means when you apply a rule, it doesn't matter what's around it. The
rule for parsing a `let_statement` is identical whether it's the first statement in the
program or nested inside a function.

Compare this to English, where "read" is pronounced differently depending on tense. In a
context-free grammar, every rule stands on its own. Your parser function for
`let_statement` doesn't need to know what called it.

A CFG is defined by four things:

1. A set of **terminals** (tokens from the lexer)
2. A set of **non-terminals** (grammar rules)
3. A set of **production rules** (how non-terminals expand)
4. A **start symbol** (the top-level non-terminal, usually `program`)

---

## Production Rules

A **production rule** defines how a non-terminal expands into a sequence of terminals and
non-terminals.

```
let_statement = "let" identifier "=" expression ";" ;
```

Read this as: "A `let_statement` is the terminal `let`, followed by the non-terminal
`identifier`, followed by `=`, followed by `expression`, followed by `;`."

A non-terminal can have **multiple productions**, separated by `|` (meaning "or"):

```
statement = let_statement
          | return_statement
          | expression_statement ;
```

The parser looks at the current token to decide which alternative to try. See `let`? First
production. See `return`? Second. Otherwise, try the third. This decision process is
exactly how a recursive descent parser works.

---

## BNF Notation (Backus-Naur Form)

BNF was invented in the late 1950s for ALGOL 60. It's the original formal grammar notation.

### Syntax

- `::=` means "is defined as"
- `<angle brackets>` wrap non-terminal names
- `"quotes"` for terminals
- `|` separates alternatives

### Example: Arithmetic Expressions

```bnf
<expression> ::= <term> | <expression> "+" <term> | <expression> "-" <term>
<term>       ::= <factor> | <term> "*" <factor> | <term> "/" <factor>
<factor>     ::= <number> | "(" <expression> ")"
<number>     ::= <digit> | <number> <digit>
<digit>      ::= "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9"
```

Tracing `1 + 2 * 3`: start at `<expression>`, match `<expression> "+" <term>`. The left
`<expression>` resolves to `1`. The `<term>` resolves to `2 * 3` via `<term> "*" <factor>`.
Result: `1 + (2 * 3)`. Multiplication binds tighter because it's deeper in the grammar.

### The Problem with BNF

BNF has no way to say "zero or more" or "optional." You need recursion for everything.
That's why `<number>` is `<digit> | <number> <digit>` instead of "one or more digits."

---

## EBNF Notation (Extended BNF)

EBNF adds convenience operators that eliminate most awkward recursion. This is what most
modern language specs use — including Go.

| Notation  | Meaning              | Example                                |
|-----------|----------------------|----------------------------------------|
| `{ ... }` | Zero or more         | `{ statement }` = any number of statements |
| `[ ... ]` | Optional (0 or 1)    | `[ "else" block ]` = else is optional  |
| `( ... )` | Grouping             | `("+" \| "-")` = plus or minus         |
| `\|`      | Alternative          | `"true" \| "false"`                    |
| `"..."`   | Terminal (literal)   | `"let"`, `"+"`, `";"`                  |
| `;` or `.`| End of rule          | Depends on the spec                    |

### Example: Arithmetic (Compare to BNF Above)

```ebnf
expression = term { ("+" | "-") term } ;
term       = factor { ("*" | "/") factor } ;
factor     = number | "(" expression ")" ;
number     = digit { digit } ;
digit      = "0" | "1" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" ;
```

The `{ ... }` notation replaces recursive definitions. `{ ("+" | "-") term }` means "zero
or more occurrences of a plus-or-minus followed by a term." Maps directly to a `while` loop
in your parser.

### Example: Let Statement

```ebnf
let_statement = "let" identifier "=" expression ";" ;
```

### Example: If/Else

```ebnf
if_expression = "if" "(" expression ")" block [ "else" block ] ;
block         = "{" { statement } "}" ;
```

The `[ "else" block ]` means the else clause is optional. The `{ statement }` inside block
means zero or more statements.

### Example: Function Declaration

```ebnf
function_literal = "fn" "(" [ parameter_list ] ")" block ;
parameter_list   = identifier { "," identifier } ;
```

The parameter list uses the most common grammar pattern for comma-separated lists:
`item { "," item }`. You'll see this everywhere — function arguments, array elements, hash
pairs.

---

## Putting It Together: A Complete Small Language

Here's a grammar that handles arithmetic with precedence, let statements, if/else, and
function declarations:

```ebnf
program   = { statement } ;
statement = let_statement | return_statement | expression_statement ;

let_statement        = "let" identifier "=" expression ";" ;
return_statement     = "return" expression ";" ;
expression_statement = expression ";" ;

expression       = equality ;
equality         = comparison { ("==" | "!=") comparison } ;
comparison       = addition { (">" | "<") addition } ;
addition         = multiplication { ("+" | "-") multiplication } ;
multiplication   = unary { ("*" | "/") unary } ;
unary            = ("-" | "!") unary | primary ;

primary = number | string | "true" | "false"
        | identifier
        | "(" expression ")"
        | if_expression
        | function_literal ;

if_expression    = "if" "(" expression ")" block [ "else" block ] ;
function_literal = "fn" "(" [ parameter_list ] ")" block ;
block            = "{" { statement } "}" ;
parameter_list   = identifier { "," identifier } ;
```

Every rule becomes a function in your parser. The structure tells you exactly how to build
it. But first, notice how the expression rules are layered — that's where operator
precedence lives.

---

## Operator Precedence Through Grammar Structure

You don't need a precedence lookup table. The grammar's layered structure IS the precedence.

### The Principle

**Lower-precedence operators appear higher in the grammar** (closer to the start symbol).
**Higher-precedence operators appear deeper** (further from the start).

```ebnf
expression     = equality ;                                    ← lowest precedence
equality       = comparison { ("==" | "!=") comparison } ;
comparison     = addition { (">" | "<") addition } ;
addition       = multiplication { ("+" | "-") multiplication } ;
multiplication = unary { ("*" | "/") unary } ;                ← highest binary
unary          = ("-" | "!") unary | primary ;
primary        = number | identifier | "(" expression ")" ;   ← atoms
```

### Why This Works

When parsing `1 + 2 * 3`, the parser walks down the chain:
`expression` -> `equality` -> `comparison` -> `addition`.

At `addition`, it parses the first operand by calling down to `multiplication`, which
resolves to `1`. Back in `addition`, it sees `+` and parses the right side by calling
`multiplication` again. This time, `multiplication` sees `2`, then `*`, then `3`, and
builds `(2 * 3)` as a single subtree. Back in `addition`, we build `1 + (2 * 3)`.

The key: `multiplication` grabbed `2 * 3` as a unit *before* `addition` could see the `*`.
Deeper rules bind tighter because they resolve first.

### Adding New Precedence Levels

Want `**` (exponentiation) with higher precedence than `*`? Insert a level:

```ebnf
multiplication = exponentiation { ("*" | "/") exponentiation } ;
exponentiation = unary { "**" unary } ;
```

Want `&&` and `||` with lower precedence than `==`? Insert above:

```ebnf
expression = or_expr ;
or_expr    = and_expr { "||" and_expr } ;
and_expr   = equality { "&&" equality } ;
```

Precedence is just the nesting order. Rearranging levels rearranges precedence.

---

## Ambiguity in Grammars

A grammar is **ambiguous** if the same input has two valid parse trees.

### The Dangling Else

```ebnf
if_statement = "if" expression "then" statement
             | "if" expression "then" statement "else" statement ;
```

For `if a then if b then s1 else s2`, the else could belong to either `if`. Two valid
trees, two different meanings. That's ambiguity.

Most languages resolve this with "else belongs to the nearest if." But the cleanest fix is
requiring braces:

```ebnf
if_expression = "if" "(" expression ")" block [ "else" block ] ;
block         = "{" { statement } "}" ;
```

With mandatory braces, grouping is explicit. No ambiguity. This is what Go does, and it's
what our language does.

### Arithmetic Ambiguity

A naive grammar like `expression = expression operator expression | number` is ambiguous
for `1 + 2 * 3` — it allows both `(1 + 2) * 3` and `1 + (2 * 3)`. The fix: stratify into
precedence levels (`expression`, `term`, `factor`). The layered grammar eliminates ambiguity
because there's only one derivation path.

**Rule of thumb**: a flat `expr OP expr` rule is almost always ambiguous. Stratify it.

---

## Left Recursion and How to Eliminate It

### What Is Left Recursion?

A rule is **left-recursive** when the non-terminal appears as the FIRST symbol on the
right side:

```bnf
<expression> ::= <expression> "+" <term> | <term>
```

### Why It Breaks Recursive Descent Parsers

The parser function for `expression` calls itself before consuming any tokens. Infinite
recursion. Stack overflow. It's like a recipe that says "to make soup, first make soup,
then add salt." You can never start.

### The Fix: EBNF Iteration

Before (left-recursive, broken):
```bnf
<expression> ::= <expression> "+" <term> | <term>
```

After (iterative EBNF, works):
```ebnf
expression = term { "+" term } ;
```

"An expression is a term, followed by zero or more plus-term pairs." The `{ ... }` becomes
a `while` loop:

```
function parseExpression():
    left = parseTerm()
    while currentToken is "+":
        advance()
        right = parseTerm()
        left = BinaryExpression(left, "+", right)
    return left
```

No recursion, no infinite loop, and it naturally produces left-associative trees
(`1 - 2 - 3` becomes `(1 - 2) - 3`).

For BNF purists, the alternative is right-recursive transformation with a helper rule:
```bnf
<expression>      ::= <term> <expression_rest>
<expression_rest> ::= "+" <term> <expression_rest> | ε
```

But in practice, use the EBNF form. It's cleaner and maps directly to code.

Watch out for **indirect** left recursion too: `A` calls `B`, `B` calls `A`. Same problem,
same fix.

---

## Real-World Grammars: Go and TypeScript

### Go's EBNF Grammar

Go's spec defines its entire syntax in EBNF, using `.` to end rules:

```
FunctionDecl  = "func" FunctionName Signature [ FunctionBody ] .
FunctionName  = identifier .
Signature     = Parameters [ Result ] .
Parameters    = "(" [ ParameterList [ "," ] ] ")" .
ParameterList = ParameterDecl { "," ParameterDecl } .
```

Every notation here is something you already know. `[ FunctionBody ]` means the body is
optional. `[ "," ]` is an optional trailing comma. `ParameterDecl { "," ParameterDecl }`
is the comma-separated list pattern.

### TypeScript / ECMAScript Grammar

The ECMAScript spec uses a modified BNF with `:` instead of `::=`:

```
VariableStatement :
    var VariableDeclarationList ;

VariableDeclarationList :
    VariableDeclaration
    VariableDeclarationList , VariableDeclaration

IfStatement :
    if ( Expression ) Statement else Statement
    if ( Expression ) Statement
```

Notice `VariableDeclarationList` is left-recursive — fine for a formal spec, but real
parsers transform it during implementation. The `IfStatement` has the dangling else
problem, resolved by prose ("else binds to nearest if") rather than grammar restructuring.

### The Design Lesson

Go chose clarity: mandatory braces, clean EBNF, no ambiguities. ECMAScript chose backward
compatibility: decades of accumulated complexity. Both use the same underlying concepts.
Our language follows Go's approach.

---

## From Grammar to Parser

Every grammar construct maps to a parser pattern:

| Grammar construct          | Parser implementation             |
|----------------------------|-----------------------------------|
| Rule name (non-terminal)   | A parsing function                |
| Sequence (`A B C`)         | Parse A, then B, then C in order  |
| Alternative (`A \| B`)     | Check current token, pick one     |
| Optional (`[ A ]`)         | If current token matches, parse A |
| Repetition (`{ A }`)       | While current token matches, parse A |
| Terminal (`"let"`)         | Expect and consume that token     |

The grammar is the blueprint. The parser is the implementation:

```ebnf
let_statement = "let" identifier "=" expression ";" ;
```

becomes:

```
function parseLetStatement():
    expect(LET)
    name = expect(IDENTIFIER)
    expect(ASSIGN)
    value = parseExpression()
    expect(SEMICOLON)
    return LetStatement(name, value)
```

---

## Key Takeaways

1. **A grammar precisely defines valid syntax.** Every valid program has exactly one
   derivation. No guessing.

2. **Terminals are tokens. Non-terminals are grammar rules** that combine terminals and
   other non-terminals.

3. **EBNF is BNF with convenience.** `{ }` for repetition, `[ ]` for optional, `( )` for
   grouping. Use EBNF.

4. **Operator precedence is grammar structure.** Lower-precedence operators live higher in
   the rule chain. No lookup tables.

5. **Ambiguity means two parse trees for one input.** Fix with stratified rules or
   mandatory delimiters.

6. **Left recursion breaks recursive descent.** Replace `A = A op B` with
   `A = B { op B }`.

7. **The grammar IS your parser's architecture.** Write the grammar first.

---

## Exercises

**Exercise 1**: Write an EBNF grammar for a calculator supporting `+`, `-`, `*`, `/`,
parentheses, and unary minus. Handle precedence correctly.

**Exercise 2**: Extend your grammar with variable assignment: `x = 10`, `y = x + 5`. Make
assignment right-associative (`x = y = 5` means `x = (y = 5)`).

**Exercise 3**: Write a grammar for `while (condition) { body }`. Is your grammar
ambiguous? Why or why not?

**Exercise 4**: Rewrite this left-recursive grammar in EBNF:
```bnf
<list>  ::= <list> "," <item> | <item>
<item>  ::= <number> | <string>
```

**Exercise 5**: Read Go's grammar for `ForStmt` at https://go.dev/ref/spec. Identify
terminals, non-terminals, and optional components.

---

## What's Next

You now have the formal tools to define what your language looks like. In the next lessons,
you'll build a parser that applies these grammar rules to construct an Abstract Syntax
Tree — every non-terminal becomes a function, every alternative becomes a branch, every
repetition becomes a loop.

See `reference-grammar.md` for the complete grammar of our language in one place.
