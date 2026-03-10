# Lesson 3: Build a Complete Lexer From Scratch in Go

In lesson 2 we learned what a lexer does and how it works conceptually. Now we build one.
By the end of this lesson you'll have a fully working lexer that takes source code as a
string and produces a stream of tokens. Every line of code is runnable. Every design
decision is explained.

---

## Project Setup

Create a new Go module for the interpreter project:

```
mkdir -p monkey/token
mkdir -p monkey/lexer
cd monkey
go mod init monkey
```

We'll build two packages: `token` (defining what tokens are) and `lexer` (the machine
that produces them).

---

## Step 1: Define the Token Type

A token is a small envelope with two things inside: what KIND of token it is and what
text it came from. Think of it like a labeled shipping box — the label says "FRAGILE"
(the type) and inside is the actual item (the literal).

Create `token/token.go`:

```go
package token

type TokenType string

type Token struct {
	Type    TokenType
	Literal string
}
```

`TokenType` is a string so we can print it easily during debugging. Some implementations
use integers (faster comparisons), but strings make error messages human-readable. When
you see `expected SEMICOLON, got RBRACE` in a compiler error, that readability matters.

---

## Step 2: Define Token Type Constants

Every distinct "shape" of token gets its own constant. This is the vocabulary of our
language — every character sequence the lexer can recognize maps to one of these.

Add these constants to `token/token.go`:

```go
const (
	ILLEGAL = "ILLEGAL"
	EOF     = "EOF"

	IDENT  = "IDENT"
	INT    = "INT"
	STRING = "STRING"

	ASSIGN   = "="
	PLUS     = "+"
	MINUS    = "-"
	BANG     = "!"
	ASTERISK = "*"
	SLASH    = "/"

	LT = "<"
	GT = ">"

	EQ     = "=="
	NOT_EQ = "!="

	COMMA     = ","
	SEMICOLON = ";"

	LPAREN = "("
	RPAREN = ")"
	LBRACE = "{"
	RBRACE = "}"

	FUNCTION = "FUNCTION"
	LET      = "LET"
	TRUE     = "TRUE"
	FALSE    = "FALSE"
	IF       = "IF"
	ELSE     = "ELSE"
	RETURN   = "RETURN"
)
```

Notice the groupings: special tokens (ILLEGAL, EOF), data (IDENT, INT, STRING),
operators, delimiters, keywords. ILLEGAL is the catch-all for any character we don't
recognize — it's our lexer's way of saying "I have no idea what this is."

---

## Step 3: The Keyword Lookup Table

Here's the problem: when the lexer reads the word `let`, how does it know that's a
keyword and not a variable name? What about `return`? What about `foo`?

The answer is a lookup table. After the lexer reads a complete word, it checks: "Is this
word in my keywords map?" If yes, return the keyword token type. If no, it's an
identifier.

Think of it like a bouncer at a VIP club with a guest list. Every name gets checked
against the list. If you're on it, you get the VIP wristband (keyword token). If not,
you get a regular wristband (IDENT token).

Add this to `token/token.go`:

```go
var keywords = map[string]TokenType{
	"fn":     FUNCTION,
	"let":    LET,
	"true":   TRUE,
	"false":  FALSE,
	"if":     IF,
	"else":   ELSE,
	"return": RETURN,
}

func LookupIdent(ident string) TokenType {
	if tok, ok := keywords[ident]; ok {
		return tok
	}
	return IDENT
}
```

This is the complete `token/token.go` file. Simple, but every other piece depends on it.

---

## Step 4: The Lexer Struct

The lexer needs to track where it is in the source code. Imagine reading a book with your
finger on the page — the lexer keeps a finger on the current character and has a second
finger ready on the next character (for peeking ahead).

Create `lexer/lexer.go`:

```go
package lexer

import "monkey/token"

type Lexer struct {
	input        string
	position     int
	readPosition int
	ch           byte
}
```

Four fields, each with a clear job:

- **input**: the entire source code string. The lexer never modifies it.
- **position**: points to the character we're currently looking at (`ch`).
- **readPosition**: points to the NEXT character. Always one ahead of `position`.
- **ch**: the actual byte at `position`. When we've read past the end, this is `0`.

Why both `position` and `readPosition`? Because we need to peek ahead without advancing.
When we see `=`, we need to check if the next character is also `=` (making it `==`)
WITHOUT consuming that next character yet.

