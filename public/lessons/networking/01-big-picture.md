# Lesson 01: The Big Picture -- How Data Gets From A to B

Every time you open a web page, send an API request, or stream a video, data
travels across the planet in milliseconds. This lesson maps the entire journey
so you have a mental model before we dive into each layer.

---

## What Happens When You Type a URL

You type `https://api.example.com/users/42` and press Enter. Here is every
step, simplified:

```
 You                                                        Server
  |                                                           |
  |  1. Browser parses the URL                                |
  |     scheme: https                                         |
  |     host:   api.example.com                               |
  |     path:   /users/42                                     |
  |                                                           |
  |  2. DNS lookup: "what IP is api.example.com?"             |
  |  -------> DNS query to resolver ------->                  |
  |  <------- 93.184.216.34 <-----------                      |
  |                                                           |
  |  3. TCP connection: three-way handshake                   |
  |  ---- SYN ------------------------------------------>     |
  |  <--- SYN-ACK ---------------------------------------     |
  |  ---- ACK ------------------------------------------>     |
  |                                                           |
  |  4. TLS handshake (because https)                         |
  |  ---- ClientHello ---------------------------------->     |
  |  <--- ServerHello + Certificate ---------------------     |
  |  ---- Key Exchange --------------------------------->     |
  |  [symmetric encryption key agreed]                        |
  |                                                           |
  |  5. HTTP request (encrypted)                              |
  |  ---- GET /users/42 HTTP/1.1 ----------------------->    |
  |       Host: api.example.com                               |
  |                                                           |
  |  6. Server processes request                              |
  |     - web server receives the request                     |
  |     - app logic queries database                          |
  |     - builds JSON response                                |
  |                                                           |
  |  7. HTTP response (encrypted)                             |
  |  <--- HTTP/1.1 200 OK ------------------------------     |
  |       Content-Type: application/json                      |
  |       {"id": 42, "name": "Alice"}                         |
  |                                                           |
  |  8. Browser renders the response                          |
  |                                                           |
  |  9. TCP connection teardown                               |
  |  ---- FIN ------------------------------------------>     |
  |  <--- ACK ------------------------------------------     |
  |  <--- FIN ------------------------------------------     |
  |  ---- ACK ------------------------------------------>     |
  v                                                           v
```

That is 9 major steps involving at least 4 different protocols (DNS, TCP, TLS,
HTTP), dozens of routers, and potentially cables running under the ocean. It
all happens in under a second.

---

## The Layered Model

Networks are built in layers. Each layer has one job and relies on the layer
below it. This is the most important mental model in networking.

### The Postal Analogy

Imagine sending a package across the country:

1. **You write a letter** (Application layer) -- the actual content
2. **You put it in an envelope** with the recipient's name and address
   (Transport layer) -- ensures it gets to the right person at that address
3. **The post office stamps it** with routing info (Network layer) -- determines
   which city and which route
4. **A mail truck picks it up** (Link layer) -- handles delivery on this
   specific road segment
5. **The road itself** (Physical layer) -- the actual asphalt the truck drives on

Each layer wraps the previous layer's data. The letter goes in an envelope.
The envelope goes in a mail bag. The mail bag goes in a truck. This wrapping
is called **encapsulation**.

### The Five Layers (TCP/IP Model)

```
Layer 5: Application    HTTP, DNS, SSH, TLS
                        "What to say"
                              |
                              v
Layer 4: Transport      TCP, UDP
                        "Reliable or fast delivery"
                              |
                              v
Layer 3: Network        IP, ICMP
                        "Addressing and routing across the internet"
                              |
                              v
Layer 2: Link           Ethernet, Wi-Fi
                        "Delivery on the local network"
                              |
                              v
Layer 1: Physical       Cables, radio waves, fiber optics
                        "The actual signal"
```

When you send data, it flows **down** the stack on your machine, across the
network, and **up** the stack on the destination machine:

```
  Sender                                           Receiver
+-----------+                                   +-----------+
|Application|  HTTP request                     |Application|
+-----------+                                   +-----------+
      |                                               ^
      v                                               |
+-----------+                                   +-----------+
| Transport |  TCP segment                      | Transport |
+-----------+                                   +-----------+
      |                                               ^
      v                                               |
+-----------+                                   +-----------+
|  Network  |  IP packet  ->  Router  ->  ...   |  Network  |
+-----------+                                   +-----------+
      |                                               ^
      v                                               |
+-----------+                                   +-----------+
|   Link    |  Ethernet frame                   |   Link    |
+-----------+                                   +-----------+
      |                                               ^
      v                                               |
+-----------+   electrical / optical signals    +-----------+
| Physical  |  ==============================>  | Physical  |
+-----------+                                   +-----------+
```

---

## Encapsulation: Headers All the Way Down

