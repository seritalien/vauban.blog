# Architecture Patterns & Design Principles

> Reference for software design, refactoring, and architectural decisions

---

## SOLID Principles

### S — Single Responsibility Principle

> A class/module should have one, and only one, reason to change.

```python
# ❌ VIOLATION — Multiple responsibilities
class UserService:
    def create_user(self, data): ...
    def send_welcome_email(self, user): ...    # Email responsibility
    def generate_pdf_report(self, user): ...   # Reporting responsibility
    def validate_credit_card(self, card): ...  # Payment responsibility

# ✅ CORRECT — Single responsibility each
class UserService:
    def create_user(self, data): ...
    def get_user(self, user_id): ...
    def update_user(self, user_id, data): ...

class EmailService:
    def send_welcome_email(self, user): ...

class ReportService:
    def generate_pdf_report(self, user): ...
```

### O — Open/Closed Principle

> Open for extension, closed for modification.

```typescript
// ❌ VIOLATION — Must modify to add new payment types
class PaymentProcessor {
  process(payment: Payment) {
    if (payment.type === "credit") {
      // Credit card logic
    } else if (payment.type === "paypal") {
      // PayPal logic
    } else if (payment.type === "crypto") {
      // Must modify this class for each new type!
    }
  }
}

// ✅ CORRECT — Extend without modifying
interface PaymentHandler {
  canHandle(payment: Payment): boolean;
  process(payment: Payment): Promise<Result>;
}

class CreditCardHandler implements PaymentHandler { ... }
class PayPalHandler implements PaymentHandler { ... }
class CryptoHandler implements PaymentHandler { ... }  // Just add new class

class PaymentProcessor {
  constructor(private handlers: PaymentHandler[]) {}
  
  async process(payment: Payment): Promise<Result> {
    const handler = this.handlers.find(h => h.canHandle(payment));
    if (!handler) throw new UnsupportedPaymentError(payment.type);
    return handler.process(payment);
  }
}
```

### L — Liskov Substitution Principle

> Subtypes must be substitutable for their base types.

```python
# ❌ VIOLATION — Square violates Rectangle's contract
class Rectangle:
    def set_width(self, w): self._width = w
    def set_height(self, h): self._height = h
    def area(self): return self._width * self._height

class Square(Rectangle):
    def set_width(self, w):
        self._width = w
        self._height = w  # Violates expectation!

# Client code breaks:
def test_area(rect: Rectangle):
    rect.set_width(5)
    rect.set_height(10)
    assert rect.area() == 50  # Fails for Square!

# ✅ CORRECT — Use composition or separate hierarchies
class Shape(ABC):
    @abstractmethod
    def area(self) -> float: ...

class Rectangle(Shape):
    def __init__(self, width: float, height: float): ...
    
class Square(Shape):
    def __init__(self, side: float): ...
```

### I — Interface Segregation Principle

> Clients should not depend on interfaces they don't use.

```typescript
// ❌ VIOLATION — Fat interface
interface Worker {
  work(): void;
  eat(): void;
  sleep(): void;
  attendMeeting(): void;
}

// Robot can't eat or sleep!
class Robot implements Worker {
  work() { ... }
  eat() { throw new Error("Robots don't eat"); }  // Forced to implement
  sleep() { throw new Error("Robots don't sleep"); }
  attendMeeting() { ... }
}

// ✅ CORRECT — Segregated interfaces
interface Workable {
  work(): void;
}

interface Feedable {
  eat(): void;
}

interface Sleepable {
  sleep(): void;
}

class Human implements Workable, Feedable, Sleepable { ... }
class Robot implements Workable { ... }  // Only implements what it needs
```

### D — Dependency Inversion Principle

> Depend on abstractions, not concretions.

```python
# ❌ VIOLATION — High-level depends on low-level
class UserService:
    def __init__(self):
        self.db = PostgresDatabase()  # Concrete dependency
        self.email = SendGridClient()  # Concrete dependency

# ✅ CORRECT — Depend on abstractions
from abc import ABC, abstractmethod

class Database(ABC):
    @abstractmethod
    def save(self, entity): ...

class EmailClient(ABC):
    @abstractmethod
    def send(self, to, subject, body): ...

class UserService:
    def __init__(self, db: Database, email: EmailClient):
        self.db = db
        self.email = email

# Inject dependencies
service = UserService(
    db=PostgresDatabase(),
    email=SendGridClient(),
)
```

