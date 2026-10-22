# Connecting the clinic apps to Firebase (one time, about 20 minutes)

Firebase is Google's free online database. Once it is connected:

- every phone, tablet and computer that signs in sees the same patients, appointments and payments
- only people the owner adds can sign in
- the **admin app** (`admin.html`) opens only for admins

Do this on a computer, signed in to the clinic's Google account.

---

## 1. Create the Firebase project

1. Go to **https://console.firebase.google.com** and sign in.
2. Click **Create a project** (or **Add project**). Name it `vichare-dental` and click **Continue**.
3. Turn **Google Analytics** off, then click **Create project**. When it finishes, click **Continue**.

## 2. Turn on email sign-in

1. In the left menu, open **Build → Authentication** and click **Get started**.
2. Under **Sign-in method**, click **Email/Password**, switch on the first **Enable** toggle, and click **Save**.
3. Open the **Settings** tab → **Authorized domains** → **Add domain**, type `YOUR-NAME.github.io` (your GitHub username), and click **Add**.

## 3. Create the database

1. In the left menu, open **Build → Firestore Database** and click **Create database**.
2. Location: choose **asia-south1 (Mumbai)**. Click **Next**.
3. Choose **Start in production mode** and click **Create**.
4. Open the **Rules** tab. Delete everything in the box, then paste the whole content of the file **`firestore.rules`** from this folder. Click **Publish**.

## 4. Copy the connection settings

1. Click the **gear icon** next to *Project Overview* → **Project settings**.
2. Scroll to **Your apps** and click the **web icon `</>`**.
3. App nickname: `Vichare app`. Leave *Firebase Hosting* unticked. Click **Register app**.
4. You will see a block like this. Keep the page open:

   ```js
   const firebaseConfig = {
     apiKey: "AIza...",
     authDomain: "vichare-dental.firebaseapp.com",
     projectId: "vichare-dental",
     storageBucket: "vichare-dental.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   ```

## 5. Put the settings into the app

1. Open your **vichare-dental** repository on GitHub and click the file **`firebase-config.js`**.
2. Click the **pencil icon** (Edit this file).
3. Replace the line `window.VDC_FIREBASE_CONFIG = null;` with the six lines you copied, written like this:

   ```js
   window.VDC_FIREBASE_CONFIG = {
     apiKey: "AIza...",
     authDomain: "vichare-dental.firebaseapp.com",
     projectId: "vichare-dental",
     storageBucket: "vichare-dental.appspot.com",
     messagingSenderId: "1234567890",
     appId: "1:1234567890:web:abc123"
   };
   ```

4. Click **Commit changes**. Wait 1–2 minutes for GitHub Pages to update.

These settings only identify your project. They are not a password: the rules from step 3 decide who can read or change records.

## 6. Set up the owner account (once)

1. Open **`https://YOUR-NAME.github.io/vichare-dental/admin.html`**.
2. Tap **First time? Set up the clinic**, enter the doctor's name, email and a strong password, and tap **Set up clinic**.
3. You are now the **owner**. Nobody else can become owner later.

## 7. Add the staff

1. In the admin app, open **Staff**.
2. For each person, enter their name, email and a temporary password. Choose **Staff** (clinic app only) or **Admin** (clinic app and admin app).
3. Tell them the email and temporary password. They can set their own password with **Forgot password?** on the sign-in screen.
4. When someone leaves, tap **Switch off**. They can no longer sign in on any device.

## 8. Start using it on every device

- **Clinic app:** `https://YOUR-NAME.github.io/vichare-dental/`. Sign in, then add it to the home screen.
- **Admin app:** `https://YOUR-NAME.github.io/vichare-dental/admin.html`. Add it to the home screen as well. It gets its own **Vichare Admin** icon.
- If a phone already has patients saved from before, a banner appears after signing in: tap **Move records** once to copy them into the shared records.

---

### Cost

The free **Spark** plan needs no card and allows 50,000 reads and 20,000 changes a day, with 1 GB of storage. That is plenty for one clinic. Firebase will email you if the clinic ever gets close to the limits.

### Privacy

- Records are stored in Google Cloud in Mumbai and travel encrypted.
- Only staff the owner adds, and who are switched on, can read them.
- Use strong passwords and don't share accounts.
- Take a **Backup** from the patient list now and then and keep the file somewhere safe.
