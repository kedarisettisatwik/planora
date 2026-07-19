import React, { useState, useRef } from "react";
import toast from 'react-hot-toast';

import '../Styles/Home.css';

import { doc, updateDoc  } from "firebase/firestore";
import { db } from "../firebase";

function NoWidgets({ setWidgetsCount, setDisplayName, Signout, email, displayName,setLoading }) {

  const [name,setName] = useState(displayName);
  const [nameEditMode, setNameEditMode] = useState(false);

  const inputRef = useRef(null);

  const focusName = () => {
    setNameEditMode(true);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }

  const saveName = async () => {
    setLoading(true);
    try {
      const userDocRef = doc(db, email, "generalDetails");
      await updateDoc(userDocRef, { displayName: name });
      setDisplayName(name); // update parent state
      console.log("Display name updated in Firestore!");

      toast('Name Changed !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '✅',
        style: {"backgroundColor":"var(--toast_success)","color":"white"}
      });
      setLoading(false);
    } catch (err) {
      console.error("Error updating display name:", err);
      toast('Error !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      setLoading(false);
    }
    setNameEditMode(false);
  }

  return (
    <section className="addWidget">
      <h1>
        <span>Hello,</span> <br />
        <input ref={inputRef} type="text" value={name} onChange={(e) => setName(e.target.value)} readOnly={!nameEditMode}>
        </input>
      </h1>

      <p className="description">
        No widgets yet! Start building your productivity hub by adding one now.
        <br /><br />select one...
      </p>

      <ul>
        <li>Daily Goals</li>
        <li>Things to Do</li>
        <li>Dairy</li>
        <li>Sticky Notes</li>
        <li>Meetings</li>
        <li>Events / Reminder</li>
        <li>Bookmarks</li>
        <li>Track Expenses</li>
        <li>Book Library</li>
        <li>Track Project</li>
        <li>Teams</li>
      </ul>

      <button onClick={Signout} className="exit">Log Out</button>

      <div>
        <a href="https://github.com/kedarisettisatwik/planora" target="_blank" rel="noreferrer">
          FAQ ?
        </a>
        <>
        {
          (nameEditMode) ? (<button onClick={() => saveName()}>Save Name</button>) : (<button onClick={() => focusName()}>Edit Name</button>)
        }
        </>
      </div>
    </section>
  );
}

export default NoWidgets;
