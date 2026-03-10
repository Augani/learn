# Lesson 03: IP -- Addressing and Routing Across the Internet

IP (Internet Protocol) is the Layer 3 protocol that gives every device on the
internet a unique address and defines how packets are forwarded from source to
destination across many networks. If Ethernet handles delivery on your street,
IP handles delivery across the country.

---

## IPv4 Addresses

An IPv4 address is a 32-bit number, written as four decimal numbers separated
by dots (dotted-decimal notation):

```
192.168.1.42

Each number is one byte (8 bits), range 0-255:

  192      .   168      .     1      .    42
  11000000     10101000     00000001     00101010
  [  byte 1  ] [ byte 2  ] [ byte 3 ] [ byte 4 ]

Total: 32 bits = 2^32 = 4,294,967,296 possible addresses
```

### The Phone Number Analogy

Think of an IP address like a phone number. It identifies your device on the
network. Just like phone numbers have area codes (country + region + subscriber
number), IP addresses have a **network** part and a **host** part:

```
Phone:  +1   -  212    -  555-1234
        country  area     subscriber

IP:     192.168.  1  .  42
        network part     host part
        (which network)  (which device on that network)
```

---

## Subnets and CIDR Notation

A **subnet** is a logical group of IP addresses. All devices on the same subnet
can communicate directly without going through a router.

### CIDR Notation

CIDR (Classless Inter-Domain Routing) notation specifies how many bits are the
network part:

```
192.168.1.0/24

The "/24" means: the first 24 bits are the network part.
The remaining 8 bits are the host part.

  192.168.1.  |  0
  ^^^^^^^^^^^    ^
  Network (24b)  Host (8 bits = 256 possible addresses)

Network:  192.168.1.0
First IP: 192.168.1.1    (usually the router)
Last IP:  192.168.1.254  (last usable address)
Broadcast: 192.168.1.255 (sends to all devices on subnet)
Usable:   254 host addresses
```

### The Neighborhood Analogy

A subnet is like a neighborhood:

- **192.168.1.0/24** = "Elm Street" -- all houses numbered 1-254
- **192.168.2.0/24** = "Oak Avenue" -- all houses numbered 1-254
- Devices on the same street can shout to each other directly
- To reach a different street, you go through the intersection (router)

### Common Subnet Sizes

```
CIDR     Subnet Mask       Hosts    Use Case
/32      255.255.255.255   1        Single host (e.g., load balancer IP)
/24      255.255.255.0     254      Typical LAN (home, small office)
/16      255.255.0.0       65,534   Large campus network
/8       255.0.0.0         16M      Giant networks (legacy Class A)
```

### Subnet Masks

A subnet mask is another way to express the network/host division. It is a
32-bit number where 1s mark the network bits and 0s mark the host bits:

```
IP Address:   192.168.1.42     = 11000000.10101000.00000001.00101010
Subnet Mask:  255.255.255.0    = 11111111.11111111.11111111.00000000
                                  ^^^^^^^^^^^^^^^^^^^^^^^^^ ^^^^^^^^
                                  Network (24 bits)         Host (8)

To find the network address, AND the IP with the mask:
  11000000.10101000.00000001.00101010  (192.168.1.42)
& 11111111.11111111.11111111.00000000  (255.255.255.0)
= 11000000.10101000.00000001.00000000  (192.168.1.0)

Two devices are on the same subnet if their network addresses match.
```

---

## Private vs Public IP Addresses

Not every IP address is reachable from the internet. Three ranges are reserved
for **private** (internal) use:

```
Range                  CIDR           Typical Use
10.0.0.0 - 10.255.255.255    10.0.0.0/8     Large organizations, cloud VPCs
172.16.0.0 - 172.31.255.255  172.16.0.0/12  Medium organizations
192.168.0.0 - 192.168.255.255 192.168.0.0/16 Home/small office networks
```

**Your home network** almost certainly uses `192.168.x.x` addresses. These
addresses only work within your local network. To reach the internet, your
router translates them to a single public IP address via NAT (see below).

**Other special addresses:**

```
127.0.0.0/8         Loopback (localhost). 127.0.0.1 = "this machine."
0.0.0.0             "Any address" or "all interfaces" (used when binding)
255.255.255.255     Broadcast to the entire local network
169.254.0.0/16      Link-local (auto-assigned when DHCP fails)
```

