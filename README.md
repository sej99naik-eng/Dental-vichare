# Vichare Dental Clinic – clinic app and admin app

Two linked apps that share one set of records. Both install on iPhone and Android from a link, and also open on any computer.

| App | Link | For | What it does |
|---|---|---|---|
| **Clinic app** | `…/vichare-dental/` | All staff | Today's OPD list, appointments, patient records, treatments, fees and payments, instalments, receipts, consent with signature, thumb scan |
| **Admin app** | `…/vichare-dental/admin.html` | Owner and admins only | Collections, dues and overdue instalments, today's OPD summary, staff sign-in accounts |

## Two ways to run

- **This device only (default):** works straight away, but each phone keeps its own records with no sign-in.
- **Shared clinic records with sign-in (recommended):** follow **FIREBASE-SETUP.md** once. Every authorised device then sees the same OPD list, patients and payments, and only staff the owner adds can sign in.

## Put it online (GitHub Pages)

1. Unzip this folder. In your `vichare-dental` repository, click **Add file → Upload files**.
2. Drag in **everything**, including the `firebase` folder: `index.html`, `admin.html`, `app.css`, `core.js`, `firebase-config.js`, `firestore.rules`, `sw.js`, both `.webmanifest` files, all `icon-*.png` files and `apple-touch-icon.png`.
3. Click **Commit changes**. GitHub replaces the old files.
4. After a couple of minutes, open the app on each phone, then close it and open it again to load the new version.

If you drag files from a phone that can't upload folders, open the `firebase` folder on GitHub (**Add file → Upload files** while inside a folder named `firebase`) and upload its three files there.

## Daily use

- **Today:** the OPD list for the day. Tap **‹ Prev / Next ›** or pick a date. Mark patients **Arrived → Done** or **Missed**. Walk-ins registered that day are listed below.
- **+ Appointment:** search the patient, pick a date, time and treatment. The app warns you if the time overlaps another appointment.
- **Add day to phone calendar:** saves the day's appointments into the phone's calendar with a reminder (5–60 minutes before, set with **Remind**).
  - iPhone: tap **Add All**.
  - Android: open the downloaded file with your calendar app, or use the **Google Calendar** button on each appointment.
- **Turn on app alerts:** shows an alert before each appointment while the app is open. Calendar reminders work even when the app is closed.
- **Fees & payments** (on each patient's page):
  - Add a fee to each treatment, and a discount if needed.
  - **Record payment** (Cash, UPI, Card, Bank transfer or Cheque) and download a **Receipt**.
  - **Instalments** splits the balance into weekly, two-weekly or monthly instalments. Each instalment shows Paid, Due today, Overdue or Upcoming.
- Staff can record payments. Only admins can delete payments or patient records.

## Files

- `index.html` – clinic app · `admin.html` – admin app · `app.css` – shared look
- `core.js` – shared data, sign-in, payments, calendar
- `firebase-config.js` – your Firebase connection (see FIREBASE-SETUP.md)
- `firestore.rules` – who can read and change what (paste into Firebase)
- `sw.js` – offline support. Change `VERSION` whenever you upload changed files.
- Consent wording is in `index.html`. Search for "Patient declaration".
