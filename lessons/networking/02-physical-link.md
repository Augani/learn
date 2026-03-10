# Lesson 02: Physical & Link Layer -- Cables, Wi-Fi, MAC Addresses

These two bottom layers handle getting data across a single physical link --
from your laptop to your router, from one switch to another, from a server to
the data center network. Application developers rarely interact with these
layers directly, but understanding them removes the magic from how devices
actually communicate.

---

## Physical Layer: The Actual Signal

The physical layer is the real, tangible stuff: copper wires, fiber optic
cables, radio waves. It converts bits (0s and 1s) into a signal that can
travel across a medium.

### Types of Physical Media

```
Medium          Speed            Distance         Use Case
-----------     ---------------  ---------------  ----------------------
Copper (Cat6)   Up to 10 Gbps    ~100 meters      Office/home LAN
Fiber Optic     Up to 400 Gbps   Kilometers       Data centers, backbones
Wi-Fi 6 (ax)    Up to 9.6 Gbps   ~50 meters       Wireless LAN
Satellite       ~100 Mbps        36,000 km (GEO)  Remote areas
```

**Copper (Ethernet cable):** Electrical signals over twisted pairs of copper
wire. The cable you plug into your laptop or the back of a router. Category 5e
(Cat5e) supports 1 Gbps. Category 6 (Cat6) supports up to 10 Gbps. Cheap and
practical for short distances.

**Fiber optic:** Pulses of light through a glass strand thinner than a hair.
Faster, longer range, and immune to electrical interference. The undersea
cables that connect continents are fiber optic bundles. Data centers use fiber
between racks.

**Wi-Fi:** Radio waves in the 2.4 GHz or 5 GHz spectrum. Same idea as
Ethernet, but wireless. Shares a medium (air), which creates unique challenges
around interference and collisions.

### The Analogy

Think of the physical layer as the **road** in a postal system. Whether it is
a dirt path, a paved highway, or a ferry across water, the job is the same:
move the vehicle (signal) from point A to point B. The higher layers do not
care what kind of road it is, as long as the data arrives.

---

## Link Layer: Getting a Frame Across the Local Network

The link layer organizes bits into **frames** and handles delivery between
devices on the same local network (LAN). It answers: "Given that I'm
physically connected to several devices, how do I send data to the right one?"

### Ethernet Frames

Ethernet is the dominant link-layer protocol. An Ethernet frame looks like
this:

```
+----------+----------+------+-----------------------------+-----+
| Dst MAC  | Src MAC  | Type |         Payload             | FCS |
| 6 bytes  | 6 bytes  | 2 B  |    46 - 1500 bytes          | 4 B |
+----------+----------+------+-----------------------------+-----+

Dst MAC:  Where this frame should go (hardware address of next device)
Src MAC:  Where this frame came from
Type:     What protocol is inside (0x0800 = IPv4, 0x86DD = IPv6)
Payload:  The IP packet from the layer above
FCS:      Frame Check Sequence -- a checksum to detect corruption
```

The minimum frame size is 64 bytes. The maximum is 1518 bytes (or 9000+ bytes
with jumbo frames). If your IP packet plus headers exceeds the Maximum
Transmission Unit (MTU, typically 1500 bytes of payload), it must be
fragmented.

---

## MAC Addresses: Hardware Identity

Every network interface card (NIC) has a **MAC address** (Media Access Control
address) burned into it at the factory. It is a 48-bit (6-byte) identifier,
written as six pairs of hex digits:

```
AA:BB:CC:DD:EE:FF

First 3 bytes (AA:BB:CC) = OUI (Organizationally Unique Identifier)
                           Identifies the manufacturer
                           e.g., Apple, Intel, Cisco

Last 3 bytes (DD:EE:FF)  = Device-specific identifier
                           Unique within that manufacturer
```

### MAC vs IP: Two Different Addressing Systems

This confuses people: why do we need both MAC addresses and IP addresses?

| Property     | MAC Address              | IP Address              |
|-------------|--------------------------|-------------------------|
| Scope       | Local network only       | Global (across internet)|
| Assigned by | Manufacturer (hardware)  | Network admin / DHCP    |
| Changes?    | No (burned in)           | Yes (changes by network)|
| Layer       | Link (Layer 2)           | Network (Layer 3)       |
| Analogy     | VIN number on a car      | Street address          |

Your car's VIN never changes, no matter where you park it. But the street
address where you park changes depending on where you drive. Same idea: your
MAC address is permanent identity; your IP address is your current location on
the network.

**MAC addresses are only used locally.** When a packet crosses a router to
another network, the Ethernet frame is stripped off and a new frame with new
source/destination MACs is created for the next hop. The IP addresses stay the
same end-to-end.

