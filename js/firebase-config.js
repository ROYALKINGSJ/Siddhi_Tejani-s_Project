// js/firebase-config.js

// TODO: Replace this object with your actual Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyAcMZEEOykAZlGJuTMKXeit2xLABithTGE",
  authDomain: "internship-portal-eff9e.firebaseapp.com",
  projectId: "internship-portal-eff9e",
  storageBucket: "internship-portal-eff9e.firebasestorage.app",
  messagingSenderId: "497307402315",
  appId: "1:497307402315:web:84ea68cb31f2f73cf88dce",
  measurementId: "G-37HJJJFJQ5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Services
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();