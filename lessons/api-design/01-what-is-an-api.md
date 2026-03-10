# Lesson 01: What Is an API?

## The Restaurant Menu Analogy

Think of a restaurant. You don't walk into the kitchen and cook your own food.
Instead, you use a **menu** -- it tells you what's available, how to order it,
and what you'll get back. The kitchen is a black box.

```
  +-------------+       +---------+       +-----------+
  |   You       | ----> |  Menu   | ----> |  Kitchen  |
  | (Client)    |       | (API)   |       | (Server)  |
  +-------------+       +---------+       +-----------+
       |                     |                  |
       | "I'd like the      | Translates to    | Prepares the
       |  Caesar salad"     | an order the     | response
       |                     | kitchen gets     |
       +---------------------+------------------+
                             |
                        Your salad arrives
```

An **API** (Application Programming Interface) is a contract between two systems.
It defines:

- **What you can ask for** (endpoints / operations)
- **How to ask** (request format)
- **What you'll get back** (response format)
- **What can go wrong** (error cases)

## APIs Are Everywhere

Every time you check the weather on your phone, your app calls a weather API.
Every time you pay online, the store calls a payment API. APIs are the glue
of the modern internet.

```
  +--------+          +--------+          +----------+
  | Mobile |--API---->| Server |--API---->| Database |
  |  App   |          |        |--API---->| Payment  |
  +--------+          |        |--API---->| Email    |
                      +--------+          +----------+

  +--------+          +--------+
  | Web    |--API---->| Same   |
  | App    |          | Server |
  +--------+          +--------+
```

## Types of APIs

```
  +----------------------------------------------------+
  |              API STYLES SPECTRUM                    |
  +----------------------------------------------------+
  |                                                    |
  |  REST        GraphQL       gRPC       WebSocket    |
  |  ~~~~        ~~~~~~~       ~~~~       ~~~~~~~~~    |
  |  HTTP-based  Query lang    Binary     Persistent   |
  |  Resources   Flexible      Fast       Realtime     |
  |  JSON        Schema        Protobuf   Bidirectional|
  |  Simple      Client-driven Streaming  Events       |
  |                                                    |
  +----------------------------------------------------+
```

We'll cover each of these in depth throughout this track.

## Your First API Call

Let's see an API in action. We'll call a public API.

### TypeScript

```typescript
async function fetchUser(): Promise<void> {
  const response = await fetch("https://jsonplaceholder.typicode.com/users/1");

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const user = await response.json();
  console.log(`Name: ${user.name}`);
  console.log(`Email: ${user.email}`);
  console.log(`City: ${user.address.city}`);
}

fetchUser().catch(console.error);
```

### Go

```go
package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
)

type User struct {
	Name  string `json:"name"`
	Email string `json:"email"`
	Address struct {
		City string `json:"city"`
	} `json:"address"`
}

func main() {
	resp, err := http.Get("https://jsonplaceholder.typicode.com/users/1")
	if err != nil {
		log.Fatal(err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		log.Fatalf("HTTP %d: %s", resp.StatusCode, resp.Status)
	}

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		log.Fatal(err)
	}

	fmt.Printf("Name: %s\nEmail: %s\nCity: %s\n", user.Name, user.Email, user.Address.City)
}
```

## The API Contract

An API contract specifies the agreement between client and server.
Think of it like a legal contract -- both sides have obligations.

```
  CLIENT PROMISES:                  SERVER PROMISES:
  +---------------------------+     +---------------------------+
  | - Send valid requests     |     | - Return promised data    |
  | - Include required fields |     | - Use agreed status codes |
  | - Authenticate properly   |     | - Handle errors gracefully|
  | - Respect rate limits     |     | - Stay backwards compat   |
  +---------------------------+     +---------------------------+
                  |                           |
                  +-----> THE CONTRACT <------+
```

Breaking this contract (on either side) causes problems.
A server changing its response format without warning breaks every client.
A client sending garbage data wastes server resources.

## Request-Response Cycle

Every API interaction follows the same basic pattern:

```
  Client                              Server
    |                                    |
    |  1. Build request                  |
    |  (method, URL, headers, body)      |
    |                                    |
    |----- HTTP Request ---------------->|
    |                                    |
    |                    2. Process       |
    |                    (validate,       |
    |                     compute,        |
    |                     fetch data)     |
    |                                    |
    |<---- HTTP Response ----------------|
    |  (status, headers, body)           |
    |                                    |
    |  3. Handle response                |
    |  (parse, display, retry?)          |
    |                                    |
```

## Key Vocabulary

| Term        | Restaurant Analogy        | API Meaning                     |
|-------------|---------------------------|---------------------------------|
| Endpoint    | A menu item               | A URL that accepts requests     |
| Request     | Placing an order          | Data sent from client to server |
| Response    | Getting your food         | Data sent from server to client |
| Payload     | The food on the plate     | The body of request/response    |
| Header      | Special instructions      | Metadata about the message      |
| Status Code | "Ready" / "86'd" / "Wait"| Numeric result indicator        |

## Exercises

1. **Run the code above.** Call the JSONPlaceholder API and print a user's info.

2. **Explore the API.** Try these URLs and observe the responses:
   - `https://jsonplaceholder.typicode.com/posts/1`
   - `https://jsonplaceholder.typicode.com/posts/1/comments`
   - `https://jsonplaceholder.typicode.com/users`

3. **Think about contracts.** You order a "Caesar salad" and get a "Greek salad."
   What went wrong in API terms? Who broke the contract?

4. **List 5 APIs you use daily** without realizing it (weather, maps, payments...).

---

[Next: Lesson 02 - REST Principles ->](02-rest-principles.md)
