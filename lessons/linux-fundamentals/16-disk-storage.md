# Lesson 16: Disk, Filesystems, and Storage

Understanding how disks and filesystems work helps you diagnose "disk full" situations, optimize I/O performance, and make sense of concepts like inodes, mount points, and symlinks that come up regularly in development and operations.

---

## Block Devices: How the OS Sees Disks

The operating system interacts with disks through block devices. A block device reads and writes data in fixed-size blocks (typically 512 bytes or 4KB), unlike character devices (keyboards, terminals) which work byte by byte.

```bash
# macOS: list disk devices
diskutil list

# Linux: list block devices
lsblk
```

On macOS, you will see something like:

```
/dev/disk0 (internal):
   #:                       TYPE NAME                    SIZE
   0:      GUID_partition_scheme                        *500.1 GB
   1:             Apple_APFS_ISC Container disk1         524.3 MB
   2:                 Apple_APFS Container disk3         494.4 GB
   3:        Apple_APFS_Recovery Container disk2         5.4 GB
```

---

## Partitions

A partition divides a physical disk into separate sections, each acting as an independent storage area. This is like dividing a warehouse into separate rooms — each room can be used for different purposes.

Common partition schemes:
- **GPT** (GUID Partition Table) — Modern standard, used by macOS and most Linux systems
- **MBR** (Master Boot Record) — Legacy, limited to 4 primary partitions and 2TB disks

