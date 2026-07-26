import { useState, useEffect } from "react";
import { isMobile } from "react-device-detect";

import '../Styles/Home.css'
import '../Styles/DailyGoals.css'

import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function DailyGoalsWidget ({ key, email, x, y, setLoading, setPopup, setPopupContent, signOut }) {

  const [isWidgetEmpty, setIsWidgetEmpty] = useState(true);
  const [addGoalPage,setAddGoalPage] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");

  const [scheduleType, setScheduleType] = useState("everyday");
  const [activeDays, setActiveDays] = useState([1, 3, 5]);

  const toggleDay = (idx) => {
    setActiveDays((prev) =>
      prev.includes(idx) ? prev.filter((d) => d !== idx) : [...prev, idx].sort()
    );
  };

  const SCHEDULE_OPTIONS = [
    { id: "everyday", label: "Every day" },
    { id: "days",     label: "Particular days" },
    { id: "dates",    label: "Particular dates" },
    { id: "range",    label: "Date range" },
  ];

  const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

  const [particularDates, setParticularDates] = useState([""]);

  const [effFromDate,setEffFromDate] = useState("");
  const [effToDate,setEffToDate] = useState("");


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

  const createNewGoal = () => {
    console.log("A");
    setAddGoalPage(false);
  }

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
            <div style={{marginBottom:"30px"}}>
              <i className="fa-solid fa-chevron-left" style={{display:"inline-block"}} onClick={() => setAddGoalPage(false)}></i>
              <h3 style={{display:"inline-block"}}>Add a New Goal</h3>
            </div>
            <span style={{display:"block"}}>Title : </span>
            <input value={newGoalTitle} placeholder="Gym .." onChange={(e) => setNewGoalTitle(e.target.value)}></input>

            <div className="repeats">
              <span className="repeatLabel">Repeats : </span>
              <div className="repeatSegment" role="tablist" aria-label="Repeat schedule">
                {SCHEDULE_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    role="tab"
                    aria-selected={scheduleType === opt.id}
                    className={`repeatSegBtn ${scheduleType === opt.id ? "repeatSegBtnActive" : ""}`}
                    onClick={() => setScheduleType(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              {scheduleType === "days" && (
                <div className="repeatSubPanel angWeekdays">
                  {WEEKDAYS.map((d, idx) => (
                    <button
                      type="button"
                      key={idx}
                      className={`repeatDayDot ${activeDays.includes(idx) ? "repeatDayDotActive" : ""}`}
                      onClick={() => toggleDay(idx)}
                      aria-pressed={activeDays.includes(idx)}
                      aria-label={d}
                    >
                      {d}
                    </button>
                  ))}
                </div>
              )}

              {scheduleType === "dates" && (
                <div className="repeatSubPanel repeatDatesList">
                  {particularDates.map((date, idx) => (
                    <div key={idx} className="repeatDateRow">
                      <input
                        type="date"
                        className="repeatInput repeatDateInput"
                        value={date}
                        onChange={(e) => {
                          const newDates = [...particularDates];
                          newDates[idx] = e.target.value;
                          setParticularDates(newDates);
                        }}
                      />
                      <button
                        type="button"
                        className="repeatRemoveDate"
                        aria-label="Remove date"
                        onClick={() => {
                          setParticularDates(particularDates.filter((_, i) => i !== idx));
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="repeatAddDate"
                    onClick={() => setParticularDates([...particularDates, ""])}
                  >
                    + Add another date
                  </button>
                </div>
              )}


              {scheduleType === "range" && (
                <div className="repeatSubPanel repeatRangeRow">
                  <div className="repeatRangeField">
                    <span className="repeatRangeLabel">From</span>
                    <input type="date" className="repeatInput repeatDateInput" max={effToDate} value={effFromDate} onChange={(e) => setEffFromDate(e.target.value)} />
                  </div>
                  <div className="repeatRangeField">
                    <span className="repeatRangeLabel">To</span>
                    <input type="date" className="repeatInput repeatDateInput" min={effFromDate} value={effToDate} onChange={(e) => setEffToDate(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            <button className="saveNewGoalBtn" onClick={createNewGoal}> Save</button>
            
          </div>

        </div>
    )
}

export default DailyGoalsWidget;