---

## NAT: Sharing One Public IP

**NAT (Network Address Translation)** is how your home router lets 20 devices
share a single public IP address. Without NAT, every device would need its own
public IP, and we ran out of IPv4 addresses years ago.

```
Your Home Network                   Internet
+---------------------+
| Laptop: 192.168.1.5 |                     +------------------+
| Phone:  192.168.1.6 |---[Router]----------| Public Internet  |
| TV:     192.168.1.7 |   Public IP:        | Servers see:     |
+---------------------+   73.42.18.200      | 73.42.18.200     |
                                             +------------------+

Your laptop sends a request:
  From: 192.168.1.5:52000  ->  To: 93.184.216.34:443

Router translates (NAT):
  From: 73.42.18.200:44001 ->  To: 93.184.216.34:443

Server responds:
  From: 93.184.216.34:443  ->  To: 73.42.18.200:44001

Router reverse-translates:
  From: 93.184.216.34:443  ->  To: 192.168.1.5:52000
```

The router maintains a **NAT table** mapping internal (IP:port) to external
(IP:port). When a response comes back, it looks up the mapping and forwards
to the correct internal device.

```
NAT Table:
+---------------------+------------------------+
| Internal            | External               |
+---------------------+------------------------+
| 192.168.1.5:52000   | 73.42.18.200:44001     |
| 192.168.1.6:38921   | 73.42.18.200:44002     |
| 192.168.1.7:60100   | 73.42.18.200:44003     |
+---------------------+------------------------+
```

NAT is why you cannot directly connect to a device behind a home router from
the internet -- there is no entry in the NAT table for unsolicited incoming
connections. This is also a form of security (accidental firewall).

---

## IPv6: The Next Generation

IPv4 has 4.3 billion addresses. We have more than 4.3 billion devices. NAT
helps, but IPv6 is the real solution.

### IPv6 Addresses

IPv6 uses 128-bit addresses, written as eight groups of four hex digits:

```
Full:        2001:0db8:85a3:0000:0000:8a2e:0370:7334

Shortened:   2001:db8:85a3::8a2e:370:7334
             (leading zeros dropped, consecutive zero groups replaced by ::)

128 bits = 2^128 = 340 undecillion addresses
         = 340,282,366,920,938,463,463,374,607,431,768,211,456
         = enough to give every atom on Earth millions of addresses
```

### IPv4 vs IPv6 Comparison

| Property       | IPv4                | IPv6                        |
|---------------|---------------------|-----------------------------|
| Address size  | 32 bits             | 128 bits                    |
| Format        | 192.168.1.1         | 2001:db8::1                 |
| Total addrs   | ~4.3 billion        | ~340 undecillion             |
| NAT needed?   | Yes (not enough)    | No (every device gets one)  |
| Header size   | 20-60 bytes         | 40 bytes (fixed, simpler)   |
| Adoption      | Universal           | Growing (~40% of traffic)   |

### Why Adoption Is Slow

IPv6 has been around since 1998 but is still not universal because:
- NAT extended IPv4's life by decades
- IPv4 and IPv6 are not compatible (you need both stacks or a translator)
- Every router, firewall, and tool needs to support IPv6
- "If it works, don't fix it" inertia

Most modern services are **dual-stack** -- they support both IPv4 and IPv6.

---

## Routing: How Packets Find Their Way

When you send a packet to an IP address, how does it get there? **Routing** is
the process of forwarding packets hop-by-hop from source to destination.

### Your Machine's Routing Decision

When your machine wants to send a packet, it makes a simple decision:

```
Is the destination on my local subnet?
  |
  +-- YES --> Send directly via Ethernet (use ARP to find MAC)
  |
  +-- NO  --> Send to my default gateway (router)
              The router will figure out the rest.
```

### How Routers Forward Packets

Each router has a **routing table** that maps destination networks to next-hop
routers:

```
Router's Routing Table:
+-----------------+------------------+-------------+
| Destination     | Next Hop         | Interface   |
+-----------------+------------------+-------------+
| 10.0.0.0/8      | 10.0.0.1         | eth0        |
| 172.16.0.0/16   | 172.16.0.1       | eth1        |
| 192.168.1.0/24  | directly connected| eth2       |
| 0.0.0.0/0       | 203.0.113.1      | eth3        |  <- default route
+-----------------+------------------+-------------+

"If the destination is in 10.0.0.0/8, forward to 10.0.0.1."
"If nothing else matches (0.0.0.0/0), forward to 203.0.113.1."
```

