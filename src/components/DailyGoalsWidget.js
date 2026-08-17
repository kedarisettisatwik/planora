import { useState, useEffect, useMemo, useRef } from "react";
import toast from "react-hot-toast";
import { isMobile } from "react-device-detect";
import * as XLSX from "xlsx";

import "../Styles/Home.css";
import "../Styles/DailyGoals.css";

import goalIcon1 from "../assests/iconsGoal/icon1.png";
import goalIcon2 from "../assests/iconsGoal/icon2.png";
import goalIcon3 from "../assests/iconsGoal/icon3.png";
import goalIcon4 from "../assests/iconsGoal/icon4.png";
import goalIcon5 from "../assests/iconsGoal/icon5.png";
import goalIcon6 from "../assests/iconsGoal/icon6.png";
import goalIcon7 from "../assests/iconsGoal/icon7.png";
import goalIcon8 from "../assests/iconsGoal/icon8.png";
import goalIcon9 from "../assests/iconsGoal/icon9.png";
import goalIcon10 from "../assests/iconsGoal/icon10.png";
import goalIcon11 from "../assests/iconsGoal/icon11.png";
import goalIcon12 from "../assests/iconsGoal/icon12.png";
import goalIcon13 from "../assests/iconsGoal/icon13.png";
import goalIcon14 from "../assests/iconsGoal/icon14.png";
import goalIcon15 from "../assests/iconsGoal/icon15.png";
import goalIcon16 from "../assests/iconsGoal/icon16.png";
import goalIcon17 from "../assests/iconsGoal/icon17.png";
import goalIcon18 from "../assests/iconsGoal/icon18.png";
import goalIcon19 from "../assests/iconsGoal/icon19.png";
import goalIcon20 from "../assests/iconsGoal/icon20.png";
import goalIcon21 from "../assests/iconsGoal/icon21.png";
import goalIcon22 from "../assests/iconsGoal/icon22.png";
import goalIcon23 from "../assests/iconsGoal/icon23.png";
import goalIcon24 from "../assests/iconsGoal/icon24.png";
import goalIcon25 from "../assests/iconsGoal/icon25.png";
import goalIcon26 from "../assests/iconsGoal/icon26.png";
import goalIcon27 from "../assests/iconsGoal/icon27.png";
import goalIcon28 from "../assests/iconsGoal/icon28.png";
import goalIcon29 from "../assests/iconsGoal/icon29.png";
import goalIcon30 from "../assests/iconsGoal/icon30.png";

import ReportsMain from "./ReportsMain";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";

import { auth, db } from "../firebase";

