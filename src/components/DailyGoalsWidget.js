import { useState, useEffect } from "react";
import { isMobile } from "react-device-detect";

import '../Styles/Home.css'
import '../Styles/DailyGoals.css'

import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function DailyGoalsWidget ({ key, email, x, y, setLoading, setPopup, setPopupContent, signOut }) {

  const [isWidgetEmpty, setIsWidgetEmpty] = useState(true)

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
        <div className={`defaultWidgetDiv DailyGoalsMain ${isMobile ? 'mobile' : 'desk'}`} style={{padding:"10px"}}>

          {
            (isWidgetEmpty 

              ? (
                <div className="emptyWidgetAdd" style={{width:"100%",display:"flex",justifyContent:"center",alignItems:"center"}}>
                  <button>Create Your First Goal + </button>
                </div>
              )
              :
              (<p>this widget contains data</p>)
            )
          }

        </div>
    )
}

export default DailyGoalsWidget;