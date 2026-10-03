// Shared Firebase setup — imported by every page that needs the database
// and/or authentication. Keep this file as the ONE place the Firebase
// config lives so it only needs updating in one spot if it ever changes.
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyDdNxvf2bK5iXe_f02P1LZC3OQihrGUsMw",
  authDomain: "ravello-tan.firebaseapp.com",
  databaseURL: "https://ravello-tan-default-rtdb.firebaseio.com",
  projectId: "ravello-tan",
  storageBucket: "ravello-tan.firebasestorage.app",
  messagingSenderId: "54830740363",
  appId: "1:54830740363:web:e2f89faa1fef7d3f37f58e",
  measurementId: "G-7F2LBRVVT0"
};

export const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
export const auth = getAuth(app);