---

## DRY — Don't Repeat Yourself

> Every piece of knowledge must have a single, unambiguous representation.

```python
# ❌ VIOLATION — Repeated tax calculation logic
def calculate_order_total(items):
    subtotal = sum(item.price for item in items)
    tax = subtotal * 0.20  # 20% VAT
    return subtotal + tax

def calculate_invoice_total(line_items):
    subtotal = sum(item.amount for item in line_items)
    tax = subtotal * 0.20  # Same calculation repeated!
    return subtotal + tax

# ✅ CORRECT — Single source of truth
TAX_RATE = Decimal("0.20")  # Defined once

def calculate_tax(amount: Decimal) -> Decimal:
    return amount * TAX_RATE

def calculate_order_total(items):
    subtotal = sum(item.price for item in items)
    return subtotal + calculate_tax(subtotal)

def calculate_invoice_total(line_items):
    subtotal = sum(item.amount for item in line_items)
    return subtotal + calculate_tax(subtotal)
```

---

## KISS — Keep It Simple, Stupid

> The simplest solution is usually the best.

```typescript
// ❌ OVER-ENGINEERED
class UserFactory {
  private static instance: UserFactory;
  private constructor() {}
  
  static getInstance(): UserFactory {
    if (!UserFactory.instance) {
      UserFactory.instance = new UserFactory();
    }
    return UserFactory.instance;
  }
  
  createUser(data: UserDTO): User {
    const builder = new UserBuilder();
    return builder
      .setName(data.name)
      .setEmail(data.email)
      .setRole(data.role)
      .build();
  }
}

// Usage: UserFactory.getInstance().createUser(data)

// ✅ SIMPLE — Just a function
function createUser(data: UserDTO): User {
  return {
    id: generateId(),
    name: data.name,
    email: data.email,
    role: data.role,
    createdAt: new Date(),
  };
}

// Usage: createUser(data)
```

---

## YAGNI — You Aren't Gonna Need It

> Don't add functionality until it's needed.

```python
# ❌ VIOLATION — Speculative generality
class DataExporter:
    """Supports 15 export formats we might need someday."""
    
    def export_csv(self, data): ...
    def export_json(self, data): ...
    def export_xml(self, data): ...
    def export_yaml(self, data): ...
    def export_excel(self, data): ...
    def export_pdf(self, data): ...
    # ... 9 more formats nobody asked for

# ✅ CORRECT — Only what's needed now
class DataExporter:
    """Exports to CSV and JSON (the only formats clients use)."""
    
    def export_csv(self, data): ...
    def export_json(self, data): ...
    
    # Add more formats when actually needed
```

---

## Clean Architecture

### Layer Separation

```
┌─────────────────────────────────────────────────────────────┐
│                      Frameworks & Drivers                    │
│  (Web, DB, External APIs, UI)                               │
├─────────────────────────────────────────────────────────────┤
│                    Interface Adapters                        │
│  (Controllers, Gateways, Presenters)                        │
├─────────────────────────────────────────────────────────────┤
│                    Application Layer                         │
│  (Use Cases, Application Services)                          │
├─────────────────────────────────────────────────────────────┤
│                      Domain Layer                            │
│  (Entities, Value Objects, Domain Services)                 │
└─────────────────────────────────────────────────────────────┘

Dependencies point INWARD only.
Inner layers know nothing about outer layers.
```

### Project Structure

```
src/
├── domain/                    # Core business logic (no dependencies)
│   ├── entities/
│   │   └── User.ts
│   ├── value_objects/
│   │   └── Email.ts
│   ├── repositories/          # Interfaces only
│   │   └── IUserRepository.ts
│   └── services/
│       └── PasswordHasher.ts
│
├── application/               # Use cases (depends on domain)
│   ├── use_cases/
│   │   ├── CreateUser.ts
│   │   └── AuthenticateUser.ts
│   └── dto/
│       └── UserDTO.ts
│
├── infrastructure/            # External concerns (depends on application)
│   ├── database/
│   │   └── PostgresUserRepository.ts
│   ├── external/
│   │   └── StripePaymentGateway.ts
│   └── security/
│       └── BcryptPasswordHasher.ts
│
└── presentation/              # UI/API (depends on application)
    ├── api/
    │   └── routes/
    │       └── userRoutes.ts
    └── web/
        └── components/
```

