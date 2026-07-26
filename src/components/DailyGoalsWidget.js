import { useState, useEffect } from "react";
import { isMobile } from "react-device-detect";

import '../Styles/Home.css'
import '../Styles/DailyGoals.css'

import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function DailyGoalsWidget ({ key, email, x, y, setLoading, setPopup, setPopupContent, signOut }) {

  const [isWidgetEmpty, setIsWidgetEmpty] = useState(true);
  const [addGoalPage,setAddGoalPage] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("Gym ..");

  useEffect(() => {
    if (!email) return;

    const fetchEmptyState = async () => {
      try {
        const snap = await getDoc(doc(db, email, "widgets"));
        if (snap.exists()) {
          const data = snap.data();
          const empty = data?.DailyGoals?.empty;
          if (empty !== undefined) {
            setIsWidgetEmpty(empty);
          }
        }
      } catch (err) {
        console.error("Error fetching DailyGoals empty state:", err);
      }
    };

    fetchEmptyState();
  }, [email]);

    return (
        <div className={`defaultWidgetDiv DailyGoalsMain ${isMobile ? 'mobile' : 'desk'} ${addGoalPage ? 'add' : ''}`} style={{padding:"10px"}}>

          {
            (isWidgetEmpty 

              ? (
                <div className="emptyWidgetAdd" style={{width:"100%",display:"flex",justifyContent:"center",alignItems:"center"}}>
                  <button onClick={() => setAddGoalPage(true)}>Create Your First Goal + </button>
                </div>
              )
              :
              (<p>this widget contains data</p>)
            )
          }

          <div className="addNewGoal">
            <div style={{marginBottom:"20px"}}>
              <i className="fa-solid fa-chevron-left" style={{display:"inline-block"}}></i>
              <h3 style={{display:"inline-block"}}>Add a New Goal</h3>
            </div>
            <span style={{display:"block"}}>Title : </span>
            <input value={newGoalTitle} onChange={(e) => setNewGoalTitle(e.target.value)}></input>
          </div>
        </div>
    )
}

export default DailyGoalsWidget;