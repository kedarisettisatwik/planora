import { useState, useEffect, useMemo } from "react";
import toast from 'react-hot-toast';
import { isMobile } from "react-device-detect";
import { v4 as uuidv4 } from 'uuid';

import '../Styles/Home.css'
import '../Styles/TTD.css'

import { doc, setDoc, deleteDoc, updateDoc, collection, getDocs, FieldPath } from "firebase/firestore";
import { db } from "../firebase";

// left -> right order on desktop
const COLUMNS = [
    { id: "inprogress", title: "In Progress" },
    { id: "pending", title: "Pending" },
    { id: "completed", title: "Completed" },
];

const STATUS_RANK = { inprogress: 0, pending: 1, completed: 2 };

// theme (background colour) choices for a task card
const TASK_COLORS = [
    "#fff8b8", // yellow
    "#d7f5d3", // green
    "#d3ebfa", // blue
    "#fbd5e5", // pink
    "#e5dcfa", // purple
    "#ffe0c2", // orange
    "#e8e8e8", // grey
    "#ffffff", // white
];
const DEFAULT_TASK_COLOR = TASK_COLORS[0];

// dark text on light backgrounds, white text on dark ones (for custom colours)
const getTextColor = (hex) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "#1f1f1f";
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 > 0.55 ? "#1f1f1f" : "#ffffff";
};

// shared inline styles for the edit modal
const fieldStyle = {
    width: "100%",
    boxSizing: "border-box",
    padding: "9px 10px",
    border: "1px solid rgba(128,128,128,0.45)",
    borderRadius: "10px",
    outline: "none",
    background: "rgba(255,255,255,0.6)",
    color: "#1f1f1f",
    fontSize: "14px",
    fontFamily: "inherit",
};
const labelStyle = { display: "block", fontSize: "13px", opacity: 0.75, margin: "14px 0 4px" };
const modalBtnStyle = {
    border: "none",
    cursor: "pointer",
    padding: "8px 14px",
    borderRadius: "10px",
    fontSize: "14px",
    color: "inherit",
    background: "rgba(128,128,128,0.2)",
};

