import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";
import { AuthContext } from "./AuthContext";
import LoadingBtn from "../components/LoadingBtn";

function ProtectedRoute({ children }) {
  const [userData, setUserData] = useState(null);
  const [checkingAuth, setCheckingAuth] = useState(true);

  const style1 = {
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    width: "100vw",
    height: "100vh",
    overflow: "hidden"
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        try {
          const userDocRef = doc(db, currentUser.email, "generalDetails");
          const userSnap = await getDoc(userDocRef);

          const firestoreData = userSnap.exists() ? userSnap.data() : {};

          setUserData({
            email: currentUser.email,
            displayName: firestoreData.displayName || currentUser.displayName || "",
            widgetsCount: firestoreData.widgetsCount || 0,
          });
        } catch (err) {
          console.error("Error fetching user data:", err);
          setUserData({
            email: currentUser.email,
            displayName: currentUser.displayName || "",
            widgetsCount: 0,
          });
        }
      } else {
        setUserData(null);
      }

      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  if (checkingAuth) {
    return <div style={style1}><LoadingBtn /></div>;
  }

  if (!userData) {
    return <Navigate to="/log" replace />;
  }

  return (
    <AuthContext.Provider value={userData}>
      {children}
    </AuthContext.Provider>
  );
}

export default ProtectedRoute;