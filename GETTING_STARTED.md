# WarrantyApp — Getting Started & Testing Guide
### For Non-Technical Users

---

## What Is This App?

WarrantyApp lets you track everything you own, store warranties, and get automatic government recall alerts — even while your phone is in your pocket. Scan a product's barcode to register it in seconds. When something you own is recalled, you get a push notification before you'd ever hear about it otherwise. You can also hand off items to another person, and their warranty and recall history transfers with them.

---

## Current Build Status

| Phase | What it includes | Status |
|---|---|---|
| Phase 1 | Login, add items, dashboard, search, categories | ✅ Complete |
| Phase 2 | Recall engine (CPSC, FDA, USDA, NHTSA), push notifications, cron jobs | ✅ Complete |
| Phase 3 | Warranty management, receipt photos, onboarding, transfer history | ✅ Complete |

**Live recall data:** 9,600+ CPSC recalls already in the database from the first run. New recalls are fetched automatically every 6 hours.

---

## What You Need

| Item | Status |
|---|---|
| Node.js on your computer | ✅ Already installed |
| This project folder | ✅ On your OneDrive at `WarrantyApp/app` |
| Expo Go app on your phone | ⬇️ Install from App Store or Play Store (free) |
| A Wi-Fi connection (phone + computer on same network) | Required |

---

## Step 1 — Install Expo Go on Your Phone

**iPhone:** App Store → search **"Expo Go"** → Install (free, by Expo)

**Android:** Play Store → search **"Expo Go"** → Install (free, by Expo)

> Expo Go is how you run the app on your phone without submitting to the App Store. Think of it as a preview launcher.

---

## Step 2 — Open a Terminal

**Windows:**
- Press `Windows key`, type `cmd`, press Enter
- A black window will open

**Mac:**
- Press `Cmd + Space`, type `Terminal`, press Enter

---

## Step 3 — Navigate to the App Folder

**Windows:** In the black cmd window, type:
```
cd "C:\Users\tjwen\OneDrive\WarrantyApp\app"
```
Then press Enter.

**Mac:**
```
cd ~/OneDrive/WarrantyApp/app
```

---

## Step 4 — Start the App

Type this and press Enter:
```
npm start
```

Wait about 30–45 seconds. A **QR code** will appear in the terminal window. Leave this window open the entire time you're testing.

---

## Step 5 — Open the App on Your Phone

**iPhone:**
1. Open the regular **Camera** app (not Expo Go)
2. Point it at the QR code on your screen
3. Tap the yellow banner at the top
4. Expo Go opens and loads the app automatically

**Android:**
1. Open **Expo Go**
2. Tap **"Scan QR code"**
3. Point at the QR code — app loads automatically

---

## Step 6 — Create Your Account

1. Tap **"Create one"** on the login screen
2. Enter your name, email address, and a password (at least 8 characters)
3. You'll get an email — open it and click the confirmation link
4. Return to the app and sign in

> **Important:** The confirmation email sometimes lands in spam. Check there if you don't see it within 2 minutes.

---

## Step 7 — Allow Notifications

When the app asks *"Allow WarrantyApp to send notifications?"* — tap **Allow**. This is how you receive recall alerts and warranty reminders. You can change this in your phone's Settings app if you decline by mistake.

---

## Complete Testing Checklist

Work through these in order. Check each one off as you go.

### Account & Login
- [ ] Create a new account
- [ ] Confirm email and sign in
- [ ] See the Home dashboard (shows 0 items to start)
- [ ] Sign out from the Profile tab
- [ ] Sign back in

---

### Adding Items

**Option A — Scan a barcode (recommended first test)**
- [ ] Tap **"+ Add"** on the Home screen
- [ ] Tap the blue **"Scan a Barcode"** banner at the top
- [ ] Grant camera permission when asked
- [ ] Point the camera at any product in your home — a cereal box, shampoo bottle, TV remote, appliance, etc.
- [ ] Watch the app look up the product automatically
- [ ] The form will be pre-filled — review it, then tap **Save Item**

**Option B — Type it in manually**
- [ ] Tap **"+ Add"** → ignore the scan banner → fill in the fields manually
- [ ] Try adding a car (Category: Vehicles), a TV (Electronics), and a kitchen appliance

**After adding items:**
- [ ] The Home dashboard now shows your item count
- [ ] Tap **"Items"** tab — see your list
- [ ] Try the search bar — type a brand name
- [ ] Try the category filter chips

---

### Warranty Registration
- [ ] When adding an item, scroll down and check **"Add warranty information"**
- [ ] Enter a start date and expiry date (try one expiring in 2 weeks to test reminders)
- [ ] Save the item
- [ ] Open the item — check the warranty section shows the correct status and time remaining
- [ ] Try the **"Add/Edit Warranty"** button on an item that doesn't have one yet
- [ ] Upload a photo of a receipt or warranty card