Think of `position` as "where I am" and `readPosition` as "where I'll be after I take
one step."

---

## Step 5: New() and readChar()

The constructor creates a lexer and immediately reads the first character so the lexer is
ready to produce tokens.

```go
func New(input string) *Lexer {
	l := &Lexer{input: input}
	l.readChar()
	return l
}

func (l *Lexer) readChar() {
	if l.readPosition >= len(l.input) {
		l.ch = 0
	} else {
		l.ch = l.input[l.readPosition]
	}
	l.position = l.readPosition
	l.readPosition += 1
}
```

`readChar()` is the engine that drives everything. Each call advances the lexer by one
character. When we're past the end of the input, `ch` becomes `0` (the null byte) — our
signal that there's nothing left to read.

The two-pointer dance: `position` catches up to `readPosition`, then `readPosition`
moves one step ahead. They're always exactly one apart, like two people walking in a line
where the front person takes a step, then the back person catches up.

Note: using `byte` instead of `rune` means we only support ASCII. A production lexer
would use `rune` for Unicode support, but ASCII keeps things focused on the lexing logic.

---

## Step 6: peekChar()

Sometimes we need to look ahead without moving. When we see `!`, we need to check: is the
next character `=`? If so, it's `!=`. If not, it's just `!`.

```go
func (l *Lexer) peekChar() byte {
	if l.readPosition >= len(l.input) {
		return 0
	}
	return l.input[l.readPosition]
}
```

`peekChar()` looks at `readPosition` but does NOT advance anything. It's like leaning
forward to see what's around the corner without actually walking there. Compare this with
`readChar()` which looks AND walks forward.

---

## Step 7: skipWhitespace()

Whitespace (spaces, tabs, newlines, carriage returns) separates tokens but doesn't
produce tokens itself. The lexer skips over it.

```go
func (l *Lexer) skipWhitespace() {
	for l.ch == ' ' || l.ch == '\t' || l.ch == '\n' || l.ch == '\r' {
		l.readChar()
	}
}
```

This is a tight loop: keep reading characters as long as they're whitespace. Once we hit
a non-whitespace character, stop. Now `l.ch` points at something meaningful.

If we were building a language where whitespace matters (like Python), we'd emit INDENT
and DEDENT tokens here instead of skipping.

---

## Step 8: readIdentifier() and readNumber()

When the lexer sees a letter, it needs to read the entire word. When it sees a digit, it
needs to read the entire number. Same pattern, different rules for what counts as "part
of the token."

```go
func (l *Lexer) readIdentifier() string {
	startPosition := l.position
	for isLetter(l.ch) {
		l.readChar()
	}
	return l.input[startPosition:l.position]
}

func (l *Lexer) readNumber() string {
	startPosition := l.position
	for isDigit(l.ch) {
		l.readChar()
	}
	return l.input[startPosition:l.position]
}

func isLetter(ch byte) bool {
	return 'a' <= ch && ch <= 'z' || 'A' <= ch && ch <= 'Z' || ch == '_'
}

func isDigit(ch byte) bool {
	return '0' <= ch && ch <= '9'
}
```

Both methods use the same strategy: remember where we started, keep advancing while the
character matches our criteria, then slice the input string from start to current
position. It's like highlighting text — you put your cursor at the start, hold shift, and
keep pressing the right arrow until you've selected the whole word.

`isLetter` allows underscores so identifiers like `my_var` work. We don't allow digits at
the start of identifiers (the main `NextToken` method handles this by checking whether
the first character is a letter or a digit).

`readNumber` only handles integers. A real lexer would handle floats (`3.14`), hex
(`0xFF`), and other formats.

---

## Step 9: readString()

Strings are delimited by double quotes. We read everything between the opening `"` and
the closing `"`.

```go
func (l *Lexer) readString() string {
	startPosition := l.position + 1
	for {
		l.readChar()
		if l.ch == '"' || l.ch == 0 {
			break
		}
	}
	return l.input[startPosition:l.position]
}
```

We start AFTER the opening quote (`position + 1`) and stop WHEN we hit the closing quote
or the end of input. The returned string does not include the surrounding quotes.

Notice the `l.ch == 0` check — that's our guard against unterminated strings. If someone
writes `"hello` without a closing quote, we don't loop forever. We stop at EOF. A
production lexer would emit an error token here.

