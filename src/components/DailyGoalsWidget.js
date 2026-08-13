import { useState, useEffect } from "react";
import toast from 'react-hot-toast';
import { isMobile } from "react-device-detect";
import { useMemo } from "react";

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
  const [goalsFetched, setGoalsFetched] = useState(false);


  const [note, setNote] = useState("");
  const [diaryData, setDiaryData] = useState({}); // { "2026-08-13": { note: "..." }, ... }
  const [diaryFetched, setDiaryFetched] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  const getLocalISODate = (d = new Date()) => {
    const offsetMs = d.getTimezoneOffset() * 60000;   // e.g. -330 min for IST → -19800000 ms
    return new Date(d.getTime() - offsetMs).toISOString().split("T")[0];
  };

  const today = getLocalISODate;
  const [date, setDate] = useState(today);

  const parseLocalDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  };

  const isGoalOnDate = (goal, dateStr) => {
    const { type, days, dates, from, to } = goal.schedule;

    switch (type) {
      case "everyday":
        return true;

      case "days": {
        const dayOfWeek = parseLocalDate(dateStr).getDay(); // 0 = Sun ... 6 = Sat
        return (days || []).includes(dayOfWeek);
      }

      case "dates":
        return (dates || []).includes(dateStr);

      case "range": {
        if (!from) return false;
        const afterStart = dateStr >= from;         // "YYYY-MM-DD" strings compare lexicographically = chronologically
        const beforeEnd = !to || dateStr <= to;
        return afterStart && beforeEnd;
      }

      default:
        return false;
    }
  };

  const isGoalCompletedOnDate = (goal, dateStr) =>
  (goal.completedDates || []).includes(dateStr);

  const goalsForSelectedDate = useMemo(
    () => goalsList.filter((g) => isGoalOnDate(g, date)),
    [goalsList, date]
  );

  useEffect(() => {
    if (!email) return;
    if (diaryFetched) return;

    const fetchDiary = async () => {
      try {
        const snap = await getDoc(doc(db, email, "diary"));
        setDiaryData(snap.exists() ? snap.data() : {});
        setDiaryFetched(true);
      } catch (err) {
        console.error("Error fetching diary:", err);
        toast("Couldn't load your notes.", {
          duration: 2000,
          position: 'top-center',
          icon: '❌',
          style: {"backgroundColor":"var(--toast_error)","color":"white"}
        });
      }
    };

    fetchDiary();
  }, [email, diaryFetched]);

  useEffect(() => {
      setNote(diaryData[date]?.note || "");
    }, [date, diaryData]);

    const saveNote = async (value) => {
    if (!email) return;
    setSavingNote(true);
    try {
      await setDoc(
        doc(db, email, "diary"),
        { [date]: { note: value } },
        { merge: true }
      );
      setDiaryData((prev) => ({ ...prev, [date]: { ...prev[date], note: value } }));
    } catch (err) {
      console.error("Error saving note:", err);
      toast("Couldn't save your note.", {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
    } finally {
      setSavingNote(false);
    }
  };

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
  if (!email) return;
  if (goalsFetched) return; 

  const fetchGoals = async () => {
    setLoading(true);
    try {
      const snap = await getDoc(doc(db, email, "DailyGoals"));
      if (snap.exists()) {
        setGoalsList(snap.data().List || []);
      } else {
        setGoalsList([]);
      }
      setGoalsFetched(true); 
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
      console.log(goalsList);
    }
  };

  fetchGoals();
}, [email, goalsFetched]);

