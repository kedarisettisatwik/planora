import { useState, useEffect, useRef } from "react";
import toast from 'react-hot-toast';
import { isMobile } from "react-device-detect";
import { v4 as uuidv4 } from 'uuid';

import '../Styles/Home.css'
import '../Styles/Notes.css'

import { doc, setDoc, deleteDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";

/* ---------------- constants & helpers ---------------- */

const NOTE_COLORS = [
    "#fff8b8", // yellow
    "#d7f5d3", // green
    "#d3ebfa", // blue
    "#fbd5e5", // pink
    "#e5dcfa", // purple
    "#ffe0c2", // orange
    "#e8e8e8", // grey
    "#ffffff", // white
];
const DEFAULT_COLOR = NOTE_COLORS[0];

// formatting buttons shown above the note editor
const TOOLS = [
    { cmd: "bold", icon: "fa-bold", title: "Bold" },
    { cmd: "italic", icon: "fa-italic", title: "Italic" },
    { cmd: "underline", icon: "fa-underline", title: "Underline" },
    { cmd: "insertUnorderedList", icon: "fa-list-ul", title: "Bullet list" },
    { cmd: "insertOrderedList", icon: "fa-list-ol", title: "Numbered list" },
];

const ALLOWED_TAGS = new Set(["B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "BR", "DIV", "P"]);

// Keeps only the formatting tags above and strips every attribute, so nothing
// like <script> or onerror="..." can ever be saved or rendered.
const sanitizeHtml = (html) => {
    const parsed = new DOMParser().parseFromString(`<div>${html || ""}</div>`, "text/html");
    const root = parsed.body.firstChild;

    const clean = (node) => {
        Array.from(node.childNodes).forEach((child) => {
            if (child.nodeType === 3) return; // text
            if (child.nodeType !== 1) { child.remove(); return; }

            if (child.tagName === "SCRIPT" || child.tagName === "STYLE") {
                child.remove();
                return;
            }

            clean(child);

            if (ALLOWED_TAGS.has(child.tagName)) {
                Array.from(child.attributes).forEach((a) => child.removeAttribute(a.name));
            } else {
                child.replaceWith(...Array.from(child.childNodes)); // unwrap unknown tags, keep their text
            }
        });
    };

    clean(root);
    return root.innerHTML;
};

// plain-text version of some HTML (used for the preview on the card)
const htmlToText = (html) => {
    const spaced = (html || "").replace(/<\/(div|p|li)>|<br\s*\/?>/gi, "$& ");
    const parsed = new DOMParser().parseFromString(spaced, "text/html");
    return (parsed.body.textContent || "").replace(/\s+/g, " ").trim();
};

// dark text on light backgrounds, white text on dark ones (for custom colours)
const getTextColor = (hex) => {
    const m = /^#([0-9a-f]{6})$/i.exec(hex || "");
    if (!m) return "#1f1f1f";
    const n = parseInt(m[1], 16);
    const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.55 ? "#1f1f1f" : "#ffffff";
};

// what the "unsaved changes?" check compares
const makeSnapshot = (d, editorHtml, pendingItem) => ({
    title: (d.title || "").trim(),
    color: d.color,
    content: d.type === "note" ? sanitizeHtml(editorHtml) : "",
    items: d.type === "list" ? d.items : [],
    pending: (pendingItem || "").trim(),
});

const showError = (message) =>
    toast(message, {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: { "backgroundColor": "var(--toast_error)", "color": "white" }
    });

const showSuccess = (message, icon = '✅') =>
    toast(message, {
        duration: 2000,
        position: 'top-center',
        icon,
        style: { "backgroundColor": "var(--toast_success)", "color": "white" }
    });


/* ---------------- component ---------------- */

function NotesWidget({ email, setLoading }) {

    const [notes, setNotes] = useState([]);
    const [loaded, setLoaded] = useState(false);

    // modal: null | "choose" (note or list?) | "edit"
    const [modal, setModal] = useState(null);
    const [draft, setDraft] = useState(null);
    const [newItemText, setNewItemText] = useState("");   // list: text waiting to be added
    const [activeFormats, setActiveFormats] = useState({});

    const editorRef = useRef(null);
    const initialRef = useRef(null);   // snapshot taken when the editor opened

    /* ---------- load ---------- */

    const readNotes = async () => {
        try {
            const snapshot = await getDocs(collection(db, email, "Notes", "List"));
            const data = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
            data.sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
            setNotes(data);
        } catch (err) {
            console.error("Error reading notes:", err);
            showError("Failed to load notes. Please try again.");
        } finally {
            setLoaded(true);
        }
    };

    useEffect(() => {
        if (!email) return;
        readNotes();
    }, [email]);

    /* ---------- open / close ---------- */

    const closeModal = () => {
        setModal(null);
        setDraft(null);
        setNewItemText("");
        setActiveFormats({});
    };

    const openNew = (type) => {
        const d = {
            sessionId: uuidv4(), id: null, type,
            title: "", content: "", items: [],
            color: DEFAULT_COLOR, createdAt: null,
        };
        initialRef.current = makeSnapshot(d, "", "");
        setDraft(d);
        setNewItemText("");
        setModal("edit");
    };

    const openExisting = (note) => {
        const d = {
            sessionId: uuidv4(), id: note.id, type: note.type || "note",
            title: note.title || "", content: note.content || "",
            items: note.items || [], color: note.color || DEFAULT_COLOR,
            createdAt: note.createdAt || null,
        };
        initialRef.current = makeSnapshot(d, d.content, "");
        setDraft(d);
        setNewItemText("");
        setModal("edit");
    };

    // Load the saved HTML into the editor once, when it opens. After that the
    // browser owns the content (so the caret never jumps) and we read it on save.
    useEffect(() => {
        if (modal !== "edit" || !draft || draft.type !== "note" || !editorRef.current) return;
        editorRef.current.innerHTML = sanitizeHtml(draft.content);
        initialRef.current = {
            ...initialRef.current,
            content: sanitizeHtml(editorRef.current.innerHTML),
        };
    }, [modal, draft?.sessionId]);

    const isDirty = () => {
        if (modal !== "edit" || !draft || !initialRef.current) return false;
        const current = makeSnapshot(draft, editorRef.current?.innerHTML || "", newItemText);
        return JSON.stringify(current) !== JSON.stringify(initialRef.current);
    };

    const handleBack = () => {
        if (isDirty() && !window.confirm("Discard your unsaved changes?")) return;
        closeModal();
    };

    // Esc = Back
    useEffect(() => {
        if (!modal) return;
        const onKey = (e) => { if (e.key === "Escape") handleBack(); };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    });

    /* ---------- rich text ---------- */

    const refreshFormats = () => {
        const el = editorRef.current;
        const sel = window.getSelection();
        if (!el || !sel || !sel.anchorNode || !el.contains(sel.anchorNode)) return;

        const next = {};
        TOOLS.forEach((t) => {
            try { next[t.cmd] = document.queryCommandState(t.cmd); }
            catch { next[t.cmd] = false; }
        });
        setActiveFormats(next);
    };

    useEffect(() => {
        if (modal !== "edit" || draft?.type !== "note") return;
        document.addEventListener("selectionchange", refreshFormats);
        return () => document.removeEventListener("selectionchange", refreshFormats);
    }, [modal, draft?.type]);

    const runCommand = (cmd) => {
        editorRef.current?.focus();
        document.execCommand(cmd, false, null);
        refreshFormats();
    };

    // paste as plain text so copied web-page styling doesn't leak into the note
    const handlePaste = (e) => {
        e.preventDefault();
        const text = e.clipboardData.getData("text/plain");
        document.execCommand("insertText", false, text);
    };

    /* ---------- list items ---------- */

    const addItem = () => {
        const text = newItemText.trim();
        if (!text) return;
        setDraft((d) => ({ ...d, items: [...d.items, { id: uuidv4(), text, done: false }] }));
        setNewItemText("");
    };

    const toggleItem = (id) =>
        setDraft((d) => ({ ...d, items: d.items.map((i) => (i.id === id ? { ...i, done: !i.done } : i)) }));

    const removeItem = (id) =>
        setDraft((d) => ({ ...d, items: d.items.filter((i) => i.id !== id) }));

    /* ---------- save / delete ---------- */

    const saveNote = async () => {
        if (!draft) return;

        let items = draft.items;
        const pending = newItemText.trim();
        // text typed in the box but not added yet is added instead of being lost
        if (draft.type === "list" && pending) {
            items = [...items, { id: uuidv4(), text: pending, done: false }];
        }

        const content = draft.type === "note" ? sanitizeHtml(editorRef.current?.innerHTML || "") : "";
        const now = new Date().toISOString();
        const id = draft.id || uuidv4();

        const data = {
            id,
            type: draft.type,
            title: draft.title.trim() || "Untitled",
            content,
            preview: draft.type === "note" ? htmlToText(content).slice(0, 200) : "",
            items: draft.type === "list" ? items : [],
            color: draft.color,
            createdAt: draft.createdAt || now,
            updatedAt: now,
        };

        setLoading(true);
        try {
            await setDoc(doc(db, email, "Notes", "List", id), data);
            closeModal();
            await readNotes();
            showSuccess(draft.id ? "Saved !!" : (draft.type === "list" ? "List created !!" : "Note created !!"));
        } catch (err) {
            console.error("Error saving note:", err);
            showError("Something went wrong while saving. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const deleteNote = async () => {
        if (!draft?.id) return;
        if (!window.confirm(`Delete "${draft.title.trim() || "Untitled"}"? This cannot be undone.`)) return;

        setLoading(true);
        try {
            await deleteDoc(doc(db, email, "Notes", "List", draft.id));
            closeModal();
            await readNotes();
            showSuccess("Deleted !!", '🗑️');
        } catch (err) {
            console.error("Error deleting note:", err);
            showError("Something went wrong while deleting. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    /* ---------- render ---------- */

    const stop = (e) => e.stopPropagation();

    const renderCard = (n) => (
        <div
            key={n.id}
            className="notes-card"
            style={{ background: n.color || DEFAULT_COLOR, color: getTextColor(n.color || DEFAULT_COLOR) }}
            onClick={() => openExisting(n)}
        >
            <div className="notes-card-head">
                <h4>{n.title || "Untitled"}</h4>
                <i className={`fa-solid ${n.type === "list" ? "fa-list-check" : "fa-note-sticky"}`}></i>
            </div>

            {n.type === "list" ? (
                <div className="notes-card-preview">
                    {(n.items || []).slice(0, 5).map((i) => (
                        <div key={i.id} className={`notes-card-line ${i.done ? "done" : ""}`}>
                            {i.done ? "☑" : "☐"} {i.text}
                        </div>
                    ))}
                </div>
            ) : (
                <div className="notes-card-preview text">{n.preview}</div>
            )}
        </div>
    );

    const renderChooser = () => (
        <div className="notes-modal notes-choose" style={{ background: "#fff", color: "#1f1f1f" }} onClick={stop}>
            <div className="notes-modal-bar">
                <button className="notes-btn" onClick={closeModal}>
                    <i className="fa-solid fa-chevron-left"></i> Back
                </button>
            </div>
            <h3>What do you want to create?</h3>
            <div className="notes-choose-options">
                <button onClick={() => openNew("note")}>
                    <i className="fa-solid fa-note-sticky"></i>
                    <strong>Note</strong>
                    <span>Rich text with bold, underline and lists</span>
                </button>
                <button onClick={() => openNew("list")}>
                    <i className="fa-solid fa-list-check"></i>
                    <strong>List</strong>
                    <span>Add items one by one and tick them off</span>
                </button>
            </div>
        </div>
    );

    const renderEditor = () => (
        <div
            className="notes-modal"
            style={{ background: draft.color, color: getTextColor(draft.color) }}
            onClick={stop}
        >
            <div className="notes-modal-bar">
                <button className="notes-btn" onClick={handleBack}>
                    <i className="fa-solid fa-chevron-left"></i> Back
                </button>
                <div className="notes-modal-actions">
                    {draft.id && (
                        <button className="notes-btn danger" onClick={deleteNote}>
                            <i className="fa-solid fa-trash"></i> Delete
                        </button>
                    )}
                    <button className="notes-btn primary" onClick={saveNote}>
                        <i className="fa-solid fa-floppy-disk"></i> Save
                    </button>
                </div>
            </div>

            <input
                className="notes-title-input"
                placeholder={draft.type === "list" ? "List title" : "Title"}
                value={draft.title}
                autoFocus={!draft.id}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
            />

            {draft.type === "note" ? (
                <>
                    <div className="notes-toolbar">
                        {TOOLS.map((t) => (
                            <button
                                key={t.cmd}
                                type="button"
                                title={t.title}
                                className={`notes-tool ${activeFormats[t.cmd] ? "active" : ""}`}
                                onMouseDown={(e) => e.preventDefault()}   // keep the text selection
                                onClick={() => runCommand(t.cmd)}
                            >
                                <i className={`fa-solid ${t.icon}`}></i>
                            </button>
                        ))}
                    </div>
                    <div
                        ref={editorRef}
                        className="notes-editor"
                        contentEditable
                        suppressContentEditableWarning
                        data-placeholder="Start writing..."
                        onPaste={handlePaste}
                        onKeyUp={refreshFormats}
                        onMouseUp={refreshFormats}
                    ></div>
                </>
            ) : (
                <div className="notes-list-body">
                    <div className="notes-add-row">
                        <textarea
                            rows={1}
                            placeholder="Add an item..."
                            value={newItemText}
                            onChange={(e) => setNewItemText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === "Enter" && !e.shiftKey) {
                                    e.preventDefault();
                                    addItem();
                                }
                            }}
                        ></textarea>
                        <button className="notes-btn primary" onClick={addItem}>Add</button>
                    </div>

                    {draft.items.length === 0 ? (
                        <p className="notes-empty-hint">No items yet.</p>
                    ) : (
                        <ul className="notes-items">
                            {draft.items.map((i) => (
                                <li key={i.id} className={i.done ? "done" : ""}>
                                    <input type="checkbox" checked={i.done} onChange={() => toggleItem(i.id)} />
                                    <span>{i.text}</span>
                                    <button type="button" title="Remove item" onClick={() => removeItem(i.id)}>
                                        <i className="fa-solid fa-xmark"></i>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            <div className="notes-colors">
                <span>Background :</span>
                {NOTE_COLORS.map((c) => (
                    <button
                        key={c}
                        type="button"
                        title={c}
                        className={`notes-swatch ${draft.color === c ? "selected" : ""}`}
                        style={{ background: c }}
                        onClick={() => setDraft((d) => ({ ...d, color: c }))}
                    ></button>
                ))}
                <label className="notes-custom-color" title="Custom colour">
                    <input
                        type="color"
                        value={draft.color}
                        onChange={(e) => setDraft((d) => ({ ...d, color: e.target.value }))}
                    />
                </label>
            </div>
        </div>
    );

    return (
        <div
            className={`defaultWidgetDiv NotesMain ${isMobile ? 'mobile' : 'desk'}`}
            style={{ padding: "0px 0px 40px 15px" }}
        >
            <div className="notes-grid">
                {notes.map(renderCard)}
            </div>

            {loaded && notes.length === 0 && (
                <p className="notes-empty">No notes yet. Tap "New Note +" to add one.</p>
            )}

            <button
                style={{ position: "absolute", bottom: "30px", right: "20px", padding: "10px", cursor: "pointer", border: "none", outline: "none", background: "var(--base_color)", color: "white", borderRadius: "10px" }}
                onClick={() => setModal("choose")}
            >
                New Note +
            </button>

            {modal && (
                <div className="notes-overlay" onClick={handleBack}>
                    {modal === "choose" ? renderChooser() : (draft && renderEditor())}
                </div>
            )}
        </div>
    );
}

export default NotesWidget;