import React, { useState, useRef } from "react";
import toast from 'react-hot-toast';

import '../Styles/Home.css';

import { doc, updateDoc, setDoc } from "firebase/firestore";
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
      await updateDoc(doc(db, email, "generalDetails"), { displayName: name });
      setDisplayName(name); // update parent state
      console.log("Display name updated in Firestore!");

      toast('Name Changed !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '✅',
        style: {"backgroundColor":"var(--toast_success)","color":"white"}
      });
    } catch (err) {
      console.error("Error updating display name:", err);
      toast('Error !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
    } finally{
      setLoading(false);
    }
    setNameEditMode(false);
  }

  const addFirstWidget = async (widgetType) => {
    setLoading(true);
    if (widgetType === "DailyGoals"){
      try{

        await updateDoc(doc(db,email,"generalDetails"),{widgetsCount: 1});

        await setDoc(doc(db,email,widgetType),{x:0,y:0,count:0});
     
        toast(`${widgetType} added succesfully`, {
          duration: 2000,
          position: 'top-center',
          icon: '✅',
          style: {"backgroundColor":"var(--toast_success)","color":"white"}
        });
        
        setWidgetsCount(1);

      } catch (err){
        console.error("Error adding widget", err);
        toast('Error !! ', {
          duration: 2000,
          position: 'top-center',
          icon: '❌',
          style: {"backgroundColor":"var(--toast_error)","color":"white"}
        });
      } finally{
        setLoading(false);
      }
    }
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
        <li onClick={() => addFirstWidget("DailyGoals")}>Daily Goals</li>
        <li onClick={() => addFirstWidget("TTD")}>Things to Do</li>
        <li onClick={() => addFirstWidget("Dairy")}>Dairy</li>
        <li onClick={() => addFirstWidget("Notes")}>Sticky Notes</li>
        <li onClick={() => addFirstWidget("Meetings")}>Meetings</li>
        <li onClick={() => addFirstWidget("Events")}>Events / Reminder</li>
        <li onClick={() => addFirstWidget("Bookmarks")}>Bookmarks</li>
        <li onClick={() => addFirstWidget("TrackExpenses")}>Track Expenses</li>
        <li onClick={() => addFirstWidget("Book")}>Book Library</li>
        <li onClick={() => addFirstWidget("TrackProject")}>Track Project</li>
        <li onClick={() => addFirstWidget("Teams")}>Teams</li>
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