function DailyGoalsWidget({
  key,
  email,
  x,
  y,
  setLoading,
  setPopup,
  setPopupContent,
  signOut,
}) {

  const [refreshState, setRefreshState] = useState(0);

  const [contextMenu, setContextMenu] = useState({
      visible: false,
      x: 0,
      y: 0,
  });

  const handleRightClick = (e) => {
      e.preventDefault();

      setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      });
  };

  const [isWidgetEmpty, setIsWidgetEmpty] = useState(true);

  const [addGoalPage, setAddGoalPage] = useState(false);
  const [viewAllGoalsPage, setViewAllGoalsPage] = useState(false);
  const [viewReports, setViewReports] = useState(false);

  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newGoalType, setNewGoalType] = useState("checklist");
  const [newGoalTrackerUnit, setNewGoalTrackerUnit] = useState("count");

  // ---------------------------------------------------------
  // GOAL ICON
  // ---------------------------------------------------------
  // iconMode: "none" | "select" | "emoji"
  const [newGoalIconMode, setNewGoalIconMode] = useState("none");
  const [newGoalSelectedIcon, setNewGoalSelectedIcon] = useState("");
  const [newGoalCustomEmoji, setNewGoalCustomEmoji] = useState("");

  const ICON_OPTIONS = [
    // Replace these with your actual 12 icon file names/paths.
    // "value" is what gets stored in the DB, "src" is what gets rendered.
    { id: "icon1", value: "icon1", src: goalIcon1 },
    { id: "icon2", value: "icon2", src: goalIcon2 },
    { id: "icon3", value: "icon3", src: goalIcon3 },
    { id: "icon4", value: "icon4", src: goalIcon4 },
    { id: "icon5", value: "icon5", src: goalIcon5 },
    { id: "icon6", value: "icon6", src: goalIcon6 },
    { id: "icon7", value: "icon7", src: goalIcon7 },
    { id: "icon8", value: "icon8", src: goalIcon8 },
    { id: "icon9", value: "icon9", src: goalIcon9},
    { id: "icon10", value: "icon10", src: goalIcon10 },
    { id: "icon11", value: "icon11", src: goalIcon11 },
    { id: "icon12", value: "icon12", src: goalIcon12 },
    { id: "icon13", value: "icon13", src: goalIcon13 },
    { id: "icon14", value: "icon14", src: goalIcon14 },
    { id: "icon15", value: "icon15", src: goalIcon15 },
    { id: "icon16", value: "icon16", src: goalIcon16 },
    { id: "icon17", value: "icon17", src: goalIcon17 },
    { id: "icon18", value: "icon18", src: goalIcon18 },
    { id: "icon19", value: "icon19", src: goalIcon19 },
    { id: "icon20", value: "icon20", src: goalIcon20 },
    { id: "icon21", value: "icon21", src: goalIcon21 },
    { id: "icon22", value: "icon22", src: goalIcon22 },
    { id: "icon23", value: "icon23", src: goalIcon23 },
    { id: "icon24", value: "icon24", src: goalIcon24 },
    { id: "icon25", value: "icon25", src: goalIcon25 },
    { id: "icon26", value: "icon26", src: goalIcon26 },
    { id: "icon27", value: "icon27", src: goalIcon27 },
    { id: "icon28", value: "icon28", src: goalIcon28 },
    { id: "icon29", value: "icon29", src: goalIcon29 },
    { id: "icon30", value: "icon30", src: goalIcon30 }
  ];

  const [MoreOptions, SetMoreOptions] = useState(false);
  const [importingExcel, setImportingExcel] =  useState(false);

  const fileInputRef = useRef(null);

  const GOAL_TYPE_OPTIONS = [
    { id: "checklist", label: "Checkbox" },
    { id: "tracker", label: "Tracker" },
  ];

  const TRACKER_UNIT_OPTIONS = [
    { id: "count", label: "Count" },
    { id: "time", label: "Time (mins)" },
  ];

  const [scheduleType, setScheduleType] = useState("everyday");
  const [activeDays, setActiveDays] = useState([1, 2, 3, 4, 5]);

  const toggleDay = (idx) => {
    setActiveDays((prev) =>
      prev.includes(idx)
        ? prev.filter((d) => d !== idx)
        : [...prev, idx].sort()
    );
  };

  const SCHEDULE_OPTIONS = [
    { id: "everyday", label: "Every day" },
    { id: "days", label: "Particular days" },
    { id: "dates", label: "Particular dates" },
    { id: "range", label: "Date range" },
  ];

  const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

  const [particularDates, setParticularDates] = useState([""]);

  const [effFromDate, setEffFromDate] = useState("");
  const [effToDate, setEffToDate] = useState("");

  const [goalsList, setGoalsList] = useState([]);
  const [editingGoalId, setEditingGoalId] = useState(null);
  // iconMode used while editing an existing goal: "none" | "select" | "emoji"
  const [editIconMode, setEditIconMode] = useState("none");
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [goalsFetched, setGoalsFetched] = useState(false);

  // Holds tracker input values while user is typing
  const [trackerDrafts, setTrackerDrafts] = useState({});

  const [note, setNote] = useState("");
  const [diaryData, setDiaryData] = useState({});
  const [diaryFetched, setDiaryFetched] = useState(false);
  const [savingNote, setSavingNote] = useState(false);

  // ---------------------------------------------------------
  // DATE HELPERS
  // ---------------------------------------------------------

  const getLocalISODate = (d = new Date()) => {
    const offsetMs = d.getTimezoneOffset() * 60000;

    return new Date(d.getTime() - offsetMs)
      .toISOString()
      .split("T")[0];
  };

  // Fixed: calling the function
  const today = getLocalISODate();

  const [date, setDate] = useState(today);

  const parseLocalDate = (dateStr) => {
    const [y, m, d] = dateStr.split("-").map(Number);

    return new Date(y, m - 1, d);
  };

  // ---------------------------------------------------------
  // GOAL HELPERS
  // ---------------------------------------------------------

  const isGoalOnDate = (goal, dateStr) => {
    const { type, days, dates, from, to } = goal.schedule;

    switch (type) {
      case "everyday":
        return true;

      case "days": {
        const dayOfWeek = parseLocalDate(dateStr).getDay();

        return (days || []).includes(dayOfWeek);
      }

      case "dates":
        return (dates || []).includes(dateStr);

      case "range": {
        if (!from) return false;

        const afterStart = dateStr >= from;
        const beforeEnd = !to || dateStr <= to;

        return afterStart && beforeEnd;
      }

      default:
        return false;
    }
  };

  const isGoalCompletedOnDate = (goal, dateStr) => {
    if ((goal.goalType || "checklist") === "tracker") {
      const val = (goal.trackerValues || {})[dateStr];

      return (
        val !== undefined &&
        val !== null &&
        val !== "" &&
        Number(val) > 0
      );
    }

    return (goal.completedDates || []).includes(dateStr);
  };

  const goalsForSelectedDate = useMemo(
    () => goalsList.filter((g) => isGoalOnDate(g, date)),
    [goalsList, date]
  );

  // ---------------------------------------------------------
  // DIARY
  // ---------------------------------------------------------

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
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor: "var(--toast_error)",
            color: "white",
          },
        });
      }
    };

    fetchDiary();
  }, [email, diaryFetched, refreshState]);

  useEffect(() => {
    setNote(diaryData[date]?.note || "");
  }, [date, diaryData,refreshState]);

  useEffect(() => {
    setTrackerDrafts({});
  }, [date,refreshState]);

  const saveNote = async (value) => {
    if (!email) return;

    setSavingNote(true);

    try {
      await setDoc(
        doc(db, email, "diary"),
        {
          [date]: {
            note: value,
          },
        },
        {
          merge: true,
        }
      );

      setDiaryData((prev) => ({
        ...prev,
        [date]: {
          ...prev[date],
          note: value,
        },
      }));
    } catch (err) {
      console.error("Error saving note:", err);

      toast("Couldn't save your note.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });
    } finally {
      setSavingNote(false);
    }
  };

  // ---------------------------------------------------------
  // WIDGET EMPTY STATE
  // ---------------------------------------------------------

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
  }, [email,refreshState]);

  // ---------------------------------------------------------
  // FETCH GOALS
  //
  // NEW STRUCTURE:
  //
  // email
  //   └── DailyGoals
  //        └── ListGoals
  //             ├── UUID-1
  //             ├── UUID-2
  //             └── UUID-3
  // ---------------------------------------------------------

  useEffect(() => {
    if (!email) return;
    if (goalsFetched) return;

    const fetchGoals = async () => {
      setLoading(true);

      try {
        const goalsCollectionRef = collection(
          db,
          email,
          "DailyGoals",
          "ListGoals"
        );

        const snapshot = await getDocs(goalsCollectionRef);

        const goals = snapshot.docs.map((goalDoc) => ({
          id: goalDoc.id,
          ...goalDoc.data(),
        }));

        setGoalsList(goals);
        setGoalsFetched(true);
      } catch (err) {
        console.error("Error fetching goals:", err);

        toast("Couldn't load your goals.", {
          duration: 2000,
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor: "var(--toast_error)",
            color: "white",
          },
        });
      } finally {
        setLoading(false);
      }
    };

    fetchGoals();
  }, [email, goalsFetched, setLoading,refreshState]);

  useEffect(() => {
    console.log("Updated goalsList:", goalsList);
  }, [goalsList,refreshState]);

  // ---------------------------------------------------------
  // CREATE NEW GOAL
  // ---------------------------------------------------------

  const createNewGoal = () => {
    // Basic title validation
    if (!newGoalTitle.trim()) {
      toast("Please enter a goal title.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });

      return;
    }

    // Schedule validation
    if (scheduleType === "days" && activeDays.length === 0) {
      toast("Please select at least one day.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });

      return;
    }

    if (
      scheduleType === "dates" &&
      particularDates.filter((d) => d).length === 0
    ) {
      toast("Please add at least one date.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });

      return;
    }

    if (scheduleType === "range" && !effFromDate) {
      toast("Please select a start date for the range.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });

      return;
    }

    // Icon validation
    if (newGoalIconMode === "select" && !newGoalSelectedIcon) {
      toast("Please select an icon.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });

      return;
    }

    if (newGoalIconMode === "emoji" && !newGoalCustomEmoji.trim()) {
      toast("Please enter an emoji.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });

      return;
    }

    // Resolve final icon value to store in DB
    const icon =
      newGoalIconMode === "select"
        ? newGoalSelectedIcon
        : newGoalIconMode === "emoji"
        ? newGoalCustomEmoji.trim()
        : "";

    // Build schedule
    let schedule = {
      type: scheduleType,
    };

    if (scheduleType === "days") {
      schedule.days = activeDays;
    }

    if (scheduleType === "dates") {
      schedule.dates = particularDates.filter((d) => d);
    }

    if (scheduleType === "range") {
      schedule = {
        ...schedule,
        from: effFromDate,
        to: effToDate || null,
      };
    }

    // Create UUID
    const goalId = newGoalTitle.trim() + "__" + crypto.randomUUID();

    const newGoal = {
      id: goalId,
      title: newGoalTitle.trim(),
      icon,
      schedule,
      goalType: newGoalType,
      createdAt: new Date().toISOString(),

      ...(newGoalType === "tracker"
        ? {
            trackerUnit: newGoalTrackerUnit,
            trackerValues: {},
          }
        : {
            completedDates: [],
          }),
    };

    saveGoalToDb(newGoal);
  };

  // ---------------------------------------------------------
  // SAVE NEW GOAL
  //
  // NEW:
  //
  // DailyGoals
  //   └── ListGoals
  //        └── goal UUID
  //             └── goal fields
  // ---------------------------------------------------------

  const saveGoalToDb = async (goalData) => {
    setLoading(true);

    try {
      const goalRef = doc(
        db,
        email,
        "DailyGoals",
        "ListGoals",
        goalData.id
      );

      // Don't store ID as a field because it is already
      // the Firestore document ID.
      const { id, ...goalDataWithoutId } = goalData;

      await setDoc(goalRef, goalDataWithoutId);

      // Update widget empty state
      await updateDoc(doc(db, email, "widgets"), {
        "DailyGoals.empty": false,
      });

      // Optimistic/local UI update
      setGoalsList((prev) => [...prev, goalData]);

      // Reset form
      setIsWidgetEmpty(false);
      setAddGoalPage(false);

      setNewGoalTitle("");
      setNewGoalType("checklist");
      setNewGoalTrackerUnit("count");

      setNewGoalIconMode("none");
      setNewGoalSelectedIcon("");
      setNewGoalCustomEmoji("");

      setScheduleType("everyday");
      setActiveDays([1, 2, 3, 4, 5]);

      setParticularDates([""]);

      setEffFromDate("");
      setEffToDate("");

      setGoalsFetched(true);

      toast("Goal Added Successfully !!", {
        duration: 2000,
        position: "top-center",
        icon: "✅",
        style: {
          backgroundColor: "var(--toast_success)",
          color: "white",
        },
      });
    } catch (err) {
      console.error("Error saving goal:", err);

      toast(
        "Something went wrong while saving your goal. Please try again.",
        {
          duration: 2000,
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor: "var(--toast_error)",
            color: "white",
          },
        }
      );
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // LOCAL GOAL UPDATE
  // ---------------------------------------------------------

  const updateGoalField = (goalId, updater) => {
    setGoalsList((prev) =>
      prev.map((g) => (g.id === goalId ? updater(g) : g))
    );

    setHasUnsavedChanges(true);
  };

  // ---------------------------------------------------------
  // SCHEDULE EDITING
  // ---------------------------------------------------------

  const toggleGoalDay = (goalId, idx) => {
    updateGoalField(goalId, (g) => {
      const days = g.schedule.days || [];

      const updated = days.includes(idx)
        ? days.filter((d) => d !== idx)
        : [...days, idx].sort();

      return {
        ...g,
        schedule: {
          ...g.schedule,
          days: updated,
        },
      };
    });
  };

  const updateGoalDate = (goalId, idx, value) => {
    updateGoalField(goalId, (g) => {
      const dates = [...(g.schedule.dates || [])];

      dates[idx] = value;

      return {
        ...g,
        schedule: {
          ...g.schedule,
          dates,
        },
      };
    });
  };

  const addGoalDate = (goalId) => {
    updateGoalField(goalId, (g) => ({
      ...g,
      schedule: {
        ...g.schedule,
        dates: [...(g.schedule.dates || []), ""],
      },
    }));
  };

  const removeGoalDate = (goalId, idx) => {
    updateGoalField(goalId, (g) => ({
      ...g,
      schedule: {
        ...g.schedule,
        dates: g.schedule.dates.filter((_, i) => i !== idx),
      },
    }));
  };

  const setGoalScheduleType = (goalId, type) => {
    updateGoalField(goalId, (g) => ({
      ...g,
      schedule: {
        type,
      },
    }));
  };

  const setGoalRangeField = (goalId, field, value) => {
    updateGoalField(goalId, (g) => ({
      ...g,
      schedule: {
        ...g.schedule,
        [field]: value,
      },
    }));
  };

  const setGoalTitle = (goalId, value) => {
    updateGoalField(goalId, (g) => ({
      ...g,
      title: value,
    }));
  };

  const setGoalIcon = (goalId, value) => {
    updateGoalField(goalId, (g) => ({
      ...g,
      icon: value,
    }));
  };

  // Figures out which icon mode a goal's current icon value belongs to,
  // so the edit form opens on the right option ("no icon" / "select" / "your own emoji").
  const getIconModeForValue = (iconValue) => {
    if (!iconValue) return "none";

    return ICON_OPTIONS.some((o) => o.value === iconValue) ? "select" : "emoji";
  };

  const startEditingGoal = (goal) => {
    setEditIconMode(getIconModeForValue(goal.icon));
    setEditingGoalId(goal.id);
  };

  // ---------------------------------------------------------
  // SAVE ALL EDITED GOALS
  //
  // NEW:
  // Instead of saving one big array,
  // update each individual goal document.
  // ---------------------------------------------------------

  const saveAllGoals = async () => {
    // Validate every goal
    for (const g of goalsList) {
      if (!g.title.trim()) {
        toast("Please enter a title for all goals.", {
          duration: 2000,
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor: "var(--toast_error)",
            color: "white",
          },
        });

        return;
      }

      const { type, days, dates, from } = g.schedule;

      if (type === "days" && (!days || days.length === 0)) {
        toast(`"${g.title}" needs at least one day selected.`, {
          duration: 2000,
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor: "var(--toast_error)",
            color: "white",
          },
        });

        return;
      }

      if (
        type === "dates" &&
        (!dates || dates.filter((d) => d).length === 0)
      ) {
        toast(`"${g.title}" needs at least one date.`, {
          duration: 2000,
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor: "var(--toast_error)",
            color: "white",
          },
        });

        return;
      }

      if (type === "range" && !from) {
        toast(`"${g.title}" needs a start date for its range.`, {
          duration: 2000,
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor: "var(--toast_error)",
            color: "white",
          },
        });

        return;
      }
    }

    setLoading(true);

    try {
      // Save each goal as its own Firestore document
      for (const goal of goalsList) {
        const goalRef = doc(
          db,
          email,
          "DailyGoals",
          "ListGoals",
          goal.id
        );

        // Don't save ID as a field
        const { id, ...goalData } = goal;

        await setDoc(goalRef, goalData, {
          merge: true,
        });
      }

      setHasUnsavedChanges(false);
      setEditingGoalId(null);

      toast("All goals saved !!", {
        duration: 2000,
        position: "top-center",
        icon: "✅",
        style: {
          backgroundColor: "var(--toast_success)",
          color: "white",
        },
      });
    } catch (err) {
      console.error("Error saving goals:", err);

      toast("Something went wrong while saving. Please try again.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });
    } finally {
      setLoading(false);
    }
  };

  // ---------------------------------------------------------
  // DELETE GOAL
  // ---------------------------------------------------------

  const deleteGoal = async (goalId) => {
    const previousGoals = goalsList;

    // Optimistic UI update
    setGoalsList((prev) =>
      prev.filter((g) => g.id !== goalId)
    );

    try {
      const goalRef = doc(
        db,
        email,
        "DailyGoals",
        "ListGoals",
        goalId
      );

      await deleteDoc(goalRef);

      // If this was the last goal
      if (previousGoals.length === 1) {
        await updateDoc(doc(db, email, "widgets"), {
          "DailyGoals.empty": true,
        });

        setIsWidgetEmpty(true);
      }
    } catch (err) {
      console.error("Error deleting goal:", err);

      // Revert UI
      setGoalsList(previousGoals);

      toast("Couldn't delete goal.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });
    }
  };

  // ---------------------------------------------------------
  // TOGGLE CHECKLIST COMPLETION
  //
  // Only updates ONE goal document.
  // ---------------------------------------------------------

  const toggleGoalCompletion = async (goalId, dateStr) => {
    const goal = goalsList.find((g) => g.id === goalId);

    if (!goal) return;

    const completedDates = goal.completedDates || [];

    const alreadyDone = completedDates.includes(dateStr);

    const updatedCompletedDates = alreadyDone
      ? completedDates.filter((d) => d !== dateStr)
      : [...completedDates, dateStr];

    // Optimistic UI update
    setGoalsList((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              completedDates: updatedCompletedDates,
            }
          : g
      )
    );

    try {
      const goalRef = doc(
        db,
        email,
        "DailyGoals",
        "ListGoals",
        goalId
      );

      await updateDoc(goalRef, {
        completedDates: updatedCompletedDates,
      });
    } catch (err) {
      console.error("Error updating goal completion:", err);

      // Revert
      setGoalsList((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? {
                ...g,
                completedDates,
              }
            : g
        )
      );

      toast("Couldn't update goal. Please try again.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });
    }
  };

  // ---------------------------------------------------------
  // TRACKER VALUE
  //
  // Only updates ONE goal document.
  // ---------------------------------------------------------

  const setGoalTrackerValue = async (
    goalId,
    dateStr,
    rawValue
  ) => {
    const goal = goalsList.find((g) => g.id === goalId);

    if (!goal) return;

    const previousTrackerValues = {
      ...(goal.trackerValues || {}),
    };

    const trackerValues = {
      ...previousTrackerValues,
    };

    if (
      rawValue === "" ||
      rawValue === undefined ||
      rawValue === null ||
      isNaN(rawValue)
    ) {
      delete trackerValues[dateStr];
    } else {
      trackerValues[dateStr] = Number(rawValue);
    }

    // Optimistic UI update
    setGoalsList((prev) =>
      prev.map((g) =>
        g.id === goalId
          ? {
              ...g,
              trackerValues,
            }
          : g
      )
    );

    try {
      const goalRef = doc(
        db,
        email,
        "DailyGoals",
        "ListGoals",
        goalId
      );

      await updateDoc(goalRef, {
        trackerValues,
      });
    } catch (err) {
      console.error("Error updating tracker value:", err);

      // Revert
      setGoalsList((prev) =>
        prev.map((g) =>
          g.id === goalId
            ? {
                ...g,
                trackerValues: previousTrackerValues,
              }
            : g
        )
      );

      toast("Couldn't update goal. Please try again.", {
        duration: 2000,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });
    }
  };

  // ---------------------------------------------------------
  // TRACKER INPUT
  // ---------------------------------------------------------

  const getTrackerInputValue = (goal, dateStr) => {
    if (goal.id in trackerDrafts) {
      return trackerDrafts[goal.id];
    }

    const val = (goal.trackerValues || {})[dateStr];

    return val === undefined || val === null ? "" : val;
  };

  const handleTrackerInputChange = (goalId, value) => {
    setTrackerDrafts((prev) => ({
      ...prev,
      [goalId]: value,
    }));
  };

  const handleTrackerInputBlur = (goal, dateStr) => {
    if (!(goal.id in trackerDrafts)) return;

    const value = trackerDrafts[goal.id];

    setGoalTrackerValue(
      goal.id,
      dateStr,
      value
    );

    setTrackerDrafts((prev) => {
      const next = {
        ...prev,
      };

      delete next[goal.id];

      return next;
    });
  };

  // ---------------------------------------------------------
  // SORTING
  // ---------------------------------------------------------

  const sortedGoalsForSelectedDate = useMemo(() => {
    return [...goalsForSelectedDate].sort((a, b) => {
      const aType = a.goalType || "checklist";
      const bType = b.goalType || "checklist";

      const aCompleted = isGoalCompletedOnDate(a, date);
      const bCompleted = isGoalCompletedOnDate(b, date);

      const getPriority = (goalType, completed) => {
        if (goalType === "tracker") return 1;
        if (!completed) return 2; // active checklist
        return 3; // completed checklist
      };

      return getPriority(aType, aCompleted) - getPriority(bType, bCompleted);
    });
  }, [goalsForSelectedDate, date]);

  // ---------------------------------------------------------
  // GOAL COUNTS
  // ---------------------------------------------------------

  const goalCounts = useMemo(() => {
    const total = goalsForSelectedDate.length;

    const completed = goalsForSelectedDate.filter((g) =>
      isGoalCompletedOnDate(g, date)
    ).length;

    const remaining = total - completed;

    return {
      total,
      completed,
      remaining,
    };
  }, [goalsForSelectedDate, date]);

  const completionPercent =
    goalCounts.total === 0
      ? 0
      : Math.round(
          (goalCounts.completed / goalCounts.total) * 100
        );


  const downloadTemplate = () => {
    // First row / headers
    const headers = [
      "Date",
      ...goalsList.map((goal) => goal.id),
    ];

    // Create worksheet with only the header row
    const worksheet = XLSX.utils.aoa_to_sheet([
      headers,
    ]);

    // Set column widths
    worksheet["!cols"] = [
      { wch: 15 }, // Date
      ...goalsList.map(() => ({ wch: 45 })),
    ];

    // Create workbook
    const workbook = XLSX.utils.book_new();

    // Add worksheet
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      "Goals"
    );

    // Download
    XLSX.writeFile(
      workbook,
      "DailyGoals_Template.xlsx"
    );
  };

  const parseExcelDate = (value) => {
    // ---------------------------------------------------------
    // JavaScript Date
    // ---------------------------------------------------------

    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        return null;
      }

      return getLocalISODate(value);
    }

    // ---------------------------------------------------------
    // Excel serial date
    // ---------------------------------------------------------

    if (typeof value === "number") {
      const excelDate =
        XLSX.SSF.parse_date_code(value);

      if (!excelDate) {
        return null;
      }

      const date = new Date(
        excelDate.y,
        excelDate.m - 1,
        excelDate.d
      );

      return getLocalISODate(date);
    }

    // ---------------------------------------------------------
    // String date
    // ---------------------------------------------------------

    if (typeof value === "string") {
      const trimmed = value.trim();

      if (!trimmed) {
        return null;
      }

      // YYYY-MM-DD
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
      ) {
        const [year, month, day] =
          trimmed.split("-").map(Number);

        const date = new Date(
          year,
          month - 1,
          day
        );

        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day
        ) {
          return null;
        }

        return trimmed;
      }

      // MM/DD/YYYY or M/D/YYYY
      const match = trimmed.match(
        /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/
      );

      if (match) {
        const month = Number(match[1]);
        const day = Number(match[2]);
        const year = Number(match[3]);

        const date = new Date(
          year,
          month - 1,
          day
        );

        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day
        ) {
          return null;
        }

        return `${year}-${String(month).padStart(
          2,
          "0"
        )}-${String(day).padStart(2, "0")}`;
      }
    }

    return null;
  };

  const uploadTemplate = async (file) => {
    if (!file) return;

    setLoading(true);

    try {
      // =========================================================
      // 1. READ EXCEL FILE
      // =========================================================

      const arrayBuffer = await file.arrayBuffer();

      const workbook = XLSX.read(arrayBuffer, {
        type: "array",
        cellDates: true,
      });

      if (!workbook.SheetNames.length) {
        throw new Error("Excel file does not contain any sheet.");
      }

      const worksheet =
        workbook.Sheets[workbook.SheetNames[0]];

      // Read Excel as 2D array
      const rows = XLSX.utils.sheet_to_json(
        worksheet,
        {
          header: 1,
          defval: null,
          raw: true,
        }
      );

      if (!rows.length) {
        throw new Error("Excel file is empty.");
      }

      // =========================================================
      // 2. READ HEADERS
      // =========================================================

      const headers = rows[0];

      if (!headers || headers.length === 0) {
        throw new Error("Excel file does not contain headers.");
      }

      // First header MUST be Date
      if (String(headers[0]).trim() !== "Date") {
        throw new Error(
          'First column header must be "Date".'
        );
      }

      // =========================================================
      // 3. GET CURRENT GOAL IDS
      // =========================================================

      const goalMap = new Map();

      goalsList.forEach((goal) => {
        goalMap.set(goal.id, goal);
      });

      // =========================================================
      // 4. VALIDATE GOAL ID HEADERS
      // =========================================================

      const excelGoalIds = headers
        .slice(1)
        .filter(
          (header) =>
            header !== null &&
            header !== undefined &&
            String(header).trim() !== ""
        )
        .map((header) => String(header).trim());

      if (excelGoalIds.length === 0) {
        throw new Error(
          "No Goal IDs were found in the Excel header."
        );
      }

      // Check duplicate Goal IDs
      const uniqueGoalIds = new Set(excelGoalIds);

      if (uniqueGoalIds.size !== excelGoalIds.length) {
        throw new Error(
          "Duplicate Goal IDs found in the Excel header."
        );
      }

      // Check every Excel Goal ID exists in DB/current goals
      const invalidGoalIds = excelGoalIds.filter(
        (goalId) => !goalMap.has(goalId)
      );

      if (invalidGoalIds.length > 0) {
        throw new Error(
          `Invalid Goal ID(s) found:\n${invalidGoalIds.join(
            ", "
          )}`
        );
      }

      // =========================================================
      // 5. VALIDATE DATES
      // =========================================================

      const dataRows = rows.slice(1);

      if (dataRows.length === 0) {
        throw new Error(
          "Excel file does not contain any data rows."
        );
      }

      const parsedRows = [];

      for (let rowIndex = 0; rowIndex < dataRows.length; rowIndex++) {
        const row = dataRows[rowIndex];

        const excelRowNumber = rowIndex + 2;

        const dateCell = row[0];

        if (
          dateCell === null ||
          dateCell === undefined ||
          dateCell === ""
        ) {
          throw new Error(
            `Date is missing in row ${excelRowNumber}.`
          );
        }

        const parsedDate = parseExcelDate(dateCell);

        if (!parsedDate) {
          throw new Error(
            `Invalid date in row ${excelRowNumber}.`
          );
        }

        parsedRows.push({
          row,
          date: parsedDate,
        });
      }

      // =========================================================
      // 6. PREPARE FIRESTORE UPDATES
      // =========================================================

      const updatedGoals = new Map();

      goalsList.forEach((goal) => {
        updatedGoals.set(goal.id, {
          ...goal,

          completedDates: [
            ...(goal.completedDates || []),
          ],

          trackerValues: {
            ...(goal.trackerValues || {}),
          },
        });
      });

      // =========================================================
      // 7. PROCESS EACH ROW
      // =========================================================

      parsedRows.forEach(({ row, date }) => {
        excelGoalIds.forEach((goalId, goalIndex) => {
          const goal = updatedGoals.get(goalId);

          if (!goal) return;

          // Excel column:
          //
          // A = date
          // B = goal index 0
          // C = goal index 1
          //
          const cellValue = row[goalIndex + 1];

          // Empty cell = nothing to update
          if (
            cellValue === null ||
            cellValue === undefined ||
            cellValue === ""
          ) {
            return;
          }

          // =====================================================
          // CHECKLIST
          // =====================================================

          if (
            (goal.goalType || "checklist") ===
            "checklist"
          ) {
            /*
            * For checklist:
            *
            * 1 = completed
            * 0 = not completed
            */

            if (
              cellValue !== 1 &&
              cellValue !== "1" &&
              cellValue !== 0 &&
              cellValue !== "0"
            ) {
              throw new Error(
                `Invalid checklist value for Goal ID "${goalId}" on ${date}. Use 1 or 0.`
              );
            }

            const isCompleted =
              Number(cellValue) === 1;

            const completedDates =
              goal.completedDates || [];

            if (isCompleted) {
              // Add date if it doesn't already exist
              if (
                !completedDates.includes(date)
              ) {
                completedDates.push(date);
              }
            } else {
              // Remove date if Excel says 0
              goal.completedDates =
                completedDates.filter(
                  (d) => d !== date
                );

              updatedGoals.set(goalId, goal);

              return;
            }

            goal.completedDates =
              completedDates;
          }

          // =====================================================
          // TRACKER
          // =====================================================

          else if (
            goal.goalType === "tracker"
          ) {
            const numericValue =
              Number(cellValue);

            if (isNaN(numericValue)) {
              throw new Error(
                `Invalid tracker value for Goal ID "${goalId}" on ${date}.`
              );
            }

            goal.trackerValues = {
              ...(goal.trackerValues || {}),
              [date]: numericValue,
            };
          }

          updatedGoals.set(goalId, goal);
        });
      });

      // =========================================================
      // 8. SAVE EACH GOAL TO FIRESTORE
      // =========================================================

      for (const [goalId, goal] of updatedGoals) {
        const goalRef = doc(
          db,
          email,
          "DailyGoals",
          "ListGoals",
          goalId
        );

        const firestoreData = {
          completedDates:
            goal.completedDates || [],

          trackerValues:
            goal.trackerValues || {},
        };

        await updateDoc(
          goalRef,
          firestoreData
        );
      }

      // =========================================================
      // 9. UPDATE LOCAL STATE
      // =========================================================

      setGoalsList(
        Array.from(updatedGoals.values())
      );

      // =========================================================
      // 10. SUCCESS
      // =========================================================

      toast(
        "Excel data imported successfully!",
        {
          duration: 2500,
          position: "top-center",
          icon: "✅",
          style: {
            backgroundColor:
              "var(--toast_success)",
            color: "white",
          },
        }
      );
    } catch (err) {
      console.error(
        "Error importing Excel:",
        err
      );

      toast(
        err.message ||
          "Something went wrong while importing the Excel file.",
        {
          duration: 4000,
          position: "top-center",
          icon: "❌",
          style: {
            backgroundColor:
              "var(--toast_error)",
            color: "white",
          },
        }
      );
    } finally {
      setLoading(false);
    }
  };

  const handleUploadClick = () => fileInputRef.current?.click();

  const handleExcelUpload = async (e) => {
    const file = e.target.files?.[0];

    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      toast("Please select an XLSX file.", {
        duration: 2500,
        position: "top-center",
        icon: "❌",
        style: {
          backgroundColor: "var(--toast_error)",
          color: "white",
        },
      });

      e.target.value = "";
      return;
    }

    await uploadTemplate(file);

    // Allow selecting the same file again
    e.target.value = "";
  };

  // ---------------------------------------------------------
  // RENDER
  // ---------------------------------------------------------

  return (
    <div
      className={`defaultWidgetDiv DailyGoalsMain ${
        isMobile ? "mobile" : "desk"
      } ${addGoalPage ? "add" : ""} ${
        viewAllGoalsPage ? "viewall" : ""
      } ${viewReports ? "reports" : ""}`}
      style={{
        padding: "0 0px 0 10px",
      }}
      onContextMenu={handleRightClick} onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
    >
      <div className="DailyGoalsScrollArea">
        {isWidgetEmpty ? (
          // =====================================================
          // EMPTY STATE
          // =====================================================
          <div
            className="emptyWidgetAdd"
            style={{
              width: "100%",
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              gap: "12px",
            }}
          >
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              style={{
                outline: "none",
                border: "none",
                padding: "0 5px",
                cursor: "pointer",
                opacity: "0.6",
                fontWeight: "bold",
                background: "none",
              }}
            />

            <h5
              style={{
                marginLeft: "6px",
                opacity: "0.5",
              }}
            >
              Note of the Day :
            </h5>

            <textarea
              className="noteDay"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={(e) => saveNote(e.target.value)}
              placeholder="Memorize your day here .. "
              style={{
                width: "100%",
                marginLeft: "5px",
                marginTop: "10px",
                minHeight: "60px",
                resize: "vertical",
                borderRadius: "8px",
                padding: "8px",
                outline: "none",
              }}
            />

            <button
              onClick={() => setAddGoalPage(true)}
            >
              Create Your First Goal +
            </button>
          </div>
        ) : (
          // =====================================================
          // MAIN GOALS VIEW
          // =====================================================
          <>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                marginTop: "5px",
              }}
            >
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                style={{
                  outline: "none",
                  border: "none",
                  padding: "0 5px",
                  cursor: "pointer",
                  opacity: "0.6",
                  fontWeight: "bold",
                  background: "none",
                }}
              />

              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "bold",
                  opacity: 0.6,
                  cursor: "pointer",
                  letterSpacing: "1px",
                }}
                onClick={() =>
                  SetMoreOptions((prev) => !prev)
                }
              >
                More ..
              </span>
            </div>

            {/* =================================================
                SUMMARY
            ================================================= */}

            <div
              className="goalsSummary"
              style={{
                position: "relative",
                margin: "15px 0 16px",
                paddingLeft: "5px",
              }}
            >
              <span
                style={{
                  position: "absolute",
                  bottom: "-25px",
                  right: "5px",
                  fontSize: "12px",
                  opacity: 0.6,
                  fontWeight: "bold",
                }}
              >
                {goalCounts.completed} / {goalCounts.total}
              </span>

              <div
                className="progressBarTrack"
                style={{
                  width: "100%",
                  height: "6px",
                  borderRadius: "999px",
                  backgroundColor: "#e0e0e0",
                  overflow: "hidden",
                }}
              >
                <div
                  className="progressBarFill"
                  style={{
                    width: `${completionPercent}%`,
                    height: "100%",
                    borderRadius: "999px",
                    backgroundColor: "var(--base_color)",
                    transition: "width 0.3s ease",
                  }}
                />
              </div>
            </div>

            {/* =================================================
                NOTE
            ================================================= */}

            <h5
              style={{
                marginLeft: "6px",
                opacity: "0.5",
              }}
            >
              Note of the Day :
            </h5>

            <textarea
              className="noteDay"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onBlur={(e) => saveNote(e.target.value)}
              placeholder="Memorize your day here .. "
              style={{
                width: "100%",
                marginLeft: "5px",
                marginTop: "10px",
                minHeight: "60px",
                resize: "vertical",
                borderRadius: "8px",
                padding: "8px",
                outline: "none",
              }}
            />

            {/* =================================================
                GOALS LIST
            ================================================= */}

            <ul
              className={
                goalsForSelectedDate.length === 0
                  ? "NoGoals GoalsAsOfDate"
                  : "GoalsAsOfDate"
              }
            >
              {sortedGoalsForSelectedDate.length === 0 ? (
                <li
                  className="noGoalsForDate"
                  style={{
                    fontSize: "15px",
                    textAlign: "center",
                    margin: "100px",
                    opacity: 0.6,
                    listStyle: "none",
                  }}
                >
                  No goals for this date
                </li>
              ) : (
                sortedGoalsForSelectedDate.map((goal) => (
                  <li
                    key={goal.id}
                    className={
                      goal.goalType === "tracker"
                        ? "goalListItem"
                        : isGoalCompletedOnDate(goal, date)
                          ? "goalDone goalListItem"
                          : "goalListItem"
                    }
                  >
                    {/* =========================================
                        TRACKER GOAL
                    ========================================= */}

                    {(goal.goalType || "checklist") ===
                    "tracker" ? (
                      <>
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          className="trackerInput"
                          placeholder={
                            goal.trackerUnit === "time"
                              ? "mins"
                              : "count"
                          }
                          value={getTrackerInputValue(
                            goal,
                            date
                          )}
                          onChange={(e) =>
                            handleTrackerInputChange(
                              goal.id,
                              e.target.value
                            )
                          }
                          onBlur={() =>
                            handleTrackerInputBlur(
                              goal,
                              date
                            )
                          }
                          style={{
                            width: "60px",
                            borderRadius: "6px",
                          }}
                        />

                        <div style={{display:"flex",gap:"10px",marginLeft:"15px",alignItems:"center",fontSize:"14px"}}>
                            {(() => {
                              const iconOpt = ICON_OPTIONS.find((o) => o.value === goal.icon);

                              console.log(iconOpt);
                              console.log(goal.icon);
                              if (iconOpt) {
                                return (
                                  <img
                                    src={iconOpt.src}
                                    alt=""
                                    className="goalIconDisplay"
                                    width="30px"
                                  />
                                );
                              }

                              if (goal.icon) {
                                return (
                                  <span className="goalIconEmoji" style={{ margin: "0 10px 0 0", fontSize: "20px", transform: "scale(1.4)" }}>{goal.icon}</span>
                                );
                              }

                              return null;
                            })()}

                            {goal.title}

                        </div>
                      </>
                    ) : (
                      // =========================================
                      // CHECKLIST GOAL
                      // =========================================
                      <>
                        <input
                          type="checkbox"
                          checked={isGoalCompletedOnDate(
                            goal,
                            date
                          )}
                          onChange={() =>
                            toggleGoalCompletion(
                              goal.id,
                              date
                            )
                          }
                          style={{
                            cursor: "pointer",
                          }}
                        />

                        <div style={{display:"flex",gap:"10px",marginLeft:"15px",alignItems:"center",fontSize:"14px"}}>
                            {(() => {
                              const iconOpt = ICON_OPTIONS.find((o) => o.value === goal.icon);

                              console.log(iconOpt);
                              console.log(goal.icon);
                              if (iconOpt) {
                                return (
                                  <img
                                    src={iconOpt.src}
                                    alt=""
                                    className="goalIconDisplay"
                                    width="30px"
                                  />
                                );
                              }

                              if (goal.icon) {
                                return (
                                  <span className="goalIconEmoji" style={{ margin: "0 10px 0 0", fontSize: "20px", transform: "scale(1.4)" }}>{goal.icon}</span>
                                );
                              }

                              return null;
                            })()}

                            {goal.title}

                            {goal.trackerUnit === "time"
                              ? " (mins)"
                              : ""}
                        </div>
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>

            {/* =================================================
                ADD GOAL BUTTON
            ================================================= */}

            <button
              style={{
                position: "absolute",
                bottom: "10px",
                right: "10px",
                padding: "10px",
                cursor: "pointer",
                border: "none",
                outline: "none",
                background: "var(--base_color)",
                color: "white",
                borderRadius: "10px",
              }}
              onClick={() => setAddGoalPage(true)}
            >
              Add Goal +
            </button>

            {/* =================================================
                MORE OPTIONS
            ================================================= */}

            {MoreOptions && (
              <div
                style={{
                  padding: "10px",
                  position: "absolute",
                  right: "15px",
                  top: "32px",
                  background: "white",
                  boxShadow:
                    "0 0 10px rgb(0, 0, 0, 0.1)",
                  borderRadius: "10px",
                }}
              >
                <span
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "bold",
                    opacity: 0.6,
                    cursor: "pointer",
                    letterSpacing: "1px",
                    padding: "10px",
                  }}
                  onClick={() => {
                    setViewAllGoalsPage(true);
                    SetMoreOptions(false);
                  }}
                >
                  View All
                </span>

                <span
                  onClick={() => {
                    setViewReports(true);
                    SetMoreOptions(false);
                  }}
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "bold",
                    opacity: 0.6,
                    cursor: "pointer",
                    letterSpacing: "1px",
                    padding: "10px",
                  }}
                >
                  View Reports
                </span>

                <span
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "bold",
                    opacity: 0.6,
                    cursor: "pointer",
                    letterSpacing: "1px",
                    padding: "10px",
                  }}
                  onClick={downloadTemplate}
                >
                  Download Template
                </span>

                <span
                  style={{
                    display: "block",
                    fontSize: "12px",
                    fontWeight: "bold",
                    opacity: 0.6,
                    cursor: "pointer",
                    letterSpacing: "1px",
                    padding: "10px",
                  }}
                  onClick={handleUploadClick}
                >
                  Upload Data
                </span>
                <input
                    type="file"
                    accept=".xlsx"
                    ref={fileInputRef}
                    onChange={handleExcelUpload}
                    style={{ display: "none" }}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* =====================================================
          REPORTS
      ===================================================== */}

      <div className="reportMain">
        <div
          style={{
            marginBottom: "10px",
          }}
        >
          <i
            className="fa-solid fa-chevron-left"
            style={{
              display: "inline-block",
            }}
            onClick={() => setViewReports(false)}
          ></i>

          <h3
            style={{
              display: "inline-block",
            }}
          >
            Reports
          </h3>
        </div>

        <ReportsMain goalsList={goalsList} />
      </div>

      {/* =====================================================
          ADD NEW GOAL
      ===================================================== */}

      <div className="addNewGoal">
        <div
          style={{
            marginBottom: "30px",
          }}
        >
          <i
            className="fa-solid fa-chevron-left"
            style={{
              display: "inline-block",
            }}
            onClick={() => setAddGoalPage(false)}
          ></i>

          <h3
            style={{
              display: "inline-block",
            }}
          >
            Add a New Goal
          </h3>
        </div>

        {/* TITLE */}

        <span
          style={{
            display: "block",
          }}
        >
          Title :
        </span>

        <input
          value={newGoalTitle}
          placeholder="Gym .."
          onChange={(e) =>
            setNewGoalTitle(e.target.value)
          }
        />

        {/* =================================================
            ICON
        ================================================= */}

        <div className="repeats" style={{marginBottom:"10px"}}>
          <span
            className="repeatLabel"
            style={{
              display: "block",
            }}
          >
            Icon :
          </span>

          <div className="iconModeOptions">
            <label style={{display:"flex", gap:"10px"}}>
              <input
                type="radio"
                name="iconMode"
                value="none"
                checked={newGoalIconMode === "none"}
                onChange={() => {
                  setNewGoalIconMode("none");
                  setNewGoalSelectedIcon("");
                  setNewGoalCustomEmoji("");
                }}
              />
              No icon
            </label>

            <label style={{display:"flex", gap:"10px"}}>
              <input
                type="radio"
                name="iconMode"
                value="select"
                checked={newGoalIconMode === "select"}
                onChange={() => {
                  setNewGoalIconMode("select");
                  setNewGoalCustomEmoji("");
                }}
              />
              Select from icons
            </label>

            <label style={{display:"flex", gap:"10px"}}>
              <input
                type="radio"
                name="iconMode"
                value="emoji"
                checked={newGoalIconMode === "emoji"}
                onChange={() => {
                  setNewGoalIconMode("emoji");
                  setNewGoalSelectedIcon("");
                }}
              />
              Your own emoji
            </label>
          </div>

          {/* ICON GRID */}

          {newGoalIconMode === "select" && (
            <div className="iconGrid">
              {ICON_OPTIONS.map((opt) => (
                <img
                  key={opt.id}
                  src={opt.src}
                  alt={opt.id}
                  className={`iconGridItem ${
                    newGoalSelectedIcon === opt.value
                      ? "iconGridItemActive"
                      : ""
                  }`}
                  onClick={() =>
                    setNewGoalSelectedIcon(opt.value)
                  }
                />
              ))}
            </div>
          )}

          {/* CUSTOM EMOJI */}

          {newGoalIconMode === "emoji" && (
            <input
              className="emojiInput"
              value={newGoalCustomEmoji}
              placeholder=""
              maxLength={4}
              onChange={(e) =>
                setNewGoalCustomEmoji(e.target.value)
              }
              style={{outline:"none",border:"1px solid rgb(0,0,0,0.1)",borderRadius:"10px",padding:"5px 0"}}
            />
          )}
        </div>

        {/* =================================================
            GOAL TYPE
        ================================================= */}

        <div className="repeats">
          <span className="repeatLabel">
            Type :
          </span>

          <div
            className="repeatSegment"
            role="tablist"
            aria-label="Goal type"
          >
            {GOAL_TYPE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={
                  newGoalType === opt.id
                }
                className={`repeatSegBtn ${
                  newGoalType === opt.id
                    ? "repeatSegBtnActive"
                    : ""
                }`}
                onClick={() =>
                  setNewGoalType(opt.id)
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* TRACKER UNIT */}

          {newGoalType === "tracker" && (
            <div
              className="repeatSubPanel"
              style={{
                marginBottom: "10px",
              }}
            >
              <span
                className="repeatLabel"
                style={{
                  marginTop: "0px",
                  display: "block",
                }}
              >
                Track by :
              </span>

              <div
                className="repeatSegment"
                role="tablist"
                aria-label="Tracker unit"
              >
                {TRACKER_UNIT_OPTIONS.map(
                  (opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={
                        newGoalTrackerUnit ===
                        opt.id
                      }
                      className={`repeatSegBtn ${
                        newGoalTrackerUnit ===
                        opt.id
                          ? "repeatSegBtnActive"
                          : ""
                      }`}
                      onClick={() =>
                        setNewGoalTrackerUnit(
                          opt.id
                        )
                      }
                    >
                      {opt.label}
                    </button>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* =================================================
            SCHEDULE
        ================================================= */}

        <div className="repeats">
          <span className="repeatLabel">
            Repeats :
          </span>

          <div
            className="repeatSegment"
            role="tablist"
            aria-label="Repeat schedule"
          >
            {SCHEDULE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                role="tab"
                aria-selected={
                  scheduleType === opt.id
                }
                className={`repeatSegBtn ${
                  scheduleType === opt.id
                    ? "repeatSegBtnActive"
                    : ""
                }`}
                onClick={() =>
                  setScheduleType(opt.id)
                }
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* PARTICULAR DAYS */}

          {scheduleType === "days" && (
            <div className="repeatSubPanel angWeekdays">
              {WEEKDAYS.map((d, idx) => (
                <button
                  type="button"
                  key={idx}
                  className={`repeatDayDot ${
                    activeDays.includes(idx)
                      ? "repeatDayDotActive"
                      : ""
                  }`}
                  onClick={() => toggleDay(idx)}
                  aria-pressed={activeDays.includes(
                    idx
                  )}
                  aria-label={d}
                >
                  {d}
                </button>
              ))}
            </div>
          )}

          {/* PARTICULAR DATES */}

          {scheduleType === "dates" && (
            <div className="repeatSubPanel repeatDatesList">
              {particularDates.map(
                (dateValue, idx) => (
                  <div
                    key={idx}
                    className="repeatDateRow"
                  >
                    <input
                      type="date"
                      className="repeatInput repeatDateInput"
                      value={dateValue}
                      onChange={(e) => {
                        const newDates = [
                          ...particularDates,
                        ];

                        newDates[idx] =
                          e.target.value;

                        setParticularDates(
                          newDates
                        );
                      }}
                    />

                    <button
                      type="button"
                      className="repeatRemoveDate"
                      aria-label="Remove date"
                      onClick={() => {
                        setParticularDates(
                          particularDates.filter(
                            (_, i) =>
                              i !== idx
                          )
                        );
                      }}
                    >
                      ×
                    </button>
                  </div>
                )
              )}

              <button
                type="button"
                className="repeatAddDate"
                onClick={() =>
                  setParticularDates([
                    ...particularDates,
                    "",
                  ])
                }
              >
                + Add another date
              </button>
            </div>
          )}

          {/* DATE RANGE */}

          {scheduleType === "range" && (
            <div className="repeatSubPanel repeatRangeRow">
              <div className="repeatRangeField">
                <span className="repeatRangeLabel">
                  From
                </span>

                <input
                  type="date"
                  className="repeatInput repeatDateInput"
                  max={effToDate}
                  value={effFromDate}
                  onChange={(e) =>
                    setEffFromDate(
                      e.target.value
                    )
                  }
                />
              </div>

              <div className="repeatRangeField">
                <span className="repeatRangeLabel">
                  To
                </span>

                <input
                  type="date"
                  className="repeatInput repeatDateInput"
                  min={effFromDate}
                  value={effToDate}
                  onChange={(e) =>
                    setEffToDate(
                      e.target.value
                    )
                  }
                />
              </div>
            </div>
          )}
        </div>

        <button
          className="saveNewGoalBtn"
          onClick={createNewGoal}
        >
          Save
        </button>
      </div>

      {/* =====================================================
          VIEW ALL GOALS
      ===================================================== */}

      <div className="viewAllGoals">
        <div
          style={{
            marginBottom: "30px",
          }}
        >
          <i
            className="fa-solid fa-chevron-left"
            style={{
              display: "inline-block",
            }}
            onClick={() =>
              setViewAllGoalsPage(false)
            }
          ></i>

          <h3
            style={{
              display: "inline-block",
            }}
          >
            Goals :
          </h3>
        </div>

        <div className="listGoals">
          {goalsList.map((goal) => (
            <div
              key={goal.id}
              className="goalCard"
            >
              {editingGoalId === goal.id ? (
                // =================================================
                // EDIT GOAL
                // =================================================
                <div className="goalEditForm">
                  <input
                    value={goal.title}
                    onChange={(e) =>
                      setGoalTitle(
                        goal.id,
                        e.target.value
                      )
                    }
                  />

                  {/* =================================================
                      ICON
                  ================================================= */}

                  <div className="repeats" style={{marginBottom:"10px"}}>
                    <span
                      className="repeatLabel"
                      style={{
                        display: "block",
                      }}
                    >
                      Icon :
                    </span>

                    <div className="iconModeOptions">
                      <label style={{display:"flex", gap:"10px"}}>
                        <input
                          type="radio"
                          name={`editIconMode-${goal.id}`}
                          value="none"
                          checked={editIconMode === "none"}
                          onChange={() => {
                            setEditIconMode("none");
                            setGoalIcon(goal.id, "");
                          }}
                        />
                        No icon
                      </label>

                      <label style={{display:"flex", gap:"10px"}}>
                        <input
                          type="radio"
                          name={`editIconMode-${goal.id}`}
                          value="select"
                          checked={editIconMode === "select"}
                          onChange={() => {
                            setEditIconMode("select");
                            setGoalIcon(goal.id, "");
                          }}
                        />
                        Select from icons
                      </label>

                      <label style={{display:"flex", gap:"10px"}}>
                        <input
                          type="radio"
                          name={`editIconMode-${goal.id}`}
                          value="emoji"
                          checked={editIconMode === "emoji"}
                          onChange={() => {
                            setEditIconMode("emoji");
                            setGoalIcon(goal.id, "");
                          }}
                        />
                        Your own emoji
                      </label>
                    </div>

                    {/* ICON GRID */}

                    {editIconMode === "select" && (
                      <div className="iconGrid">
                        {ICON_OPTIONS.map((opt) => (
                          <img
                            key={opt.id}
                            src={opt.src}
                            alt={opt.id}
                            className={`iconGridItem ${
                              goal.icon === opt.value
                                ? "iconGridItemActive"
                                : ""
                            }`}
                            onClick={() =>
                              setGoalIcon(goal.id, opt.value)
                            }
                          />
                        ))}
                      </div>
                    )}

                    {/* CUSTOM EMOJI */}

                    {editIconMode === "emoji" && (
                      <input
                        className="emojiInput"
                        value={goal.icon || ""}
                        placeholder=""
                        maxLength={4}
                        onChange={(e) =>
                          setGoalIcon(goal.id, e.target.value)
                        }
                        style={{outline:"none",border:"1px solid rgb(0,0,0,0.1)",borderRadius:"10px",padding:"5px 0"}}
                      />
                    )}
                  </div>

                  {/* SCHEDULE TYPE */}

                  <div
                    className="repeatSegment"
                    role="tablist"
                    aria-label="Repeat schedule"
                  >
                    {SCHEDULE_OPTIONS.map(
                      (opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          className={`repeatSegBtn ${
                            goal.schedule.type ===
                            opt.id
                              ? "repeatSegBtnActive"
                              : ""
                          }`}
                          onClick={() =>
                            setGoalScheduleType(
                              goal.id,
                              opt.id
                            )
                          }
                        >
                          {opt.label}
                        </button>
                      )
                    )}
                  </div>

                  {/* DAYS */}

                  {goal.schedule.type ===
                    "days" && (
                    <div className="repeatSubPanel angWeekdays">
                      {WEEKDAYS.map(
                        (d, idx) => (
                          <button
                            type="button"
                            key={idx}
                            className={`repeatDayDot ${
                              (
                                goal.schedule
                                  .days || []
                              ).includes(idx)
                                ? "repeatDayDotActive"
                                : ""
                            }`}
                            onClick={() =>
                              toggleGoalDay(
                                goal.id,
                                idx
                              )
                            }
                          >
                            {d}
                          </button>
                        )
                      )}
                    </div>
                  )}

                  {/* DATES */}

                  {goal.schedule.type ===
                    "dates" && (
                    <div className="repeatSubPanel repeatDatesList">
                      {(
                        goal.schedule.dates || [
                          "",
                        ]
                      ).map(
                        (
                          dateValue,
                          idx
                        ) => (
                          <div
                            key={idx}
                            className="repeatDateRow"
                          >
                            <input
                              type="date"
                              className="repeatInput repeatDateInput"
                              value={
                                dateValue
                              }
                              onChange={(
                                e
                              ) =>
                                updateGoalDate(
                                  goal.id,
                                  idx,
                                  e.target
                                    .value
                                )
                              }
                            />

                            <button
                              type="button"
                              onClick={() =>
                                removeGoalDate(
                                  goal.id,
                                  idx
                                )
                              }
                            >
                              ×
                            </button>
                          </div>
                        )
                      )}

                      <button
                        type="button"
                        className="repeatAddDate"
                        onClick={() =>
                          addGoalDate(
                            goal.id
                          )
                        }
                      >
                        + Add another date
                      </button>
                    </div>
                  )}

                  {/* RANGE */}

                  {goal.schedule.type ===
                    "range" && (
                    <div className="repeatSubPanel repeatRangeRow">
                      <div className="repeatRangeField">
                        <span className="repeatRangeLabel">
                          From
                        </span>

                        <input
                          type="date"
                          value={
                            goal.schedule
                              .from || ""
                          }
                          onChange={(e) =>
                            setGoalRangeField(
                              goal.id,
                              "from",
                              e.target.value
                            )
                          }
                        />
                      </div>

                      <div className="repeatRangeField">
                        <span className="repeatRangeLabel">
                          To
                        </span>

                        <input
                          type="date"
                          value={
                            goal.schedule
                              .to || ""
                          }
                          onChange={(e) =>
                            setGoalRangeField(
                              goal.id,
                              "to",
                              e.target.value
                            )
                          }
                        />
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() =>
                      setEditingGoalId(
                        null
                      )
                    }
                  >
                    Done
                  </button>
                </div>
              ) : (
                // =================================================
                // DISPLAY GOAL
                // =================================================
                <div className="goalDisplay">
                  
                    <span>
                      {(() => {
                        const iconOpt = ICON_OPTIONS.find((o) => o.value === goal.icon);

                        if (iconOpt) {
                          return (
                            <img
                              src={iconOpt.src}
                              alt=""
                              className="goalIconDisplay"
                              width="30px"
                              style={{marginRight:"10px"}}
                            />
                          );
                        }

                        if (goal.icon) {
                          return (
                            <i className="goalIconEmoji" style={{ margin: "0 13px 0 0", fontSize: "20px", transform: "scale(1.4)",fontStyle:"normal" }}>{goal.icon}</i>
                          );
                        }

                        return null;
                      })()}

                      {goal.title}
                    </span>

                  <span className="goalSchedulePreview">
                    {goal.schedule.type}
                  </span>

                  <span className="goalTypePreview">
                    {(goal.goalType ||
                      "checklist") ===
                    "tracker"
                      ? `Tracker · ${
                          goal.trackerUnit ===
                          "time"
                            ? "mins"
                            : "count"
                        }`
                      : "Checkbox"}
                  </span>

                  <i
                    className="fa-solid fa-pen"
                    onClick={() =>
                      startEditingGoal(goal)
                    }
                  ></i>

                  <i
                    className="fa-solid fa-trash"
                    onClick={() =>
                      deleteGoal(goal.id)
                    }
                  ></i>
                </div>
              )}
            </div>
          ))}

          {/* =================================================
              SAVE CHANGES
          ================================================= */}

          {hasUnsavedChanges && (
            <button
              className="saveAllGoalsBtn"
              onClick={saveAllGoals}
            >
              Save Changes
            </button>
          )}
        </div>

        <button
          style={{
            position: "absolute",
            top: "10px",
            right: "10px",
            padding: "10px",
            cursor: "pointer",
            border: "none",
            outline: "none",
            background: "var(--base_color)",
            color: "white",
            borderRadius: "10px",
          }}
          onClick={() =>
            setAddGoalPage(true)
          }
        >
          Add Goal +
        </button>
      </div>
      <div className="refreshWidget" style={{ display: contextMenu.visible ? "block" : "none",left: contextMenu.x,top: contextMenu.y, cursor:"pointer", width: "auto", overflow: "hidden", padding: "10px", boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)", zIndex: 20, position: "fixed", background: "white", borderRadius: "10px", fontSize: "13px" }} onClick={() => setRefreshState(prev => prev + 1)}>Refresh</div>
    </div>
  );
}

export default DailyGoalsWidget;