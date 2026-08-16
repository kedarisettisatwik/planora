import { useState, useEffect } from "react";
import toast from "react-hot-toast";
import { isMobile } from "react-device-detect";

import "../Styles/Home.css";
import "../Styles/Connections.css";

import {
  doc,
  setDoc,
  collection,
  getDocs,
  deleteDoc
} from "firebase/firestore";

import { auth, db } from "../firebase";


function TeamsWidget({
  key,
  email,
  x,
  y,
  setLoading,
  setPopup,
  setPopupContent,
  signOut
}) {

  const [connections, setConnections] = useState([]);

  const [addFrndMail, setAddFrndMail] = useState("");
  const [addFrndName, setAddFrndName] = useState("");

  const [refreshState, setRefreshState] = useState(0);

  const [contextMenu, setContextMenu] = useState({
      visible: false,
      x: 0,
      y: 0,
  });

  const handleRightClick = (e) => {
      e.preventDefault();

      setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      });
  };


  // =========================================================
  // FETCH CONNECTIONS
  // =========================================================

  useEffect(() => {

    if (!email) return;

    const fetchConnections = async () => {

      try {

        const connectionsRef = collection(
          db,
          email,
          "TeamsWidget",
          "List"
        );

        const snap = await getDocs(connectionsRef);

        const data = snap.docs.map((item) => ({
          id: item.id,
          ...item.data()
        }));

        setConnections(data);

        console.log("Connections:", data);

      } catch (err) {

        console.error(
          "Error fetching connections:",
          err
        );

      }

    };

    fetchConnections();

  }, [email, refreshState]);


  // =========================================================
  // DELETE CONNECTION
  // =========================================================

  const deleteThisRecord = async (connection) => {

    setLoading(true);

    try {

      const docRef = doc(
        db,
        email,
        "TeamsWidget",
        "List",
        connection.id
      );

      await deleteDoc(docRef);

      setConnections((prev) =>
        prev.filter(
          (conn) => conn.id !== connection.id
        )
      );

      toast("Friend removed.", {
        duration: 2000,
        position: "top-center",
        icon: "✅",
        style: {
          backgroundColor: "var(--toast_success)",
          color: "white"
        }
      });

    } catch (err) {

      console.error(
        "Error deleting friend:",
        err
      );

      toast(
        "Something went wrong. Please try again.",
        {
          duration: 2000,
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor: "var(--toast_error)",
            color: "white"
          }
        }
      );

    } finally {

      setLoading(false);

    }

  };


  // =========================================================
  // ADD CONNECTION
  // =========================================================

  const addFrndMailtoDB = async () => {

    const trimmedMail =
      addFrndMail.trim().toLowerCase();

    const trimmedName =
      addFrndName.trim();


    // -------------------------------------------------------
    // NAME VALIDATION
    // -------------------------------------------------------

    if (!trimmedName) {

      toast("Please enter a name.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white"
        }
      });

      return;
    }


    // -------------------------------------------------------
    // EMAIL VALIDATION
    // -------------------------------------------------------

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;


    if (
      !trimmedMail ||
      !emailRegex.test(trimmedMail)
    ) {

      toast("Please enter a valid email.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white"
        }
      });

      return;
    }


    // -------------------------------------------------------
    // DUPLICATE CHECK
    // -------------------------------------------------------

    if (
      connections.some(
        (conn) => conn.email === trimmedMail
      )
    ) {

      toast("This friend is already added.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white"
        }
      });

      return;
    }


    setLoading(true);


    try {

      // -----------------------------------------------------
      // CONNECTIONS SUBCOLLECTION
      // -----------------------------------------------------

      const connectionsRef = collection(
        db,
        email,
        "TeamsWidget",
        "List"
      );


      // -----------------------------------------------------
      // CREATE AUTO-GENERATED UUID / DOCUMENT ID
      // -----------------------------------------------------

      const newConnectionRef =
        doc(connectionsRef);


      // -----------------------------------------------------
      // CONNECTION DATA
      // -----------------------------------------------------

      const connectionData = {
        email: trimmedMail,
        name: trimmedName
      };


      // -----------------------------------------------------
      // SAVE TO FIRESTORE
      // -----------------------------------------------------

      await setDoc(
        newConnectionRef,
        connectionData
      );


      // -----------------------------------------------------
      // UPDATE LOCAL STATE
      // -----------------------------------------------------

      setConnections((prev) => [
        ...prev,
        {
          id: newConnectionRef.id,
          ...connectionData
        }
      ]);


      // -----------------------------------------------------
      // CLEAR INPUTS
      // -----------------------------------------------------

      setAddFrndMail("");
      setAddFrndName("");


      // -----------------------------------------------------
      // SUCCESS MESSAGE
      // -----------------------------------------------------

      toast("Friend added !!", {
        duration: 2000,
        position: "top-center",
        icon: "✅",
        style: {
          backgroundColor: "var(--toast_success)",
          color: "white"
        }
      });


    } catch (err) {

      console.error(
        "Error adding friend:",
        err
      );

      toast(
        "Something went wrong. Please try again.",
        {
          duration: 2000,
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor: "var(--toast_error)",
            color: "white"
          }
        }
      );

    } finally {

      setLoading(false);

    }

  };


  // =========================================================
  // UI
  // =========================================================

  return (

    <div
      className="defaultWidgetDiv connections"
      style={{
        padding: "10px 0 10px 10px"
      }}
      onContextMenu={handleRightClick} onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
    >

      {/* =====================================================
          ADD FRIEND
      ====================================================== */}

      <div className="addFrnd">

        {/* NAME */}

        <input
          type="text"
          placeholder="Team Member name"
          autoComplete="off"
          value={addFrndName}
          onChange={(e) =>
            setAddFrndName(e.target.value)
          }
        />


        {/* EMAIL */}

        <input
          type="email"
          placeholder="EE@gmail.com"
          autoComplete="off"
          value={addFrndMail}
          onChange={(e) =>
            setAddFrndMail(e.target.value)
          }
        />


        {/* ADD BUTTON */}

        <i onClick={addFrndMailtoDB}>
          Add +
        </i>

      </div>


      {/* =====================================================
          CONNECTION LIST
      ====================================================== */}

      <ul
        style={{
          marginBottom: "0px"
        }}
        className="List"
      >

        {Array.isArray(connections) &&
          connections.map((conn) => (

            <li key={conn.id}>

              <span>

                {conn.name} <br></br><label style={{opacity:"0.6",marginTop:"10px",display:"inline-block"}}>{conn.email}</label>

              </span>


              <i
                className="fa-solid fa-trash"
                onClick={() =>
                  deleteThisRecord(conn)
                }
              ></i>

            </li>

          ))}

      </ul>

      <div className="refreshWidget" style={{ display: contextMenu.visible ? "block" : "none",left: contextMenu.x,top: contextMenu.y, cursor:"pointer", width: "auto", overflow: "hidden", padding: "10px", boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)", zIndex: 20, position: "fixed", background: "white", borderRadius: "10px", fontSize: "13px" }} onClick={() => setRefreshState(prev => prev + 1)}>Refresh</div>
    </div>

  );

}


export default TeamsWidget;