### Packet Journey Example

```
Laptop (192.168.1.5) sends packet to Server (151.101.1.69):

Hop 1: Laptop -> Home Router (192.168.1.1)
  "151.101.1.69 is not on my subnet. Send to default gateway."

Hop 2: Home Router -> ISP Router (10.0.0.1)
  "151.101.1.69 is not in my local networks. Forward to ISP."

Hop 3: ISP Router -> Regional Router (203.0.113.5)
  "151.101.1.69 matches the route via 203.0.113.5."

Hop 4: Regional Router -> Backbone Router (64.233.174.1)
  "Forward to the backbone."

Hop 5-8: Several more backbone routers...

Hop 9: Destination network's edge router -> Server (151.101.1.69)
  "151.101.1.69 is on my directly connected network. Deliver."

Each router:
1. Reads the destination IP from the IP header
2. Looks up the longest-matching prefix in its routing table
3. Forwards the packet to the next hop
4. Decrements the TTL
```

---

## TTL: Time To Live

Every IP packet has a **TTL** field (8 bits, value 0-255). Each router that
forwards the packet decrements the TTL by 1. If TTL reaches 0, the packet is
dropped and an ICMP "Time Exceeded" message is sent back to the sender.

**Why?** To prevent routing loops. If two routers misconfigure their tables
and keep forwarding a packet back and forth, the TTL ensures it eventually
dies instead of looping forever.

```
TTL in action:
  Laptop sends packet with TTL=64

  Hop 1 (home router):     TTL: 64 -> 63
  Hop 2 (ISP router):      TTL: 63 -> 62
  Hop 3 (regional router): TTL: 62 -> 61
  ...
  Hop 9 (destination):     TTL: 55 -> delivered!

  If there were a routing loop:
  Hop 60: TTL: 4 -> 3
  Hop 61: TTL: 3 -> 2
  Hop 62: TTL: 2 -> 1
  Hop 63: TTL: 1 -> 0  DROPPED! ICMP "Time Exceeded" sent back.
```

Default TTL values vary by OS: Linux = 64, Windows = 128, macOS = 64.

---

## ICMP: Internet Control Message Protocol

ICMP is a network-layer protocol used for diagnostics and error reporting. It
is not used for data transfer -- it is the network's way of saying "something
went wrong" or "are you alive?"

### Common ICMP Message Types

| Type | Name                | Used By    | Purpose                    |
|------|---------------------|------------|----------------------------|
| 0    | Echo Reply          | ping       | Response to echo request   |
| 3    | Dest. Unreachable   | network    | Can't reach destination    |
| 8    | Echo Request        | ping       | "Are you there?"           |
| 11   | Time Exceeded       | traceroute | TTL reached 0              |

### ping: Testing Reachability

`ping` sends ICMP Echo Request packets and waits for Echo Reply:

```
$ ping -c 4 8.8.8.8

PING 8.8.8.8: 56 data bytes
64 bytes from 8.8.8.8: icmp_seq=0 ttl=118 time=12.3 ms
64 bytes from 8.8.8.8: icmp_seq=1 ttl=118 time=11.8 ms
64 bytes from 8.8.8.8: icmp_seq=2 ttl=118 time=12.1 ms
64 bytes from 8.8.8.8: icmp_seq=3 ttl=118 time=11.9 ms

--- 8.8.8.8 ping statistics ---
4 packets transmitted, 4 packets received, 0.0% packet loss
round-trip min/avg/max/stddev = 11.8/12.0/12.3/0.2 ms
```

What this tells you:
- The host is reachable (packets came back)
- RTT is about 12 ms (low latency, likely same continent)
- TTL=118 suggests the server started with TTL=128 (Windows?) and crossed 10 hops
- 0% packet loss means the connection is clean

### traceroute: Seeing the Path

`traceroute` exploits TTL to discover every router between you and the
destination. It sends packets with TTL=1 (first router drops it, sends back
ICMP), then TTL=2 (second router), then TTL=3, and so on:

