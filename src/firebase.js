
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// https://firebase.google.com/docs/web/setup#available-libraries

const firebaseConfig = {
  apiKey: "AIzaSyB3TNi4OXrQNtzyFZd9g2ZMazaV4djIXiE",
  authDomain: "planora-db5c1.firebaseapp.com",
  projectId: "planora-db5c1",
  storageBucket: "planora-db5c1.firebasestorage.app",
  messagingSenderId: "28495612438",
  appId: "1:28495612438:web:9ccbd259bd53d90f564337"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);