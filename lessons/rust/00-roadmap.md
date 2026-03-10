# Rust in 72 Hours — Beginner-Friendly Rust Track

This track is for learners from any programming background, including people
who are new to systems programming.

Rust's biggest new idea is **ownership**: compile-time rules that give you
memory safety without a garbage collector. The early lessons explain those
rules from first principles, not from Go or TypeScript assumptions.

---

## Reference Files (read anytime)

- [CS Fundamentals](../reference-cs-fundamentals.md) — Stack, heap, memory, pointers, GC, binary explained with everyday analogies
- [Rust Glossary](./reference-rust-glossary.md) — Ownership, borrowing, traits, lifetimes, crates, and other Rust terms in plain language

---

## The Roadmap

### Hours 1–8: Foundations & Ownership (the hard part, front-loaded)
- [ ] [Lesson 01: Ownership, moves, and borrowing](./01-ownership.md)
- [ ] [Lesson 02: References, slices, and lifetimes](./02-references-slices-lifetimes.md)
- [ ] [Lesson 03: Pattern matching, enums, Option, Result](./03-enums-pattern-matching.md)
- [ ] [Lesson 04: Error handling patterns](./04-error-handling.md)

### Hours 9–20: Core Language
- [ ] [Lesson 05: Structs and methods](./05-structs-methods.md)
- [ ] [Lesson 06: Traits — shared behavior and interfaces](./06-traits.md)
- [ ] [Lesson 07: Generics and trait bounds](./07-generics.md)
- [ ] [Lesson 08: Iterators and closures](./08-iterators-closures.md)
- [ ] [Lesson 09: Strings (String vs &str, the full picture)](./09-strings.md)

### Hours 21–36: Practical Rust
- [ ] [Lesson 10: Collections (Vec, HashMap, HashSet)](./10-collections.md)
- [ ] [Lesson 11: Modules, crates, and cargo](./11-modules-cargo.md)
- [ ] [Lesson 12: Testing](./12-testing.md)
- [ ] [Lesson 13: Serialization with serde](./13-serde.md)

### Hours 37–54: Intermediate Concepts
- [ ] [Lesson 14: Smart pointers (Box, Rc, Arc)](./14-smart-pointers.md)
- [ ] [Lesson 15: Concurrency (threads, async/await, tokio)](./15-concurrency.md)
- [ ] [Lesson 16: Trait objects vs generics (dynamic vs static dispatch)](./16-trait-objects.md)
- [ ] [Lesson 17: Macros (the basics)](./17-macros.md)

### Hours 55–72: Build Something Real
- [ ] [Lesson 18: CLI tool with clap](./18-cli-clap.md)
- [ ] [Lesson 19: HTTP API with axum](./19-http-axum.md)
- [ ] [Lesson 20: Putting it all together](./20-project.md)

---

## How to use these lessons

Each lesson file in this track lives in `lessons/rust/` and has:
1. Concept explanation from first principles
2. Why the feature exists and what problem it solves
3. Code examples you can run
4. Exercises at the end
5. Keywords defined inline or linked to the Rust glossary

**Start with the CS Fundamentals reference** if stack, heap, pointers, or
garbage collection are unfamiliar concepts.

If a lesson compares Rust to another language, treat that as an optional
sidebar, not a prerequisite.

Run examples by editing `src/main.rs` and running:
```bash
cargo run
```

---

## Recommended Reading

These books are optional — the lessons above cover everything you need. But if you want to go deeper:

- **The Rust Programming Language** by Steve Klabnik and Carol Nichols (No Starch Press, 2nd Edition 2023) — The official Rust book, covers everything from ownership to async. *Free online at doc.rust-lang.org/book*
- **Rust for Rustaceans** by Jon Gjengset (No Starch Press, 2021) — Intermediate to advanced Rust patterns and idioms
- **Programming Rust** by Jim Blandy, Jason Orendorff, and Leonora Tindall (O'Reilly, 2nd Edition 2021) — Comprehensive reference for experienced programmers