---

## Hexagonal Architecture (Ports & Adapters)

```
                    ┌─────────────────────────┐
                    │                         │
    ┌───────────────┤    Application Core     ├───────────────┐
    │               │                         │               │
    │               │  ┌─────────────────┐   │               │
    │               │  │  Domain Model   │   │               │
    │   PRIMARY     │  └─────────────────┘   │   SECONDARY   │
    │   PORTS       │  ┌─────────────────┐   │   PORTS       │
    │   (Driving)   │  │   Use Cases     │   │   (Driven)    │
    │               │  └─────────────────┘   │               │
    │               │                         │               │
    └───────┬───────┴─────────────────────────┴───────┬───────┘
            │                                         │
    ┌───────▼───────┐                         ┌───────▼───────┐
    │   ADAPTERS    │                         │   ADAPTERS    │
    │   (Driving)   │                         │   (Driven)    │
    ├───────────────┤                         ├───────────────┤
    │ REST API      │                         │ PostgreSQL    │
    │ GraphQL       │                         │ Redis         │
    │ CLI           │                         │ S3            │
    │ Message Queue │                         │ Email Service │
    └───────────────┘                         └───────────────┘
```

---

## Design Patterns Quick Reference

### Creational Patterns

| Pattern | Use When |
|---------|----------|
| **Factory** | Object creation logic is complex or varies |
| **Builder** | Object has many optional parameters |
| **Singleton** | Only one instance should exist (use sparingly!) |

### Structural Patterns

| Pattern | Use When |
|---------|----------|
| **Adapter** | Integrate incompatible interfaces |
| **Decorator** | Add behavior without modifying class |
| **Facade** | Simplify complex subsystem |
| **Composite** | Tree structures with uniform treatment |

### Behavioral Patterns

| Pattern | Use When |
|---------|----------|
| **Strategy** | Multiple algorithms, selected at runtime |
| **Observer** | Objects need to react to state changes |
| **Command** | Encapsulate requests as objects |
| **State** | Behavior changes based on internal state |

---

## Refactoring Red Flags

### Code Smells to Address

| Smell | Symptom | Refactoring |
|-------|---------|-------------|
| **Long Method** | > 20 lines | Extract Method |
| **Large Class** | > 200 lines | Extract Class |
| **Long Parameter List** | > 3 params | Introduce Parameter Object |
| **Duplicated Code** | Same code in multiple places | Extract Method/Class |
| **Feature Envy** | Method uses another class more than its own | Move Method |
| **Data Clumps** | Same data groups appear together | Extract Class |
| **Primitive Obsession** | Primitives instead of small objects | Replace with Value Object |
| **Switch Statements** | Type-checking switch/if | Replace with Polymorphism |
| **Speculative Generality** | Unused abstractions | Remove |
| **Dead Code** | Unreachable code | Delete |

---

## Decision Framework

When facing architectural decisions:

1. **Start simple** — KISS, YAGNI
2. **Identify pain points** — What problems are we solving?
3. **Consider trade-offs** — Complexity vs. flexibility
4. **Document decisions** — ADRs (Architecture Decision Records)
5. **Revisit when needed** — Refactor as requirements clarify

### ADR Template

```markdown
# ADR-001: Use PostgreSQL for Primary Database

## Status
Accepted

## Context
We need a primary database for the application.

## Decision
We will use PostgreSQL 16.

## Consequences
### Positive
- ACID compliance for financial transactions
- Rich JSON support for flexible schemas
- Excellent ecosystem and tooling

### Negative
- Requires managed hosting or ops expertise
- Horizontal scaling requires additional tools
```

---

*Apply these principles thoughtfully — they are guidelines, not dogma.*
