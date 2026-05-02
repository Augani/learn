# Lesson 09: File Systems — How Files Actually Work

When you save a file, where does it go? How does the OS find it again?
A file system turns a raw disk (just billions of numbered bytes) into
something organized: files with names, directories, permissions, and
timestamps.

---

## The Big Picture

A disk is a flat array of bytes. Without a file system, you'd have to
remember "my essay starts at byte 4,819,200 and is 3,072 bytes long."
The file system is the layer that lets you say `open("essay.txt")`.

```
Raw disk (no file system):
┌──────────────────────────────────────────────────────────┐
│ 00 00 48 65 6C 6C 6F 00 FF FF 00 57 6F 72 6C 64 ...    │
│ ← just billions of bytes, no structure, no names →       │
└──────────────────────────────────────────────────────────┘

With a file system:
┌─────────────────────────────────────────────────────────────┐
│ Superblock │ Inode Table │ Data Blocks                      │
│            │             │                                   │
│ metadata   │ inode 1: /  │ block 100: "Hello, world!\n"     │
│ about the  │ inode 2:    │ block 101: <directory entries>    │
│ filesystem │   essay.txt │ block 102: <more file data>       │
│ itself     │ inode 3:    │ ...                               │
│            │   photo.jpg │                                   │
└─────────────────────────────────────────────────────────────┘
```

**Analogy: the warehouse**

A file system is like a warehouse with a directory at the front desk.

- The **warehouse** is the disk — it has shelves (blocks) where stuff is stored
- The **front desk directory** is the inode table — it tells you which shelf
  each item is on
- Each **inventory card** at the front desk is an inode — it records the
  item name, size, who owns it, and which shelves it occupies
- The **shelves** are data blocks — where the actual contents live

Without the front desk, you'd wander the warehouse randomly looking for
your stuff. The file system IS that front desk.

---

## Key Components

### 1. Superblock

The first thing on the disk. Contains metadata about the file system itself:

- File system type and version
- Total size
- Block size (usually 4 KB)
- Number of inodes
- Location of the inode table
- Free block/inode counts

If the superblock is corrupted, the entire file system is unreadable.
Most file systems keep backup copies of the superblock.

### 2. Inodes (Index Nodes)

An inode stores **everything about a file EXCEPT its name and contents**.

```
Inode #42
┌──────────────────────────────────┐
│ Type:        regular file        │
│ Size:        12,288 bytes        │
│ Owner:       uid 1000            │
│ Group:       gid 1000            │
│ Permissions: rwxr-xr-x (755)    │
│ Link count:  1                   │
│ Created:     2025-03-15 10:30    │
│ Modified:    2025-03-15 14:22    │
│ Accessed:    2025-03-16 09:00    │
│                                  │
│ Data block pointers:             │
│   Direct:  [100, 101, 102]       │
│   Indirect: [500]                │
│   Double indirect: [null]        │
│   Triple indirect: [null]        │
└──────────────────────────────────┘
```

Key insight: **the file name is NOT stored in the inode**. The name
lives in the directory that contains the file.

### 3. Data Blocks

Where actual file contents live. Typically 4 KB each.

A 12 KB file needs 3 data blocks. A 1-byte file still uses 1 block
(the remaining space is wasted — this is called **internal fragmentation**).

### 4. Block Pointers — How Large Files Work

An inode has limited space for block pointers. To handle large files,
file systems use indirect pointers:

```
Inode
┌─────────────────────┐
│ Direct pointers (12) │──→ blocks 0-11  (up to 48 KB)
│                      │
│ Single indirect      │──→ pointer block ──→ blocks 12-1035
│                      │    (256 pointers)    (up to ~4 MB)
│                      │
│ Double indirect      │──→ pointer block ──→ 256 pointer blocks ──→ blocks
│                      │                      (up to ~1 GB)
│                      │
│ Triple indirect      │──→ pointer block ──→ ... ──→ ...
│                      │                      (up to ~4 TB)
└─────────────────────┘
```

