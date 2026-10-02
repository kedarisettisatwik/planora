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

// width share of each column on desktop (2fr : 1fr : 1fr)
const COLUMN_WEIGHTS = { inprogress: 2, pending: 1, completed: 1 };
const EMPTY_COLUMN_WIDTH = "150px";

function TTDWidget({ email, setLoading }) {

    const [refreshState, setRefreshState] = useState(0);

    const [contextMenu, setContextMenu] = useState({ visible: false, x: 0, y: 0 });

    const handleRightClick = (e) => {
        e.preventDefault();
        setContextMenu({ visible: true, x: e.clientX, y: e.clientY });
    };

    const [addTaskPage, setAddTaskPage] = useState(false);

    // when non-null, the "addNewTask" panel is in edit mode for this task instead of create mode
    const [editingOriginalTask, setEditingOriginalTask] = useState(null);

    const [newTaskTitle, setNewTaskTitle] = useState("");
    const [desc, setNewTaskDesc] = useState("");

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

    const resetTaskForm = () => {
        setAddTaskPage(false);
        setEditingOriginalTask(null);
        setNewTaskTitle("");
        setNewTaskDesc("");
        setStartDate(getLocalISODate());
        setEndDate("");
    };

    const openEditTask = (task) => {
        setEditingOriginalTask(task);
        setNewTaskTitle(task.title || "");
        setNewTaskDesc(task.description || "");
        setStartDate(task.startDate || getLocalISODate());
        setEndDate(task.endDate || "");
        setAddTaskPage(true);
    };

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
            assign: {
                [email]: { email, done: false, privateNotes: "" }
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

    // Edits in place - status, completion and notes are untouched.
    const updateTaskDB = async () => {
        if (!editingOriginalTask) return;

        if (!newTaskTitle.trim()) {
            showError("Please enter a task title.");
            return;
        }

        setLoading(true);
        try {
            await updateDoc(doc(db, email, "TTD", "List", editingOriginalTask.id), {
                title: newTaskTitle.trim(),
                description: desc.trim(),
                startDate,
                endDate
            });

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

    const saveTask = () => {
        if (editingOriginalTask) {
            updateTaskDB();
        } else {
            createTaskDB();
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

    const renderTaskCard = (task, { draggable = false } = {}) => {
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
            <li
                key={task.id}
                className={classNames.join(" ")}
                draggable={draggable}
                onDragStart={draggable ? (e) => handleDragStart(e, task) : undefined}
                onDragEnd={draggable ? handleDragEnd : undefined}
                style={draggable ? {
                    cursor: "grab",
                    opacity: draggingId === task.id ? 0.4 : 1,
                    listStyle: "none",
                    marginBottom: "10px"
                } : undefined}
            >
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
                            defaultValue={task.assign[email].privateNotes || ""}
                            placeholder="Add a note..."
                            onBlur={(e) => updatePrivateNotes(task, e.target.value)}
                            // don't let text selection inside the textarea start a card drag
                            onMouseDown={(e) => e.stopPropagation()}
                            draggable={false}
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

                {/* Mobile: status select instead of the Done / Back buttons.
                    Desktop: no control needed, you drag the card between columns. */}
                {isMobile && (
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
                )}

                <span className="TaskDone">Completed {formatDate(displayCompletionDate)} </span>
            </li>
        );
    };

    // Mobile (unchanged layout): one list, In Progress -> Pending -> Completed
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

    // Desktop: three equal columns that act as drop zones
    const renderKanbanBoard = () => {
        // tasks per column
        const tasksByColumn = {};
        COLUMNS.forEach((col) => {
            tasksByColumn[col.id] = allTasks.filter((t) => t.status === col.id);
        });

        // Empty column -> fixed 150px. Non-empty columns split the remaining
        // width by weight (In Progress 1fr, Pending 2fr, Completed 1fr).
        const gridTemplateColumns = COLUMNS
            .map((col) =>
                tasksByColumn[col.id].length === 0
                    ? EMPTY_COLUMN_WIDTH
                    : `minmax(0, ${COLUMN_WEIGHTS[col.id]}fr)`
            )
            .join(" ");

        return (
        <div
            className="kanbanBoard"
            style={{
                display: "grid",
                gridTemplateColumns,
                gap: "14px",
                alignItems: "stretch",
                paddingRight: "15px",
                transition: "grid-template-columns 0.2s ease"
            }}
        >
            {COLUMNS.map((col) => {
                const colTasks = tasksByColumn[col.id];
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

                        <ul style={{ padding: 0, margin: 0 }}>
                            {colTasks.map((task) => renderTaskCard(task, { draggable: true }))}
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
    };

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
                onClick={() => { setEditingOriginalTask(null); setAddTaskPage(true); }}
            >
                New Task +
            </button>

            <div className="addNewTask">
                <div style={{ marginBottom: "30px" }}>
                    <i className="fa-solid fa-chevron-left" style={{ display: "inline-block" }} onClick={resetTaskForm}></i>
                    <h3 style={{ display: "inline-block" }}>{editingOriginalTask ? "Edit Task" : "SetUp New Task"}</h3>
                </div>

                <span style={{ display: "block" }}>Title : </span>
                <input value={newTaskTitle} placeholder="Create Doc .." onChange={(e) => setNewTaskTitle(e.target.value)}></input>

                <span style={{ display: "block" }}>Description : </span>
                <textarea placeholder="What need to be done, etc .. " value={desc} onChange={(e) => setNewTaskDesc(e.target.value)} style={{ fontSize: "14px" }}></textarea>

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

                <button className="saveNewTaskBtn" onClick={saveTask}>{editingOriginalTask ? "Update" : "Save"}</button>

                {editingOriginalTask && (
                    <button
                        type="button"
                        className="deleteTaskBtn"
                        onClick={deleteTaskDB}
                        style={{ padding: "10px", cursor: "pointer", background: "var(--toast_error)", color: "white", border: "none", borderRadius: "10px" }}
                    >
                        <i className="fa-solid fa-trash" style={{ marginRight: "8px" }}></i>
                        Delete Task
                    </button>
                )}

                <div style={{ height: "20px" }}></div>
            </div>

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