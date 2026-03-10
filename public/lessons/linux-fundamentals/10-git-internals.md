# Lesson 10: Git Internals — How Git Actually Works

You use git every day but might treat it as a black box — memorized commands that usually do the right thing, and panic when they do not. Understanding how git works internally transforms it from magic incantations into a predictable tool. Once you see the data structures, everything clicks.

---

## Git Is a Content-Addressable Filesystem

At its core, git is a key-value store. You give it content, it gives you back a hash (the key). You can retrieve the content later using that hash. The version control system is built on top of this storage layer.

Every piece of data — file contents, directory listings, commits, tags — is stored as an **object** identified by its SHA-1 hash. The hash is computed from the content itself, which means:

- Identical content always produces the same hash
- Different content always produces different hashes
- You cannot modify an object without changing its hash (integrity guarantee)

This is conceptually similar to a `HashMap<SHA1, Bytes>`.

---

## The Four Object Types

### 1. Blob — File contents

A blob stores the raw contents of a file. It does NOT store the filename or permissions — just the bytes. Two files with identical contents share the same blob object.

```bash
echo "hello world" | git hash-object --stdin
# ce013625030ba8dba906f756967f9e9ca394464a
```

### 2. Tree — Directory listing

A tree maps filenames to blobs (files) and other trees (subdirectories). It stores the name, permissions, type, and hash for each entry.

```
100644 blob ce01362... README.md
100644 blob a1b2c3d... src/main.rs
040000 tree d4e5f6a... src/utils
```

Think of a tree as a directory snapshot: it captures what files exist, what they are named, and what their contents are (by referencing blob hashes).

### 3. Commit — A snapshot in time

A commit points to:
- A tree (the root directory snapshot)
- Zero or more parent commits
- Author and committer information
- A commit message
- A timestamp

```
tree d4e5f6a...
parent a1b2c3d...
author Augustus <aug@example.com> 1705312000 -0500
committer Augustus <aug@example.com> 1705312000 -0500

feat: add user authentication
```

A commit is NOT a diff. It is a pointer to a complete snapshot of the project (the root tree). Git computes diffs on the fly when you ask for them.

### 4. Tag (annotated) — Named reference to a commit

Annotated tags are objects that point to a commit with additional metadata (tagger, date, message).

```bash
git tag -a v1.0.0 -m "First stable release"
```

---

## The .git Directory

Every git repository has a `.git` directory. This IS the repository. Everything else in your working directory is just a checked-out snapshot.

```bash
ls -la .git/
```

Key contents:

| Path | Purpose |
|------|---------|
| `HEAD` | Points to the current branch (or commit if detached) |
| `objects/` | All git objects (blobs, trees, commits, tags) |
| `refs/heads/` | Branch pointers |
| `refs/tags/` | Tag pointers |
| `refs/remotes/` | Remote tracking branches |
| `index` | The staging area (binary file) |
| `config` | Repository-local configuration |
| `hooks/` | Client-side hook scripts |

```bash
cat .git/HEAD
# ref: refs/heads/main

cat .git/refs/heads/main
# a1b2c3d4e5f6... (the SHA of the commit this branch points to)
```

---

## Branches Are Just Pointers

A branch is a 41-byte file containing a commit hash. That is all. Creating a branch is nearly instantaneous because it is just writing 40 characters to a file.

```bash
cat .git/refs/heads/main
# a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2

cat .git/refs/heads/feature-auth
# b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3
```

When you commit on a branch, git:
1. Creates a new commit object (pointing to the current tree and the previous commit)
2. Updates the branch file to point to the new commit

That is it. A branch is just a moveable pointer to a commit.

HEAD is a pointer to the current branch (which is itself a pointer to a commit). It tells git which branch to update when you make a new commit.

```
HEAD → refs/heads/main → commit abc123
```

---

## The Commit Graph (DAG)

Commits form a Directed Acyclic Graph. Each commit points to its parent(s), creating a chain of history.

```
A ← B ← C ← D      (main)
         ↑
         └── E ← F  (feature)
```

- `A` is the initial commit (no parent)
- `B` points to `A`, `C` points to `B`, `D` points to `C`
- `E` branches from `C`, `F` points to `E`

Visualize it:

```bash
git log --oneline --graph --all
```

### Merge commits have two parents

When you merge `feature` into `main`:

```
A ← B ← C ← D ← G  (main, merge commit)
         ↑         ↗
         └── E ← F  (feature)
```

Commit `G` has two parents: `D` (main's previous tip) and `F` (feature's tip).

---

## The Staging Area (Index)

The staging area (also called the "index") is a file (`.git/index`) that holds the tree you are building for the next commit. It sits between your working directory and the repository.

```
Working Directory → [git add] → Staging Area → [git commit] → Repository
```

Why does the staging area exist? It lets you craft precise commits. You can modify 10 files but only stage 3 of them for a commit. This enables atomic, focused commits even in the middle of larger changes.

```bash
git status                       # shows what's staged vs unstaged vs untracked
git diff                         # unstaged changes (working dir vs index)
git diff --staged                # staged changes (index vs last commit)
git add file.rs                  # move changes from working dir to staging area
git reset HEAD file.rs           # unstage (move back from staging area)
```

Think of the staging area as a draft of your next commit. `git add` adds to the draft. `git commit` finalizes it.

---

## Merge vs Rebase

Both integrate changes from one branch into another, but they produce different commit histories.

### Merge

Creates a new merge commit with two parents. Preserves the complete history of both branches.

```bash
git checkout main
git merge feature
```

Before:
```
A ← B ← C        (main)
     ↑
     └── D ← E   (feature)
```

After:
```
A ← B ← C ← F   (main, F is merge commit)
     ↑       ↗
     └── D ← E   (feature)
```

