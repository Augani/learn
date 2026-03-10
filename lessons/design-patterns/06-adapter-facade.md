# Lesson 06: Adapter and Facade

> **The one thing to remember**: An Adapter makes two incompatible
> things work together (like a travel plug adapter). A Facade gives
> you one simple door into a complicated building. Both reduce the
> pain of working with code that doesn't fit your needs.

---

## Adapter Pattern

### The Travel Adapter Analogy

You're traveling from the US to Europe. Your phone charger has a
US plug (two flat prongs), but the wall outlet expects a European
plug (two round prongs). The charger works fine. The outlet works
fine. They just don't fit together.

A travel adapter solves this. It doesn't change how your charger
works or how the outlet works — it sits between them and translates
one interface to another.

```
ADAPTER: MAKING INCOMPATIBLE THINGS FIT

  WITHOUT ADAPTER:
  ┌──────────┐     ╔══════════╗
  │ US Plug  │  ✗  ║ EU Outlet║   ← won't fit
  │ ▯ ▯      │     ║  ○  ○    ║
  └──────────┘     ╚══════════╝

  WITH ADAPTER:
  ┌──────────┐  ┌───────────┐  ╔══════════╗
  │ US Plug  │──│  Adapter  │──║ EU Outlet║   ← works!
  │ ▯ ▯      │  │ ▯▯ → ○○  │  ║  ○  ○    ║
  └──────────┘  └───────────┘  ╚══════════╝

  The adapter translates between two interfaces
  without changing either one.
```

### When You Need an Adapter

- You're using a third-party library whose API doesn't match yours
- You're integrating a legacy system with new code
- You're replacing one implementation with another that has a
  different interface
- You want to isolate your code from external API changes

### The Problem

```
YOUR CODE expects:                 THE LIBRARY provides:
  emailService.send(                 mailgun.messages().send({
    to: "alice@test.com",              from: "noreply@app.com",
    subject: "Hello",                  to: ["alice@test.com"],
    body: "Hi Alice"                   subject: "Hello",
  )                                    text: "Hi Alice"
                                     })

  Different method names, different parameter shapes,
  different calling conventions. They don't fit together.
```

### Adapter in TypeScript

```typescript
interface EmailService {
  send(to: string, subject: string, body: string): Promise<void>;
}

class MailgunClient {
  messages() {
    return {
      send: async (params: {
        from: string;
        to: string[];
        subject: string;
        text: string;
      }) => {
        // Mailgun-specific sending logic
      },
    };
  }
}

class MailgunAdapter implements EmailService {
  constructor(
    private client: MailgunClient,
    private fromAddress: string
  ) {}

  async send(to: string, subject: string, body: string): Promise<void> {
    await this.client.messages().send({
      from: this.fromAddress,
      to: [to],
      subject,
      text: body,
    });
  }
}

const emailService: EmailService = new MailgunAdapter(
  new MailgunClient(),
  "noreply@app.com"
);

await emailService.send("alice@test.com", "Hello", "Hi Alice");
```

If you switch from Mailgun to SendGrid, you write a new
`SendGridAdapter` that implements `EmailService`. Nothing else
in your application changes.

### Adapter in Python

```python
from abc import ABC, abstractmethod

class PaymentGateway(ABC):
    @abstractmethod
    def charge(self, amount_cents: int, currency: str, token: str) -> str:
        """Returns transaction ID."""
        ...

class StripeSDK:
    def create_charge(self, amount: int, currency: str,
                      source: str, description: str) -> dict:
        return {"id": "ch_123", "status": "succeeded"}

class StripeAdapter(PaymentGateway):
    def __init__(self, sdk: StripeSDK):
        self._sdk = sdk

    def charge(self, amount_cents: int, currency: str, token: str) -> str:
        result = self._sdk.create_charge(
            amount=amount_cents,
            currency=currency,
            source=token,
            description="Payment"
        )
        return result["id"]

gateway: PaymentGateway = StripeAdapter(StripeSDK())
transaction_id = gateway.charge(2999, "usd", "tok_visa")
```

### Adapter in Rust

