# WarrantyApp — Getting Started Guide
### For Non-Technical Users

---

## What Is This App?

WarrantyApp lets you keep track of everything you own, store your warranties in one place, and automatically alerts you if the government recalls any product you've registered. You can also scan the barcode on a product box to add it instantly.

---

## What You Need to Test the App

You need **three things** on your computer:
1. **Node.js** — already installed ✅
2. **Expo Go** — a free app on your phone (iPhone or Android)
3. This project folder — already on your OneDrive ✅

---

## Step 1 — Install Expo Go on Your Phone

**iPhone:** Open the App Store, search **"Expo Go"**, install it (it's free, made by Expo)

**Android:** Open the Play Store, search **"Expo Go"**, install it (it's free)

> Expo Go lets you run the app directly on your phone without submitting it to the App Store first. It's the fastest way to see it working.

---

## Step 2 — Open the App Folder

1. Open **File Explorer** (Windows) or **Finder** (Mac)
2. Navigate to: `OneDrive → WarrantyApp → app`
3. This is where all the app code lives

---

## Step 3 — Open a Terminal / Command Prompt

**On Windows:**
- Press the **Windows key**, type `cmd`, press Enter
- OR right-click on the `app` folder while holding **Shift**, then click "Open PowerShell window here"

**On Mac:**
- Open **Terminal** (search for it in Spotlight with Cmd+Space)
- Type `cd ~/OneDrive/WarrantyApp/app` and press Enter

---

## Step 4 — Start the App

In the terminal, type this and press Enter:

```
npm start
```

Wait about 30 seconds. You'll see a big **QR code** appear in the terminal window.

---

## Step 5 — Open the App on Your Phone

**iPhone:**
1. Open your phone's **Camera** app (not Expo Go — just the regular camera)
2. Point it at the QR code on your computer screen
3. Tap the yellow banner that appears at the top
4. Expo Go will open automatically and load the app

**Android:**
1. Open **Expo Go** on your phone
2. Tap **"Scan QR code"**
3. Point at the QR code on your computer screen
4. The app loads automatically

---

## Step 6 — Create an Account

Once the app loads on your phone:
1. Tap **"Create one"** to make a new account
2. Enter your name, email, and a password
3. Check your email for a confirmation link — click it
4. Come back to the app and sign in

---

## What to Test

Here's what you can try in order:

| What to try | How |
|---|---|
| **Add an item manually** | Tap the "+" button → fill in details → Save |
| **Scan a barcode** | Tap "+" → tap "Scan Barcode" → point camera at any product box or tag |
| **View your dashboard** | The home screen shows a summary of everything you own |
| **Check warranties** | Tap any item to see its warranty status |
| **Recall alerts** | The Alerts tab shows any government recalls for your items |
| **Transfer an item** | Open an item → tap "Transfer Ownership" |

---

## Stopping the App

In the terminal window, press **Ctrl + C** (Windows) or **Cmd + C** (Mac) to stop the server.

---

## Common Issues

| Problem | Solution |
|---|---|
| QR code doesn't work | Make sure your phone and computer are on the **same Wi-Fi network** |
| "Something went wrong" | Stop the server (Ctrl+C), type `npm start` again |
| App is slow to load | First load is always slow — give it 60 seconds |
| Can't scan barcode | Make sure you've given the app camera permission when it asked |
| Email confirmation not arriving | Check your spam folder |

---

## Where Is Everything Stored?

| What | Where |
|---|---|
| Your code | `OneDrive → WarrantyApp → app` |
| Your database | Supabase (cloud) at supabase.com |
| Your code backup | GitHub at github.com/tjwentling/WarrantyApp |
| This guide | `OneDrive → WarrantyApp → GETTING_STARTED.md` |
| Secret keys | `OneDrive → WarrantyApp → .env.local` (never share this file) |

---

## Who Built This?

This app was built using:
- **React Native + Expo** — the code that makes the app work on iPhone and Android
- **Supabase** — the database that stores your items, warranties, and alerts
- **Government APIs** — free data feeds from CPSC, NHTSA, FDA, and USDA for recalls

---

*Last updated: February 2026*
