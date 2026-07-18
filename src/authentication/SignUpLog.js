import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth } from "../firebase";

const authErrorMessages = {
  "auth/email-already-in-use": "Email address already in use",
  "auth/invalid-email": "Invalid email address",
  "auth/weak-password": "Password should be at least 6 characters",
  "auth/missing-password": "Please enter a password",
  "auth/network-request-failed": "Network error, please try again",
  "auth/too-many-requests": "Too many attempts, please try again later",
};

function getFriendlyError(code) {
  return authErrorMessages[code] || "Something went wrong, please try again";
}

export async function SignUpLog(email, password, displayName = "") {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;

    if (displayName) {
      await updateProfile(user, { displayName });
    }

    return { success: true, user };
  } catch (error) {
    return { success: false, error: getFriendlyError(error.code) };
  }
}