```
Your Laptop         Router A          Router B          Server
MAC: AA:AA          MAC: BB:BB        MAC: CC:CC        MAC: DD:DD
IP:  192.168.1.5    IP: varies        IP: varies        IP: 93.184.216.34

Frame 1 (your LAN):
  Src MAC: AA:AA    Dst MAC: BB:BB    [IP: 192.168.1.5 -> 93.184.216.34]

Frame 2 (ISP network):
  Src MAC: BB:BB    Dst MAC: CC:CC    [IP: 192.168.1.5 -> 93.184.216.34]
                                       ^-- same IP addresses!

Frame 3 (destination LAN):
  Src MAC: CC:CC    Dst MAC: DD:DD    [IP: 192.168.1.5 -> 93.184.216.34]
```

Each hop creates a new Ethernet frame. IP addresses travel end-to-end. MAC
addresses are hop-to-hop.

---

## Switches: Connecting Devices on a LAN

A **switch** is a device that connects multiple devices on the same local
network. Unlike a simple hub (which broadcasts everything to everyone), a
switch learns which MAC address is connected to which port and forwards frames
only to the correct port.

```
        Port 1   Port 2   Port 3   Port 4
          |        |        |        |
       +--------------------------------------+
       |             SWITCH                    |
       |                                      |
       |  MAC Table:                          |
       |    AA:AA:AA -> Port 1                |
       |    BB:BB:BB -> Port 2                |
       |    CC:CC:CC -> Port 3                |
       |    DD:DD:DD -> Port 4                |
       +--------------------------------------+
          |        |        |        |
        Laptop   Desktop   Phone   Printer
        AA:AA    BB:BB     CC:CC   DD:DD
```

When the switch receives a frame destined for `BB:BB:BB`, it looks up its MAC
table and sends the frame only out Port 2. This is more efficient and more
secure than broadcasting to all ports.

**How does the switch learn?** When a frame arrives on Port 1 with source MAC
`AA:AA:AA`, the switch records "AA:AA:AA is on Port 1." Over time, it builds
a complete mapping. If it receives a frame for an unknown MAC, it floods the
frame to all ports (except the source) and learns from the response.

---

## ARP: Translating IP to MAC

Here is a practical problem: your machine knows the destination IP address
(from DNS), but Ethernet frames need MAC addresses. **ARP (Address Resolution
Protocol)** bridges this gap.

### How ARP Works

Scenario: Your laptop (192.168.1.5, MAC AA:AA) wants to send data to your
router (192.168.1.1, MAC ??:??).

```
Step 1: Laptop broadcasts ARP Request to ALL devices on the LAN
        "Who has IP 192.168.1.1? Tell 192.168.1.5"

+--------+     ARP Request (broadcast)     +--------+
| Laptop |  =============================> | Router |
| .1.5   |  "Who has 192.168.1.1?"         | .1.1   |
| AA:AA  |                                 | BB:BB  |
+--------+                                 +--------+
            (all devices hear this)

Step 2: Router responds with ARP Reply (unicast)
        "192.168.1.1 is at MAC BB:BB"

+--------+     ARP Reply (unicast)         +--------+
| Laptop |  <============================= | Router |
| .1.5   |  "I'm BB:BB"                   | .1.1   |
| AA:AA  |                                 | BB:BB  |
+--------+                                 +--------+

Step 3: Laptop caches the mapping
        ARP cache: 192.168.1.1 -> BB:BB (expires in ~5 min)

Step 4: Now laptop can build an Ethernet frame
        Dst MAC: BB:BB, Src MAC: AA:AA
```

### Viewing Your ARP Cache

```bash
# macOS / Linux
arp -a

# Example output:
# ? (192.168.1.1) at aa:bb:cc:dd:ee:ff on en0 [ethernet]
# ? (192.168.1.42) at 11:22:33:44:55:66 on en0 [ethernet]
```

ARP is only used on the local network. If the destination IP is outside your
subnet (which is most of the time), your machine sends the frame to the
router's MAC address instead, and the router takes care of forwarding.

---

## Wi-Fi: Wireless Ethernet

Wi-Fi is conceptually the same as Ethernet -- it delivers frames between
devices on a local network using MAC addresses. But because all devices share
the same medium (air), it has unique challenges.

### How Wi-Fi Differs from Ethernet

| Property          | Ethernet (Wired)         | Wi-Fi (Wireless)           |
|-------------------|--------------------------|----------------------------|
| Medium            | Dedicated cable          | Shared air                 |
| Collision handling| CSMA/CD (detect)         | CSMA/CA (avoid)            |
| Speed             | Up to 10 Gbps            | Up to 9.6 Gbps (Wi-Fi 6)  |
| Latency           | Very consistent          | More variable              |
| Security          | Physical access needed   | Anyone nearby can sniff    |

**CSMA/CD** (Ethernet): If two devices send at the same time and detect a
collision, they both stop, wait a random time, and retry.

**CSMA/CA** (Wi-Fi): Because wireless devices cannot detect collisions while
transmitting, Wi-Fi uses collision **avoidance**. Before transmitting, a device
listens to see if the channel is clear. If busy, it waits. It also uses
acknowledgments -- if the receiver does not ACK, the sender assumes a collision
and retries.

### Wi-Fi Access Points

