import { useState, useEffect, useRef, useCallback, use } from "react";
import toast from 'react-hot-toast';
import { isMobile } from "react-device-detect";

import '../Styles/Home.css'
import '../Styles/Connections.css'

import { doc, getDoc, setDoc, arrayUnion, arrayRemove, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function Connections ({ key, email, x, y ,setLoading, setPopup, setPopupContent, signOut}){

    const [connections,setConnections] = useState([]);
    const [addFrndMail,setAddFrndMail] = useState("");


    // fetch connections 
    useEffect(() => {
      if (!email) return;
    
      const fetchConnections = async () => {
        try {
          const snap = await getDoc(doc(db, email, "Connections"));
          const data = snap.exists() ? snap.data().List || [] : [];
    
          setConnections(data);
          console.log(data);
        } catch (err) {
          console.error("Error fetching connections:", err);
        }
      };
    
      fetchConnections();
    }, [email]); 

    const deleteThisRecord = async (connToDelete) => {
        setLoading(true);
        try {
        const docRef = doc(db, email, "Connections");
        await updateDoc(docRef, { List: arrayRemove(connToDelete) });

        setConnections((prev) => prev.filter((c) => c !== connToDelete));

        toast('Friend removed.', {
            duration: 2000,
            position: 'top-center',
            icon: '✅',
            style: {"backgroundColor":"var(--toast_success)","color":"white"}
        });
        } catch (err) {
        console.error("Error deleting friend:", err);
        toast("Something went wrong. Please try again.", {
            duration: 2000,
            position: 'top-center',
            icon: '❌',
            style: {"backgroundColor":"var(--toast_error)","color":"white"}
        });
        } finally {
        setLoading(false);
        }
    };

    const addFrndMailtoDB = async () => {
        const trimmedMail = addFrndMail.trim().toLowerCase();

        // basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!trimmedMail || !emailRegex.test(trimmedMail)) {
            toast("Please enter a valid email.", {
                duration: 2000,
                position: 'top-center',
                icon: '❌',
                style: {"backgroundColor":"var(--toast_error)","color":"white"}
            });
            return;
            }

            if (connections.includes(trimmedMail)) {
            toast("This friend is already added.", {
                duration: 2000,
                position: 'top-center',
                icon: '❌',
                style: {"backgroundColor":"var(--toast_error)","color":"white"}
            });
            return;
            }

            setLoading(true);
            try {
            const docRef = doc(db, email, "Connections");
            await setDoc(docRef, { List: arrayUnion(trimmedMail) }, { merge: true });

            setConnections((prev) => [...prev, trimmedMail]);
            setAddFrndMail("");

            toast('Friend added !!', {
                duration: 2000,
                position: 'top-center',
                icon: '✅',
                style: {"backgroundColor":"var(--toast_success)","color":"white"}
            });
            } catch (err) {
            console.error("Error adding friend:", err);
            toast("Something went wrong. Please try again.", {
                duration: 2000,
                position: 'top-center',
                icon: '❌',
                style: {"backgroundColor":"var(--toast_error)","color":"white"}
            });
            } finally {
            setLoading(false);
            }
    };


    return (
        <div className='defaultWidgetDiv connections' style={{padding:"10px 0 10px 10px"}}>
            <div className="addFrnd">
                <input
                  type="email"
                  placeholder="friend@gmail.com"
                  autoComplete="off"
                  value={addFrndMail}
                  onChange={(e) => setAddFrndMail(e.target.value)}
                />
                <i onClick={addFrndMailtoDB}>Add +</i>
              </div>
            <ul style={{ marginBottom: "0px" }} className="List">
              {Array.isArray(connections) &&
                connections.map((conn, index) => (
                  <li key={index} className="connections">
                    <span>{conn} </span>
                    <i className="fa-solid fa-trash" onClick={() => deleteThisRecord(conn)}></i>
                  </li>
                ))}
            </ul>
        </div>
    )
}

export default Connections;