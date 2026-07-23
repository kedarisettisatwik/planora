import { useState, useEffect} from "react";
import { isMobile } from "react-device-detect";

import '../Styles/Home.css'

import DailyGoalsWidget1 from "./DailyGoalsWidget1";

import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function TrackExpensesWidget ({ key, email, x, y ,setLoading, setPopup, setPopupContent, signOut}){

    const [isEmpty,setIsEmpty] = useState(true);

    useEffect(() => {
        const fetchUserData = async () => {
          setLoading(true);
          try {
            const userDocRef = doc(db, email, "DailyGoals");
            const userSnap = await getDoc(userDocRef);
    
            if (userSnap.exists()) {
              const data = userSnap.data();
              setIsEmpty(data.empty);
            } else {
              setIsEmpty();
            }
    
          } catch (err) {
            console.error("Error fetching user data:", err);
          } finally {
            console.log(isEmpty);
            setLoading(false);
          }
        };
    
        fetchUserData();

    }, []);

    return (
        <div className='defaultWidgetDiv' style={{padding:"10px"}}>

            {
                (isMobile
                    ? 
                    (<></>)
                    : 
                    (<h1 style={{fontFamily:"Englebert",fontSize:"1.5em",color:"var(--base_color)",letterSpacing:"1px",marginBottom:"10px"}}>Track Expenses</h1>)
                )
            }

            {
                (isEmpty)
                ? 
                    (
                        <div>
                        </div>
                    )
                : 
                    (<DailyGoalsWidget1/>)
            }
            
        </div>
    )
}

export default TrackExpensesWidget;