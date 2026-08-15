# InsightForge

The personal brand and portfolio site for **Shashidhar A. Patil** — Business Analytics · Finance · AI.

This version is backed by a real database (Firebase). Editing content in the Admin Panel
updates the live site **instantly, for every visitor** — no downloading files, no replacing
files, no redeploying.

No content is invented anywhere. Every section starts empty or shows "Coming Soon" until you
add real projects, certifications, experience, etc. through the Admin Panel.

The visual design — dark theme, glassmorphism, blue accent, typography, layout, animations,
navigation, sections — is untouched from the previous version. Only the data layer changed.

---

## What changed architecturally

| | Before | Now |
|---|---|---|
| Content storage | `js/content.js` (static file) | Firestore database |
| Publishing edits | Download `content.js` → replace → redeploy | Instant — same second |
| Images/PDFs | Embedded as base64 in the browser | Uploaded to Firebase Storage, get a real URL |
| Admin login | Local password hash in the browser | Firebase Authentication |
| Multi-device | Edits only visible on your own browser | Visible to every visitor immediately |

---

## 1. Create your Firebase project (one-time, ~10 minutes, no coding)

I can't do this part for you — it needs your own Google account — but it's all clicking, no code.

1. Go to **console.firebase.google.com** → **Add project** → name it (e.g. `insightforge`) →
   finish the wizard. The free "Spark" plan is enough for a personal portfolio.
2. **Enable Authentication:** left sidebar → Build → Authentication → Get started → enable the
   **Email/Password** sign-in method.
3. **Create your admin account:** Authentication → Users tab → Add user → enter the email and
   password you'll use to log into `/admin.html`. (There's no public sign-up page — you are the
   only account.)
4. **Enable Firestore:** Build → Firestore Database → Create database → start in **production
   mode** → pick a region close to you.
5. **Set Firestore rules:** Firestore Database → Rules tab → delete everything → paste the
   entire contents of `firestore.rules` from this project → **Publish**.
6. **Enable Storage:** Build → Storage → Get started → same region as Firestore.
7. **Set Storage rules:** Storage → Rules tab → paste the entire contents of `storage.rules` →
   **Publish**.
8. **Get your web config:** Project settings (gear icon, top left) → General tab → scroll to
   "Your apps" → click the **</> (Web)** icon → register an app (any nickname) → you'll see a
   `firebaseConfig` object with `apiKey`, `authDomain`, `projectId`, `storageBucket`,
   `messagingSenderId`, `appId`. Keep this tab open for step 3 below.

## 2. Local testing (optional but recommended before you deploy)

```bash
cd insightforge
cp js/firebase-config.example.js js/firebase-config.js
```
Open `js/firebase-config.js` and paste in the six values from step 1.8. Then:
```bash
python3 -m http.server 8000
```
Visit `http://localhost:8000` and `http://localhost:8000/admin.html`. `firebase-config.js` is
git-ignored, so your keys never get committed.

## 3. Deploy on Netlify with environment variables

1. Push this project to a GitHub repository (recommended — gives you version history for a
   5-year site) and connect it to Netlify, **or** keep using drag-and-drop deploys.
2. In Netlify: **Site configuration → Environment variables**, add these six (values from step 1.8):
   - `FIREBASE_API_KEY`
   - `FIREBASE_AUTH_DOMAIN`
   - `FIREBASE_PROJECT_ID`
   - `FIREBASE_STORAGE_BUCKET`
   - `FIREBASE_MESSAGING_SENDER_ID`
   - `FIREBASE_APP_ID`
3. Netlify will run `node scripts/build-config.js` automatically on every deploy (already
   configured in `netlify.toml`) — this generates `js/firebase-config.js` from those variables
   at build time, so the keys are never committed to your repo.
4. Deploy. Visit `yoursite.netlify.app/admin.html` and log in with the account you created in
   step 1.3.

**A note on "secrets":** Firebase's web config values are not secret in the traditional sense —
they identify your project to the browser, and real security is enforced by the Firestore/Storage
rules from step 1, not by hiding these values. Using environment variables here keeps them out of
your git history and makes them easy to rotate, which is good practice, but don't rely on them
being invisible — anyone can see them in your site's network requests, same as with any Firebase
web app.

## 4. Daily use — the CMS workflow you asked for

