
import { useState, useEffect } from "react";
import toast from 'react-hot-toast';
import { isMobile } from "react-device-detect";
import { useMemo } from "react";
import { v4 as uuidv4 } from 'uuid';

import '../Styles/Home.css'
import '../Styles/TTD.css'

import { doc, getDoc, setDoc, arrayUnion, updateDoc, collection, getDocs, FieldPath } from "firebase/firestore";
import { auth, db } from "../firebase";


function TTDWidget({ key, email, x, y, setLoading, setPopup, setPopupContent, signOut }) {

    const [addTaskPage, setAddTaskPage] = useState(false);
    const [viewAllTasksPage, setViewAllTasksPage] = useState(false);


    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [desc, setNewTaskDesc] = useState("");

    const getLocalISODate = (d = new Date()) => {
    const offsetMs = d.getTimezoneOffset() * 60000;   // e.g. -330 min for IST → -19800000 ms
        return new Date(d.getTime() - offsetMs).toISOString().split("T")[0];
    };

  const today = getLocalISODate;

    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState("");


    const [connections, setConnections] = useState([]);

    const [assignSelf, setAssignSelf] = useState(true);
    const [assignConnections, setAssignConnections] = useState([]);
    const [assignOthers, setAssignOthers] = useState([]);
    const [showOthersInputs, setShowOthersInputs] = useState(false);

    const [selectedFilters, setSelectedFilters] = useState(["viewAll"]);

    const FILTER_OPTIONS = [
        { id: "viewAll", label: "View All" },
        { id: "pending", label: "Pending" },
        { id: "completed", label: "Completed" },
        { id: "overdue", label: "Overdue" },
        { id: "future", label: "Future Tasks" },
        { id: "createdByMe", label: "Created by Me" },
        { id: "assignedByOthers", label: "Assigned By Others" },
    ];

    const toggleFilter = (id) => {
        setSelectedFilters((prev) => {
            if (id === "viewAll") return ["viewAll"];
            const withoutAll = prev.filter((f) => f !== "viewAll");
            const next = withoutAll.includes(id)
                ? withoutAll.filter((f) => f !== id)
                : [...withoutAll, id];
            return next.length === 0 ? ["viewAll"] : next; // fall back to viewAll if nothing selected
        });
    };

    const [tasks, setTasks] = useState([]);

    const readTasks = async () => {
        try {
            const tasksRef = collection(db, email, "TTD", "List");
            const snapshot = await getDocs(tasksRef);

            const tasks = snapshot.docs.map(doc => ({
                id: doc.id,        // taskId
                ...doc.data()      // taskData
            }));

            setTasks(tasks);

            console.log(snapshot);

        } catch (err) {
            console.error("Error reading tasks:", err);
            toast("Failed to load tasks. Please try again.", {
                duration: 2000,
                position: 'top-center',
                icon: '❌',
                style: { "backgroundColor": "var(--toast_error)", "color": "white" }
            });
        }
    };

    useEffect(() => {
        if (!email) return;

        readTasks();
    }, [email]);

    useEffect(() => {
        if (!email) return;

        const fetchConnections = async () => {
            try {
                const snap = await getDoc(doc(db, email, "Connections"));
                const data = snap.exists() ? snap.data().List || [] : [];

                setConnections(data);
                console.log(data);
            } catch (err) {
                console.error("Error fetching connections:", err);
            }
        };

        fetchConnections();
    }, [email]);

    const toggleAssignConnection = (conn) => {
        setAssignConnections((prev) =>
            prev.includes(conn) ? prev.filter((c) => c !== conn) : [...prev, conn]
        );
    };

    const addOtherEmailField = () => {
        setShowOthersInputs(true);
        setAssignOthers((prev) => [...prev, ""]);
    };

    const updateOtherEmail = (idx, value) => {
        setAssignOthers((prev) => {
            const updated = [...prev];
            updated[idx] = value;
            return updated;
        });
    };

    const removeOtherEmail = (idx) => {
        setAssignOthers((prev) => prev.filter((_, i) => i !== idx));
    };

    const buildAssignedEmails = () => {
        const emails = [];

        if (assignSelf) emails.push(email); // current user's own email

        assignConnections.forEach((conn) => {
            if (!emails.includes(conn)) emails.push(conn);
        });

        assignOthers
            .map((m) => m.trim().toLowerCase())
            .filter(Boolean)
            .forEach((mail) => {
                if (!emails.includes(mail)) emails.push(mail);
            });

        return emails;
    };

    const createTaskDB = async () => {
        if (!newTaskTitle.trim()) {
            toast("Please enter a task title.", {
                duration: 2000,
                position: 'top-center',
                icon: '❌',
                style: { "backgroundColor": "var(--toast_error)", "color": "white" }
            });
            return;
        }

        let assignedEmails = buildAssignedEmails();

        if (assignedEmails.length === 0) {
            toast("Please assign the task to at least one person.", {
                duration: 2000,
                position: 'top-center',
                icon: '❌',
                style: { "backgroundColor": "var(--toast_error)", "color": "white" }
            });
            return;
        }

        const taskId = newTaskTitle.trim() + "_" + uuidv4();

        const selfSelected = assignSelf;

        const hasOtherAssignees = assignedEmails.some(mail => mail !== email);

        const assigneeMap = assignedEmails.reduce((acc, mail) => {
            acc[mail] = { email: mail, done: false };
            return acc;
        }, {});

        const baseTaskData = {
            id: taskId,
            title: newTaskTitle.trim(),
            description: desc.trim(),
            startDate,
            endDate,
            assign: assigneeMap,
            createdBy: email,
            createdAt: new Date().toISOString(),
            completed: false,
            selfSelected: selfSelected,
            hasOtherAssignees: hasOtherAssignees
        };

        setLoading(true);
        try {
            for (const assignedEmail of assignedEmails) {
                await setDoc(
                    doc(db, assignedEmail, "TTD", "List", taskId),
                    baseTaskData
                );
            }

            if (!selfSelected) {
                await setDoc(
                    doc(db, email, "TTD", "List", taskId),
                    { ...baseTaskData, IsRequested: true }
                );
            }

            // reset form on success
            setAddTaskPage(false);
            setNewTaskTitle("");
            setNewTaskDesc("");
            setStartDate("");
            setEndDate("");
            setAssignSelf(true);
            setAssignConnections([]);
            setAssignOthers([]);
            setShowOthersInputs(false);

            await readTasks();

            toast('Task assigned successfully !!', {
                duration: 2000,
                position: 'top-center',
                icon: '✅',
                style: { "backgroundColor": "var(--toast_success)", "color": "white" }
            });
        } catch (err) {
            console.error("Error creating task:", err);
            toast("Something went wrong while saving the task. Please try again.", {
                duration: 2000,
                position: 'top-center',
                icon: '❌',
                style: { "backgroundColor": "var(--toast_error)", "color": "white" }
            });
        } finally {
            setLoading(false);
        }
    };

    const getDateStatusClass = (task) => {
        const today = todayLocal();
        const classes = [];
        let remainingDays = null;

        const start = parseLocalDate(task.startDate);
        const end = parseLocalDate(task.endDate);

        if (start && start > today) {
            classes.push("futureTask");
        }

        if (end) {
            const diff = daysBetween(today, end); // positive = days left, negative = overdue

            if (end < today) {
                classes.push("overdue");
            } else if (diff <= 3) {
                classes.push("showtime");
                remainingDays = diff;
            }
        }

        return { classes, remainingDays };
    };

    const CLASS_PRIORITY = ["selfAssignedOnlyU", "assignedbyother", "shared", "createdforothers"];

    const getClassPriority = (listClassName) => {
        const idx = CLASS_PRIORITY.findIndex((key) => listClassName.includes(key));
        return idx === -1 ? CLASS_PRIORITY.length : idx; // unmatched classes sink to the end
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = String(d.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
    };

    const parseLocalDate = (dateStr) => {
        if (!dateStr) return null;
        const [y, m, d] = dateStr.split("-").map(Number);
        return new Date(y, m - 1, d);
    };

    const todayLocal = () => {
        const t = new Date();
        return new Date(t.getFullYear(), t.getMonth(), t.getDate());
    };

    const daysBetween = (dateA, dateB) => {
        const MS_PER_DAY = 1000 * 60 * 60 * 24;
        return Math.round((dateB - dateA) / MS_PER_DAY);
    };

    const allAssigneesDone = (task) => {
        if (!task.assign || typeof task.assign !== "object") return false;
        const values = Object.values(task.assign);
        return values.length > 0 && values.every((a) => a.done);
    };

    const isAssignedToMe = (task) => !!(task.assign && task.assign[email]);

    const isCreatorTaskComplete = (task) => {
        if (!task.assign || typeof task.assign !== "object" || Object.keys(task.assign).length === 0) {
            return true; // no assign at all -> treat as completed
        }
        return allAssigneesDone(task);
    };

    const bucketTask = (task) => {
        const { createdBy, completed, hasOtherAssignees, selfSelected } = task;

        if (email !== createdBy) {
            return completed
                ? { ...task, listClassName: "taskblock assignedbyother completed", bucket: "completed" }
                : { ...task, listClassName: "taskblock assignedbyother notcompleted", bucket: "active" };
        }

        // email === createdBy: completion is always derived from the assign map (condition 3)
        const creatorComplete = isCreatorTaskComplete(task);

        if (!hasOtherAssignees) {
            return creatorComplete
                ? { ...task, listClassName: "taskblock selfAssignedOnlyU completed", bucket: "completed" }
                : { ...task, listClassName: "taskblock selfAssignedOnlyU notcompleted", bucket: "active" };
        }

        if (!selfSelected) {
            return creatorComplete
                ? { ...task, listClassName: "taskblock createdforothers completed", bucket: "completed" }
                : { ...task, listClassName: "taskblock createdforothers notcompleted", bucket: "active" };
        }

        if (creatorComplete) {
            return { ...task, listClassName: "taskblock shared completedAll", bucket: "completed" };
        }
        if (completed) {
            // creator's own portion is done, but not everyone else's yet
            return { ...task, listClassName: "taskblock shared notcompleted selfCompleted", bucket: "active" };
        }
        return { ...task, listClassName: "taskblock shared notcompleted", bucket: "active" };
    };

    // AND semantics: a task must satisfy every selected filter. See note below for OR instead.
    const matchesFilters = (task, bucketed) => {
        if (selectedFilters.includes("viewAll")) return true;

        return selectedFilters.every((filter) => {
            switch (filter) {
                case "pending":
                    return bucketed.bucket === "active";
                case "completed":
                    return bucketed.bucket === "completed";
                case "overdue":
                    return bucketed.bucket !== "completed" && getDateStatusClass(task).classes.includes("overdue");
                case "future":
                    return bucketed.bucket !== "completed" && getDateStatusClass(task).classes.includes("futureTask");
                case "createdByMe":
                    return task.createdBy === email;
                case "assignedByOthers":
                    return task.createdBy !== email;
                default:
                    return true;
            }
        });
    };

    const { activeTasks, completedTasks } = useMemo(() => {
        const activeTasks = [];
        const completedTasks = [];

        tasks.forEach((task) => {
            const bucketed = bucketTask(task);
            if (!matchesFilters(task, bucketed)) return;

            if (bucketed.bucket === "completed") {
                completedTasks.push(bucketed);
            } else {
                activeTasks.push(bucketed);
            }
        });

        return { activeTasks, completedTasks };
    }, [tasks, email, selectedFilters]);


    const renderTaskList = (list, Blockabel) => {
        if (!list || list.length === 0) {
            return null;
        }

        const sortedList = [...list].sort(
            (a, b) => getClassPriority(a.listClassName) - getClassPriority(b.listClassName)
        );

        return (
            <>
                <div style={{ margin: "0px 0", paddingRight: "10px" }}>
                    <ul>
                        {sortedList.map((task) => {
                            const showAssignees =
                                task.listClassName.includes("shared") ||
                                task.listClassName.includes("createdforothers");

                            const isTaskCompleted =
                                task.listClassName.includes("completed") ||
                                task.listClassName.includes("completedAll");

                            const { classes: dateClasses, remainingDays } = getDateStatusClass(task);
                            const fullClassName = [task.listClassName, ...dateClasses].join(" ");

                            // resolve the display completion date for finished tasks
                            let displayCompletionDate = null;
                            if (isTaskCompleted) {
                                if (task.completionDate) {
                                    displayCompletionDate = task.completionDate;
                                } else if (task.assign && typeof task.assign === "object") {
                                    const allDates = Object.values(task.assign)
                                        .map((a) => a.completionDate)
                                        .filter(Boolean);
                                    if (allDates.length > 0) {
                                        displayCompletionDate = allDates.reduce((latest, curr) =>
                                            new Date(curr) > new Date(latest) ? curr : latest
                                        );
                                    }
                                }
                            }

                            return (
                                <li key={task.id} className={fullClassName}>
                                    <h3>{task.title}</h3>

                                    <label style={{ fontSize: "16px", opacity: 0.7, marginBottom: "10px", display: "block" }}>Description : </label>
                                    <p style={{ fontSize: "15px", padding: "0 10px 10px 10px", minHeight: "50px", borderBottom: "1px dashed rgb(0,0,0,0.1)" }}>{task.description}</p>

                                    {showAssignees && task.assign && typeof task.assign === "object" && (
                                        <ul className="assigneeStatusList" style={{ margin: "10px 0" }}>
                                            {Object.values(task.assign).map((a) => (
                                                <li key={a.email} className="assigneeStatusRow">
                                                    <input
                                                        type="checkbox"
                                                        checked={a.done}
                                                        disabled
                                                        readOnly
                                                    />
                                                    <span>{a.email}</span><br></br>
                                                    <i>{formatDate(a.completionDate)}</i>
                                                </li>
                                            ))}
                                        </ul>
                                    )}

                                    <div className="TaskDates">
                                        <p className="TaskStartDate">Starts From : <span>{formatDate(task.startDate)}</span></p>
                                        {task.endDate && <p className="TaskEndDate">DeadLine :  <span>{formatDate(task.endDate)}</span></p>}
                                    </div>

                                    {remainingDays !== null && (
                                        <span className="remainingDaysLabel">
                                            {remainingDays === 0 ? "Due today" : `${remainingDays} day${remainingDays === 1 ? "" : "s"} left`}
                                        </span>
                                    )}

                                    <span className="overDueLabel">OverDue</span>

                                    {task.listClassName.includes("assignedbyother") && (
                                        <span className="createdByLabel" style={{ fontSize: "12px", marginTop: "10px", display: "block" }}>Assigned by {task.createdBy}</span>
                                    )}


                                    <div className="btns">
                                        <span className="shared">Shared</span>
                                        <span className="request">Request</span>
                                        <span className="assign">Assigned</span>
                                        <button className="Done" onClick={() => markTaskDone(task)}>
                                            <i className="fa-solid fa-check"></i> Mark as Done
                                        </button>
                                        <button className="Back" onClick={() => moveTaskToPending(task)}>
                                            Move Back to Pending
                                        </button>
                                    </div>

                                    <span className="TaskDone">Completed {(formatDate(displayCompletionDate))} </span>
                                </li>
                            );
                        })}
                    </ul>
                </div>
            </>
        );
    };

    const updateTaskStatus = async (task, doneValue) => {
        setLoading(true);
        try {
            const completionDate = doneValue ? new Date().toISOString() : null;

            const ownTaskRef = doc(db, email, "TTD", "List", task.id);
            const hasOwnAssignEntry = task.assign && Object.prototype.hasOwnProperty.call(task.assign, email);
            const createdByOther = task.createdBy && task.createdBy !== email;

            // Build the field/value pairs for the acting user's own doc
            const ownUpdatePairs = ["completed", doneValue];

            // only add a top-level completionDate on the own doc when someone ELSE created the task
            if (createdByOther) {
                ownUpdatePairs.push("completionDate", completionDate);
            }

            // update this user's own entry inside assign (covers both createdByOther and self-created cases,
            // since when createdBy === email, ownTaskRef IS the creator's doc)
            if (hasOwnAssignEntry) {
                ownUpdatePairs.push(
                    new FieldPath("assign", email, "done"), doneValue,
                    new FieldPath("assign", email, "completionDate"), completionDate
                );
            }

            await updateDoc(ownTaskRef, ...ownUpdatePairs);

            // If someone else created this task, also propagate done-status + completionDate into their doc
            if (createdByOther) {
                const creatorTaskRef = doc(db, task.createdBy, "TTD", "List", task.id);
                await updateDoc(
                    creatorTaskRef,
                    new FieldPath("assign", email, "done"), doneValue,
                    new FieldPath("assign", email, "completionDate"), completionDate
                );
            }

            await readTasks();

            toast(doneValue ? "Marked as done!" : "Moved back to pending.", {
                duration: 2000,
                position: 'top-center',
                icon: doneValue ? '✅' : '↩️',
                style: { "backgroundColor": doneValue ? "var(--toast_success)" : "var(--toast_error)", "color": "white" }
            });
        } catch (err) {
            console.error("Error updating task status:", err);
            toast("Something went wrong. Please try again.", {
                duration: 2000,
                position: 'top-center',
                icon: '❌',
                style: { "backgroundColor": "var(--toast_error)", "color": "white" }
            });
        } finally {
            setLoading(false);
        }
    };

    const markTaskDone = (task) => updateTaskStatus(task, true);
    const moveTaskToPending = (task) => updateTaskStatus(task, false);

    return (
        <div className={`defaultWidgetDiv TTDMain ${isMobile ? 'mobile' : 'desk'} ${addTaskPage ? 'add' : ''} ${viewAllTasksPage ? 'viewall' : ''}`} style={{ padding: "0px 0px 40px 15px" }}>

            {
                <>
                    <div className="taskFilterBar">
                        {FILTER_OPTIONS.map((opt) => (
                            <button
                                key={opt.id}
                                type="button"
                                className={`filterPill ${selectedFilters.includes(opt.id) ? "filterPillActive" : ""}`}
                                onClick={() => toggleFilter(opt.id)}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <div className="TasksList">
                        {renderTaskList(activeTasks, "Active ")}
                        {renderTaskList(completedTasks, "Completed ")}
                    </div>

                    <button style={{ position: "absolute", bottom: "10px", right: "10px", padding: "10px", cursor: "pointer", border: "none", outline: "none", background: "var(--base_color)", color: "white", borderRadius: "10px" }} onClick={() => setAddTaskPage(true)}>New Task + </button>

                </>

            }

            <div className="addNewTask">
                <div style={{ marginBottom: "30px" }}>
                    <i className="fa-solid fa-chevron-left" style={{ display: "inline-block" }} onClick={() => setAddTaskPage(false)}></i>
                    <h3 style={{ display: "inline-block" }}>SetUp New Task</h3>
                </div>
                <span style={{ display: "block" }}>Title : </span>
                <input value={newTaskTitle} placeholder="Create Doc .." onChange={(e) => setNewTaskTitle(e.target.value)}></input>
                <span style={{ display: "block" }}>Description : </span>
                <textarea placeholder="What need to be done, etc .. " value={desc} onChange={(e) => setNewTaskDesc(e.target.value)} style={{ fontSize: "14px" }}></textarea>
                <div className="Dates" style={{ display: "flex" }}>
                    <div>
                        <span style={{ display: "block" }} >Start's From : </span>
                        <input type="date" className="DateIn" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)}></input>
                    </div>
                    <div style={{ marginLeft: "20px" }}>
                        <span style={{ display: "block" }}>DeadLine : </span>
                        <input type="date" className="DateIn" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}></input>
                    </div>
                </div>

                <span style={{ display: "block", marginTop: "20px" }}>Assign to : </span>

                <div className="assignTo">
                    <div className="assignRow">
                        <input
                            type="checkbox"
                            checked={assignSelf}
                            onChange={() => setAssignSelf((prev) => !prev)}
                        />
                        <span>self</span>
                    </div>

                    {Array.isArray(connections) && connections.length > 0 && (
                        <>
                            <span className="assignSubLabel">Your connections</span>
                            {connections.map((conn) => (
                                <div className="assignRow assignRowIndented" key={conn}>
                                    <input
                                        type="checkbox"
                                        checked={assignConnections.includes(conn)}
                                        onChange={() => toggleAssignConnection(conn)}
                                    />
                                    <span>{conn}</span>
                                </div>
                            ))}
                        </>
                    )}

                    <span className="assignSubLabel">Others :</span>
                    {assignOthers.map((mail, idx) => (
                        <div className="assignRow assignRowIndented" key={idx}>
                            <input
                                type="email"
                                className="assignOtherInput"
                                placeholder="friend@gmail.com"
                                value={mail}
                                onChange={(e) => updateOtherEmail(idx, e.target.value)}
                            />
                            <button type="button" className="repeatRemoveDate" onClick={() => removeOtherEmail(idx)}>×</button>
                        </div>
                    ))}
                    <button type="button" className="repeatAddDate" onClick={addOtherEmailField} style={{ padding: "10px", cursor: "pointer", borderRadius: "10px", border: "none" }}>
                        + Add email
                    </button>
                </div>


                <button className="saveNewTaskBtn" onClick={createTaskDB}> Save</button>

                <div style={{ height: "20px" }}></div>

            </div>

        </div>
    )
}

export default TTDWidget;