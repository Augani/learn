# Reference: Essential Commands Quick Reference

A practical cheat sheet organized by category. All commands work on macOS unless noted otherwise.

---

## Navigation

```bash
pwd                         # print current directory
cd /path/to/dir             # change directory
cd ~                        # go to home directory
cd -                        # go to previous directory
cd ..                       # go up one directory

ls                          # list files
ls -l                       # long format (permissions, size, date)
ls -la                      # include hidden files
ls -lh                      # human-readable sizes (KB, MB, GB)
ls -lt                      # sort by modification time (newest first)
ls -lS                      # sort by size (largest first)
ls -R                       # recursive listing

tree                        # show directory tree (install via brew)
tree -L 2                   # limit depth to 2 levels
tree -d                     # directories only

find . -name "*.rs"         # find files by name
find . -type d              # find directories only
find . -type f -mtime -7    # files modified in last 7 days
find . -size +100M          # files larger than 100MB
find . -name "*.log" -delete  # find and delete

which program               # show full path of a program
type program                # show if built-in, alias, or external
```

## File Operations

```bash
touch file.txt              # create empty file or update timestamp
mkdir dirname               # create directory
mkdir -p a/b/c              # create nested directories
cp src dst                  # copy file
cp -r srcdir dstdir         # copy directory recursively
cp -i src dst               # prompt before overwrite
mv src dst                  # move or rename
rm file                     # delete file
rm -r dir                   # delete directory recursively
rm -i file                  # prompt before delete
rmdir dir                   # delete empty directory only
ln -s target linkname       # create symbolic link
ln target linkname          # create hard link

stat file                   # detailed file metadata
file myfile                 # detect file type
basename /path/to/file.txt  # extract filename -> file.txt
dirname /path/to/file.txt   # extract directory -> /path/to
```

## Viewing & Reading Files

```bash
cat file                    # print entire file
less file                   # paginated viewer (q to quit, / to search)
head file                   # first 10 lines
head -n 20 file             # first 20 lines
tail file                   # last 10 lines
tail -n 20 file             # last 20 lines
tail -f file                # follow file (live updates)
wc file                     # line, word, character count
wc -l file                  # line count only

diff file1 file2            # show differences between files
diff -u file1 file2         # unified diff format
```

## Text Processing

```bash
grep pattern file           # search for pattern in file
grep -r pattern dir         # recursive search
grep -i pattern file        # case-insensitive
grep -v pattern file        # invert match (lines NOT matching)
grep -c pattern file        # count matching lines
grep -n pattern file        # show line numbers
grep -l pattern dir/*       # list filenames with matches
grep -E 'regex' file        # extended regex (egrep)
grep -w word file           # match whole words only
grep -A 3 pattern file      # show 3 lines after match
grep -B 3 pattern file      # show 3 lines before match
grep -C 3 pattern file      # show 3 lines before and after

sed 's/old/new/' file       # replace first occurrence per line
sed 's/old/new/g' file      # replace all occurrences
sed -i '' 's/old/new/g' f   # in-place edit (macOS, note the '')
sed -i 's/old/new/g' f      # in-place edit (Linux, no '' needed)
sed -n '5,10p' file         # print lines 5-10
sed '/pattern/d' file       # delete lines matching pattern

awk '{print $1}' file       # print first column (space-delimited)
awk -F',' '{print $2}' file # print second column (comma-delimited)
awk 'NR==5' file            # print line 5
awk '{sum+=$1} END {print sum}' file  # sum first column
awk '/pattern/ {print}' f   # print lines matching pattern

cut -d',' -f1,3 file        # extract columns 1 and 3 (comma delimiter)
cut -c1-10 file             # extract characters 1-10
sort file                   # sort lines alphabetically
sort -n file                # sort numerically
sort -r file                # reverse sort
sort -k2 file               # sort by second column
sort -u file                # sort and deduplicate
uniq                        # remove adjacent duplicates (sort first!)
uniq -c                     # count occurrences
tr 'a-z' 'A-Z'             # translate lowercase to uppercase
tr -d '\r'                  # delete carriage returns
tr -s ' '                   # squeeze repeated spaces

jq '.' file.json            # pretty-print JSON
jq '.key' file.json         # extract a key
jq '.[] | .name' file.json  # extract name from each array element
jq -r '.key' file.json      # raw output (no quotes)
```

## Pipes & Redirection

```bash
cmd1 | cmd2                 # pipe stdout of cmd1 to stdin of cmd2
cmd > file                  # redirect stdout to file (overwrite)
cmd >> file                 # redirect stdout to file (append)
cmd 2> file                 # redirect stderr to file
cmd 2>&1                    # redirect stderr to stdout
cmd &> file                 # redirect both stdout and stderr to file
cmd < file                  # use file as stdin
cmd1 | tee file | cmd2      # write to file AND pass to cmd2
cmd | xargs other_cmd       # convert stdin lines to arguments
$(command)                  # command substitution
```

## Processes

