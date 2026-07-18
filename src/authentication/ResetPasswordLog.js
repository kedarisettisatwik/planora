import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "../firebase";

const authErrorMessages = {
  "auth/email-already-in-use": "Email address already in use",
  "auth/invalid-email": "Invalid email address",
  "auth/weak-password": "Password should be at least 6 characters",
  "auth/missing-password": "Please enter a password",
  "auth/user-not-found": "No account found with this email",
  "auth/wrong-password": "Incorrect password",
  "auth/invalid-credential": "Incorrect email or password",
  "auth/user-disabled": "This account has been disabled",
  "auth/network-request-failed": "Network error, please try again",
  "auth/too-many-requests": "Too many attempts, please try again later",
  "auth/missing-email": "Please enter an email address",
};

function getFriendlyError(code) {
  return authErrorMessages[code] || "Something went wrong, please try again";
}

export async function ResetPasswordLog(email) {
  try {
    await sendPasswordResetEmail(auth, email);
    return { success: true };
  } catch (error) {
    return { success: false, error: getFriendlyError(error.code) };
  }
}