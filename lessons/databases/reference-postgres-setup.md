# PostgreSQL Setup

How to get PostgreSQL running on your Mac for these lessons.

---

## Install with Homebrew

```bash
brew install postgresql@17
brew services start postgresql@17
```

This starts PostgreSQL as a background service that runs whenever your
Mac is on.

## Create the learning database

```bash
createdb learn_db
```

## Connect with psql

```bash
psql learn_db
```

You're now in the PostgreSQL interactive terminal. Try:

```sql
SELECT 'hello from postgres!' AS greeting;
```

### Useful psql commands

| Command | What it does |
|---------|-------------|
| `\l` | List all databases |
| `\dt` | List tables in current database |
| `\d tablename` | Describe a table (columns, types, indexes) |
| `\di` | List indexes |
| `\x` | Toggle expanded output (vertical format) |
| `\timing` | Toggle query timing |
| `\q` | Quit psql |
| `\?` | Help for psql commands |
| `\h SELECT` | Help for SQL commands |

### Executing SQL files

```bash
psql learn_db -f path/to/file.sql
```

---

## GUI Options (pick one if you prefer visual tools)

- **pgAdmin** — official, feature-rich, browser-based
- **DBeaver** — free, works with any database
- **TablePlus** — macOS native, clean UI (paid, free tier available)
- **Postico** — simple macOS Postgres client

---

## Verify your setup

Run this in psql:

```sql
SELECT version();
SELECT current_database();
SELECT current_user;
```

If all three return results, you're good to go.

---

## Stop/Start PostgreSQL

```bash
brew services stop postgresql@17     # stop
brew services start postgresql@17    # start
brew services restart postgresql@17  # restart
```

## Reset the learning database (start fresh)

```bash
dropdb learn_db
createdb learn_db
```
