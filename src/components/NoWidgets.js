import React, { useState, useEffect } from "react";
import toast from 'react-hot-toast';

import '../Styles/Home.css';

import { doc, updateDoc, setDoc, getDoc, writeBatch } from "firebase/firestore";
import { db } from "../firebase";

function NoWidgets({ setWidgetsCount, Signout, email, setLoading }) {

  const [name, setName] = useState("");
  const [nameEditMode, setNameEditMode] = useState(false);

  const batch = writeBatch(db);

  useEffect(() => {
    if (!email) return;

    const fetchDisplayName = async () => {
      setLoading(true);
      try {
        const userDocRef = doc(db, email, "generalDetails");
        const userSnap = await getDoc(userDocRef);

        if (userSnap.exists()) {
          setName(userSnap.data().displayName || "");
        }
      } catch (err) {
        console.error("Error fetching display name:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchDisplayName();
  }, [email]);

  const saveName = async () => {

    if (name.length == 0){
      toast('Name is empty !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return ;
    }

    setLoading(true);
    try {
      await updateDoc(doc(db, email, "generalDetails"), { displayName: name });
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

      try{

      batch.update(doc(db, email, "generalDetails"), { widgetsCount: 1,Homepage:widgetType});
      batch.set(doc(db, email, "widgets"), { [widgetType]: { x: 0, y: 0, close:"true", empty:true } }, { merge: true });
      batch.set(doc(db, email, widgetType), { empty: true }, { merge: true });

      await batch.commit();
    
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

  return (
    <section className={`addWidget ${nameEditMode ? 'editMode' : ''}`} >
      <h1>
        <span>Hello,</span> <br /> {name}
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
        <li onClick={() => addFirstWidget("Forms")}>Forms</li>
        <li onClick={() => addFirstWidget("Schedules")}>Schedules</li>
        <li onClick={() => addFirstWidget("TrackProject")}>Track Project</li>
        <li onClick={() => addFirstWidget("Teams")}>Teams</li>
      </ul>

      <button onClick={Signout} className="exit">Log Out</button>

      <div className="btns">
        <a href="https://github.com/kedarisettisatwik/planora" target="_blank" rel="noreferrer">
          FAQ ?
        </a>
        <button onClick={() => setNameEditMode(true)}>Edit Name</button>
      </div>
      <i style={{position:"absolute",bottom:"20px",opacity:"0.5"}}>Planora</i>
      <section className="editNamesection">
        <div>
          <p style={{ fontWeight:"bold",opacity: 0.6,margin:"10px 0"}}>Change Name : </p>
          <input type="text" placeholder="Enter New Name" value={name} onChange={(e) => setName(e.target.value)} style={{padding:"10px",borderRadius:"10px",border:"2px solid var(--base_color)",outline:"none"}}></input>
          <p style={{margin:"20px 0"}}> 
            <button onClick={() => {setNameEditMode(false);}} style={{display:"inline-block",margin:"0 20px 0 0",backgroundColor:"white", border:"2px solid var(--base_color)",color:"var(--base_color)"}}>Cancel</button> 
            <button onClick={() => saveName()} style={{border:"2px solid var(--base_color)"}}>Save</button>
          </p>
        </div>
      </section>
    </section>
  );
}

export default NoWidgets;