---

### Receipt & Warranty Document Upload
- [ ] Open any item → tap **"Add Receipt"** or the camera icon
- [ ] Choose a photo from your camera roll, or take a new photo
- [ ] The image uploads and appears on the item

---

### Recall Alerts
> **Note:** Recalls are matched automatically based on your registered items. The engine checks every 6 hours. To test immediately, add a product that you know has been recalled (e.g. search CPSC.gov for a brand you own).

- [ ] Open the **Alerts** tab
- [ ] If you have items matching known recalls, you'll see a red notification
- [ ] Tap an alert — see the full recall notice with hazard description and remedy
- [ ] Tap **"View Official Notice →"** to open the government recall page
- [ ] Tap **"Mark all read"** — the unread badge on the tab disappears
- [ ] The Home dashboard recall banner should also clear

**To trigger a test alert manually (developer shortcut):**
1. Go to **Supabase Dashboard** → supabase.com/dashboard/project/ikfuafcygrfwgayxzwbz
2. Open **Table Editor → recalls**
3. Insert a row with `source = 'CPSC'`, `external_id = 'TEST-001'`, `title = 'Test Recall'`, and `affected_products = [{"brand":"Samsung","name":"TV","category":"Electronics"}]`
4. Run the SQL function: `SELECT match_recalls_to_items();`
5. If you have a Samsung TV registered, you'll get a notification

---

### Ownership Transfer
- [ ] Create a **second account** (use a different email — maybe a personal email vs a work email)
- [ ] Sign into the second account on a different device (or ask someone to help)
- [ ] Back on your main account: open an item → tap **"Transfer Ownership"**
- [ ] Search the recipient by email
- [ ] Confirm the transfer
- [ ] Sign into the second account — the item should now appear in their Items list
- [ ] Verify the original owner no longer sees the item

---

### Transfer History
- [ ] Open a transferred item on the receiving account
- [ ] Scroll to the bottom — you'll see a **Ownership History** section showing the previous owner and transfer date

---

### Warranty Expiry Reminder (push notification)
> The reminder system runs automatically every day at 9:00 AM UTC. To test without waiting:

1. Add an item with a warranty expiring within 7 days of today
2. Go to Supabase Dashboard → **Edge Functions** → warranty-check → click **"Invoke"**
3. You should receive a push notification within a few seconds

---

### Profile
- [ ] Open the **Profile** tab
- [ ] Edit your display name
- [ ] Confirm the change saves
- [ ] Check the "Data Sources" section — CPSC, NHTSA, FDA, USDA should all show Active

---

## Stopping the App

In the terminal, press **Ctrl + C** (Windows/Mac) to stop. Your data is saved in the cloud — it will all be there next time.

---

## Troubleshooting

| Problem | What to do |
|---|---|
| QR code doesn't work | Your phone and computer must be on the **same Wi-Fi network** |
| App shows "Something went wrong" | Press Ctrl+C → type `npm start` again |
| App takes a long time to load | Normal on first load — give it 60 seconds |
| Camera won't open for barcode scan | Go to Settings → Expo Go → allow Camera |
| Push notifications not arriving | Go to Settings → Expo Go → allow Notifications |
| Confirmation email not in inbox | Check your **Spam** folder |
| "User not found" when transferring | The recipient must have created a WarrantyApp account first |
| App shows white screen | Press Ctrl+C, then `npm start` — sometimes the bundler needs a restart |

---

## How the Recall Engine Works (for the curious)

Every 6 hours, automatically:
1. The app checks **CPSC** (saferproducts.gov) for new consumer product recalls
2. It checks **FDA** (api.fda.gov) for food, drug, and medical device recalls
3. It checks **USDA** (fsis.usda.gov) for meat and poultry recalls
4. For any vehicles you've registered, it checks **NHTSA** (nhtsa.gov)
5. Each new recall is compared against every item you've registered (brand, name, model)
6. If there's a match, you get an in-app notification AND a push notification

You don't have to do anything — it all happens in the background.

---

## Where Everything Lives

| What | Where |
|---|---|
| App code | `OneDrive → WarrantyApp → app` |
| Database & live functions | supabase.com/dashboard/project/ikfuafcygrfwgayxzwbz |
| Code repository (full history) | github.com/tjwentling/WarrantyApp |
| Secret keys | `OneDrive → WarrantyApp → .env.local` — **never share this file** |
| This guide | `OneDrive → WarrantyApp → GETTING_STARTED.md` |

---

*Last updated: February 2026 — Phase 3 complete*