```rust
trait Storage {
    fn read(&self, key: &str) -> Result<Vec<u8>, StorageError>;
    fn write(&self, key: &str, data: &[u8]) -> Result<(), StorageError>;
}

struct AwsS3Client {
    bucket: String,
}

impl AwsS3Client {
    fn get_object(&self, bucket: &str, key: &str) -> Result<Vec<u8>, S3Error> {
        // AWS S3 specific logic
        Ok(vec![])
    }

    fn put_object(&self, bucket: &str, key: &str, body: &[u8]) -> Result<(), S3Error> {
        // AWS S3 specific logic
        Ok(())
    }
}

struct S3Adapter {
    client: AwsS3Client,
}

impl Storage for S3Adapter {
    fn read(&self, key: &str) -> Result<Vec<u8>, StorageError> {
        self.client
            .get_object(&self.client.bucket, key)
            .map_err(|e| StorageError::ReadFailed(e.to_string()))
    }

    fn write(&self, key: &str, data: &[u8]) -> Result<(), StorageError> {
        self.client
            .put_object(&self.client.bucket, key, data)
            .map_err(|e| StorageError::WriteFailed(e.to_string()))
    }
}
```

### Adapter in Go

```go
type MessageSender interface {
    Send(to string, message string) error
}

type SlackAPI struct {
    token string
}

func (s *SlackAPI) PostMessage(channel string, blocks []Block) error {
    // Slack-specific API call
    return nil
}

type SlackAdapter struct {
    api *SlackAPI
}

func (a *SlackAdapter) Send(to string, message string) error {
    blocks := []Block{{Type: "section", Text: message}}
    return a.api.PostMessage(to, blocks)
}

var sender MessageSender = &SlackAdapter{api: &SlackAPI{token: "xoxb-..."}}
sender.Send("#general", "Deploy complete")
```

---

## Facade Pattern

### The Hotel Front Desk Analogy

A hotel has dozens of internal departments: housekeeping, kitchen,
maintenance, billing, concierge, valet, spa, laundry. As a guest,
you don't call each department directly. You call the **front desk**,
and they route your request to the right place.

The front desk is a Facade: one simple interface that hides the
complexity of the system behind it.

```
FACADE: ONE SIMPLE ENTRY POINT

  WITHOUT FACADE:
  ┌──────┐
  │ You  │──→ Call housekeeping
  │      │──→ Call kitchen
  │      │──→ Call billing
  │      │──→ Call maintenance
  │      │──→ Call concierge
  └──────┘
  You need to know 5 phone numbers and 5 different procedures.

  WITH FACADE:
  ┌──────┐     ┌────────────┐     ┌──────────────┐
  │ You  │──→  │ Front Desk │──→  │ Housekeeping │
  │      │     │  (Facade)  │──→  │ Kitchen      │
  └──────┘     │            │──→  │ Billing      │
               │            │──→  │ Maintenance  │
               └────────────┘──→  │ Concierge    │
                                  └──────────────┘
  You know one number. The front desk handles the rest.
```

### When You Need a Facade

- A subsystem has many classes and the API is confusing
- You want to provide a simpler interface for common use cases
- You want to decouple your code from a complex third-party library
- You're wrapping a multi-step process into a single call

### Facade in TypeScript

Imagine a video conversion system with many subsystems:

```typescript
class VideoFile {
  constructor(public path: string) {}
}

class AudioExtractor {
  extract(video: VideoFile): AudioTrack {
    return new AudioTrack(video.path);
  }
}

class VideoCompressor {
  compress(video: VideoFile, codec: string): CompressedVideo {
    return new CompressedVideo(video.path, codec);
  }
}

class AudioMixer {
  mix(audio: AudioTrack, volume: number): MixedAudio {
    return new MixedAudio(audio, volume);
  }
}

class SubtitleEncoder {
  encode(subtitlePath: string, format: string): EncodedSubtitles {
    return new EncodedSubtitles(subtitlePath, format);
  }
}

class OutputWriter {
  write(video: CompressedVideo, audio: MixedAudio,
        subs: EncodedSubtitles | null, outputPath: string): void {
    // combine everything and write to disk
  }
}

class VideoConverterFacade {
  private audioExtractor = new AudioExtractor();
  private compressor = new VideoCompressor();
  private mixer = new AudioMixer();
  private subtitleEncoder = new SubtitleEncoder();
  private writer = new OutputWriter();

  convert(inputPath: string, outputPath: string, codec: string): void {
    const video = new VideoFile(inputPath);
    const audio = this.audioExtractor.extract(video);
    const compressed = this.compressor.compress(video, codec);
    const mixed = this.mixer.mix(audio, 1.0);
    this.writer.write(compressed, mixed, null, outputPath);
  }

  convertWithSubtitles(inputPath: string, outputPath: string,
                       codec: string, subtitlePath: string): void {
    const video = new VideoFile(inputPath);
    const audio = this.audioExtractor.extract(video);
    const compressed = this.compressor.compress(video, codec);
    const mixed = this.mixer.mix(audio, 1.0);
    const subs = this.subtitleEncoder.encode(subtitlePath, "srt");
    this.writer.write(compressed, mixed, subs, outputPath);
  }
}

const converter = new VideoConverterFacade();
converter.convert("input.avi", "output.mp4", "h264");
```

