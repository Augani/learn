# Lesson 4: Networking (VPC)

## The Big Analogy: Building a Secure Office Complex

Think of a VPC as designing an office building:

```
THE INTERNET (Public Road)
        |
  +-----+-----+ Internet Gateway (Front Door)
  |           |
  | VPC: 10.0.0.0/16 (Your Office Complex)           |
  | +-------------------------------------------+     |
  | |  PUBLIC SUBNET (Lobby/Reception)           |     |
  | |  10.0.1.0/24                               |     |
  | |  +-------------+  +-------------------+   |     |
  | |  | Load        |  | NAT Gateway       |   |     |
  | |  | Balancer    |  | (Receptionist who |   |     |
  | |  | (Reception  |  |  forwards mail    |   |     |
  | |  |  desk)      |  |  for back office) |   |     |
  | |  +-------------+  +-------------------+   |     |
  | +-------------------------------------------+     |
  |        |                    |                      |
  | +-------------------------------------------+     |
  | |  PRIVATE SUBNET (Back Office)              |     |
  | |  10.0.2.0/24                               |     |
  | |  +-------------+  +-------------------+   |     |
  | |  | App Servers |  | Database Servers  |   |     |
  | |  | (Workers)   |  | (Filing Room)     |   |     |
  | |  +-------------+  +-------------------+   |     |
  | |  Can reach internet via NAT (outbound)    |     |
  | |  Cannot be reached from internet (inbound)|     |
  | +-------------------------------------------+     |
  +---------------------------------------------------+
```

## VPC CIDR Blocks

Every VPC needs an IP address range using CIDR notation.

```
CIDR NOTATION CHEAT SHEET

  10.0.0.0/16  = 65,536 IPs  (10.0.0.0 - 10.0.255.255)
  10.0.0.0/24  = 256 IPs     (10.0.0.0 - 10.0.0.255)
  10.0.0.0/28  = 16 IPs      (10.0.0.0 - 10.0.0.15)

  /16 = VPC level (whole building)
  /24 = Subnet level (one floor)

  COMMON LAYOUT:
  VPC:              10.0.0.0/16
    Public-AZ-a:    10.0.1.0/24
    Public-AZ-b:    10.0.2.0/24
    Private-AZ-a:   10.0.10.0/24
    Private-AZ-b:   10.0.11.0/24
    Database-AZ-a:  10.0.20.0/24
    Database-AZ-b:  10.0.21.0/24
```

## Multi-AZ VPC Architecture

```
              INTERNET
                 |
          +------+------+
          | Internet GW  |
          +------+------+
                 |
  +--------------+--------------+
  |     AZ-a     |     AZ-b     |
  |              |              |
  | +----------+ | +----------+ |
  | |Public    | | |Public    | |
  | |10.0.1/24| | |10.0.2/24| |
  | | ALB     | | | ALB     | |
  | | NAT GW  | | | NAT GW  | |
  | +----+-----+ | +----+-----+ |
  |      |       |      |       |
  | +----+-----+ | +----+-----+ |
  | |Private   | | |Private   | |
  | |10.0.10/24| | |10.0.11/24| |
  | | App      | | | App      | |
  | | Servers  | | | Servers  | |
  | +----+-----+ | +----+-----+ |
  |      |       |      |       |
  | +----+-----+ | +----+-----+ |
  | |Data      | | |Data      | |
  | |10.0.20/24| | |10.0.21/24| |
  | | RDS      | | | RDS      | |
  | | (primary)| | | (replica)| |
  | +----------+ | +----------+ |
  +--------------+--------------+
```

## Security Groups vs NACLs

