# Locora database ER diagram
Source of truth: `services/api/prisma/schema.prisma`. Money is stored as integer **paise**. View this Mermaid diagram on GitHub or at mermaid.live.

```mermaid
erDiagram
  User ||--o{ SellerApplication : submits
  User ||--o{ Store : owns
  User ||--o{ Address : has
  User ||--o| Cart : has
  User ||--o{ WishlistItem : saves
  User ||--o{ Order : places
  User ||--o{ Delivery : "delivers (partner)"
  User ||--o{ AuditLog : "acts (admin)"
  User ||--o{ Review : writes
  User ||--o{ PasswordResetToken : requests
  Store ||--o{ Product : sells
  Store ||--o{ SellerFulfillment : fulfils
  Category ||--o{ Product : groups
  Product ||--o{ ProductImage : has
  Product ||--o{ CartItem : "in"
  Product ||--o{ WishlistItem : "in"
  Product ||--o{ OrderItem : "bought as"
  Product ||--o{ Review : receives
  Cart ||--o{ CartItem : contains
  Address ||--o{ Order : "ships to"
  Order ||--o{ SellerFulfillment : "split per store"
  Order ||--o{ OrderItem : contains
  Order ||--o{ Payment : "paid by"
  SellerFulfillment ||--o{ OrderItem : groups
  SellerFulfillment ||--o| Delivery : "assigned to"

  User { string id PK  string email UK  enum role  bool isActive  bool deliveryApproved }
  Store { string id PK  string ownerId FK  string name  string logoUrl  bool isActive }
  Product { string id PK  string storeId FK  string categoryId FK  int pricePaise  int stock  bool isActive  bool moderationBlocked }
  Order { string id PK  string userId FK  string addressId FK  enum status  int totalPaise  string idempotencyKey UK }
  SellerFulfillment { string id PK  string orderId FK  string storeId FK  enum status }
  OrderItem { string id PK  string productName  int unitPricePaise  int quantity }
  Payment { string id PK  enum method  enum status  int amountPaise  string providerOrderId UK  string providerPaymentId UK }
  Delivery { string id PK  string fulfillmentId UK  string partnerId FK  enum status }
```

**Multi-seller strategy:** one customer `Order` (the money the customer pays) is split into one `SellerFulfillment` per store. Each seller only sees and changes their own fulfillment. `OrderItem` stores the price and name at purchase time, so later price edits never change old orders.
**Anti-duplicate constraints:** `Order.idempotencyKey`, `Payment.providerOrderId`, `Payment.providerPaymentId`, `Delivery.fulfillmentId`, `Review(userId, productId)` are unique.
