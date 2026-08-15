/**
 * InsightForge — firebase-init.js
 * ---------------------------------------------------------------
 * Loads the Firebase v10 modular SDK straight from Google's CDN
 * (no npm/build step needed) and exposes a small `window.FB`
 * wrapper so the rest of the app (store.js, main.js, admin.js —
 * plain scripts, not modules) can call simple functions instead
 * of dealing with imports.
 *
 * Requires js/firebase-config.js to have already set
 * window.FIREBASE_CONFIG = { apiKey, authDomain, projectId, ... }
 * See README.md → "1. Create your Firebase project" for where
 * those values come from.
 * ---------------------------------------------------------------
 */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut,
  updatePassword, EmailAuthProvider, reauthenticateWithCredential,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore, collection, doc, onSnapshot, addDoc, setDoc, updateDoc,
  deleteDoc, query, orderBy, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject, listAll,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

const config = window.FIREBASE_CONFIG;
if (!config || !config.apiKey) {
  document.addEventListener("DOMContentLoaded", () => {
    document.body.innerHTML =
      '<div style="max-width:560px;margin:80px auto;padding:32px;font-family:sans-serif;line-height:1.6;">' +
      "<h2>Firebase isn't configured yet</h2>" +
      "<p><code>js/firebase-config.js</code> is missing or empty. See README.md &rarr; " +
      '"Create your Firebase project" for the copy-paste setup steps.</p></div>';
  });
  throw new Error("InsightForge: missing Firebase config");
}

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

/* ---------------- image compression (client-side, before upload) ---------------- */
function compressImage(file, maxDim = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
      resolve(file);
      return;
    }
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        const scale = maxDim / Math.max(width, height);
        width = Math.round(width * scale);
        height = Math.round(height * scale);
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: "image/jpeg" }) : file),
        "image/jpeg",
        quality
      );
    };
    img.onerror = () => resolve(file);
    img.src = url;
  });
}

window.FB = {
  auth,
  db,
  storage,

  /* ---- auth ---- */
  onAuthChange(cb) {
    return onAuthStateChanged(auth, cb);
  },
  async signIn(email, password) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  },
  signOut() {
    return signOut(auth);
  },
  async changePassword(currentPassword, newPassword) {
    const user = auth.currentUser;
    if (!user) throw new Error("Not signed in");
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
    await updatePassword(user, newPassword);
  },

  /* ---- firestore: collections ---- */
  watchCollection(path, cb, orderField) {
    const colRef = orderField ? query(collection(db, path), orderBy(orderField, "asc")) : collection(db, path);
    return onSnapshot(colRef, (snap) => {
      const items = [];
      snap.forEach((d) => items.push({ id: d.id, ...d.data() }));
      cb(items);
    }, (err) => console.error(`InsightForge: watch(${path}) failed`, err));
  },
  addDoc(path, data) {
    return addDoc(collection(db, path), { ...data, createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
  },
  updateDoc(path, id, data) {
    return updateDoc(doc(db, path, id), { ...data, updatedAt: serverTimestamp() });
  },
  deleteDoc(path, id) {
    return deleteDoc(doc(db, path, id));
  },

  /* ---- firestore: single settings-style document ---- */
  watchDoc(path, id, cb) {
    return onSnapshot(doc(db, path, id), (d) => cb(d.exists() ? d.data() : null),
      (err) => console.error(`InsightForge: watchDoc(${path}/${id}) failed`, err));
  },
  setDoc(path, id, data, merge = true) {
    return setDoc(doc(db, path, id), { ...data, updatedAt: serverTimestamp() }, { merge });
  },

  /* ---- storage ---- */
  compressImage,
  uploadFile(folder, file, onProgress) {
    return new Promise(async (resolve, reject) => {
      try {
        const toUpload = file.type.startsWith("image/") ? await compressImage(file) : file;
        const path = `${folder}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
        const storageRef = ref(storage, path);
        const task = uploadBytesResumable(storageRef, toUpload);
        task.on(
          "state_changed",
          (snap) => onProgress && onProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
          reject,
          async () => resolve({ url: await getDownloadURL(task.snapshot.ref), path })
        );
      } catch (e) {
        reject(e);
      }
    });
  },
  deleteFile(path) {
    if (!path) return Promise.resolve();
    return deleteObject(ref(storage, path)).catch(() => {});
  },
  async listFiles(folders) {
    const all = [];
    for (const folder of folders) {
      try {
        const res = await listAll(ref(storage, folder));
        for (const item of res.items) {
          try {
            const url = await getDownloadURL(item);
            all.push({ path: item.fullPath, name: item.name, url });
          } catch (e) {}
        }
      } catch (e) {}
    }
    return all;
  },
};

window.dispatchEvent(new Event("firebase-ready"));
