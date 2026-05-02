# Lesson 2: Lexical Analysis — Breaking Code Into Tokens

The lexer (also called a scanner or tokenizer) is the first stage of the pipeline. Its
job is simple: take a string of source code and break it into a sequence of **tokens**.

---

## What Are Tokens?

A token is the smallest meaningful unit of source code. Think of how English text is made
of words and punctuation — you wouldn't try to understand a sentence character by
character. You'd group characters into words first, THEN figure out the grammar.

```
Source: let x = 10 + 20;

Tokens: [let] [x] [=] [10] [+] [20] [;]
```

Each token has two pieces of information:
- **Type**: what KIND of token it is (keyword? identifier? number? operator?)
- **Literal**: the actual text that was matched ("let", "x", "10")

Analogy: imagine a mail room sorting machine in a warehouse. Letters (characters) arrive
on a conveyor belt. The machine reads each letter's label, groups them into parcels
(tokens), stamps each parcel with a category (token type), and sends them down the belt
to the next station (the parser). The machine doesn't understand what's IN the parcels —
it just sorts them.

---

## Token Types

Our language needs these categories of tokens:

### Keywords

Reserved words that have special meaning. You can't use them as variable names.

| Token  | Literal  | What it does                    |
|--------|----------|---------------------------------|
| LET    | `let`    | Variable binding                |
| FN     | `fn`     | Function literal                |
| IF     | `if`     | Conditional                     |
| ELSE   | `else`   | Alternative branch              |
| RETURN | `return` | Return from function            |
| TRUE   | `true`   | Boolean literal                 |
| FALSE  | `false`  | Boolean literal                 |

### Identifiers

User-defined names: variable names, function names, parameter names.

```
x, foo, myVariable, add, calculate_total
```

The tricky part: how does the lexer know if `let` is a keyword or an identifier? It uses
a **lookup table**. After reading a word, it checks: "Is this word in my keywords table?"
If yes, it's a keyword token. If no, it's an identifier token.

### Literals

Values that appear directly in source code:

| Type    | Examples            | Notes                            |
|---------|---------------------|----------------------------------|
| Integer | `0`, `42`, `99999`  | We'll skip floats for simplicity |
| String  | `"hello"`, `""`     | Delimited by double quotes       |

### Operators

Symbols that perform operations:

| Token       | Literal | Notes                           |
|-------------|---------|---------------------------------|
| ASSIGN      | `=`     | Assignment (not equality)        |
| PLUS        | `+`     |                                  |
| MINUS       | `-`     | Also used as prefix (negation)   |
| BANG        | `!`     | Logical NOT                      |
| ASTERISK    | `*`     | Multiplication                   |
| SLASH       | `/`     | Division                         |
| LT          | `<`     | Less than                        |
| GT          | `>`     | Greater than                     |
| EQ          | `==`    | Equality (two characters!)       |
| NOT_EQ      | `!=`    | Not equal (two characters!)      |

Two-character tokens (`==`, `!=`) are important — when the lexer sees `=`, it has to
peek ahead to check if the next character is also `=`. If so, it's an `EQ` token. If
not, it's an `ASSIGN` token.

### Delimiters

Structural punctuation:

| Token     | Literal |
|-----------|---------|
| COMMA     | `,`     |
| SEMICOLON | `;`     |
| COLON     | `:`     |
| LPAREN    | `(`     |
| RPAREN    | `)`     |
| LBRACE    | `{`     |
| RBRACE    | `}`     |
| LBRACKET  | `[`     |
| RBRACKET  | `]`     |

### Special Tokens

| Token   | Meaning                                    |
|---------|--------------------------------------------|
| EOF     | End of file — no more tokens               |
| ILLEGAL | A character we don't recognize             |

---

## How the Lexer Works

The lexer is a loop that does three things over and over:

1. **Look** at the current character
2. **Decide** what kind of token it starts
3. **Consume** characters until the token is complete, then **emit** the token

### The Core Loop