useEffect(() => {
  console.log("Updated goalsList:", goalsList);
}, [goalsList]);

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
      createdAt: new Date().toISOString()
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
      setGoalsFetched(false); 

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

  const toggleGoalCompletion = async (goalId, dateStr) => {
    const updatedList = goalsList.map((g) => {
      if (g.id !== goalId) return g;
      const completedDates = g.completedDates || [];
      const alreadyDone = completedDates.includes(dateStr);
      return {
        ...g,
        completedDates: alreadyDone
          ? completedDates.filter((d) => d !== dateStr)   // uncheck
          : [...completedDates, dateStr],                  // check
      };
    });

    setGoalsList(updatedList); // optimistic UI update

    try {
      await setDoc(doc(db, email, "DailyGoals"), { List: updatedList }, { merge: true });
    } catch (err) {
      console.error("Error updating goal completion:", err);
      setGoalsList(goalsList); // revert on failure
      toast("Couldn't update goal. Please try again.", {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
    }
  };

  const sortedGoalsForSelectedDate = useMemo(() => {
      return [...goalsForSelectedDate].sort((a, b) => {
        const aDone = isGoalCompletedOnDate(a, date);
        const bDone = isGoalCompletedOnDate(b, date);
        return aDone === bDone ? 0 : aDone ? 1 : -1;
      });
    }, [goalsForSelectedDate, date]);

  const goalCounts = useMemo(() => {
    const total = goalsForSelectedDate.length;
    const completed = goalsForSelectedDate.filter((g) => isGoalCompletedOnDate(g, date)).length;
    const remaining = total - completed;
    return { total, completed, remaining };
  }, [goalsForSelectedDate, date]);

  const completionPercent = goalCounts.total === 0
  ? 0
  : Math.round((goalCounts.completed / goalCounts.total) * 100);

    return (
        <div className={`defaultWidgetDiv DailyGoalsMain ${isMobile ? 'mobile' : 'desk'} ${addGoalPage ? 'add' : ''} ${viewAllGoalsPage ? 'viewall' : ''}` } style={{padding:"0 0px 0 10px"}}>

          <div className="DailyGoalsScrollArea">
            {isWidgetEmpty ? (
              <div className="emptyWidgetAdd" style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "flex-start", gap: "12px" }}>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  style={{ outline: "none", border: "none", padding: "0 5px", cursor: "pointer", opacity: "0.6", fontWeight: "bold", background: "none" }}
                />

                <h5 style={{marginLeft:"6px"}}>Note of the Day : </h5>
                <textarea
                  className="noteDay"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onBlur={(e) => saveNote(e.target.value)}
                  placeholder="Note of the day..."
                  style={{ width: "100%",marginLeft:"5px", minHeight: "60px", resize: "vertical", borderRadius: "8px", padding: "8px", outline: "none" }}
                />
                <button onClick={() => setAddGoalPage(true)}>Create Your First Goal + </button>
              </div>
            ) : (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",marginTop:"5px" }}>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    style={{ outline: "none", border: "none", padding: "0 5px", cursor: "pointer", opacity: "0.6", fontWeight: "bold", background: "none" }}
                  />
                  <span style={{ fontSize: "12px", fontWeight: "bold", opacity: 0.6, cursor: "pointer", letterSpacing: "1px" }} onClick={() => setViewAllGoalsPage(true)}>view All</span>
                </div>

                <div className="goalsSummary" style={{ position: 'relative', margin: '15px 0 16px',paddingLeft:'5px' }}>
                <span
                  style={{
                    position: 'absolute',
                    bottom: '-25px',
                    right: '5px',
                    fontSize: '12px',
                    opacity: 0.6,
                    fontWeight: 'bold',
                  }}
                >
                  {goalCounts.completed} / {goalCounts.total}
                </span>

                <div
                  className="progressBarTrack"
                  style={{
                    width: '100%',
                    height: '6px',
                    borderRadius: '999px',
                    backgroundColor: '#e0e0e0',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    className="progressBarFill"
                    style={{
                      width: `${completionPercent}%`,
                      height: '100%',
                      borderRadius: '999px',
                      backgroundColor: 'var(--base_color)',
                      transition: 'width 0.3s ease',
                    }}
                  />
                </div>
              </div>

              <h5 style={{marginLeft:"6px"}}>Note of the Day : </h5>
              <textarea
                className="noteDay"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                onBlur={(e) => saveNote(e.target.value)}
                placeholder="Note of the day..."
                style={{ width: "100%",marginLeft:"5px",marginTop:"10px", minHeight: "60px", resize: "vertical", borderRadius: "8px", padding: "8px", outline: "none" }}
              />

                <ul className={goalsForSelectedDate.length === 0 ? "NoGoals GoalsAsOfDate" : "GoalsAsOfDate"}>
                      {sortedGoalsForSelectedDate.length === 0 ? (
                        <li className="noGoalsForDate" style={{ fontSize: '15px', textAlign: 'center', margin: '100px', opacity: 0.6, listStyle: 'none' }}>No goals for this date</li>
                      ) : (
                        sortedGoalsForSelectedDate.map((goal) => (
                          <li key={goal.id} className={isGoalCompletedOnDate(goal, date) ? "goalDone goalListItem" : "goalListItem"}>
                            <input
                              type="checkbox"
                              checked={isGoalCompletedOnDate(goal, date)}
                              onChange={() => toggleGoalCompletion(goal.id, date)}
                              style={{cursor:"pointer"}}
                            />
                            <span>
                              {goal.title}
                            </span>
                          </li>
                        ))
                      )}
                    </ul>
                    <button style={{ position: "absolute", bottom: "10px", right: "10px", padding: "10px", cursor: "pointer", border: "none", outline: "none", background: "var(--base_color)", color: "white", borderRadius: "10px" }} onClick={() => setAddGoalPage(true)}>Add Goal + </button>
                
              </>
            )}
          </div>

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
              <button style={{position:"absolute",top:"10px",right:"10px",padding:"10px",cursor:"pointer",border:"none",outline:"none",background:"var(--base_color)",color:"white",borderRadius:"10px"}} onClick={() => setAddGoalPage(true)}>Add Goal + </button>  
          </div>

                   
        </div>
    )
}

export default DailyGoalsWidget;