```
$ traceroute 8.8.8.8

 1  192.168.1.1 (router)       1.2 ms   1.1 ms   1.0 ms
 2  10.0.0.1 (ISP)             5.3 ms   5.1 ms   5.2 ms
 3  72.14.215.85               8.7 ms   8.5 ms   8.6 ms
 4  108.170.252.1              10.1 ms  10.0 ms  10.2 ms
 5  8.8.8.8                    12.3 ms  12.1 ms  12.2 ms

Each line = one router (hop) between you and the destination.
Three RTT measurements per hop.
```

```
How traceroute works:

Packet with TTL=1:
  Laptop ---[TTL=1]---> Router 1 (TTL=0, drops packet, sends ICMP back)
  Laptop learns: Hop 1 = Router 1

Packet with TTL=2:
  Laptop ---[TTL=2]---> Router 1 ---[TTL=1]---> Router 2 (TTL=0, ICMP)
  Laptop learns: Hop 2 = Router 2

Packet with TTL=3:
  Laptop ---[TTL=3]---> Router 1 ---[TTL=2]---> Router 2 ---[TTL=1]---> Router 3
  Laptop learns: Hop 3 = Router 3

...until the destination is reached.
```

---

## The IP Header

```
 0                   1                   2                   3
 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1 2 3 4 5 6 7 8 9 0 1
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|Version|  IHL  |    DSCP/ECN   |         Total Length          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|         Identification        |Flags|    Fragment Offset      |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|  Time to Live |    Protocol   |       Header Checksum         |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                       Source Address                          |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+
|                    Destination Address                        |
+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+-+

Key fields:
  Version:        4 (IPv4) or 6 (IPv6)
  TTL:            Decremented each hop. Packet dies at 0.
  Protocol:       What's inside (6=TCP, 17=UDP, 1=ICMP)
  Source Address:  32-bit sender IP
  Dest Address:    32-bit receiver IP
```

---

## Exercises

### Exercise 1: Find Your IP Addresses

```bash
# Your private (local) IP:
# macOS:
ifconfig en0 | grep "inet "
# Linux:
ip addr show

# Your public IP (what the internet sees):
curl -s https://ifconfig.me
# or
curl -s https://api.ipify.org

# Compare them. They are different because of NAT.
```

### Exercise 2: Understand Your Subnet

```bash
# macOS:
ifconfig en0

# Find these values:
# - Your IP address (e.g., 192.168.1.42)
# - Your subnet mask (e.g., 255.255.255.0 = /24)
# - Your broadcast address

# Questions:
# 1. How many usable host addresses does your subnet have?
# 2. What is the network address?
# 3. Is your IP private or public?
```

### Exercise 3: View Your Routing Table

```bash
# macOS:
netstat -rn

# Linux:
ip route

# Find your default gateway (the line with "default" or "0.0.0.0").
# That is your router's IP address.
# Ping it -- it should be very fast (< 1ms).
```

### Exercise 4: Ping Different Destinations

```bash
# Ping and compare latency:
ping -c 5 127.0.0.1        # Localhost (should be < 0.1 ms)
ping -c 5 192.168.1.1      # Your router (should be < 5 ms)
ping -c 5 8.8.8.8          # Google DNS (10-50 ms typically)
ping -c 5 1.1.1.1          # Cloudflare DNS
ping -c 5 example.com      # Some remote server

# Which is fastest? Which is slowest? Why?
```

### Exercise 5: Trace the Route

```bash
# See every hop between you and a destination:
traceroute -n 8.8.8.8

# Count the hops.
# Notice where the big latency jumps happen (usually at ISP boundaries).
# Try different destinations and compare routes.

traceroute -n github.com
traceroute -n 1.1.1.1
```

### Exercise 6: Subnet Math (By Hand)

Given the IP address `10.50.100.200/20`:

1. What is the subnet mask in dotted-decimal?
2. What is the network address?
3. What is the broadcast address?
4. How many usable host addresses?
5. Is `10.50.99.1` on the same subnet?

Answers:
1. 255.255.240.0
2. 10.50.96.0 (the /20 means the first 20 bits are network. 100 in binary is
   01100100, keeping the top 4 bits gives 0110xxxx = 96)
3. 10.50.111.255
4. 2^12 - 2 = 4094
5. Yes (10.50.99.1 AND 255.255.240.0 = 10.50.96.0, same network)

---

Next: [Lesson 04: TCP -- Reliable Delivery](./04-tcp.md)