A typical Linux server might have:
- `/` partition — Root filesystem (OS, applications)
- `/home` partition — User data
- `swap` partition — Virtual memory overflow
- `/var` partition — Logs and variable data (separate so logs filling up won't kill the OS)

On macOS with APFS, partitioning works differently — APFS uses a container model where volumes share space within a container, growing and shrinking dynamically.

---

## Filesystems: Organizing Data on Disk

A filesystem defines how data is stored, organized, and retrieved on a partition. Different filesystems have different trade-offs.

| Filesystem | OS | Notes |
|-----------|-----|-------|
| APFS | macOS | Default since High Sierra. Copy-on-write, encryption, snapshots |
| ext4 | Linux | Most common Linux filesystem. Mature, reliable |
| XFS | Linux | High performance for large files. Default on RHEL |
| Btrfs | Linux | Copy-on-write, snapshots, checksums. Used by some distros |
| ZFS | Linux/FreeBSD | Enterprise-grade. Checksums, snapshots, RAID, compression |
| FAT32/exFAT | Cross-platform | USB drives, SD cards. No permissions, limited file sizes |
| NTFS | Windows | Read-only on macOS by default |

```bash
# See filesystem types of mounted volumes
# macOS:
mount | grep -E "apfs|hfs|msdos"
df -h

# Linux:
df -T                            # shows filesystem type
mount | column -t
```

---

## Mounting: Connecting Filesystems to the Directory Tree

In Unix, all storage appears as a single directory tree rooted at `/`. Mounting attaches a filesystem to a point in this tree.

When you plug in a USB drive on Linux, it does not automatically appear as `D:\`. Instead, it gets mounted at a directory like `/media/username/USB_DRIVE`. From then on, accessing `/media/username/USB_DRIVE/file.txt` reads from the USB drive.

```bash
# See all mounted filesystems
mount

# macOS: list mount points
df -h

# Linux: mount a device
sudo mount /dev/sdb1 /mnt/usb

# Linux: unmount
sudo umount /mnt/usb
```

On macOS, mounting is mostly handled automatically by the system. USB drives appear under `/Volumes/`.

### /etc/fstab (Linux)

The `/etc/fstab` file defines filesystems to mount at boot:

```
# device            mount point   type   options        dump  pass
/dev/sda1           /             ext4   defaults       0     1
/dev/sda2           /home         ext4   defaults       0     2
/dev/sda3           none          swap   sw             0     0
UUID=abc-123        /data         xfs    defaults       0     2
```

---

## df: Disk Space Usage

`df` (disk free) shows how much space is available on mounted filesystems.

```bash
df -h                            # human-readable (GB, MB)
df -h /                          # just the root filesystem
df -h /Users                     # the filesystem containing /Users
df -i                            # inode usage (Linux)
```

Output:

```
Filesystem     Size   Used  Avail Capacity  Mounted on
/dev/disk3s1  460Gi  120Gi  340Gi    26%    /
```

**When to worry:** If capacity exceeds 90%, you need to free space. At 100%, the system can become unstable — processes cannot write log files, databases cannot write data, and things start failing in unexpected ways.

---

## du: Directory Space Usage

`du` (disk usage) shows how much space files and directories consume.

```bash
du -sh *                         # size of each item in current directory
du -sh * | sort -rh              # sorted by size, largest first
du -sh .                         # total size of current directory
du -h -d 1                      # one level deep (subdirectories)
du -h -d 1 /var                 # what's taking space in /var
```

### Finding large files

```bash
# Find files larger than 100MB
find / -type f -size +100M 2>/dev/null

# Find the top 20 largest files
find / -type f -exec du -h {} + 2>/dev/null | sort -rh | head -20

# Large directories under home
du -sh ~/*/  2>/dev/null | sort -rh | head -10

# Specific large directories (common culprits)
du -sh ~/Library/Caches 2>/dev/null
du -sh ~/.cargo 2>/dev/null
du -sh ~/node_modules 2>/dev/null        # won't exist if you're organized
du -sh /var/log 2>/dev/null
```

Common space hogs:
- `~/Library/Caches` — macOS application caches
- `~/.cargo/registry` — Rust crate downloads
- `~/Library/Developer/Xcode` — Xcode derived data
- Docker images and volumes — `docker system df`
- `node_modules` — npm packages (in individual projects)

---

## Inodes: File Metadata

An inode (index node) stores all metadata about a file EXCEPT its name and contents:

- File type and permissions
- Owner and group
- Size
- Timestamps (created, modified, accessed)
- Pointers to data blocks on disk
- Link count

The filename is stored in the directory (which is itself a file), as a mapping from name to inode number.

```bash
# See a file's inode number
ls -i file.txt
# 12345 file.txt

# Detailed inode info
stat file.txt
```

**Why this matters:** A filesystem has a fixed number of inodes (set at creation on ext4). You can run out of inodes even with free disk space if you have millions of tiny files. This is rare but happens with some applications that create many small files.

```bash
# Check inode usage (Linux)
df -i

# Count files in a directory tree
find /path -type f | wc -l
```

---

## Symlinks vs Hard Links

### Symbolic links (symlinks)

A symlink is a special file that contains the path to another file. It is a pointer, like a shortcut.

```bash
ln -s /path/to/target linkname

# Example
ln -s /opt/homebrew/bin/python3 ~/bin/python
ls -la ~/bin/python
# lrwxr-xr-x  1 augustus  staff  28 Jan 15 10:00 python -> /opt/homebrew/bin/python3
```

Properties of symlinks:
- Can point to files or directories
- Can cross filesystem boundaries
- Can point to something that does not exist (broken symlink)
- Deleting the target breaks the symlink
- Deleting the symlink does not affect the target
- Have their own inode (different from the target)

### Hard links

A hard link is another name for the same inode. The file has two (or more) directory entries pointing to the same data.

```bash
ln target hardlink               # no -s flag

echo "hello" > original.txt
ln original.txt hardlink.txt

ls -li original.txt hardlink.txt
# 12345 -rw-r--r--  2 augustus  staff  6 Jan 15 10:00 hardlink.txt
# 12345 -rw-r--r--  2 augustus  staff  6 Jan 15 10:00 original.txt
# Note: same inode (12345), link count = 2
```

Properties of hard links:
- Same inode as the original — they ARE the same file
- Cannot cross filesystem boundaries
- Cannot link to directories (usually)
- Deleting one link does not delete the data — data persists until all links are removed
- No concept of "original" — both names are equally valid

### When to use which

- **Symlinks** — Almost always. They are flexible, visible (`ls -la` shows the target), and work across filesystems. Use for version management (`python -> python3.12`), configuration shortcuts, and developer convenience.
- **Hard links** — Rarely needed directly. Used internally by git (deduplication), backup tools, and some package managers.

---

## Disk I/O: Sequential vs Random

Understanding I/O patterns helps explain performance differences:

**Sequential I/O** — Reading or writing data in order (beginning to end). Fast on both HDDs and SSDs. Examples: streaming a video file, writing log files, `cat` a large file.

**Random I/O** — Reading or writing small chunks at arbitrary positions. Slow on HDDs (physical seek time), fast on SSDs. Examples: database queries (reading scattered records), loading many small files.

SSDs transformed disk I/O performance because they have no physical seek time. Random reads on an SSD are nearly as fast as sequential reads. This is why databases perform dramatically better on SSDs.

```bash
# Monitor disk I/O
iostat -w 2                      # macOS: every 2 seconds
iostat -x 2                     # Linux: extended stats every 2 seconds

# Which processes are doing the most I/O
sudo iotop                       # Linux (install: apt install iotop)
sudo fs_usage -f diskio          # macOS
```

---

## RAID (Brief)

RAID (Redundant Array of Independent Disks) combines multiple disks for redundancy and/or performance.

| Level | How it works | Benefit |
|-------|-------------|---------|
| RAID 0 | Striping — data split across disks | 2x speed, no redundancy (if one disk fails, all data lost) |
| RAID 1 | Mirroring — data duplicated on each disk | Redundancy, read speed boost |
| RAID 5 | Striping with parity — can survive one disk failure | Balance of speed, capacity, and redundancy |
| RAID 10 | Mirroring + striping | High performance + redundancy (expensive: needs 4+ disks) |

You will encounter RAID in production servers and cloud storage. As a developer, you typically do not configure RAID directly — the cloud provider or sysadmin handles it.

---

## Exercises

### Exercise 1: Check your disk usage

```bash
# Overall disk usage
df -h

# Your home directory size
du -sh ~

# Largest directories in your home
du -sh ~/* 2>/dev/null | sort -rh | head -10

# Find files over 100MB in your home directory
find ~ -type f -size +100M 2>/dev/null | head -10
```

### Exercise 2: Explore mount points

```bash
# All mounted filesystems
mount | head -20

# macOS disk details
diskutil list

# Check filesystem type
df -h /

# See what's under /Volumes (macOS)
ls -la /Volumes/
```

### Exercise 3: Symlinks and hard links

```bash
mkdir -p /tmp/link-exercise
cd /tmp/link-exercise

# Create a file
echo "original content" > original.txt

# Create a symlink
ln -s original.txt symlink.txt
ls -la symlink.txt               # shows -> original.txt

# Create a hard link
ln original.txt hardlink.txt
ls -li                           # notice: original and hardlink share the same inode

# Modify through hard link
echo "modified" >> hardlink.txt
cat original.txt                 # shows the modification (same file)

# Delete original
rm original.txt

# Hard link still works
cat hardlink.txt                 # still has content

# Symlink is broken
cat symlink.txt                  # error: No such file or directory
ls -la symlink.txt               # shows broken link (red on many terminals)

# Clean up
rm -rf /tmp/link-exercise
```

### Exercise 4: Find what's using your disk

```bash
# Common space hogs on macOS
echo "=== Cargo cache ==="
du -sh ~/.cargo 2>/dev/null || echo "Not found"

echo "=== Docker ==="
docker system df 2>/dev/null || echo "Docker not running"

echo "=== Homebrew cache ==="
du -sh ~/Library/Caches/Homebrew 2>/dev/null || echo "Not found"

echo "=== Xcode derived data ==="
du -sh ~/Library/Developer/Xcode/DerivedData 2>/dev/null || echo "Not found"

echo "=== Application caches ==="
du -sh ~/Library/Caches 2>/dev/null || echo "Not found"
```

### Exercise 5: Monitor disk I/O

```bash
# Watch disk I/O in real time (macOS)
iostat -w 2

# In another terminal, create some I/O
dd if=/dev/zero of=/tmp/testfile bs=1m count=100 2>/dev/null
rm /tmp/testfile

# Watch the I/O spike in iostat, then Ctrl+C to stop
```

---

Next: [Lesson 17 — Logs](./17-logs.md)