1. Log in at `/admin.html`.
2. Go to **Projects → New Project**.
3. Drag in a cover image, drag in screenshots, paste your GitHub/demo/dashboard/Drive links.
4. Click **Save Project**.
5. Open your live site — the project is already there. No extra step.

Same pattern for Certifications, Skills, Resources, Experience, Education, Resume, and Settings.

---

## 5. What's stored where

**Firestore collections:**
- `projects`, `certifications`, `skillCategories`, `resources`, `experience`, `education` — each
  editable document maps 1:1 to a card/entry on the site.
- `settings/site` — a single document holding site meta, your profile, social links and accent color.
- `messages` — Contact form submissions. Visitors can create one; only you (signed in) can read/delete them.
- `testimonials`, `blogPosts` — collections exist and are rule-protected, ready for when you build
  their admin panels and public sections (see §7).

**Firebase Storage folders:** `covers/`, `screenshots/`, `certificates/`, `certificates_pdf/`,
`resume/`, `profile/`, `favicon/`. Every upload automatically gets a public download URL — that's
what gets saved into Firestore.

## 6. Security notes

- **Authentication** — only your one Firebase Auth account can write to the database or upload
  files; enforced server-side by the rules, not just by hiding the admin page.
- **Input validation** — the contact form's Firestore rule restricts what a public submission can
  contain (only the expected fields, capped lengths); admin forms validate required fields
  client-side.
- **XSS** — every piece of user-entered or database-stored text is HTML-escaped before being
  inserted into the page (see the `esc()` helper in `main.js`/`admin.js`), so stored text can't
  execute as HTML/JS.
- **Protected routes** — `/admin.html` renders nothing but the login screen until Firebase
  confirms you're signed in.
- These rules are solid for a personal portfolio. They are not a substitute for a professional
  security review if this site ever handles anything more sensitive than a portfolio and a
  contact form.

## 7. Adding future features (Blog, Testimonials, Analytics, etc.) without restructuring

The pattern is the same every time:
1. Add a Firestore collection (and a rule for it in `firestore.rules` — `testimonials` and
   `blogPosts` are already there as examples).
2. Add `FB.watchCollection("yourCollection", cb)` in `store.js`, store it on `state`.
3. Add a render function in `main.js` and a spot for it in `renderAll()`.
4. Add a nav link + `<section class="page">` in `index.html` if it needs its own page (or fold it
   into an existing page the way Experience/Education were added to About).
5. Add a CRUD panel in `admin.html` + `admin.js`, copying the pattern used for Experience.

Ideas this scales to cleanly: **Blog** (collection of posts with rich text + cover image),
**Testimonials** (name, role, quote, photo), **Visitor Counter** (a Firestore counter document
incremented on page load via a Cloud Function, to avoid write-spam from the client), **Project
Search/Filtering** (already built for Projects — same pattern), **Admin Activity Logs** (a
collection written to on every admin write), **Newsletter** (Firestore collection + an email
provider's API called from a Cloud Function). Anything needing scheduled jobs, sending email, or
hiding real secrets (like a newsletter provider's API key) is best done with a small **Cloud
Function** rather than client-side code — that's the one piece of backend this static-hosting +
Firebase setup doesn't include yet.

## 8. File structure

```
insightforge/
├── index.html              Public site
├── admin.html               Admin Panel
├── netlify.toml              Netlify build config (generates firebase-config.js)
├── firestore.rules            Paste into Firebase Console → Firestore → Rules
├── storage.rules               Paste into Firebase Console → Storage → Rules
├── scripts/
│   └── build-config.js          Generates js/firebase-config.js from env vars (Netlify runs this)
├── css/
│   ├── style.css                 Design system (unchanged)
│   └── admin.css                  Admin-only layout
└── js/
    ├── firebase-config.example.js   Template — copy to firebase-config.js for local dev
    ├── firebase-init.js              Initializes Firebase, exposes window.FB helpers
    ├── store.js                       Live Firestore listeners → in-memory state
    ├── main.js                         Public site rendering & interactions
    └── admin.js                        Admin Panel logic (auth, CRUD, uploads)
```

## 9. Costs

Firebase's free "Spark" plan covers Authentication, a generous Firestore read/write quota, and
1GB of Storage — comfortably enough for a personal portfolio for years. If the site gets very
high traffic later, Firebase will prompt you to upgrade to the pay-as-you-go "Blaze" plan, which
still has a free tier built in.