This implementation doesn't handle escape sequences like `\"` or `\n`. A real lexer would
need to watch for backslashes and handle them specially.

---

## Step 10: NextToken() — The Heart of the Lexer

This is the method the parser will call repeatedly. Each call returns the next token from
the input. Think of it as a vending machine: every time you press the button, one token
comes out.

```go
func (l *Lexer) NextToken() token.Token {
	var tok token.Token

	l.skipWhitespace()

	switch l.ch {
	case '=':
		if l.peekChar() == '=' {
			ch := l.ch
			l.readChar()
			literal := string(ch) + string(l.ch)
			tok = token.Token{Type: token.EQ, Literal: literal}
		} else {
			tok = newToken(token.ASSIGN, l.ch)
		}
	case '+':
		tok = newToken(token.PLUS, l.ch)
	case '-':
		tok = newToken(token.MINUS, l.ch)
	case '!':
		if l.peekChar() == '=' {
			ch := l.ch
			l.readChar()
			literal := string(ch) + string(l.ch)
			tok = token.Token{Type: token.NOT_EQ, Literal: literal}
		} else {
			tok = newToken(token.BANG, l.ch)
		}
	case '/':
		tok = newToken(token.SLASH, l.ch)
	case '*':
		tok = newToken(token.ASTERISK, l.ch)
	case '<':
		tok = newToken(token.LT, l.ch)
	case '>':
		tok = newToken(token.GT, l.ch)
	case ';':
		tok = newToken(token.SEMICOLON, l.ch)
	case ',':
		tok = newToken(token.COMMA, l.ch)
	case '(':
		tok = newToken(token.LPAREN, l.ch)
	case ')':
		tok = newToken(token.RPAREN, l.ch)
	case '{':
		tok = newToken(token.LBRACE, l.ch)
	case '}':
		tok = newToken(token.RBRACE, l.ch)
	case '"':
		tok.Type = token.STRING
		tok.Literal = l.readString()
	case 0:
		tok.Literal = ""
		tok.Type = token.EOF
	default:
		if isLetter(l.ch) {
			tok.Literal = l.readIdentifier()
			tok.Type = token.LookupIdent(tok.Literal)
			return tok
		} else if isDigit(l.ch) {
			tok.Type = token.INT
			tok.Literal = l.readNumber()
			return tok
		} else {
			tok = newToken(token.ILLEGAL, l.ch)
		}
	}

	l.readChar()
	return tok
}

func newToken(tokenType token.TokenType, ch byte) token.Token {
	return token.Token{Type: tokenType, Literal: string(ch)}
}
```

Let's break down the key decisions:

**Two-character tokens (`==`, `!=`)**: When we see `=`, we peek ahead. If the next
character is also `=`, we consume both characters and return an EQ token. If not, we
return an ASSIGN token. Same logic for `!` — peek for `=` to decide between NOT_EQ and
BANG.

**Early return for identifiers and numbers**: Notice the `return tok` inside the
`isLetter` and `isDigit` branches. This is because `readIdentifier()` and `readNumber()`
already advance past the last character of the token. If we fell through to the
`l.readChar()` at the bottom, we'd skip one character too many. Single-character tokens
need that final `readChar()` to advance past themselves; multi-character tokens handle
their own advancing.

This is a subtle but critical detail. Getting it wrong means the lexer skips characters
or reads them twice, producing garbage tokens.

**The default branch**: if the character isn't whitespace, isn't a known operator or
delimiter, isn't a letter, and isn't a digit, it's ILLEGAL. The lexer doesn't crash —
it produces an ILLEGAL token and keeps going. Robust error handling means the parser can
report multiple errors instead of dying on the first one.

---

## Testing the Lexer

Tests are how we prove the lexer actually works. The strategy: give it source code, call
`NextToken()` in a loop, and check that every token matches what we expect.

Create `lexer/lexer_test.go`:

```go
package lexer

import (
	"testing"

	"monkey/token"
)

func TestNextToken(t *testing.T) {
	input := `let five = 5;
let ten = 10;

let add = fn(x, y) {
	x + y;
};