A **wireless access point (AP)** is like a switch for Wi-Fi devices. Your home
router contains both a switch (for wired connections) and an AP (for wireless
connections). All devices connect through the AP, which bridges wireless traffic
to the wired network.

```
                     Internet
                        |
                   +--------+
                   | Router |   Has both:
                   | + AP   |   - Wired switch (Ethernet ports)
                   | + SW   |   - Wireless AP (Wi-Fi antenna)
                   +--------+
                   /    |    \
                 /      |      \
      (Wi-Fi)  /   (Ethernet)   \  (Wi-Fi)
        Phone      Desktop      Laptop
```

---

## Collision Domains and Broadcast Domains

**Collision domain:** The set of devices that can interfere with each other's
signals. Switches create separate collision domains per port (each device has
its own "lane"). Hubs put everyone in one collision domain.

**Broadcast domain:** The set of devices that receive broadcast frames (like
ARP requests). A switch does NOT separate broadcast domains -- all ports
receive broadcasts. A router DOES separate broadcast domains.

```
Hub (everyone collides):        Switch (isolated collision domains):

   A ---+--- B                    A ---[Port 1]
        |                               |
   Hub--+--- C                   Switch--[Port 2]--- B
        |                               |
   D ---+--- E                   C ---[Port 3]

   All 5 in same collision       Each port is its own
   domain AND broadcast          collision domain.
   domain.                       Still same broadcast domain.
```

---

## VLANs: Virtual LANs

A **VLAN** lets you split one physical switch into multiple logical networks.
Devices on different VLANs cannot communicate directly, even if they are
plugged into the same switch. This is how offices separate departments or guest
Wi-Fi from corporate networks.

```
Physical switch, two VLANs:

  VLAN 10 (Engineering)         VLAN 20 (Guest)
  +--------+  +--------+       +--------+  +--------+
  | Dev A  |  | Dev B  |       | Guest1 |  | Guest2 |
  +--------+  +--------+       +--------+  +--------+
      |            |                |            |
  [Port 1]    [Port 2]         [Port 3]    [Port 4]
  +-------------------------------------------------+
  |                  SWITCH                          |
  +-------------------------------------------------+

  Dev A can talk to Dev B (same VLAN 10).
  Guest1 can talk to Guest2 (same VLAN 20).
  Dev A CANNOT talk to Guest1 (different VLANs).
  A router is needed to bridge VLANs.
```

---

## Why Application Developers Should Care

You might think: "I write HTTP APIs, I never touch Ethernet frames." True, but
understanding these layers helps when:

1. **Debugging latency issues:** Is it the network? Wi-Fi interference? MTU
   mismatch causing fragmentation?

2. **Docker/Kubernetes networking:** Containers use virtual Ethernet bridges,
   VLANs, and virtual switches. Understanding the link layer demystifies
   container networking.

3. **Cloud networking:** AWS VPCs, security groups, and ENIs (Elastic Network
   Interfaces) are all abstractions over link-layer concepts.

4. **Performance tuning:** Jumbo frames (MTU 9000) can improve throughput in
   data center networks. Understanding MTU helps you understand why.

5. **Security:** ARP spoofing, MAC flooding, and Wi-Fi sniffing are real
   attack vectors. Understanding the link layer helps you understand the
   threat model.

---

## Exercises

### Exercise 1: Find Your MAC Address

```bash
# macOS
ifconfig en0 | grep ether

# Linux
ip link show

# Look for a line like:
# ether aa:bb:cc:dd:ee:ff
# That is your MAC address.
```

Look up the first 3 bytes (OUI) at https://maclookup.app to identify the
manufacturer of your network card.

### Exercise 2: View Your ARP Cache

```bash
# See what IP-to-MAC mappings your machine has learned:
arp -a

# Questions:
# 1. Can you find your router's MAC address?
# 2. How many devices are on your local network?
# 3. Clear the cache and ping a device -- what happens?
```

### Exercise 3: Observe Ethernet Frames with tcpdump

```bash
# Capture Ethernet frames (requires root/sudo):
sudo tcpdump -i en0 -e -c 10

# The -e flag shows Ethernet headers (MAC addresses)
# Look at the output:
# - Src and Dst MAC addresses
# - EtherType (IPv4, IPv6, ARP)
# - The payload summary
```

### Exercise 4: Watch an ARP Exchange

```bash
# In one terminal, start capturing ARP traffic:
sudo tcpdump -i en0 arp

# In another terminal, clear your ARP cache and ping a local device:
# macOS:
sudo arp -d -a
ping -c 1 192.168.1.1

# Watch the ARP request and reply appear in tcpdump.
# You should see:
#   "Who has 192.168.1.1? Tell 192.168.1.X"
#   "192.168.1.1 is-at aa:bb:cc:dd:ee:ff"
```

### Exercise 5: Identify Your Network Topology

Draw a diagram of your home or office network:
- What devices are connected?
- Which are wired vs wireless?
- What is the router's IP and MAC?
- Are there any switches?
- How many broadcast domains exist?

---

Next: [Lesson 03: IP -- Addressing and Routing](./03-ip-addressing.md)