Small files (under 48 KB) use only direct pointers — fast, no
indirection. Large files traverse more levels of indirection.

Modern file systems like ext4 use **extents** instead of individual block
pointers. An extent says "blocks 100 through 356" instead of listing
each block individually — much more efficient for large files.

---

## Directories Are Just Files

A directory is NOT a folder icon on your screen. Under the hood, it is
a file whose contents are a table mapping names to inode numbers.

```
Directory file for /home/alice/
┌──────────────────────────┐
│ Name          │ Inode #  │
├──────────────────────────┤
│ .             │ 200      │  ← this directory itself
│ ..            │ 150      │  ← parent directory
│ essay.txt     │ 42       │
│ photo.jpg     │ 87       │
│ projects/     │ 201      │
└──────────────────────────┘
```

When you run `ls /home/alice/`:

1. OS finds the inode for `/` (always inode 2 on ext4)
2. Reads the data blocks of `/` — finds `home` → inode 50
3. Reads the data blocks of inode 50 — finds `alice` → inode 200
4. Reads the data blocks of inode 200 — lists the entries

This is called **path resolution** — the OS walks the directory tree
one component at a time.

---

## Hard Links vs Soft Links (Symlinks)

### Hard Links

A hard link is another directory entry pointing to the **same inode**.

```
Directory /home/alice/           Directory /home/bob/
┌──────────────────────┐         ┌──────────────────────┐
│ report.txt → inode 42│         │ shared.txt → inode 42│
└──────────────────────┘         └──────────────────────┘
            │                                │
            └──────────┐  ┌──────────────────┘
                       ▼  ▼
                    Inode #42
                ┌──────────────┐
                │ link count: 2│
                │ size: 4096   │
                │ data → [100] │
                └──────────────┘
```

- Both names point to the same inode — same file, same data
- The inode tracks how many names point to it (link count)
- The file is only deleted when the link count reaches 0
- You cannot hard-link across file systems (different inode tables)
- You cannot hard-link directories (would create cycles in the tree)

### Soft Links (Symlinks)

A symlink is a separate file whose content is a path to another file.

```
Directory /home/alice/
┌──────────────────────────┐
│ report.txt   → inode 42  │  (regular file)
│ shortcut.txt → inode 99  │  (symlink)
└──────────────────────────┘

Inode #99 (symlink)
┌────────────────────────────────┐
│ type: symlink                  │
│ content: "/home/alice/report.txt" │
└────────────────────────────────┘
```

- A symlink is its own file with its own inode
- It contains a path string, not a direct inode reference
- If the target is deleted, the symlink becomes **dangling** (broken)
- Symlinks CAN cross file systems
- Symlinks CAN point to directories

```
Hard link:   name ──→ inode ──→ data     (direct connection)
Symlink:     name ──→ inode ──→ "path" ──→ name ──→ inode ──→ data
             (extra level of indirection)
```

---

## File System Types

| File System | OS         | Features                                        |
|-------------|------------|-------------------------------------------------|
| ext4        | Linux      | Journaling, extents, mature and reliable        |
| APFS        | macOS/iOS  | Copy-on-write, snapshots, encryption, SSD-aware |
| Btrfs       | Linux      | Copy-on-write, snapshots, checksums, RAID       |
| ZFS         | FreeBSD/Linux | Pooled storage, checksums, dedup, snapshots  |
| NTFS        | Windows    | Journaling, ACLs, compression                   |
| XFS         | Linux      | High performance, large files, parallel I/O     |
| FAT32       | Universal  | Simple, no journaling, 4 GB file size limit     |

### Copy-on-Write (CoW) file systems (APFS, Btrfs, ZFS)

Traditional file systems overwrite data in place. CoW file systems
never overwrite — they write new data to a new location, then update
the pointer.

```
Traditional (ext4):                 Copy-on-Write (APFS/Btrfs):

1. Read block 100                   1. Write new data to block 200
2. Modify in memory                 2. Update pointer: inode now
3. Write back to block 100             points to block 200
                                    3. Old block 100 still intact
If crash during step 3:                (until reclaimed)
   → corrupted data                 If crash during step 2:
                                       → old data still valid
```