let result = add(five, ten);
!-/*5;
5 < 10 > 5;

if (5 < 10) {
	return true;
} else {
	return false;
}

10 == 10;
10 != 9;
"foobar"
"foo bar"
`

	tests := []struct {
		expectedType    token.TokenType
		expectedLiteral string
	}{
		{token.LET, "let"},
		{token.IDENT, "five"},
		{token.ASSIGN, "="},
		{token.INT, "5"},
		{token.SEMICOLON, ";"},

		{token.LET, "let"},
		{token.IDENT, "ten"},
		{token.ASSIGN, "="},
		{token.INT, "10"},
		{token.SEMICOLON, ";"},

		{token.LET, "let"},
		{token.IDENT, "add"},
		{token.ASSIGN, "="},
		{token.FUNCTION, "fn"},
		{token.LPAREN, "("},
		{token.IDENT, "x"},
		{token.COMMA, ","},
		{token.IDENT, "y"},
		{token.RPAREN, ")"},
		{token.LBRACE, "{"},
		{token.IDENT, "x"},
		{token.PLUS, "+"},
		{token.IDENT, "y"},
		{token.SEMICOLON, ";"},
		{token.RBRACE, "}"},
		{token.SEMICOLON, ";"},

		{token.LET, "let"},
		{token.IDENT, "result"},
		{token.ASSIGN, "="},
		{token.IDENT, "add"},
		{token.LPAREN, "("},
		{token.IDENT, "five"},
		{token.COMMA, ","},
		{token.IDENT, "ten"},
		{token.RPAREN, ")"},
		{token.SEMICOLON, ";"},

		{token.BANG, "!"},
		{token.MINUS, "-"},
		{token.SLASH, "/"},
		{token.ASTERISK, "*"},
		{token.INT, "5"},
		{token.SEMICOLON, ";"},

		{token.INT, "5"},
		{token.LT, "<"},
		{token.INT, "10"},
		{token.GT, ">"},
		{token.INT, "5"},
		{token.SEMICOLON, ";"},

		{token.IF, "if"},
		{token.LPAREN, "("},
		{token.INT, "5"},
		{token.LT, "<"},
		{token.INT, "10"},
		{token.RPAREN, ")"},
		{token.LBRACE, "{"},
		{token.RETURN, "return"},
		{token.TRUE, "true"},
		{token.SEMICOLON, ";"},
		{token.RBRACE, "}"},
		{token.ELSE, "else"},
		{token.LBRACE, "{"},
		{token.RETURN, "return"},
		{token.FALSE, "false"},
		{token.SEMICOLON, ";"},
		{token.RBRACE, "}"},

		{token.INT, "10"},
		{token.EQ, "=="},
		{token.INT, "10"},
		{token.SEMICOLON, ";"},

		{token.INT, "10"},
		{token.NOT_EQ, "!="},
		{token.INT, "9"},
		{token.SEMICOLON, ";"},

		{token.STRING, "foobar"},
		{token.STRING, "foo bar"},

		{token.EOF, ""},
	}

	l := New(input)

	for i, tt := range tests {
		tok := l.NextToken()

		if tok.Type != tt.expectedType {
			t.Fatalf("tests[%d] - tokentype wrong. expected=%q, got=%q",
				i, tt.expectedType, tok.Type)
		}

		if tok.Literal != tt.expectedLiteral {
			t.Fatalf("tests[%d] - literal wrong. expected=%q, got=%q",
				i, tt.expectedLiteral, tok.Literal)
		}
	}
}
```

The test covers every token type we defined:

- **Keywords**: `let`, `fn`, `if`, `else`, `return`, `true`, `false`
- **Identifiers**: `five`, `ten`, `add`, `result`, `x`, `y`
- **Integers**: `5`, `10`, `9`
- **Strings**: `"foobar"`, `"foo bar"` (with a space inside)
- **Operators**: `=`, `+`, `-`, `!`, `*`, `/`, `<`, `>`, `==`, `!=`
- **Delimiters**: `;`, `,`, `(`, `)`, `{`, `}`
- **EOF**: the final token

The line `!-/*5;` is deliberately ugly — it tests that single-character operators work
back-to-back without whitespace. If the lexer has an off-by-one error in its position
tracking, this line will expose it.

Run the test:

```
cd monkey
go test ./lexer/
```

You should see:

```
ok      monkey/lexer    0.001s
```

---

## How It All Connects

Let's trace through the first few characters of `let five = 5;` to see every method
working together:

```
State: position=0, readPosition=1, ch='l'
```

1. `NextToken()` is called.
2. `skipWhitespace()` — `'l'` is not whitespace, nothing happens.
3. `switch l.ch` — `'l'` doesn't match any case, falls to `default`.
4. `isLetter('l')` — true.
5. `readIdentifier()` — reads `'l'`, `'e'`, `'t'`, stops at `' '`. Returns `"let"`.
6. `LookupIdent("let")` — found in keywords map, returns `LET`.
7. Returns `Token{Type: LET, Literal: "let"}`. (Early return, no extra `readChar()`.)

```
State: position=3, readPosition=4, ch=' '
```

8. `NextToken()` is called again.
9. `skipWhitespace()` — `' '` is whitespace, calls `readChar()`. Now `ch='f'`.
10. `switch l.ch` — `'f'` falls to `default`.
11. `isLetter('f')` — true.
12. `readIdentifier()` — reads `'f'`, `'i'`, `'v'`, `'e'`, stops at `' '`. Returns `"five"`.
13. `LookupIdent("five")` — NOT in keywords map, returns `IDENT`.
14. Returns `Token{Type: IDENT, Literal: "five"}`.

```
State: position=8, readPosition=9, ch=' '
```

15. `NextToken()` is called.
16. `skipWhitespace()` — skips the space. Now `ch='='`.
17. `switch l.ch` — matches `case '='`.
18. `peekChar()` — returns `' '` (space). Not `'='`.
19. `newToken(ASSIGN, '=')` — creates the token.
20. `l.readChar()` at the bottom — advances past `=`.
21. Returns `Token{Type: ASSIGN, Literal: "="}`.

This trace shows why the early return matters. In steps 7 and 14, `readIdentifier()`
already advanced past the word. In step 20, the single-character `=` needs the explicit
`readChar()` at the bottom of `NextToken()` to advance past it. Without the early return,
identifiers would skip the character after them.

---

## Design Decisions Worth Understanding

### Why a struct instead of a closure?

You could build a lexer as a function that returns a closure:

```go
func NewLexer(input string) func() token.Token {
    pos := 0
    return func() token.Token { ... }
}
```

The struct approach is better because:
- The parser needs to hold a reference to the lexer
- Testing is easier with a concrete type
- Adding methods later (for error reporting, position tracking) is cleaner

### Why `byte` instead of `rune`?

Go strings are UTF-8 encoded. A `byte` can only represent ASCII characters (0-127). For
a real language supporting Unicode identifiers (`let cafe = "hello"`), you'd need `rune`
and `utf8.DecodeRuneInString()`. We use `byte` because it keeps the code focused on
lexing concepts rather than encoding details.

### Why `string` for TokenType?

An integer enum would be faster for comparisons and use less memory. But string types
mean that when a test fails, you see `expected="LET", got="IDENT"` instead of
`expected=7, got=3`. During development, debuggability wins over micro-optimization.

### Why a switch statement instead of a map?

You could map characters to handler functions. The switch statement is more explicit about
what's happening, especially for two-character tokens where we need the peek-ahead logic.
It's also what most real lexers use — Go's own `go/scanner` uses a switch.

---

## Exercises

1. **Add more operators**: implement `<=`, `>=`, `&&`, `||`. Each requires the same
   peek-ahead pattern used for `==` and `!=`.

2. **Add line/column tracking**: modify the Lexer struct to track `line` and `column`.
   Increment `column` in `readChar()`. When you see `\n`, increment `line` and reset
   `column`. Add these to the Token struct so error messages can say "error on line 5,
   column 12."

3. **Add single-line comments**: when the lexer sees `//`, skip everything until the next
   newline. This goes in `NextToken()` as a new case, or in `skipWhitespace()` if you
   treat comments as whitespace.

4. **Add float support**: modify `readNumber()` to handle a single decimal point. `3.14`
   should produce a FLOAT token. `3.14.15` should produce an error.

---

## Key Takeaways

- A lexer is a state machine that walks through source code one character at a time
- Two pointers (`position` and `readPosition`) enable peek-ahead without consuming
- The keyword lookup table is how identifiers and keywords are distinguished
- Two-character tokens (`==`, `!=`) require peeking at the next character
- Multi-character tokens (identifiers, numbers, strings) handle their own position
  advancing, which is why they use early return in `NextToken()`
- ILLEGAL tokens let the lexer keep going after encountering unknown characters
- The lexer is the foundation — every stage that follows depends on it producing correct
  tokens
