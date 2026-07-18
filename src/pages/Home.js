import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

import LoadingBtn from "../components/LoadingBtn";

import { signOut, onAuthStateChanged  } from "firebase/auth";
import { auth, db} from "../firebase";
import { doc, getDoc } from "firebase/firestore";


function Home() {

  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [widgetsCount, setWidgetsCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setEmail(user.email);

        try {
          const userDocRef = doc(db, user.email, "generalDetails");
          const userSnap = await getDoc(userDocRef);

          if (userSnap.exists()) {
            const data = userSnap.data();
            setDisplayName(data.displayName || "");
            setWidgetsCount(data.widgetsCount || 0);
          } else {
            console.log("No generalDetails found for this user");
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }

        setLoading(false);
      } else {
        // No user logged in — redirect to login
        navigate('/log');
      }
    });

    return () => unsubscribe();
  }, [navigate]);

  const Signout = async () => {
    await signOut(auth);
    navigate('/log');
  };
  if (loading){
    return <LoadingBtn/>
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