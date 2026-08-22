import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { isMobile } from "react-device-detect";
import toast from 'react-hot-toast';

import DesktopHome from "./DesktopHome";
import MobileHome from "./MobileHome";

import '../Styles/Home.css';

import LoadingBtn from "../components/LoadingBtn";
import NoWidgets from "../components/NoWidgets";
import Notifications from "../components/Notifications";

import { signOut } from "firebase/auth";
import { doc, getDoc, collection, onSnapshot} from "firebase/firestore";
import { auth, db } from "../firebase";

const requestNotificationPermission = async () => {
  if (!("Notification" in window)) {
    console.warn("This browser does not support desktop notifications");
    return;
  }

  if (Notification.permission === "granted") {
    return; // already allowed
  }

  if (Notification.permission !== "denied") {
    const permission = await Notification.requestPermission();
    console.log("Notification permission:", permission); // "granted" | "denied" | "default"
  }
};

// change this to whatever your actual Home route path is
const HOME_ROUTE = "/home";

function Home() {
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");

  const [widgetsCount, setWidgetsCount] = useState(0);

  const [loading, setLoading] = useState(true);

  const [popup,setPopup] = useState(false);

  const [popupContent, setPopupContent] = useState(null);

  // Track whether we're currently on the Home route, via ref so the
  // Firestore listener's closure always reads the latest value.
  const isOnHomeRef = useRef(false);

  // Queue of toasts that arrived while the tab was hidden/backgrounded,
  // flushed once the tab becomes visible again.
  const pendingNotificationsRef = useRef([]);

  useEffect(() => {
    requestNotificationPermission(); // ask once when Home mounts
  }, []);

  useEffect(() => {
    isOnHomeRef.current = location.pathname === HOME_ROUTE;
  }, [location]);

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

  const showNotificationToast = (title, description, onOpen) => {
    toast.custom(
      (t) => (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: "12px",
            background: "var(--toast_success)",
            color: "white",
            padding: "12px 16px",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            minWidth: "280px",
            maxWidth: "360px",
            opacity: t.visible ? 1 : 0,
            transition: "opacity 0.2s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "8px" }}>
            <span style={{ fontSize: "18px" }}>🔔</span>
            <div>
              <div style={{ fontWeight: "bold", fontSize: "14px", marginBottom: "4px" }}>
                {title}
              </div>
              {description && (
                <div style={{ fontSize: "13px", opacity: 0.9 }}>
                  {description}
                </div>
              )}
            </div>
          </div>

          <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
            <button
              onClick={() => {
                onOpen && onOpen();
                toast.dismiss(t.id);
              }}
              style={{
                background: "white",
                color: "var(--toast_success)",
                border: "none",
                borderRadius: "4px",
                padding: "4px 10px",
                fontSize: "12px",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              Open
            </button>

            <button
              onClick={() => {toast.dismiss(t.id);}}
              style={{
                background: "transparent",
                color: "white",
                border: "none",
                fontSize: "16px",
                cursor: "pointer",
                opacity: 0.8,
              }}
            >
              ✕
            </button>
          </div>
        </div>
      ),
      {
        duration: 2000,
        position: "top-center",
      }
    );
  };

  // Flush any queued toasts once the tab becomes visible again.
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible" && isOnHomeRef.current) {
        pendingNotificationsRef.current.forEach(({ title, description, onOpen }) => {
          showNotificationToast(title, description, onOpen);
        });
        pendingNotificationsRef.current = [];
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!email) return;

    const notificationsRef = collection(db, email, "Notifications", "List");

    const unsubscribe = onSnapshot(
      notificationsRef,
      (snapshot) => {
        const notArr = snapshot.docs.map((d) => ({
          id: d.id,
          isNew: true,
          ...d.data(),
        }));

        snapshot.docChanges().forEach((change) => {
          if (change.type !== "added") return; // skip modified/removed

          const notData = change.doc.data();
          const notTitle = notData.title || "New Notification";
          const notBody = notData.description || "";

          const onOpen = () => {
            setPopup(true);
            setPopupContent(
              <Notifications
                email={email}
                setPopup={setPopup}
                setPopupContent={setPopupContent}
                signOut={Signout}
              />
            );
          };

          // Only show the in-page toast right away if we're on this page
          // AND the tab is actually visible/focused right now.
          // Otherwise queue it to be shown when the tab regains visibility.
          const canShowNow =
            isOnHomeRef.current && document.visibilityState === "visible";

          if (canShowNow) {
            showNotificationToast(notData.title, notData.description, onOpen);
          } else {
            pendingNotificationsRef.current.push({
              title: notData.title,
              description: notData.description,
              onOpen,
            });
          }

          // browser notification still fires regardless — that's its whole
          // job, to reach the user when they're not looking at the tab
          if (Notification.permission === "granted") {
            const notif = new Notification(notTitle, {
              body: notBody,
              icon: "/favicon.ico", // emoji strings don't work as icons, use an actual image path
            });

            notif.onclick = () => {
              window.focus();
              onOpen();
              notif.close();
            };
          } else {
            console.warn(
              "Notification permission not granted, current state:",
              Notification.permission
            );
          }
        });
      },
      (error) => {
        console.error("Firestore Error (List):", error);
      }
    );

    return () => unsubscribe();

  }, [email]);

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