### Rebase

Replays your branch's commits on top of the target branch. Creates new commits (with new hashes) that have the same changes but different parents.

```bash
git checkout feature
git rebase main
```

Before:
```
A ← B ← C        (main)
     ↑
     └── D ← E   (feature)
```

After:
```
A ← B ← C        (main)
         ↑
         └── D' ← E'   (feature, D' and E' are NEW commits)
```

Then fast-forward main:
```bash
git checkout main
git merge feature     # fast-forward merge, no merge commit needed
```

Result: `A ← B ← C ← D' ← E'` — linear history.

**Key difference:** Merge preserves the branching history (you can see that work happened in parallel). Rebase creates a linear history (looks like everything happened sequentially).

**Warning:** Never rebase commits that have been pushed and shared with others. Rebase rewrites history (creates new commit hashes), which breaks other people's branches that reference the old commits.

---

## Detached HEAD

Normally HEAD points to a branch, which points to a commit:

```
HEAD → main → abc123
```

In detached HEAD state, HEAD points directly to a commit, not a branch:

```
HEAD → abc123
```

This happens when you:
- `git checkout abc123` (checking out a specific commit)
- `git checkout v1.0.0` (checking out a tag)

You can make commits in detached HEAD, but they are not on any branch. If you switch away, those commits become unreachable (orphaned) unless you create a branch first:

```bash
git checkout abc123              # detached HEAD
# make some commits...
git checkout -b recovery-branch  # save your work to a branch
```

---

## Reflog: Your Safety Net

The reflog records every change to HEAD and branch tips. Even if you mess up badly, the reflog usually has your previous state.

```bash
git reflog                       # show history of HEAD changes
git reflog show main             # show history of main branch tip

# Typical reflog output:
# abc1234 HEAD@{0}: commit: add authentication
# def5678 HEAD@{1}: checkout: moving from feature to main
# 789abcd HEAD@{2}: commit: fix bug in parser
```

### Recovery scenarios

```bash
# Accidentally deleted a branch
git reflog
# Find the commit hash
git checkout -b recovered-branch abc1234

# Accidentally reset too hard
git reflog
git reset --hard HEAD@{2}       # go back to state 2 steps ago

# Lost commits after a bad rebase
git reflog
git reset --hard HEAD@{5}       # go back to before the rebase
```

The reflog keeps entries for about 90 days by default. It is local only — not pushed to remotes.

---

## Exercises

### Exercise 1: Explore the .git directory

```bash
mkdir -p /tmp/git-internals && cd /tmp/git-internals
git init

# Look at the structure
find .git -type f | head -20

# Check HEAD
cat .git/HEAD

# Create a commit and explore
echo "hello" > readme.txt
git add readme.txt
git commit -m "initial commit"

# Now see what's there
cat .git/HEAD
cat .git/refs/heads/main

# Look at the commit object
COMMIT=$(cat .git/refs/heads/main)
git cat-file -t $COMMIT         # type: commit
git cat-file -p $COMMIT         # pretty-print the commit

# Look at the tree
TREE=$(git cat-file -p $COMMIT | grep tree | awk '{print $2}')
git cat-file -p $TREE           # directory listing

# Look at the blob
BLOB=$(git cat-file -p $TREE | awk '{print $3}')
git cat-file -p $BLOB           # file contents: "hello"
```

### Exercise 2: Create objects manually

```bash
cd /tmp/git-internals

# Create a blob from raw content
echo "manual content" | git hash-object -w --stdin
# This returns a hash and stores the blob

# Verify it
HASH=$(echo "manual content" | git hash-object --stdin)
git cat-file -p $HASH           # "manual content"
git cat-file -t $HASH           # "blob"
```

### Exercise 3: Understand branches as pointers

```bash
cd /tmp/git-internals

# Create a branch
git branch feature

# Both point to the same commit
cat .git/refs/heads/main
cat .git/refs/heads/feature
# (they're identical)

# Make a commit on feature
git checkout feature
echo "feature work" >> readme.txt
git add readme.txt
git commit -m "feature work"

# Now they differ
cat .git/refs/heads/main
cat .git/refs/heads/feature

# Visualize
git log --oneline --graph --all
```

### Exercise 4: Practice with reflog

```bash
cd /tmp/git-internals

# Make several commits
for i in 1 2 3 4 5; do
    echo "change $i" >> readme.txt
    git add readme.txt
    git commit -m "change $i"
done

# View the history
git log --oneline

# Now "accidentally" reset
git reset --hard HEAD~3

# The commits seem gone
git log --oneline

# But reflog has them
git reflog

# Recover
git reset --hard HEAD@{1}

# They're back
git log --oneline

# Clean up
rm -rf /tmp/git-internals
```

### Exercise 5: Merge vs rebase visualization

```bash
mkdir -p /tmp/merge-vs-rebase && cd /tmp/merge-vs-rebase
git init

# Create initial history
echo "initial" > file.txt
git add file.txt && git commit -m "initial"
echo "base change 1" >> file.txt
git add file.txt && git commit -m "base 1"

# Create a feature branch
git checkout -b feature
echo "feature 1" >> feature.txt
git add feature.txt && git commit -m "feature 1"
echo "feature 2" >> feature.txt
git add feature.txt && git commit -m "feature 2"

# Add more commits to main
git checkout main
echo "base change 2" >> file.txt
git add file.txt && git commit -m "base 2"

# View the diverged state
git log --oneline --graph --all

# Merge approach
git merge feature -m "merge feature"
git log --oneline --graph --all

# Clean up
rm -rf /tmp/merge-vs-rebase
```

---

Next: [Lesson 11 — SSH](./11-ssh.md)