Each layer adds its own header to the data from the layer above. Think of it
as nested envelopes:

```
Application data:     [    "Hello, world!"    ]

Transport adds hdr:   [ TCP hdr | "Hello, world!"    ]
                       src port, dst port, seq #

Network adds hdr:     [ IP hdr | TCP hdr | "Hello, world!"    ]
                       src IP, dst IP, TTL

Link adds hdr+trail:  [ Eth hdr | IP hdr | TCP hdr | "Hello, world!" | Eth trail ]
                       src MAC, dst MAC                                  checksum
```

When the receiver gets the frame, it **strips headers** layer by layer
(de-encapsulation) until the application gets the original data.

Each layer only reads its own header. The Ethernet switch reads the Ethernet
header. The router reads the IP header. The OS reads the TCP header. Your app
reads the HTTP content. No layer needs to understand the others.

---

## Packets: Breaking Data Into Chunks

You might be sending a 10 MB file, but the network can only handle packets up
to about 1500 bytes (the MTU -- Maximum Transmission Unit). So the data is
split into many small packets:

```
Original data (10 MB):
[=====================================================]

Split into packets:
[pkt 1][pkt 2][pkt 3][pkt 4] ... [pkt 6667]

Each packet travels independently:
  pkt 1 ---> Router A ---> Router C ---> Destination
  pkt 2 ---> Router A ---> Router B ---> Router C ---> Destination
  pkt 3 ---> Router A ---> Router C ---> Destination
              (different routes are possible!)

Reassembled at destination:
[pkt 1][pkt 2][pkt 3][pkt 4] ... [pkt 6667]
[=====================================================]
```

Packets can take different routes. They can arrive out of order. Some can get
lost. TCP handles all of this (lesson 04). UDP does not (lesson 05).

---

## The Internet Is a Network of Networks

The "internet" is not one network. It is thousands of networks connected
together:

```
Your Home Network          Your ISP            The Internet Backbone
+----------------+     +-----------+     +-------------------------+
| Phone          |     |           |     |                         |
| Laptop    [Router]---| ISP      |-----| Tier 1 ISPs             |
| Desktop        |     | Network  |     | (AT&T, Cogent, NTT...) |
+----------------+     +-----------+     | Undersea cables         |
                                         | Peering points          |
                                         +-------------------------+
                                                    |
                                          +---------+---------+
                                          |                   |
                                    +-----------+       +-----------+
                                    | Cloud     |       | Another   |
                                    | Provider  |       | ISP       |
                                    | (AWS,GCP) |       |           |
                                    +-----------+       +-----------+
                                          |
                                    +-----------+
                                    | example   |
                                    | .com      |
                                    | server    |
                                    +-----------+
```

Your packet might cross 10-20 different networks to reach its destination.
Each network agrees to forward traffic via peering agreements. BGP (Border
Gateway Protocol) is how these networks tell each other which IP ranges they
can reach.

---

## Latency vs Bandwidth

These are the two fundamental metrics of network performance, and they measure
completely different things.

**Bandwidth** = how much data you can send per second
**Latency** = how long it takes data to arrive

### The Highway Analogy

Think of a highway between two cities:

- **Bandwidth** is the number of lanes. A 10-lane highway can move more cars
  per hour than a 2-lane road.
- **Latency** is the distance between the cities. No matter how many lanes you
  have, it still takes time to drive from New York to Los Angeles.

```
High bandwidth, high latency:
  A 10-lane highway between NYC and LA.
  Lots of data, but each piece takes 40ms.

  [==========]  -------40ms-------->  [==========]

Low bandwidth, low latency:
  A 1-lane road between two neighboring buildings.
  Very little data, but it arrives in 1ms.

  [=]  --1ms-->  [=]
```

| Metric    | Unit                  | Improved By                    |
|-----------|-----------------------|--------------------------------|
| Bandwidth | Mbps, Gbps            | Bigger pipes, more connections |
| Latency   | Milliseconds (ms)     | Shorter distance, fewer hops   |

For most web applications, **latency matters more than bandwidth**. A 1 Gbps
connection with 200ms latency feels slower for web browsing than a 10 Mbps
connection with 10ms latency. This is because every HTTP request requires at
least one round trip, and modern pages make dozens of requests.

### Real-World Latency Numbers

| Route                        | Approximate RTT  |
|------------------------------|-------------------|
| Same machine (localhost)     | < 0.1 ms          |
| Same data center             | 0.5 - 1 ms        |
| Same city                    | 1 - 5 ms           |
| Same continent               | 10 - 50 ms         |
| Cross-continent (US to EU)  | 70 - 120 ms        |
| US to Asia                   | 150 - 250 ms       |
| Satellite internet           | 500 - 700 ms       |
| Starlink (LEO satellite)    | 25 - 50 ms         |

