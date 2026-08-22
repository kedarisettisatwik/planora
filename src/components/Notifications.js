import { useState, useEffect } from "react";
import "../Styles/Home.css";
import "../Styles/Notifications.css";

import {
  collection,
  onSnapshot,
  getDocs,
  doc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { db } from "../firebase";

function Notifications({
  email,
  setLoading,
  setPopup,
  setPopupContent,
  signOut,
}) {
  const [notifications, setNotifications] = useState([]); // List (live)
  const [doneNotifications, setDoneNotifications] = useState([]); // Done (one-time)

  // real-time listener for List
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
        setNotifications(notArr);
      },
      (error) => {
        console.error("Firestore Error (List):", error);
      }
    );

    return () => unsubscribe();
  }, [email]);

  // one-time fetch for Done, runs once on mount
  useEffect(() => {
    if (!email) return;

    const fetchDone = async () => {
      try {
        const doneRef = collection(db, email, "Notifications", "Done");
        const snapshot = await getDocs(doneRef);
        const doneArr = snapshot.docs.map((d) => ({
          id: d.id,
          isNew: false,
          ...d.data(),
        }));
        setDoneNotifications(doneArr);
      } catch (err) {
        console.error("Error fetching Done notifications:", err);
      }
    };

    fetchDone();
  }, [email]);

  // combined list, newest List items first then Done items, sorted by DD within each group
  const allNotifications = [...notifications, ...doneNotifications].sort(
    (a, b) => (b.DD?.toDate?.() ?? 0) - (a.DD?.toDate?.() ?? 0)
  );

  const handleDelete = async (not, e) => {
    e.stopPropagation();
    try {
      const collectionName = not.isNew ? "List" : "Done";
      const notDocRef = doc(db, email, "Notifications", collectionName, not.id);
      await deleteDoc(notDocRef);

      if (!not.isNew) {
        // Done isn't live, so remove it from local state manually
        setDoneNotifications((prev) => prev.filter((n) => n.id !== not.id));
      }
      // List updates automatically via onSnapshot
    } catch (err) {
      console.error("Error deleting notification:", err);
    }
  };

  // deletes every doc in both List and Done
  const handleClearAll = async () => {
    if (allNotifications.length === 0) return;

    const confirmed = window.confirm(
      `Delete all ${allNotifications.length} notifications? This can't be undone.`
    );
    if (!confirmed) return;

    try {
      const batch = writeBatch(db);

      notifications.forEach((not) => {
        batch.delete(doc(db, email, "Notifications", "List", not.id));
      });
      doneNotifications.forEach((not) => {
        batch.delete(doc(db, email, "Notifications", "Done", not.id));
      });

      await batch.commit();
      // List clears via onSnapshot automatically; Done needs a manual clear since it's not live
      setDoneNotifications([]);
    } catch (err) {
      console.error("Error clearing all notifications:", err);
    }
  };

  const moveNewToDone = async () => {
    if (notifications.length === 0) return; // nothing in List to move

    try {
            const batch = writeBatch(db);

            notifications.forEach((not) => {
            const { id, isNew, ...data } = not; // strip local-only fields, keep real DB fields

            const doneDocRef = doc(db, email, "Notifications", "Done", id); // same id in Done
            const listDocRef = doc(db, email, "Notifications", "List", id);

            batch.set(doneDocRef, data); // copy into Done
            batch.delete(listDocRef); // remove from List
            });

            await batch.commit();

            // List clears itself via onSnapshot automatically.
            // Done isn't live, so refresh it manually to reflect the newly moved docs.
            const doneRef = collection(db, email, "Notifications", "Done");
            const snapshot = await getDocs(doneRef);
            const doneArr = snapshot.docs.map((d) => ({
            id: d.id,
            isNew: false,
            ...d.data(),
            }));
            setDoneNotifications(doneArr);
        } catch (err) {
            console.error("Error moving notifications from List to Done:", err);
        }
    };

  return (
    <div className="defaultWidgetDiv notifications" style={{ padding: "10px 20px" }}>
      <p style={{ fontSize: "20px", margin: "10px 0 50px 0" }}>
        <span
          style={{ display: "inline-block", marginRight: "10px", cursor: "pointer" }}
          onClick={() => {
            setPopup(false);
            setPopupContent(null);
            moveNewToDone();
          }}
        >
          ←
        </span>
        Notifications
      </p>

      <div className="NotiList">
        {allNotifications.length === 0 ? (
          <p>No notifications found.</p>
        ) : (
          allNotifications.map((not) => (
            <div
              key={not.id}
              className={`notificationItem ${not.type}${not.isNew ? " new" : ""}`}
            >
              <div style={{ fontWeight: "bold", fontSize: "15px", marginBottom: "10px" }}>
                {not.title}
              </div>
              <p style={{ fontSize: "14px" }}>{not.description}</p>
              <p style={{ fontSize: "11px", marginTop: "10px" }}>By - {not.createdBy}</p>
              <span style={{ fontSize: "12px", position: "absolute", top: "10px", right: "0px" }}>
                {not.DD?.toDate ? not.DD.toDate().toLocaleString() : ""}
              </span>
              <i onClick={(e) => handleDelete(not, e)} style={{ cursor: "pointer" }}>
                X
              </i>
              {
                not.isNew ? (
                    <label style={{ position: "absolute", top: "30px", right: "0", fontSize: "13px", color: "var(--base_color)", fontWeight: "bold", letterSpacing: "1px" }}>new</label>
            
                ):
                (<></>)
              }
              </div>
          ))
        )}
      </div>

      <button onClick={handleClearAll} disabled={allNotifications.length === 0}>
        Clear All
      </button>
    </div>
  );
}

export default Notifications;