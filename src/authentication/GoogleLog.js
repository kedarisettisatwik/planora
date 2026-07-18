import { GoogleAuthProvider, signInWithPopup } from "firebase/auth";
import { auth } from "../firebase"; // adjust path to your firebase.js

const provider = new GoogleAuthProvider();

export async function GoogleLog () {
  try {
    const result = await signInWithPopup(auth, provider);
    const user = result.user;

    console.log("Signed in user:", user);
    return user;
  } catch (error) {
    console.error("Google sign-in error:", error.code, error.message);
    throw error;
  }
};