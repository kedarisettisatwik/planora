import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { isMobile } from "react-device-detect";

import DesktopHome from "./DesktopHome";
import MobileHome from "./MobileHome";

import '../Styles/Home.css';

import LoadingBtn from "../components/LoadingBtn";
import NoWidgets from "../components/NoWidgets";

import { signOut } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function Home() {
  const navigate = useNavigate();

  const [email, setEmail] = useState("");

  const [widgetsCount, setWidgetsCount] = useState(0);

  const [loading, setLoading] = useState(true);

  const [popup,setPopup] = useState(false);

  const [popupContent, setPopupContent] = useState(null);

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
          setWidgetsCount(data.widgetsCount || 0);
        } else {
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

  const style1 = {
    justifyContent: "space-around",
    alignItems: "center",
    width: "100vw",
    height: "100vh",
    overflow: "hidden"
  };

  return (
      <section className={`Home ${loading ? 'loading' : ''} ${popup ? 'popup' : ''}`}>
      { 
        widgetsCount == 0 ?
        (<NoWidgets setWidgetsCount={setWidgetsCount} Signout={Signout} email={email} setLoading={setLoading}/>)
        :
        (
          isMobile 
            ? <MobileHome setLoading={setLoading} email={email} setPopup={setPopup} setPopupContent={setPopupContent} signOut={Signout} />
            : <DesktopHome setLoading={setLoading} email={email} setPopup={setPopup} setPopupContent={setPopupContent} signOut={Signout}/>
        )
      }
      <div style={style1} className="loadingModal"><LoadingBtn /></div>
      <div style={style1} className="widgetModal">{popupContent}</div>
      </section>
  );
}

export default Home;