CoW enables cheap snapshots: just keep the old pointers instead of
reclaiming old blocks.

---

## Journaling — Crash Safety

What happens if power goes out while the OS is writing a file?

Without journaling, the file system can be left in an inconsistent
state: data blocks allocated but inode not updated, or directory entry
pointing to a freed inode.

**Analogy: journaling is like a database WAL (Write-Ahead Log)**

Before making changes, the file system writes a description of what it's
about to do into a journal. Then it makes the actual changes. If a crash
happens:

- If the journal entry is incomplete → discard it, nothing changed
- If the journal entry is complete but changes not applied → replay it

```
Without journaling:                With journaling:

1. Allocate data block             1. Write to journal:
2. Write data to block                "will allocate block 500,
3. Update inode                        write data, update inode 42"
4. Update directory                2. Allocate data block
                                   3. Write data to block
 Crash at step 3?                  4. Update inode
 → Block allocated but             5. Update directory
   inode doesn't know              6. Mark journal entry complete
 → Lost data, corrupted FS
                                   Crash at step 4?
                                   → On reboot, replay journal
                                   → File system consistent
```

Journaling modes (ext4):

- **Journal**: both metadata AND data go through the journal (safest, slowest)
- **Ordered**: only metadata is journaled, but data is written before metadata (default, good balance)
- **Writeback**: only metadata is journaled, data can be written in any order (fastest, riskiest)

---

## File System Permissions

Every file has three permission sets: owner, group, and other.
Each set has three bits: read (r), write (w), execute (x).

```
-rwxr-xr-- 1 alice devteam 4096 Mar 15 10:30 deploy.sh
│├─┤├─┤├─┤
│ │   │  │
│ │   │  └─ Other: read only (r--)      = 4
│ │   └──── Group: read + execute (r-x)  = 5
│ └──────── Owner: read + write + exec   = 7
└────────── File type: - regular, d directory, l symlink

Octal: 754
```

The permission bits as numbers:

```
r = 4   (read)
w = 2   (write)
x = 1   (execute)

Common patterns:
  755 = rwxr-xr-x  (executables, directories)
  644 = rw-r--r--  (regular files)
  600 = rw-------  (private files)
  777 = rwxrwxrwx  (wide open — usually a bad idea)
```

For directories, the bits mean something slightly different:

- **r**: can list directory contents
- **w**: can create/delete files in the directory
- **x**: can traverse (cd into) the directory

---

## Rust: File System Operations

### Reading file metadata (inode information)

```rust
use std::fs;
use std::os::unix::fs::MetadataExt;

fn inspect_file(path: &str) -> std::io::Result<()> {
    let metadata = fs::metadata(path)?;

    println!("File: {}", path);
    println!("Size: {} bytes", metadata.len());
    println!("Is file: {}", metadata.is_file());
    println!("Is dir: {}", metadata.is_dir());
    println!("Is symlink: {}", metadata.file_type().is_symlink());

    println!("Inode: {}", metadata.ino());
    println!("Device: {}", metadata.dev());
    println!("Hard links: {}", metadata.nlink());
    println!("UID: {}", metadata.uid());
    println!("GID: {}", metadata.gid());
    println!("Mode: {:o}", metadata.mode());
    println!("Block size: {}", metadata.blksize());
    println!("Blocks used: {}", metadata.blocks());

    if let Ok(modified) = metadata.modified() {
        println!("Modified: {:?}", modified);
    }

    Ok(())
}
```

### Working with symlinks

