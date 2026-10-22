import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey:"AIzaSyChsXZQJMSSU2iYm2WgbQUO_dnzNPzT3kI",
  authDomain:"cc-drivers.firebaseapp.com",
  projectId:"cc-drivers",
  storageBucket:"cc-drivers.firebasestorage.app",
  messagingSenderId:"1052687152920",
  appId:"1:1052687152920:web:3b0f29e77fc51f4162d06d"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