The caller doesn't need to know about `AudioExtractor`,
`VideoCompressor`, `AudioMixer`, `SubtitleEncoder`, or
`OutputWriter`. They just call `convert()`.

### Facade in Python

```python
class UserRegistrationFacade:
    def __init__(self, user_repo, email_service, analytics,
                 permissions_service):
        self._repo = user_repo
        self._email = email_service
        self._analytics = analytics
        self._permissions = permissions_service

    def register(self, name: str, email: str) -> User:
        user = self._repo.create(name=name, email=email)
        self._permissions.assign_default_role(user.id)
        self._email.send_welcome(user.email, user.name)
        self._analytics.track("user_registered", {"user_id": user.id})
        return user
```

### Facade in Rust

```rust
struct DeploymentFacade {
    builder: ImageBuilder,
    registry: ContainerRegistry,
    orchestrator: KubernetesClient,
    monitor: HealthChecker,
}

impl DeploymentFacade {
    fn deploy(&self, app: &str, version: &str) -> Result<(), DeployError> {
        let image = self.builder.build(app, version)?;
        let tag = self.registry.push(&image)?;
        self.orchestrator.rolling_update(app, &tag)?;
        self.monitor.wait_healthy(app, Duration::from_secs(120))?;
        Ok(())
    }
}
```

### Facade in Go

```go
type OrderFacade struct {
    inventory  *InventoryService
    payment    *PaymentService
    shipping   *ShippingService
    notification *NotificationService
}

func (f *OrderFacade) PlaceOrder(customerID string, items []Item) (*Order, error) {
    if err := f.inventory.Reserve(items); err != nil {
        return nil, fmt.Errorf("reservation failed: %w", err)
    }

    total := f.inventory.CalculateTotal(items)

    receipt, err := f.payment.Charge(customerID, total)
    if err != nil {
        f.inventory.Release(items)
        return nil, fmt.Errorf("payment failed: %w", err)
    }

    tracking, err := f.shipping.Ship(customerID, items)
    if err != nil {
        f.payment.Refund(receipt.ID)
        f.inventory.Release(items)
        return nil, fmt.Errorf("shipping failed: %w", err)
    }

    f.notification.SendConfirmation(customerID, tracking)

    return &Order{Receipt: receipt, Tracking: tracking}, nil
}
```

---

## Adapter vs Facade

```
ADAPTER vs FACADE

  ADAPTER                          FACADE
  ─────────────────────────────    ─────────────────────────────
  Converts ONE interface           Simplifies a WHOLE subsystem
  to another                       into one entry point

  Works with one class             Wraps many classes

  Goal: compatibility              Goal: simplicity

  "Make this square peg            "Give me one button instead
   fit this round hole"             of this control panel"

  ┌───┐   ┌─────────┐   ┌───┐    ┌───┐   ┌────────┐   ┌───┐
  │ A │──→│ Adapter │──→│ B │    │ X │──→│ Facade │──→│ B │
  └───┘   └─────────┘   └───┘    └───┘   │        │──→│ C │
                                          │        │──→│ D │
                                          └────────┘   └───┘
```

---

## Real-World Examples

- **React**: `react-dom` is a Facade over the browser's DOM API
- **ORMs** (SQLAlchemy, TypeORM): Adapters that translate your
  objects to SQL and back
- **Logging libraries**: Facades over file I/O, formatting, rotation
- **HTTP clients** (axios, reqwest): Facades over low-level TCP
  socket management

---

## Exercises

1. **Adapter**: Write an adapter that makes a REST API client
   conform to a `DataSource` interface with `fetch(id)` and
   `save(id, data)` methods.

2. **Facade**: Create a facade for a "smart home" system that
   coordinates lights, thermostat, locks, and alarm into simple
   operations like `leaveHome()` and `arriveHome()`.

3. **Combined**: Build an email-sending facade that uses an adapter
   internally so you can swap between Mailgun and SendGrid.

4. **Identify**: Name three facades and three adapters in libraries
   or frameworks you use regularly.

---

[← Previous: Singleton and Prototype](./05-singleton-prototype.md) · [Next: Lesson 07 — Decorator and Proxy →](./07-decorator-proxy.md)