The speed of light in fiber is about 200,000 km/s. New York to London is
5,500 km. The absolute minimum one-way latency is ~28 ms. In practice, it is
about 35-40 ms because of routing and processing at each hop. Physics sets a
hard floor that no amount of engineering can break.

---

## The Full Stack Diagram

Here is a complete picture of a packet's journey through all layers:

```
YOUR MACHINE                                              SERVER
+----------------------------------------------------------+
| Application: HTTP GET /users/42                          |
|   - Your code or browser creates the request             |
+----------------------------------------------------------+
                        |
                        v
+----------------------------------------------------------+
| Transport: TCP                                           |
|   - Assigns source port (ephemeral, e.g. 52431)         |
|   - Destination port 443 (HTTPS)                         |
|   - Adds sequence number, checksum                       |
|   +----------------------------------------------------+ |
|   | Src Port: 52431 | Dst Port: 443 | Seq: 1000 | ... | |
|   | [HTTP GET /users/42 ...]                            | |
|   +----------------------------------------------------+ |
+----------------------------------------------------------+
                        |
                        v
+----------------------------------------------------------+
| Network: IP                                              |
|   - Adds source IP (your machine: 192.168.1.42)         |
|   - Adds destination IP (server: 93.184.216.34)         |
|   - Sets TTL to 64                                       |
|   +----------------------------------------------------+ |
|   | Src: 192.168.1.42 | Dst: 93.184.216.34 | TTL: 64  | |
|   | [TCP segment from above]                            | |
|   +----------------------------------------------------+ |
+----------------------------------------------------------+
                        |
                        v
+----------------------------------------------------------+
| Link: Ethernet                                           |
|   - Adds source MAC (your NIC: AA:BB:CC:DD:EE:FF)      |
|   - Adds destination MAC (your router: 11:22:33:44:55:66)|
|   - Note: dst MAC is NOT the server -- it is the NEXT    |
|     hop (your router). MAC addresses are local only.     |
|   +----------------------------------------------------+ |
|   | Src MAC | Dst MAC | [IP packet from above] | CRC   | |
|   +----------------------------------------------------+ |
+----------------------------------------------------------+
                        |
                        v
+----------------------------------------------------------+
| Physical: Electrical signals on your Ethernet cable      |
|   or radio waves if you are on Wi-Fi                     |
+----------------------------------------------------------+
                        |
          [travels to your router]
          [router strips Ethernet frame]
          [reads IP header: dst is 93.184.216.34]
          [looks up routing table, forwards to ISP]
          [new Ethernet frame with new MACs for next hop]
          [repeat at each router until destination reached]
                        |
                        v
+----------------------------------------------------------+
| SERVER receives the frame                                |
|   Physical -> Link -> Network -> Transport -> Application|
|   Each layer strips its header                           |
|   Application receives: GET /users/42 HTTP/1.1           |
+----------------------------------------------------------+
```

---

## Key Takeaways

1. **Networking is layers.** Each layer has one job and talks to the layers
   directly above and below it.

2. **Encapsulation** means each layer wraps the data from above with its own
   header. Like nested envelopes.

3. **Data is split into packets** (~1500 bytes each). Packets travel
   independently and may take different routes.

4. **The internet is a network of networks** connected by routers and peering
   agreements.

5. **Latency and bandwidth are different things.** Latency is how long it takes.
   Bandwidth is how much you can send.

6. **Everything you build as a developer sits at the application layer.** But
   understanding the layers below helps you debug, optimize, and make
   architectural decisions.

---

## Exercises

### Exercise 1: Trace the Journey

Pick any URL (e.g., `https://github.com`). Write out every step that happens
when you request it, from DNS resolution through TCP handshake through TLS
through HTTP request and response. Include the layer each step happens at.

### Exercise 2: Measure Latency and Bandwidth

```bash
# Measure latency to different locations
ping -c 5 127.0.0.1          # localhost
ping -c 5 8.8.8.8            # Google DNS (usually nearby)
ping -c 5 example.com        # Some server

# Compare the round-trip times. Which is fastest? Why?
```

### Exercise 3: See the Hops

```bash
# See every router between you and a destination
traceroute example.com

# Or on Linux:
tracepath example.com

# Count the hops. How many networks did your packet cross?
```

### Exercise 4: Identify the Layers

For each of the following, identify which network layer is primarily involved:

1. Your Wi-Fi password
2. The IP address `192.168.1.1`
3. Port 443
4. A `GET /api/users` request
5. Your network card's MAC address
6. The physical Ethernet cable plugged into your laptop

Answers: 1-Physical/Link, 2-Network, 3-Transport, 4-Application, 5-Link,
6-Physical

---

Next: [Lesson 02: Physical & Link Layer](./02-physical-link.md)
