import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// import LoadingBtn from "../components/LoadingBtn";

import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function Home() {
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  
  const [email, setEmail] = useState("");

  const [widgetsCount, setWidgetsCount] = useState(0);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserData = async () => {
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        const userDocRef = doc(db, currentUser.email, "generalDetails");
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          const data = userSnap.data();
          setDisplayName(data.displayName || currentUser.displayName || "");
          setWidgetsCount(data.widgetsCount || 0);
        } else {
          setDisplayName(currentUser.displayName || "");
          setWidgetsCount(0);
        }

        setEmail(currentUser.email);
      } catch (err) {
        console.error("Error fetching user data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const Signout = async () => {
    await signOut(auth);
    navigate('/log');
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div>
      <div>Welcome, {displayName}</div>
      <div>Email: {email}</div>
      <div>Widgets: {widgetsCount}</div>
      <button onClick={Signout}>Sign Out</button>
    </div>
  );
}

export default Home;