```rust
use std::fs;
use std::os::unix::fs as unix_fs;
use std::path::Path;

fn link_demo() -> std::io::Result<()> {
    fs::write("original.txt", "Hello, world!")?;

    fs::hard_link("original.txt", "hardlink.txt")?;

    unix_fs::symlink("original.txt", "symlink.txt")?;

    let orig_meta = fs::metadata("original.txt")?;
    let hard_meta = fs::metadata("hardlink.txt")?;

    assert_eq!(orig_meta.ino(), hard_meta.ino());

    let sym_target = fs::read_link("symlink.txt")?;
    println!("Symlink points to: {}", sym_target.display());

    let sym_meta = fs::symlink_metadata("symlink.txt")?;
    assert!(sym_meta.file_type().is_symlink());

    println!("Original inode: {}", orig_meta.ino());
    println!("Hardlink inode: {}", hard_meta.ino());
    println!("Symlink inode:  {}", sym_meta.ino());
    println!("Link count: {}", orig_meta.nlink());

    fs::remove_file("original.txt")?;
    fs::remove_file("hardlink.txt")?;
    fs::remove_file("symlink.txt")?;

    Ok(())
}
```

### Setting permissions

```rust
use std::fs;
use std::os::unix::fs::PermissionsExt;

fn set_permissions_demo() -> std::io::Result<()> {
    fs::write("secret.txt", "top secret data")?;

    let permissions = fs::Permissions::from_mode(0o600);
    fs::set_permissions("secret.txt", permissions)?;

    let meta = fs::metadata("secret.txt")?;
    let mode = meta.permissions().mode();
    println!("Permissions: {:o}", mode & 0o777);

    fs::remove_file("secret.txt")?;
    Ok(())
}
```

### Walking a directory tree

```rust
use std::fs;
use std::path::Path;

fn walk_directory(dir: &Path, depth: usize) -> std::io::Result<()> {
    if !dir.is_dir() {
        return Ok(());
    }

    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        let indent = "  ".repeat(depth);
        let file_type = entry.file_type()?;

        if file_type.is_dir() {
            println!("{}{}/", indent, entry.file_name().to_string_lossy());
            walk_directory(&path, depth + 1)?;
        } else if file_type.is_symlink() {
            let target = fs::read_link(&path).unwrap_or_default();
            println!(
                "{}{} -> {}",
                indent,
                entry.file_name().to_string_lossy(),
                target.display()
            );
        } else {
            let size = entry.metadata()?.len();
            println!(
                "{}{} ({} bytes)",
                indent,
                entry.file_name().to_string_lossy(),
                size
            );
        }
    }

    Ok(())
}
```

---

## Exercises

### Exercise 1: Explore Inodes

```bash
# Create a test file
echo "hello" > testfile.txt

# See the inode number and all metadata
stat testfile.txt

# On Linux, see inode details:
ls -li testfile.txt

# On macOS:
stat -f "inode: %i  links: %l  size: %z  mode: %p" testfile.txt
```

Questions to answer:
1. What inode number was assigned?
2. How many blocks does a 6-byte file use?
3. What is the link count?

### Exercise 2: Hard Links and Soft Links

```bash
# Create a file
echo "original content" > original.txt

# Create a hard link
ln original.txt hardlink.txt

# Create a soft link
ln -s original.txt symlink.txt

# Compare inodes
ls -li original.txt hardlink.txt symlink.txt

# What happens when you delete the original?
rm original.txt

# Can you still read the hard link?
cat hardlink.txt

# Can you still read the symlink?
cat symlink.txt
```

Answer these:
1. Do `original.txt` and `hardlink.txt` have the same inode number?
2. What is the link count after creating the hard link?
3. After deleting `original.txt`, which link still works and why?

### Exercise 3: Check Your File System Type

```bash
# Linux
df -T /
mount | grep "on / "

# macOS
diskutil info / | grep "File System"
mount | grep "on / "
```

### Exercise 4: Write a Rust File Inspector

Build a program that takes a path as an argument and prints:
- File type (regular file, directory, symlink)
- Inode number
- Size in bytes and number of blocks
- Permission mode in octal
- Number of hard links
- Owner UID and GID
- Last modified time

Make it handle errors gracefully (file not found, permission denied).

### Exercise 5: Find Hard Links

Write a Rust program that walks a directory tree and finds all files
with a hard link count greater than 1. Group files by inode number to
show which names point to the same file.

---

Next: [Lesson 10: File Descriptors and I/O](./10-file-descriptors-io.md)