```
SECURITY GROUPS (Apartment Lock)      NACLs (Building Gate)
+------------------------------+     +------------------------------+
| Attached to ENI (instance)   |     | Attached to subnet           |
| Stateful: return traffic     |     | Stateless: must allow both   |
|   auto-allowed               |     |   inbound AND outbound       |
| Allow rules only             |     | Allow AND deny rules         |
| All rules evaluated          |     | Rules evaluated in order     |
+------------------------------+     +------------------------------+

  TRAFFIC FLOW:
  Internet --> NACL (subnet) --> Security Group (instance) --> App

  Example Security Group:
  +-------+----------+--------+-------------------+
  | Type  | Protocol | Port   | Source            |
  +-------+----------+--------+-------------------+
  | HTTP  | TCP      | 80     | 0.0.0.0/0        |
  | HTTPS | TCP      | 443    | 0.0.0.0/0        |
  | SSH   | TCP      | 22     | 10.0.0.0/16      |
  | App   | TCP      | 8080   | sg-loadbalancer  |
  +-------+----------+--------+-------------------+
```

## VPC with Terraform

```hcl
resource "aws_vpc" "main" {
  cidr_block           = "10.0.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "main-vpc"
  }
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
}

resource "aws_subnet" "public" {
  count                   = 2
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.0.${count.index + 1}.0/24"
  availability_zone       = data.aws_availability_zones.available.names[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "public-${count.index + 1}"
  }
}

resource "aws_subnet" "private" {
  count             = 2
  vpc_id            = aws_vpc.main.id
  cidr_block        = "10.0.${count.index + 10}.0/24"
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "private-${count.index + 1}"
  }
}

resource "aws_eip" "nat" {
  domain = "vpc"
}

resource "aws_nat_gateway" "main" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public[0].id
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main.id
  }
}

resource "aws_route_table_association" "public" {
  count          = 2
  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count          = 2
  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}
```

### Security Group with Terraform

```hcl
resource "aws_security_group" "web" {
  name_prefix = "web-"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

## NAT Gateway vs Internet Gateway

```
INTERNET GATEWAY                NAT GATEWAY
(Front Door - two way)          (Mail Forwarding - one way out)

Internet <---> Public Subnet    Private Subnet ---> Internet
                                Internet -X-> Private Subnet

Used by:                        Used by:
  Load balancers                  App servers pulling updates
  Bastion hosts                   Containers pulling images
  Public-facing services          Lambda in VPC calling APIs
```

## VPN and Direct Connect

```
YOUR OFFICE                           AWS VPC
+------------+   VPN (encrypted       +------------+
|            |   tunnel over          |            |
| On-Prem    |===== internet ========| Cloud      |
| Network    |                        | Resources  |
|            |   Direct Connect       |            |
| 192.168.x  |------ dedicated ------| 10.0.x     |
|            |   fiber line           |            |
+------------+                        +------------+

VPN:             Cheap, encrypted, over public internet, variable latency
Direct Connect:  Expensive, dedicated line, consistent latency, higher bandwidth
```

**GCP equivalents**: VPC (VPC), Cloud NAT (NAT Gateway), Cloud VPN (VPN), Cloud Interconnect (Direct Connect)

## Exercises

1. Create a VPC with 2 public and 2 private subnets across 2
   AZs using Terraform. Include an internet gateway and NAT
   gateway. Run `terraform plan` to verify.

2. Create a security group that allows:
   - HTTP (80) and HTTPS (443) from anywhere
   - SSH (22) only from your IP
   - All outbound traffic

3. Launch an EC2 instance in a private subnet. Verify it can
   reach the internet (via NAT) for updates but cannot be
   reached directly from the internet.

4. Draw the network diagram for a 3-tier application:
   - Load balancer in public subnet
   - App servers in private subnet
   - Database in isolated subnet
   Show which security group rules connect each tier.

5. Your company needs to connect their office network (192.168.0.0/16)
   to a VPC (10.0.0.0/16). Compare VPN vs Direct Connect for
   a workload that transfers 500 GB/day with sub-10ms latency needs.

---

[Next: Lesson 5 - IAM & Access Control](05-iam.md)
