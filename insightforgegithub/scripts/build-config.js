/**
 * Runs automatically on Netlify (see netlify.toml) before every deploy.
 * Reads Firebase config out of Netlify's environment variables and
 * writes js/firebase-config.js, which index.html / admin.html load
 * before firebase-init.js.
 *
 * Set these in Netlify: Site configuration → Environment variables.
 */
const fs = require("fs");
const path = require("path");

const required = [
  "FIREBASE_API_KEY",
  "FIREBASE_AUTH_DOMAIN",
  "FIREBASE_PROJECT_ID",
  "FIREBASE_STORAGE_BUCKET",
  "FIREBASE_MESSAGING_SENDER_ID",
  "FIREBASE_APP_ID",
];

const missing = required.filter((k) => !process.env[k]);
if (missing.length) {
  console.warn(
    "⚠️  InsightForge: missing environment variables: " +
      missing.join(", ") +
      "\n   The site will show a setup message until these are set in Netlify → Environment variables."
  );
}

const config = {
  apiKey: process.env.FIREBASE_API_KEY || "",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "",
  projectId: process.env.FIREBASE_PROJECT_ID || "",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "",
  appId: process.env.FIREBASE_APP_ID || "",
};

const out = `// AUTO-GENERATED at build time from Netlify environment variables — do not edit or commit.
window.FIREBASE_CONFIG = ${JSON.stringify(config, null, 2)};
`;

fs.writeFileSync(path.join(__dirname, "..", "js", "firebase-config.js"), out);
console.log("✅ InsightForge: js/firebase-config.js generated.");