```
position = 0

while not at end of input:
    skip whitespace

    look at character at position:
        if it's a letter    → read the whole word, check if keyword or identifier
        if it's a digit     → read the whole number
        if it's a '"'       → read until the closing '"', that's a string
        if it's '='         → peek at next char: '=' means EQ, otherwise ASSIGN
        if it's '!'         → peek at next char: '=' means NOT_EQ, otherwise BANG
        if it's '+', '-', etc → single-character operator token
        if it's '{', '(' etc  → single-character delimiter token
        if it's end of input  → EOF token
        otherwise             → ILLEGAL token

    advance position past the token
    emit the token
```

### Whitespace Handling

Most languages (including ours) treat whitespace as a separator but don't produce tokens
for it. The lexer skips spaces, tabs, and newlines.

```
let    x   =   5;
```

Produces the same tokens as:

```
let x = 5;
```

**Python is the notable exception**. In Python, indentation is significant — the lexer
emits INDENT and DEDENT tokens when the indentation level changes. That's why mixing
tabs and spaces in Python is a syntax error — the lexer can't figure out the indentation.

**Go** is interesting too: the Go lexer automatically inserts semicolons after certain
tokens when a newline follows them. That's why you don't need semicolons in Go — the
lexer adds them for you.

### Reading Multi-Character Tokens

Single-character tokens are easy — you see `+`, you emit a PLUS token. But identifiers,
numbers, and two-character operators need more work.

**Identifiers and keywords**: When you see a letter, keep reading until you hit a
non-letter, non-digit character. The result is either a keyword (if it's in the lookup
table) or an identifier.

```
Input: "let x"
       ^
See 'l' (a letter) → read 'l', 'e', 't' → stop at ' ' (not a letter/digit)
Word is "let" → check keywords table → it IS a keyword → emit LET token
Skip whitespace
See 'x' (a letter) → read 'x' → stop at end
Word is "x" → check keywords table → NOT a keyword → emit IDENT token
```

**Numbers**: When you see a digit, keep reading until you hit a non-digit character.

```
Input: "42 +"
       ^
See '4' (a digit) → read '4', '2' → stop at ' ' (not a digit)
Number is "42" → emit INT token
```

**Two-character operators**: When you see `=` or `!`, peek at the NEXT character without
consuming it.

```
Input: "== !="
       ^
See '=' → peek at next character → it's '=' → consume both → emit EQ token
Skip whitespace
See '!' → peek at next character → it's '=' → consume both → emit NOT_EQ token
```

---

## Example: Tokenizing a Real Program

Let's trace through this source code:

```
let add = fn(x, y) { x + y; };
```

```
Character(s)  Action                         Token Emitted
-----------   ----------------------------   ----------------
'l'           letter → read word "let"       LET "let"
' '           skip whitespace                (none)
'a'           letter → read word "add"       IDENT "add"
' '           skip whitespace                (none)
'='           peek next: not '=' → single    ASSIGN "="
' '           skip whitespace                (none)
'f'           letter → read word "fn"        FUNCTION "fn"
'('           single char delimiter           LPAREN "("
'x'           letter → read word "x"         IDENT "x"
','           single char delimiter           COMMA ","
' '           skip whitespace                (none)
'y'           letter → read word "y"         IDENT "y"
')'           single char delimiter           RPAREN ")"
' '           skip whitespace                (none)
'{'           single char delimiter           LBRACE "{"
' '           skip whitespace                (none)
'x'           letter → read word "x"         IDENT "x"
' '           skip whitespace                (none)
'+'           single char operator            PLUS "+"
' '           skip whitespace                (none)
'y'           letter → read word "y"         IDENT "y"
';'           single char delimiter           SEMICOLON ";"
' '           skip whitespace                (none)
'}'           single char delimiter           RBRACE "}"
';'           single char delimiter           SEMICOLON ";"
EOF           end of input                   EOF ""
```

**25 tokens** from 31 characters. The parser will work with these tokens instead of raw
characters — a much cleaner input.

---

## How Real Language Lexers Work

### Go's Lexer (`go/scanner`)

Go's standard library includes a complete lexer you can use:

```go
import "go/scanner"
import "go/token"

var s scanner.Scanner
fset := token.NewFileSet()
file := fset.AddFile("", fset.Base(), len(src))
s.Init(file, []byte(src), nil, scanner.ScanComments)

for {
    pos, tok, lit := s.Scan()
    if tok == token.EOF {
        break
    }
    fmt.Printf("%s\t%s\t%q\n", fset.Position(pos), tok, lit)
}
```

Go's lexer handles semicolon insertion: after tokens like identifiers, literals, `break`,
`continue`, `return`, `)`, `}`, if the next thing is a newline, the lexer inserts a
semicolon token. This is why Go doesn't need explicit semicolons.

### TypeScript's Lexer

TypeScript's scanner is in `src/compiler/scanner.ts` in the TypeScript repo. It handles
things our simple lexer won't:

- Template literals (`` `hello ${name}` ``) — requires tracking nesting depth
- Regular expressions (`/pattern/flags`) — tricky because `/` is also division
- JSX (`<Component />`) — switching between JS and XML-like syntax
- Unicode identifiers — `const π = 3.14` is valid TypeScript

### Rust's Lexer

Rust's lexer (in `rustc_lexer`) is interesting because it handles raw strings
(`r#"hello"#`), lifetime annotations (`'a`), and the turbofish (`::<Type>`). The `'`
character can be a character literal OR a lifetime — the lexer has to figure out which
based on context.

---

## Lexer vs Regular Expressions

You might wonder: "Can't I just use regex for this?" Sort of, but not well.

Regular expressions can match individual token patterns:
- Identifiers: `[a-zA-Z_][a-zA-Z0-9_]*`
- Integers: `[0-9]+`
- Strings: `"[^"]*"`

But a lexer needs to:
1. Match the LONGEST possible token (greedy matching)
2. Handle overlapping patterns (`=` vs `==`)
3. Maintain state (are we inside a string? a comment?)
4. Track position for error reporting
5. Be fast (character-by-character is faster than regex for this)

Some lexer generators (like `flex`) use regex internally to generate state machines, but
hand-written lexers (like we'll build) are usually simpler and easier to debug.

---

## Common Lexer Edge Cases

Things that make lexing harder than it sounds:

**Strings with escape characters**: `"hello\nworld"` — the `\n` is two characters in
source but represents one character (newline) in the string value.

**Nested comments**: `/* outer /* inner */ still in comment? */` — if comments nest, you
need a depth counter. Go and Rust allow nested comments. C does not.

**Ambiguous characters**: in Go, `<-` is the channel operator, but `<` followed by `-5`
is "less than negative five." The lexer might need to be context-aware.

**Number formats**: `0xFF` (hex), `0b1010` (binary), `1_000_000` (underscores), `3.14`
(float), `6.022e23` (scientific). Real lexers handle all of these.

**Unicode**: `let café = "hello"` — should `café` be a valid identifier? In Go and Rust,
yes. The lexer needs to handle multi-byte characters.

We'll keep our lexer simple — ASCII only, integers only, basic escape sequences — but
know that production lexers handle all of this.

---

## Key Vocabulary

| Term         | Meaning                                                   |
|--------------|-----------------------------------------------------------|
| **Token**    | The smallest meaningful unit (a "word" of source code)    |
| **Lexeme**   | The actual text that forms a token ("let", "42", "+")     |
| **Lexer**    | The program that converts source text into tokens         |
| **Scanner**  | Another name for lexer                                    |
| **Tokenizer**| Another name for lexer                                    |

These terms are used interchangeably in different communities. Go calls it a "scanner,"
JavaScript tools often say "tokenizer," and academic papers say "lexer." They all mean
the same thing.

---

## What's Next

In the next lesson, we'll build a complete lexer from scratch in Go. You'll implement
every concept from this lesson as working code: the token types, the character reading,
the keyword lookup table, the peek-ahead for two-character tokens, and comprehensive
tests.

The lexer is the simplest piece of the pipeline, but it has to be rock-solid — every
other stage depends on it producing correct tokens.
