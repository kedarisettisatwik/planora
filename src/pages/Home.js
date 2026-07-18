import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

// import LoadingBtn from "../components/LoadingBtn";

import { signOut } from "firebase/auth";
import { auth} from "../firebase";
import { useAuth } from "../authentication/AuthContext";

function Home() {
  const navigate = useNavigate();
  const authData = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [widgetsCount, setWidgetsCount] = useState(0);

  useEffect(() => {
    if (authData) {
      setDisplayName(authData.displayName);
      setEmail(authData.email);
      setWidgetsCount(authData.widgetsCount);
    }
  }, [authData]);

  const Signout = async () => {
    await signOut(auth);
    navigate('/log');
  };

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