```bash
ps aux                      # list all processes (BSD style)
ps -ef                      # list all processes (System V style)
top                         # real-time process viewer
htop                        # interactive process viewer (install via brew)

kill PID                    # send SIGTERM (graceful shutdown)
kill -9 PID                 # send SIGKILL (force kill)
kill -STOP PID              # pause process
kill -CONT PID              # resume process
killall name                # kill all processes by name
pkill -f pattern            # kill processes matching pattern

jobs                        # list background jobs
cmd &                       # run command in background
fg %1                       # bring job 1 to foreground
bg %1                       # resume job 1 in background
Ctrl+Z                      # suspend current process
Ctrl+C                      # interrupt (SIGINT) current process

nohup cmd &                 # run command immune to hangup
lsof -p PID                 # files opened by process
lsof -i :8080               # what process is using port 8080
```

## Permissions

```bash
chmod 755 file              # rwxr-xr-x
chmod 644 file              # rw-r--r--
chmod +x file               # add execute for everyone
chmod u+x file              # add execute for owner only
chmod g-w file              # remove write for group
chmod -R 755 dir            # recursive permission change

chown user file             # change file owner
chown user:group file       # change owner and group
chown -R user:group dir     # recursive ownership change
chgrp group file            # change group only

umask                       # show default permission mask
umask 022                   # set default (new files: 644, dirs: 755)
```

## Networking

```bash
curl -s URL                 # fetch URL silently
curl -o file URL            # download to file
curl -I URL                 # headers only
curl -X POST -d 'data' URL # POST request
curl -H 'Header: val' URL  # custom header
wget URL                    # download file (install via brew on macOS)

ping host                   # test connectivity
traceroute host             # trace packet route
nslookup domain             # DNS lookup
dig domain                  # detailed DNS lookup
host domain                 # simple DNS lookup

netstat -an                 # all connections (macOS)
ss -tlnp                    # listening TCP ports (Linux only)
lsof -i :port               # what's on a port (macOS and Linux)

nc -l 8080                  # listen on port 8080
nc host port                # connect to host:port

ssh user@host               # remote shell
scp file user@host:/path    # copy file to remote
rsync -avz src dst          # sync files (local or remote)

ifconfig                    # network interfaces (macOS)
ip addr                     # network interfaces (Linux)
```

## Disk & Storage

```bash
df -h                       # disk space usage (human-readable)
du -sh dir                  # directory size
du -sh * | sort -rh         # largest items in current directory
du -h -d 1                  # size of subdirectories (depth 1)

mount                       # show mounted filesystems
diskutil list               # list disks (macOS)
lsblk                       # list block devices (Linux)

ln -s target link           # symbolic link
readlink link               # show link target
```

## System Info

```bash
uname -a                    # system info
hostname                    # machine name
uptime                      # how long system has been running
whoami                      # current user
id                          # user and group IDs
date                        # current date/time
cal                         # calendar

sw_vers                     # macOS version
cat /etc/os-release         # Linux distribution info
```

## Archives & Compression

```bash
tar czf archive.tar.gz dir  # create gzipped tar
tar xzf archive.tar.gz      # extract gzipped tar
tar xzf archive.tar.gz -C /dest  # extract to specific directory
tar tf archive.tar.gz       # list contents without extracting

zip -r archive.zip dir      # create zip
unzip archive.zip           # extract zip
unzip -l archive.zip        # list contents

gzip file                   # compress file (replaces original)
gunzip file.gz              # decompress
zcat file.gz                # view compressed file without extracting
```

## SSH

```bash
ssh-keygen -t ed25519       # generate Ed25519 key pair
ssh-add ~/.ssh/id_ed25519   # add key to agent
ssh -L 5432:localhost:5432 host  # local port forward
ssh -J jumphost target      # connect through jump host
ssh -N -L 8080:db:5432 host # tunnel without shell
```

## Docker

```bash
docker build -t name .      # build image
docker run -it name bash    # run interactive container
docker run -d -p 8080:80 name  # run detached with port mapping
docker ps                   # running containers
docker ps -a                # all containers (including stopped)
docker logs container       # view container logs
docker logs -f container    # follow logs
docker exec -it container bash  # shell into running container
docker stop container       # graceful stop
docker rm container         # remove container
docker images               # list images
docker rmi image            # remove image
docker system prune         # clean up unused resources

docker compose up -d        # start services (detached)
docker compose down         # stop and remove
docker compose logs -f      # follow logs
docker compose ps           # list services
```

## History & Shortcuts

```bash
history                     # command history
Ctrl+R                      # reverse search history
!!                          # repeat last command
!$                          # last argument of previous command
!grep                       # repeat last command starting with 'grep'

Ctrl+A                      # move cursor to beginning of line
Ctrl+E                      # move cursor to end of line
Ctrl+K                      # delete from cursor to end of line
Ctrl+U                      # delete from cursor to beginning of line
Ctrl+W                      # delete previous word
Ctrl+L                      # clear screen
Alt+B                       # move back one word
Alt+F                       # move forward one word
```
