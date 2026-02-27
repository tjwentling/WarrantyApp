# WarrantyApp — Project Plan

## What Is This App?

WarrantyApp helps people track everything they own, register warranties, and get automatic alerts when any of their products are recalled by the government or a manufacturer. It also lets users transfer ownership of items (along with all warranty/recall history) to another person.

---

## Who Is It For?

Anyone who owns stuff — consumers who want peace of mind that they'll be notified if something they own is recalled (appliances, electronics, vehicles, baby products, food, etc.).

---

## Core Features (Plain English)

### 1. My Possessions
- Add items you own (name, brand, model, serial number, purchase date, receipt photo)
- View a simple list/dashboard of everything you own
- Tag items by category (Electronics, Appliances, Vehicles, Furniture, Toys, etc.)

### 2. Warranty Registration
- Store warranty info for each item (length, expiration date, what's covered)
- Get a reminder before a warranty expires
- Upload proof of purchase / warranty documents

### 3. Recall Alerts
- Automatically check government recall databases for every product you've registered
- Push notification the moment one of your items is recalled
- Show the full recall notice (what's wrong, what to do, how to get a refund/fix)
- Notification history log per item

### 4. Ownership Transfer
- Transfer any item to another WarrantyApp user (by email or username)
- All recall history, warranty info, and future notifications transfer with the item
- The old owner no longer receives notifications; the new owner does
- Transfer receipt/log is kept for both parties

---

## Government Recall Data Sources (US)

| Authority | What They Cover | API / Data Feed |
|---|---|---|
| CPSC (Consumer Product Safety Commission) | Electronics, toys, appliances, baby products, furniture | recall.gov + CPSC API |
| NHTSA (National Highway Traffic Safety Administration) | Vehicles, tires, car seats | api.nhtsa.dot.gov |
| FDA (Food & Drug Administration) | Food, drugs, medical devices, cosmetics | open.fda.gov |
| USDA FSIS | Meat, poultry, egg products | fsis.usda.gov/recalls |
| EPA | Pesticides, certain consumer products | epa.gov/recalls |
| CPSC + recall.gov | Aggregated cross-agency recalls | recall.gov (unified) |

All of these are free, publicly accessible APIs. We poll them regularly (e.g., every 6 hours) and match new recalls against user-registered products.

---

## Tech Stack

### Mobile App (iOS + Android)
- **Framework:** React Native with Expo (single codebase for both platforms)
- **UI:** NativeWind (Tailwind CSS for React Native)
- **Navigation:** Expo Router

### Backend & Database
- **Platform:** Supabase (PostgreSQL database + Auth + Storage + Realtime)
- **Auth:** Supabase Auth (email/password + social login)
- **Storage:** Supabase Storage (receipt photos, warranty docs)
- **Push Notifications:** Expo Push Notifications + Supabase Edge Functions

### Recall Engine (Background Service)
- **Supabase Edge Functions** (Deno) — scheduled jobs that:
  1. Fetch new recalls from all government APIs
  2. Match recalls against registered products
  3. Send push notifications to affected users

### Infrastructure
- **Hosting:** Supabase (fully managed)
- **CI/CD:** GitHub Actions
- **Repo:** GitHub (WarrantyApp)

---

## Database Structure (Simple View)

```
users
  └── id, email, name, push_token

items (possessions)
  └── id, user_id, name, brand, model, serial_number, category, purchase_date, receipt_url

warranties
  └── id, item_id, start_date, end_date, coverage_notes, document_url

recalls
  └── id, source (CPSC/NHTSA/FDA/etc.), recall_id, title, description, affected_products, date_issued

item_recalls (matches between a user's item and a recall)
  └── id, item_id, recall_id, notified_at

notifications
  └── id, user_id, item_id, recall_id, message, read_at

ownership_transfers
  └── id, item_id, from_user_id, to_user_id, transferred_at
```

---

## App Screens

1. **Home / Dashboard** — summary of items owned, active warranties, unread recall alerts
2. **My Items** — list of all possessions, tap to view details
3. **Add Item** — form to register a new possession
4. **Item Detail** — warranty info, recall history, transfer option
5. **Recall Alerts** — full notification feed, filtered by item
6. **Transfer Item** — search for recipient user, confirm transfer
7. **Profile / Settings** — account info, notification preferences

---

## Build Phases

### Phase 1 — Foundation (Weeks 1–3)
- Supabase project setup (database, auth, storage)
- GitHub repo, CI/CD pipeline
- Expo project scaffold
- User registration & login
- Add/view items (basic)

### Phase 2 — Recall Engine (Weeks 4–6)
- Integrate CPSC, NHTSA, FDA APIs
- Build recall matching logic
- Push notification delivery
- Notification history screen

### Phase 3 — Warranty & Transfers (Weeks 7–9)
- Warranty registration & expiry reminders
- Ownership transfer flow
- Item detail screen with full history

### Phase 4 — Polish & Launch (Weeks 10–12)
- UI polish, onboarding flow
- App Store & Google Play submission
- Beta testing

---

## What Makes This Valuable

1. **Passive protection** — users don't have to check anything; recalls find them
2. **All-in-one** — warranties, receipts, recalls in one place
3. **Transfer history** — buying/selling used goods with full provenance
4. **Cross-agency** — covers CPSC + NHTSA + FDA + USDA, not just one source