function TTDWidget({ email, setLoading }) {

    const [refreshState, setRefreshState] = useState(0);

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

    const handleRightClick = (e) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
    };

    // "New Task" panel (create)
    const [addTaskPage, setAddTaskPage] = useState(false);

    // when non-null, the edit modal is open for this task
    const [editingOriginalTask, setEditingOriginalTask] = useState(null);

    // form fields (shared by the create panel and the edit modal)
    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [desc, setNewTaskDesc] = useState("");
    const [newTaskNotes, setNewTaskNotes] = useState("");
    const [taskColor, setTaskColor] = useState(DEFAULT_TASK_COLOR);

    const getLocalISODate = (d = new Date()) => {
        const offsetMs = d.getTimezoneOffset() * 60000;
        return new Date(d.getTime() - offsetMs).toISOString().split("T")[0];
    };

    const [startDate, setStartDate] = useState(() => getLocalISODate());
    const [endDate, setEndDate] = useState("");

    const [selectedFilters, setSelectedFilters] = useState(["viewAll"]);

    const [searchInput, setSearchInput] = useState("");   // live input value
    const [searchQuery, setSearchQuery] = useState("");   // committed value used for filtering (set onBlur / Enter)

    // drag & drop (desktop only)
    const [draggingId, setDraggingId] = useState(null);
    const [dragOverCol, setDragOverCol] = useState(null);

    const FILTER_OPTIONS = [
        { id: "viewAll", label: "View All" },
        { id: "inprogress", label: "In Progress" },
        { id: "pending", label: "Pending" },
        { id: "completed", label: "Completed" },
        { id: "overdue", label: "Overdue" },
        { id: "future", label: "Future Tasks" },
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

    const showError = (message) =>
        toast(message, {
            duration: 2000,
            position: 'top-center',
            icon: '❌',
            style: { "backgroundColor": "var(--toast_error)", "color": "white" }
        });

    const [tasks, setTasks] = useState([]);

    const readTasks = async () => {
        try {
            const tasksRef = collection(db, email, "TTD", "List");
            const snapshot = await getDocs(tasksRef);

            setTasks(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
        } catch (err) {
            console.error("Error reading tasks:", err);
            showError("Failed to load tasks. Please try again.");
        }
    };

    useEffect(() => {
        if (!email) return;
        readTasks();
    }, [email, refreshState]);

    /* ---------------- form helpers ---------------- */

    const getTaskNotes = (task) => task?.assign?.[email]?.privateNotes || "";

    // closes both the create panel and the edit modal
    const resetTaskForm = () => {
        setAddTaskPage(false);
        setEditingOriginalTask(null);
        setNewTaskTitle("");
        setNewTaskDesc("");
        setNewTaskNotes("");
        setTaskColor(DEFAULT_TASK_COLOR);
        setStartDate(getLocalISODate());
        setEndDate("");
    };

    // opens the edit modal, pre-filled
    const openEditTask = (task) => {
        setAddTaskPage(false);
        setNewTaskTitle(task.title || "");
        setNewTaskDesc(task.description || "");
        setNewTaskNotes(getTaskNotes(task));
        setTaskColor(task.color || DEFAULT_TASK_COLOR);
        setStartDate(task.startDate || getLocalISODate());
        setEndDate(task.endDate || "");
        setEditingOriginalTask(task);
    };

    const isEditDirty = () => {
        const t = editingOriginalTask;
        if (!t) return false;
        return (
            newTaskTitle !== (t.title || "") ||
            desc !== (t.description || "") ||
            newTaskNotes !== getTaskNotes(t) ||
            startDate !== (t.startDate || getLocalISODate()) ||
            endDate !== (t.endDate || "") ||
            taskColor !== (t.color || DEFAULT_TASK_COLOR)
        );
    };

    const handleModalBack = () => {
        if (isEditDirty() && !window.confirm("Discard your unsaved changes?")) return;
        resetTaskForm();
    };

    // Esc = Back
    useEffect(() => {
        if (!editingOriginalTask) return;
        const onKey = (e) => { if (e.key === "Escape") handleModalBack(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    /* ---------------- create / update / delete ---------------- */

    const createTaskDB = async () => {
        if (!newTaskTitle.trim()) {
            showError("Please enter a task title.");
            return;
        }

        const taskId = newTaskTitle.trim() + "_" + uuidv4();

        const taskData = {
            id: taskId,
            title: newTaskTitle.trim(),
            description: desc.trim(),
            startDate,
            endDate,
            color: taskColor,
            assign: {
                [email]: { email, done: false, privateNotes: newTaskNotes.trim() }
            },
            createdBy: email,
            createdAt: new Date().toISOString(),
            status: "pending",          // new tasks always start in Pending
            completed: false,
            selfSelected: true,
            hasOtherAssignees: false
        };

        setLoading(true);
        try {
            await setDoc(doc(db, email, "TTD", "List", taskId), taskData);

            resetTaskForm();
            await readTasks();

            toast('Task added successfully !!', {
                duration: 2000,
                position: 'top-center',
                icon: '✅',
                style: { "backgroundColor": "var(--toast_success)", "color": "white" }
            });
        } catch (err) {
            console.error("Error creating task:", err);
            showError("Something went wrong while saving the task. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    // Saves the edit modal in place - status and completion are untouched.
    const updateTaskDB = async () => {
        if (!editingOriginalTask) return;

        if (!newTaskTitle.trim()) {
            showError("Please enter a task title.");
            return;
        }

        setLoading(true);
        try {
            await updateDoc(
                doc(db, email, "TTD", "List", editingOriginalTask.id),
                "title", newTaskTitle.trim(),
                "description", desc.trim(),
                "startDate", startDate,
                "endDate", endDate,
                "color", taskColor,
                new FieldPath("assign", email, "privateNotes"), newTaskNotes
            );

            resetTaskForm();
            await readTasks();

            toast('Task updated successfully !!', {
                duration: 2000,
                position: 'top-center',
                icon: '✅',
                style: { "backgroundColor": "var(--toast_success)", "color": "white" }
            });
        } catch (err) {
            console.error("Error updating task:", err);
            showError("Something went wrong while updating the task. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const deleteTaskDB = async () => {
        if (!editingOriginalTask) return;

        const confirmed = window.confirm(
            `Delete "${editingOriginalTask.title}"? This cannot be undone.`
        );
        if (!confirmed) return;

        setLoading(true);
        try {
            await deleteDoc(doc(db, email, "TTD", "List", editingOriginalTask.id));

            resetTaskForm();
            await readTasks();

            toast('Task deleted !!', {
                duration: 2000,
                position: 'top-center',
                icon: '🗑️',
                style: { "backgroundColor": "var(--toast_success)", "color": "white" }
            });
        } catch (err) {
            console.error("Error deleting task:", err);
            showError("Something went wrong while deleting the task. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    /* ---------------- date helpers ---------------- */

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

    const formatDate = (dateStr) => {
        if (!dateStr) return "";
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return "";
        const day = String(d.getDate()).padStart(2, "0");
        const month = String(d.getMonth() + 1).padStart(2, "0");
        const year = String(d.getFullYear()).slice(-2);
        return `${day}/${month}/${year}`;
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

    /* ---------------- task state / sorting ---------------- */

    const isTaskDone = (task) => !!task.completed || !!task.assign?.[email]?.done;

    // Older tasks have no `status` field: they are "completed" if done, otherwise "pending".
    const getStatus = (task) => {
        if (isTaskDone(task)) return "completed";
        return task.status === "inprogress" ? "inprogress" : "pending";
    };

    const getCompletionDate = (task) =>
        task.completionDate || task.assign?.[email]?.completionDate || null;

    // overdue first, normal in the middle, future-dated last
    const getDateStatusPriority = (task) => {
        const classes = getDateStatusClass(task).classes;
        if (classes.includes("overdue")) return 0;
        if (classes.includes("futureTask")) return 2;
        return 1;
    };

    const matchesFilters = (task, status) => {
        if (selectedFilters.includes("viewAll")) return true;

        return selectedFilters.every((filter) => {
            switch (filter) {
                case "inprogress":
                    return status === "inprogress";
                case "pending":
                    return status === "pending";
                case "completed":
                    return status === "completed";
                case "overdue":
                    return status !== "completed" && getDateStatusClass(task).classes.includes("overdue");
                case "future":
                    return status !== "completed" && getDateStatusClass(task).classes.includes("futureTask");
                default:
                    return true;
            }
        });
    };

    const matchesSearch = (task, query) => {
        if (!query) return true;
        const title = (task.title || "").toLowerCase();
        const description = (task.description || "").toLowerCase();
        return title.includes(query) || description.includes(query);
    };

    // Single sorted list: In Progress, then Pending, then Completed.
    // (Mobile renders it as-is; desktop splits it into the three columns.)
    const allTasks = useMemo(() => {
        const result = [];

        tasks.forEach((task) => {
            const status = getStatus(task);
            if (!matchesFilters(task, status)) return;
            if (!matchesSearch(task, searchQuery)) return;

            result.push({ ...task, status, isDone: status === "completed" });
        });

        result.sort((a, b) => {
            const rankDiff = STATUS_RANK[a.status] - STATUS_RANK[b.status];
            if (rankDiff !== 0) return rankDiff;

            if (a.status === "completed") {
                // most recently completed first
                return (getCompletionDate(b) || "").localeCompare(getCompletionDate(a) || "");
            }

            const dateDiff = getDateStatusPriority(a) - getDateStatusPriority(b);
            if (dateDiff !== 0) return dateDiff;

            return (a.startDate || "").localeCompare(b.startDate || "");
        });

        return result;
    }, [tasks, email, selectedFilters, searchQuery]);

    /* ---------------- actions ---------------- */

    const STATUS_TOAST = {
        inprogress: { text: "Moved to In Progress.", icon: "🚧", ok: true },
        pending: { text: "Moved to Pending.", icon: "↩️", ok: false },
        completed: { text: "Marked as done!", icon: "✅", ok: true },
    };

    // Sets a task to "inprogress" | "pending" | "completed".
    // The UI updates immediately; Firestore is written in the background.
    const updateTaskStatus = async (task, newStatus) => {
        const oldStatus = getStatus(task);
        if (oldStatus === newStatus) return;

        const doneValue = newStatus === "completed";
        const completionDate = doneValue ? new Date().toISOString() : null;
        const touchesCompletion = doneValue || oldStatus === "completed";

        // optimistic update
        setTasks((prev) =>
            prev.map((t) => {
                if (t.id !== task.id) return t;
                const next = { ...t, status: newStatus, completed: doneValue };
                if (touchesCompletion) next.completionDate = completionDate;
                if (t.assign?.[email]) {
                    next.assign = {
                        ...t.assign,
                        [email]: {
                            ...t.assign[email],
                            done: doneValue,
                            ...(touchesCompletion ? { completionDate } : {})
                        }
                    };
                }
                return next;
            })
        );

        try {
            const updatePairs = [
                "status", newStatus,
                "completed", doneValue
            ];

            if (touchesCompletion) {
                updatePairs.push("completionDate", completionDate);
            }

            if (task.assign && Object.prototype.hasOwnProperty.call(task.assign, email)) {
                updatePairs.push(new FieldPath("assign", email, "done"), doneValue);
                if (touchesCompletion) {
                    updatePairs.push(new FieldPath("assign", email, "completionDate"), completionDate);
                }
            }

            await updateDoc(doc(db, email, "TTD", "List", task.id), ...updatePairs);

            const t = STATUS_TOAST[newStatus];
            toast(t.text, {
                duration: 1500,
                position: 'top-center',
                icon: t.icon,
                style: { "backgroundColor": t.ok ? "var(--toast_success)" : "var(--toast_error)", "color": "white" }
            });
        } catch (err) {
            console.error("Error updating task status:", err);
            showError("Something went wrong. Please try again.");
            readTasks(); // roll back to what is actually stored
        }
    };

    // used by the inline notes box on the mobile cards
    const updatePrivateNotes = async (task, value) => {
        if (!task.assign || !task.assign[email]) return;

        try {
            await updateDoc(
                doc(db, email, "TTD", "List", task.id),
                new FieldPath("assign", email, "privateNotes"), value
            );
            await readTasks();
        } catch (err) {
            console.error("Error saving notes:", err);
            showError("Failed to save notes.");
        }
    };

    /* ---------------- drag & drop handlers (desktop) ---------------- */

    const handleDragStart = (e, task) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", task.id);
        setDraggingId(task.id);
    };

    const handleDragEnd = () => {
        setDraggingId(null);
        setDragOverCol(null);
    };

    const handleColumnDragOver = (e, colId) => {
        e.preventDefault(); // required, otherwise drop never fires
        e.dataTransfer.dropEffect = "move";
        if (dragOverCol !== colId) setDragOverCol(colId);
    };

    const handleColumnDragLeave = (e, colId) => {
        // ignore leave events fired when moving over a child element
        if (e.currentTarget.contains(e.relatedTarget)) return;
        setDragOverCol((cur) => (cur === colId ? null : cur));
    };

    const handleColumnDrop = (e, colId) => {
        e.preventDefault();
        const id = e.dataTransfer.getData("text/plain") || draggingId;
        const task = tasks.find((t) => t.id === id);

        setDraggingId(null);
        setDragOverCol(null);

        if (task) updateTaskStatus(task, colId);
    };

    /* ---------------- render ---------------- */

    // theme picker, used by both the create panel and the edit modal
    const renderColorPicker = () => (
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", marginTop: "6px" }}>
            {TASK_COLORS.map((c) => (
                <button
                    key={c}
                    type="button"
                    title={c}
                    onClick={() => setTaskColor(c)}
                    style={{
                        width: "24px",
                        height: "24px",
                        padding: 0,
                        borderRadius: "50%",
                        cursor: "pointer",
                        background: c,
                        border: taskColor === c ? "2px solid #000" : "2px solid rgba(0,0,0,0.2)",
                        boxShadow: taskColor === c ? "0 0 0 2px #fff inset" : "none"
                    }}
                ></button>
            ))}
            <input
                type="color"
                title="Custom colour"
                value={taskColor}
                onChange={(e) => setTaskColor(e.target.value)}
                style={{ width: "28px", height: "28px", padding: 0, border: "none", background: "none", cursor: "pointer" }}
            />
        </div>
    );

    // Desktop: a 200 x 200 card showing only the title and description.
    // Click opens the edit modal, drag moves it between columns.
    const renderBoardCard = (task) => {
        const bg = task.color || DEFAULT_TASK_COLOR;
        const overdue = !task.isDone && getDateStatusClass(task).classes.includes("overdue");

        return (
            <li
                key={task.id}
                className="boardCard"
                draggable
                onDragStart={(e) => handleDragStart(e, task)}
                onDragEnd={handleDragEnd}
                onClick={() => openEditTask(task)}
                style={{
                    width: "200px",
                    boxSizing: "border-box",
                    padding: "14px",
                    margin: 0,
                    borderRadius: "14px",
                    border: overdue ? "2px solid #d9534f" : "1px solid rgba(0,0,0,0.08)",
                    boxShadow: "0 1px 4px rgba(0,0,0,0.12)",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    listStyle: "none",
                    cursor: "grab",
                    opacity: draggingId === task.id ? 0.4 : 1,
                    background: bg,
                    color: getTextColor(bg)
                }}
            >
                <h3
                    style={{
                        margin: 0,
                        fontSize: "15px",
                        lineHeight: 1.3,
                        wordBreak: "break-word",
                        overflow: "hidden",
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical"
                    }}
                >
                    {task.title}
                </h3>

                {task.description?.trim().length > 0 && (
                    <p
                        style={{
                            margin: 0,
                            fontSize: "12.5px",
                            lineHeight: 1.45,
                            opacity: 0.75,
                            wordBreak: "break-word",
                            whiteSpace: "pre-wrap",
                            maxHeight: "150px",
                            overflow: "hidden"
                        }}
                    >
                        {task.description}
                    </p>
                )}
            </li>
        );
    };

    // Mobile: the full card (unchanged layout) with the status select
    const renderTaskCard = (task) => {
        const { classes: dateClasses, remainingDays } = getDateStatusClass(task);
        const displayCompletionDate = task.isDone ? getCompletionDate(task) : null;

        // keep the class names your existing CSS already targets
        const classNames = [
            "taskblock",
            "selfAssignedOnlyU",
            task.isDone ? "completed" : "notcompleted",
            ...(task.status === "inprogress" ? ["inprogress"] : []),
            ...dateClasses
        ];

        // finished after the deadline -> mark as overdue too
        if (task.isDone && task.endDate && displayCompletionDate) {
            if (new Date(displayCompletionDate) > new Date(task.endDate)) {
                classNames.push("overdue");
            }
        }

        return (
            <li key={task.id} className={classNames.join(" ")}>
                <h3>
                    {task.title}
                    <i
                        className="fa-solid fa-pen editTaskIcon"
                        title="Edit task"
                        style={{ fontSize: "13px", marginLeft: "10px", opacity: 0.6, cursor: "pointer" }}
                        onClick={() => openEditTask(task)}
                    ></i>
                </h3>

                {task.description?.trim().length > 0 && (
                    <>
                        <label
                            style={{
                                fontSize: "13px",
                                opacity: 0.7,
                                marginBottom: "10px",
                                display: "block"
                            }}
                        >
                            Description :
                        </label>

                        <p
                            className="descriptionBlock"
                            style={{
                                fontSize: "13px",
                                padding: "0 10px 10px 10px",
                                minHeight: "30px"
                            }}
                        >
                            {task.description}
                        </p>
                    </>
                )}

                {task.assign && task.assign[email] && (
                    <div className="notesBlock">
                        <label style={{ fontSize: "13px", opacity: 0.7, display: "block" }}>Notes :</label>
                        <textarea
                            // key changes when the saved notes change, so edits made in the modal show up here
                            key={`${task.id}-${task.assign[email].privateNotes || ""}`}
                            defaultValue={task.assign[email].privateNotes || ""}
                            placeholder="Add a note..."
                            onBlur={(e) => updatePrivateNotes(task, e.target.value)}
                            style={{ width: "100%", fontSize: "13px", minHeight: "40px" }}
                        ></textarea>
                    </div>
                )}

                <div className="TaskDates">
                    <p className="TaskStartDate">Starts From : <span>{formatDate(task.startDate)}</span></p>
                    {task.endDate && <p className="TaskEndDate">DeadLine :  <span>{formatDate(task.endDate)}</span></p>}
                </div>

                {remainingDays !== null && !task.isDone && (
                    <span className="remainingDaysLabel">
                        {remainingDays === 0 ? "Due today" : `${remainingDays} day${remainingDays === 1 ? "" : "s"} left`}
                    </span>
                )}

                <span className="overDueLabel">OverDue</span>

                <div style={{ marginTop: "10px" }}>
                    <select
                        className="statusSelect"
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task, e.target.value)}
                        style={{ padding: "8px 10px", borderRadius: "8px", border: "1px solid rgba(0,0,0,0.2)", fontSize: "13px" }}
                    >
                        <option value="inprogress">In Progress</option>
                        <option value="pending">Pending</option>
                        <option value="completed">Completed</option>
                    </select>
                </div>

                <span className="TaskDone">Completed {formatDate(displayCompletionDate)} </span>
            </li>
        );
    };

    // Mobile: one list, In Progress -> Pending -> Completed
    const renderMobileList = () => {
        if (allTasks.length === 0) return null;

        return (
            <div style={{ margin: "0px 0", paddingRight: "10px" }}>
                <ul>
                    {allTasks.map((task) => renderTaskCard(task))}
                </ul>
            </div>
        );
    };

    // Desktop: three equal-width columns that act as drop zones.
    // Cards wrap inside each column, so they sit side by side.
    const renderKanbanBoard = () => (
        <div
            className="kanbanBoard"
            style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: "14px",
                alignItems: "stretch",
                paddingRight: "15px"
            }}
        >
            {COLUMNS.map((col) => {
                const colTasks = allTasks.filter((t) => t.status === col.id);
                const isOver = dragOverCol === col.id;

                return (
                    <div
                        key={col.id}
                        className={`kanbanColumn ${col.id} ${isOver ? "dragOver" : ""}`}
                        onDragOver={(e) => handleColumnDragOver(e, col.id)}
                        onDragLeave={(e) => handleColumnDragLeave(e, col.id)}
                        onDrop={(e) => handleColumnDrop(e, col.id)}
                        style={{
                            minHeight: "60vh",
                            padding: "10px",
                            borderRadius: "12px",
                            outline: "1px dashed rgba(0,0,0,0.35)",
                            transition: "background 0.15s, outline-color 0.15s"
                        }}
                    >
                        <div
                            className="kanbanColumnHeader"
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}
                        >
                            <h3 style={{ margin: 0 }}>{col.title}</h3>
                            <span style={{ fontSize: "13px", opacity: 0.6 }}>{colTasks.length}</span>
                        </div>

                        <ul
                            style={{
                                display: "flex",
                                flexWrap: "wrap",
                                alignItems: "flex-start",
                                gap: "12px",
                                padding: 0,
                                margin: 0,
                                listStyle: "none"
                            }}
                        >
                            {colTasks.map((task) => renderBoardCard(task))}
                        </ul>

                        {colTasks.length === 0 && (
                            <p style={{ fontSize: "13px", opacity: 0.5, textAlign: "center", marginTop: "30px" }}>
                                Drop tasks here
                            </p>
                        )}
                    </div>
                );
            })}
        </div>
    );

    // Modal for viewing / editing a task
    const renderEditModal = () => (
        <div
            onClick={handleModalBack}
            style={{
                position: "fixed",
                inset: 0,
                zIndex: 1000,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: "16px",
                boxSizing: "border-box",
                background: "rgba(0,0,0,0.45)"
            }}
        >
            <div
                onClick={(e) => e.stopPropagation()}
                style={{
                    width: "min(560px, 100%)",
                    maxHeight: "90vh",
                    overflowY: "auto",
                    boxSizing: "border-box",
                    padding: "16px 18px 20px",
                    borderRadius: "16px",
                    boxShadow: "0 10px 40px rgba(0,0,0,0.3)",
                    background: taskColor,
                    color: getTextColor(taskColor)
                }}
            >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px", marginBottom: "14px" }}>
                    <button type="button" style={modalBtnStyle} onClick={handleModalBack}>
                        <i className="fa-solid fa-chevron-left"></i> Back
                    </button>
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            type="button"
                            style={{ ...modalBtnStyle, background: "var(--toast_error, #d9534f)", color: "#fff" }}
                            onClick={deleteTaskDB}
                        >
                            <i className="fa-solid fa-trash"></i> Delete
                        </button>
                        <button
                            type="button"
                            style={{ ...modalBtnStyle, background: "var(--base_color, #333)", color: "#fff" }}
                            onClick={updateTaskDB}
                        >
                            <i className="fa-solid fa-floppy-disk"></i> Save
                        </button>
                    </div>
                </div>

                <input
                    style={{ ...fieldStyle, fontSize: "18px", fontWeight: "bold" }}
                    placeholder="Title"
                    value={newTaskTitle}
                    onChange={(e) => setNewTaskTitle(e.target.value)}
                />

                <span style={labelStyle}>Description :</span>
                <textarea
                    style={{ ...fieldStyle, minHeight: "110px", resize: "vertical" }}
                    placeholder="What need to be done, etc .. "
                    value={desc}
                    onChange={(e) => setNewTaskDesc(e.target.value)}
                ></textarea>

                <span style={labelStyle}>Notes :</span>
                <textarea
                    style={{ ...fieldStyle, minHeight: "90px", resize: "vertical" }}
                    placeholder="Add a note..."
                    value={newTaskNotes}
                    onChange={(e) => setNewTaskNotes(e.target.value)}
                ></textarea>

                <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
                    <div>
                        <span style={labelStyle}>Start's From :</span>
                        <input type="date" style={{ ...fieldStyle, width: "auto" }} value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)} />
                    </div>
                    <div>
                        <span style={labelStyle}>DeadLine :</span>
                        <input type="date" style={{ ...fieldStyle, width: "auto" }} value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)} />
                    </div>
                </div>

                <span style={labelStyle}>Theme (background colour) :</span>
                {renderColorPicker()}
            </div>
        </div>
    );

    return (
        <div
            className={`defaultWidgetDiv TTDMain ${isMobile ? 'mobile' : 'desk'} ${addTaskPage ? 'add' : ''}`}
            style={{ padding: "0px 0px 40px 15px" }}
            onContextMenu={handleRightClick}
            onClick={() => setContextMenu((prev) => ({ ...prev, visible: false }))}
        >
            <div className="taskFilterBar">
                <input
                    style={{
                        outline: "none",
                        border: "1px solid rgba(0, 0, 0, 0.2)",
                        paddingLeft: "10px",
                        borderRadius: "20px",
                    }}
                    type="text"
                    placeholder="Search tasks..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onBlur={() => setSearchQuery(searchInput.trim().toLowerCase())}
                    onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            setSearchQuery(searchInput.trim().toLowerCase());
                            e.target.blur();
                        }
                    }}
                />
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
                {isMobile ? renderMobileList() : renderKanbanBoard()}
            </div>

            <div className="recordsCount">
                <span>Records : </span>
                <label>{allTasks.length}</label>
            </div>

            <button
                style={{ position: "absolute", bottom: "30px", right: "20px", padding: "10px", cursor: "pointer", border: "none", outline: "none", background: "var(--base_color)", color: "white", borderRadius: "10px" }}
                onClick={() => { resetTaskForm(); setAddTaskPage(true); }}
            >
                New Task +
            </button>

            {/* Create panel: title, description, notes, dates, theme */}
            <div className="addNewTask">
                <div style={{ marginBottom: "30px" }}>
                    <i className="fa-solid fa-chevron-left" style={{ display: "inline-block" }} onClick={resetTaskForm}></i>
                    <h3 style={{ display: "inline-block" }}>SetUp New Task</h3>
                </div>

                <span style={{ display: "block" }}>Title : </span>
                <input value={newTaskTitle} placeholder="Create Doc .." onChange={(e) => setNewTaskTitle(e.target.value)}></input>

                <span style={{ display: "block" }}>Description : </span>
                <textarea placeholder="What need to be done, etc .. " value={desc} onChange={(e) => setNewTaskDesc(e.target.value)} style={{ fontSize: "14px" }}></textarea>

                <span style={{ display: "block" }}>Notes : </span>
                <textarea placeholder="Add a note..." value={newTaskNotes} onChange={(e) => setNewTaskNotes(e.target.value)} style={{ fontSize: "14px" }}></textarea>

                <div className="Dates" style={{ display: "flex" }}>
                    <div>
                        <span style={{ display: "block" }}>Start's From : </span>
                        <input type="date" className="DateIn" value={startDate} max={endDate} onChange={(e) => setStartDate(e.target.value)}></input>
                    </div>
                    <div style={{ marginLeft: "20px" }}>
                        <span style={{ display: "block" }}>DeadLine : </span>
                        <input type="date" className="DateIn" value={endDate} min={startDate} onChange={(e) => setEndDate(e.target.value)}></input>
                    </div>
                </div>

                <span style={{ display: "block", marginTop: "14px" }}>Theme (background colour) : </span>
                {renderColorPicker()}

                <button className="saveNewTaskBtn" onClick={createTaskDB}>Save</button>

                <div style={{ height: "20px" }}></div>
            </div>

            {editingOriginalTask && renderEditModal()}

            <div
                className="refreshWidget"
                style={{ display: contextMenu.visible ? "block" : "none", left: contextMenu.x, top: contextMenu.y, cursor: "pointer", width: "auto", overflow: "hidden", padding: "10px", boxShadow: "0 0 10px rgba(0, 0, 0, 0.1)", zIndex: 20, position: "fixed", background: "white", borderRadius: "10px", fontSize: "13px" }}
                onClick={() => setRefreshState(prev => prev + 1)}
            >
                Refresh
            </div>
        </div>
    )
}

export default TTDWidget;