import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import LoadingBtn from "../components/LoadingBtn";

function ProtectedRoute({ children }) {
  const [user, setUser] = useState(null);
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
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setCheckingAuth(false);
    });

    return () => unsubscribe();
  }, []);

  if (checkingAuth) {
    return <div style={style1}><LoadingBtn /></div>;
  }

  if (!user) {
    return <Navigate to="/log" replace />;
  }

  return children;
}

export default ProtectedRoute;