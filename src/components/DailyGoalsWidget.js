import { useState, useEffect } from "react";
import toast from 'react-hot-toast';
import { isMobile } from "react-device-detect";

import '../Styles/Home.css'
import '../Styles/DailyGoals.css'

import { doc, getDoc, setDoc, arrayUnion, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function DailyGoalsWidget ({ key, email, x, y, setLoading, setPopup, setPopupContent, signOut }) {

  const [isWidgetEmpty, setIsWidgetEmpty] = useState(true);
  const [addGoalPage,setAddGoalPage] = useState(false);
  const [viewAllGoalsPage,setViewAllGoalsPage] = useState(false);
  const [newGoalTitle, setNewGoalTitle] = useState("");

  const [scheduleType, setScheduleType] = useState("everyday");
  const [activeDays, setActiveDays] = useState([1, 2, 3, 4, 5]);

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

  const [goalsList, setGoalsList] = useState([]);
  const [editingGoalId, setEditingGoalId] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);


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

  useEffect(() => {
    if (!viewAllGoalsPage || !email) return;

    const fetchGoals = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, email, "DailyGoals"));
        if (snap.exists()) {
          setGoalsList(snap.data().List || []);
        } else {
          setGoalsList([]);
        }
      } catch (err) {
        console.error("Error fetching goals:", err);
        toast("Couldn't load your goals.", {
          duration: 2000,
          position: 'top-center',
          icon: '❌',
          style: {"backgroundColor":"var(--toast_error)","color":"white"}
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGoals();
  }, [viewAllGoalsPage, email]);

  const createNewGoal = () => {
    // Basic title check
    if (!newGoalTitle.trim()) {
      toast("Please enter a goal title.", {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return;
    }

    // Schedule-specific validation
    if (scheduleType === "days" && activeDays.length === 0) {
      toast("Please select at least one day.", {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return;
    }

    if (scheduleType === "dates" && particularDates.filter((d) => d).length === 0) {
      toast("Please add at least one date.", {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return;
    }

    if (scheduleType === "range" && !effFromDate) {
      toast("Please select a start date for the range.", {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return;
    }

    // Build the schedule payload based on type
    let schedule = { type: scheduleType };
    if (scheduleType === "days") schedule.days = activeDays;
    if (scheduleType === "dates") schedule.dates = particularDates.filter((d) => d);
    if (scheduleType === "range") schedule = { ...schedule, from: effFromDate, to: effToDate || null };

    const newGoal = {
      id: Date.now().toString(),
      title: newGoalTitle.trim(),
      schedule,
      createdAt: new Date().toISOString(),
      completed: false,
    };

    saveGoalToDb(newGoal);
  };

  const saveGoalToDb = async (goalData) => {
    setLoading(true);
    try {
      const docRef = doc(db, email, "DailyGoals");
      await setDoc(docRef, { List: arrayUnion(goalData) }, { merge: true });
      await updateDoc(doc(db, email, "widgets"), {
      "DailyGoals.empty": false,
    });

      // reset form + close panel on success
      setIsWidgetEmpty(false);
      setAddGoalPage(false);
      setNewGoalTitle("");
      setScheduleType("everyday");
      setActiveDays([1, 2, 3, 4, 5]);
      setParticularDates([""]);
      setEffFromDate("");
      setEffToDate("");

      toast('Goal Added Succesfully !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '✅',
        style: {"backgroundColor":"var(--toast_success)","color":"white"}
      });
      
    } catch (err) {
      console.error("Error saving goal:", err);
      
      toast("Something went wrong while saving your goal. Please try again.", {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });

    } finally {
      setLoading(false);
    }
  };

  const updateGoalField = (goalId, updater) => {
    setGoalsList((prev) =>
      prev.map((g) => (g.id === goalId ? updater(g) : g))
    );
    setHasUnsavedChanges(true);
  };

  const toggleGoalDay = (goalId, idx) => {
    updateGoalField(goalId, (g) => {
      const days = g.schedule.days || [];
      const updated = days.includes(idx) ? days.filter((d) => d !== idx) : [...days, idx].sort();
      return { ...g, schedule: { ...g.schedule, days: updated } };
    });
  };

  const updateGoalDate = (goalId, idx, value) => {
    updateGoalField(goalId, (g) => {
      const dates = [...(g.schedule.dates || [])];
      dates[idx] = value;
      return { ...g, schedule: { ...g.schedule, dates } };
    });
  };

  const addGoalDate = (goalId) => {
    updateGoalField(goalId, (g) => ({
      ...g,
      schedule: { ...g.schedule, dates: [...(g.schedule.dates || []), ""] },
    }));
  };

  const removeGoalDate = (goalId, idx) => {
    updateGoalField(goalId, (g) => ({
      ...g,
      schedule: { ...g.schedule, dates: g.schedule.dates.filter((_, i) => i !== idx) },
    }));
  };

  const setGoalScheduleType = (goalId, type) => {
    updateGoalField(goalId, (g) => ({ ...g, schedule: { type } }));
  };

  const setGoalRangeField = (goalId, field, value) => {
    updateGoalField(goalId, (g) => ({
      ...g,
      schedule: { ...g.schedule, [field]: value },
    }));
  };

  const setGoalTitle = (goalId, value) => {
    updateGoalField(goalId, (g) => ({ ...g, title: value }));
  };

  const saveAllGoals = async () => {
    // validate every goal before writing anything
    for (const g of goalsList) {
      if (!g.title.trim()) {
        toast(`Please enter a title for all goals.`, {
          duration: 2000, position: 'top-center', icon: '❌',
          style: {"backgroundColor":"var(--toast_error)","color":"white"}
        });
        return;
      }
      const { type, days, dates, from } = g.schedule;
      if (type === "days" && (!days || days.length === 0)) {
        toast(`"${g.title}" needs at least one day selected.`, {
          duration: 2000, position: 'top-center', icon: '❌',
          style: {"backgroundColor":"var(--toast_error)","color":"white"}
        });
        return;
      }
      if (type === "dates" && (!dates || dates.filter((d) => d).length === 0)) {
        toast(`"${g.title}" needs at least one date.`, {
          duration: 2000, position: 'top-center', icon: '❌',
          style: {"backgroundColor":"var(--toast_error)","color":"white"}
        });
        return;
      }
      if (type === "range" && !from) {
        toast(`"${g.title}" needs a start date for its range.`, {
          duration: 2000, position: 'top-center', icon: '❌',
          style: {"backgroundColor":"var(--toast_error)","color":"white"}
        });
        return;
      }
    }

    setLoading(true);
    try {
      await setDoc(doc(db, email, "DailyGoals"), { List: goalsList }, { merge: true });

      if (goalsList.length === 0) {
        await updateDoc(doc(db, email, "widgets"), { "DailyGoals.empty": true });
        setIsWidgetEmpty(true);
      }

      setHasUnsavedChanges(false);
      setEditingGoalId(null);

      toast('All goals saved !!', {
        duration: 2000, position: 'top-center', icon: '✅',
        style: {"backgroundColor":"var(--toast_success)","color":"white"}
      });
    } catch (err) {
      console.error("Error saving goals:", err);
      toast("Something went wrong while saving. Please try again.", {
        duration: 2000, position: 'top-center', icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
    } finally {
      setLoading(false);
    }
  };

  const deleteGoal = (goalId) => {
    setGoalsList((prev) => prev.filter((g) => g.id !== goalId));
    setHasUnsavedChanges(true);
  };

    return (
        <div className={`defaultWidgetDiv DailyGoalsMain ${isMobile ? 'mobile' : 'desk'} ${addGoalPage ? 'add' : ''} ${viewAllGoalsPage ? 'viewall' : ''}` } style={{padding:"10px"}}>

          {
            (isWidgetEmpty 

              ? (
                <div className="emptyWidgetAdd" style={{width:"100%",display:"flex",justifyContent:"center",alignItems:"center"}}>
                  <button onClick={() => setAddGoalPage(true)}>Create Your First Goal + </button>
                </div>
              )
              :
              (
                <span onClick={() => setViewAllGoalsPage(true)}>view All</span>
              )
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

          <div className="viewAllGoals">
              <div style={{marginBottom:"30px"}}>
                <i className="fa-solid fa-chevron-left" style={{display:"inline-block"}} onClick={() => setViewAllGoalsPage(false)}></i>
                <h3 style={{display:"inline-block"}}>Goals : </h3>
              </div>

              <div className="listGoals">
                {goalsList.map((goal) => (
                  <div key={goal.id} className="goalCard">
                    {editingGoalId === goal.id ? (
                      <div className="goalEditForm">
                        <input
                          value={goal.title}
                          onChange={(e) => setGoalTitle(goal.id, e.target.value)}
                        />

                        <div className="repeatSegment" role="tablist" aria-label="Repeat schedule">
                          {SCHEDULE_OPTIONS.map((opt) => (
                            <button
                              key={opt.id}
                              type="button"
                              className={`repeatSegBtn ${goal.schedule.type === opt.id ? "repeatSegBtnActive" : ""}`}
                              onClick={() => setGoalScheduleType(goal.id, opt.id)}
                            >
                              {opt.label}
                            </button>
                          ))}
                        </div>

                        {goal.schedule.type === "days" && (
                          <div className="repeatSubPanel angWeekdays">
                            {WEEKDAYS.map((d, idx) => (
                              <button
                                type="button"
                                key={idx}
                                className={`repeatDayDot ${(goal.schedule.days || []).includes(idx) ? "repeatDayDotActive" : ""}`}
                                onClick={() => toggleGoalDay(goal.id, idx)}
                              >
                                {d}
                              </button>
                            ))}
                          </div>
                        )}

                        {goal.schedule.type === "dates" && (
                          <div className="repeatSubPanel repeatDatesList">
                            {(goal.schedule.dates || [""]).map((date, idx) => (
                              <div key={idx} className="repeatDateRow">
                                <input
                                  type="date"
                                  className="repeatInput repeatDateInput"
                                  value={date}
                                  onChange={(e) => updateGoalDate(goal.id, idx, e.target.value)}
                                />
                                <button type="button" onClick={() => removeGoalDate(goal.id, idx)}>×</button>
                              </div>
                            ))}
                            <button type="button" className="repeatAddDate" onClick={() => addGoalDate(goal.id)}>
                              + Add another date
                            </button>
                          </div>
                        )}

                        {goal.schedule.type === "range" && (
                          <div className="repeatSubPanel repeatRangeRow">
                            <div className="repeatRangeField">
                              <span className="repeatRangeLabel">From</span>
                              <input
                                type="date"
                                value={goal.schedule.from || ""}
                                onChange={(e) => setGoalRangeField(goal.id, "from", e.target.value)}
                              />
                            </div>
                            <div className="repeatRangeField">
                              <span className="repeatRangeLabel">To</span>
                              <input
                                type="date"
                                value={goal.schedule.to || ""}
                                onChange={(e) => setGoalRangeField(goal.id, "to", e.target.value)}
                              />
                            </div>
                          </div>
                        )}

                        <button onClick={() => setEditingGoalId(null)}>Done</button>
                      </div>
                    ) : (
                      <div className="goalDisplay">
                        <span>{goal.title}</span>
                        <span className="goalSchedulePreview">{goal.schedule.type}</span>
                        <i className="fa-solid fa-pen" onClick={() => setEditingGoalId(goal.id)}></i>
                        <i className="fa-solid fa-trash" onClick={() => deleteGoal(goal.id)}></i>
                      </div>
                    )}
                  </div>
                ))}

                {hasUnsavedChanges && (
                  <button className="saveAllGoalsBtn" onClick={saveAllGoals}>
                    Save Changes
                  </button>
                )}
              </div>
          </div>

        </div>
    )
}

export default DailyGoalsWidget;