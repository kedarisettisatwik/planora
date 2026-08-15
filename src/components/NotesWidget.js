import { useState, useEffect, useMemo } from "react";
import { isMobile } from "react-device-detect";

import '../Styles/Home.css'
import '../Styles/Notes.css'

import { collection, getDocs, doc, setDoc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function NotesWidget ({ email, x, y, setLoading, setPopup, setPopupContent, signOut}){

    const [notes, setNotes] = useState([]);
    const [selectedNoteId, setSelectedNoteId] = useState(null);

    const [editTitle, setEditTitle] = useState("");
    const [editContent, setEditContent] = useState("");
    const [editLabels, setEditLabels] = useState([]);
    const [labelInput, setLabelInput] = useState("");

    const [initialLoad, setInitialLoad] = useState(true);
    const [searchQuery, setSearchQuery] = useState("");
    const [checkedLabels, setCheckedLabels] = useState([]);
    const [showLabelFilter, setShowLabelFilter] = useState(false);

    // FIX: this needs to be state, not a ref — updating a ref doesn't
    // trigger the isDirty useMemo to recompute, so the Save button
    // kept showing "dirty" after a successful save.
    const [savedSnapshot, setSavedSnapshot] = useState({ title: "", content: "", labels: [] });

    const notesListRef = () => collection(db, email, "Notes", "NotesList");
    const noteDocRef = (id) => doc(db, email, "Notes", "NotesList", id);

    useEffect(() => {
        if (!email) return;
        fetchNotes();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [email]);

    const fetchNotes = async () => {
        setLoading && setLoading(true);
        try {
            const snapshot = await getDocs(notesListRef());
            const notesArr = snapshot.docs.map(d => ({ id: d.id, labels: [], ...d.data() }));
            notesArr.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0));
            setNotes(notesArr);
        } catch (err) {
            console.error("Error fetching notes:", err);
            if (setPopupContent && setPopup) {
                setPopupContent("Failed to load notes. Please try again.");
                setPopup(true);
            }
        } finally {
            setLoading && setLoading(false);
            setInitialLoad(false);
        }
    };

    const deleteNote = async (noteId) => {
        setLoading && setLoading(true);
        try {
            await deleteDoc(noteDocRef(noteId));
            setNotes(prev => prev.filter(n => n.id !== noteId));
            if (selectedNoteId === noteId) {
                setSelectedNoteId(null); // close editor if the deleted note was open
            }
        } catch (err) {
            console.error("Error deleting note:", err);
            if (setPopupContent && setPopup) {
                setPopupContent("Failed to delete note.");
                setPopup(true);
            }
        } finally {
            setLoading && setLoading(false);
        }
    };

    const createNewNote = async () => {
        const now = Date.now();
        const newId = `${now}_${crypto.randomUUID()}`;
        const newNote = {
            title: "Untitled Note",
            content: "",
            labels: [],
            dateCreated: now,
            lastModified: now
        };

        setLoading && setLoading(true);
        try {
            await setDoc(noteDocRef(newId), newNote);
            const fullNote = { id: newId, ...newNote };
            setNotes(prev => [fullNote, ...prev]);
            openNote(fullNote);
        } catch (err) {
            console.error("Error creating note:", err);
            if (setPopupContent && setPopup) {
                setPopupContent("Failed to create note. Please try again.");
                setPopup(true);
            }
        } finally {
            setLoading && setLoading(false);
        }
    };

    const openNote = (note) => {
        setSelectedNoteId(note.id);
        setEditTitle(note.title || "");
        setEditContent(note.content || "");
        setEditLabels(note.labels || []);
        setLabelInput("");
        setSavedSnapshot({
            title: note.title || "",
            content: note.content || "",
            labels: note.labels || []
        });
    };

    const closeEditor = () => {
        setSelectedNoteId(null);
    };

    const isDirty = useMemo(() => {
        if (!selectedNoteId) return false;
        return (
            editTitle !== savedSnapshot.title ||
            editContent !== savedSnapshot.content ||
            JSON.stringify(editLabels) !== JSON.stringify(savedSnapshot.labels)
        );
    }, [editTitle, editContent, editLabels, selectedNoteId, savedSnapshot]);

    const saveNote = async () => {
        if (!selectedNoteId || !isDirty) return;
        const now = Date.now();
        setLoading && setLoading(true);
        try {
            await updateDoc(noteDocRef(selectedNoteId), {
                title: editTitle,
                content: editContent,
                labels: editLabels,
                lastModified: now
            });
            setNotes(prev =>
                prev.map(n => n.id === selectedNoteId
                    ? { ...n, title: editTitle, content: editContent, labels: editLabels, lastModified: now }
                    : n
                ).sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0))
            );
            setSavedSnapshot({ title: editTitle, content: editContent, labels: editLabels });
        } catch (err) {
            console.error("Error saving note:", err);
            if (setPopupContent && setPopup) {
                setPopupContent("Failed to save note.");
                setPopup(true);
            }
        } finally {
            setLoading && setLoading(false);
        }
    };

    const addLabel = () => {
        const val = labelInput.trim();
        if (!val) return;
        if (!editLabels.includes(val)) {
            setEditLabels(prev => [...prev, val]);
        }
        setLabelInput("");
    };

    const removeLabel = (label) => {
        setEditLabels(prev => prev.filter(l => l !== label));
    };

    const handleLabelKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addLabel();
        }
    };

    const allLabels = useMemo(() => {
        const set = new Set();
        notes.forEach(n => (n.labels || []).forEach(l => set.add(l)));
        return Array.from(set).sort();
    }, [notes]);

    const toggleLabelFilter = (label) => {
        setCheckedLabels(prev =>
            prev.includes(label) ? prev.filter(l => l !== label) : [...prev, label]
        );
    };

    const filteredNotes = useMemo(() => {
        return notes.filter(note => {
            const matchesSearch = (note.title || "")
                .toLowerCase()
                .includes(searchQuery.trim().toLowerCase());
            const noteLabels = note.labels || [];
            const matchesLabels = checkedLabels.every(l => noteLabels.includes(l));
            return matchesSearch && matchesLabels;
        });
    }, [notes, searchQuery, checkedLabels]);

    const selectedNote = notes.find(n => n.id === selectedNoteId);
    const showListOnMobile = isMobile && !selectedNoteId;
    const showEditorOnMobile = isMobile && !!selectedNoteId;

    useEffect(() => {
        if (!initialLoad && selectedNoteId && !notes.find(n => n.id === selectedNoteId)) {
            setSelectedNoteId(null);
        }
    }, [notes, selectedNoteId, initialLoad]);

    return (
        <div className='defaultWidgetDiv notesWidget' style={{ padding: "10px" }}>

            {initialLoad ? null : notes.length === 0 ? (
                <div className="notesEmptyState" style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "200px",
                    gap: "12px"
                }}>
                    <p style={{opacity:"0.7"}}>No Notes created</p>
                    <button onClick={createNewNote} style={{ padding: "10px", cursor: "pointer", outline: "none", border: "none", background: "var(--base_color)", color: "white", borderRadius: "10px" }} >New Note +</button>
                </div>
            ) : (
                <div className="notesWidgetLayout" style={{
                    display: "flex",
                    height: "500px",
                    width: "100%",
                    gap: "10px"
                }}>

                    {/* ---- Notes list panel ---- */}
                    {(!isMobile || showListOnMobile) && (
                        <div className="notesListPanel" style={{
                            width: isMobile ? "100%" : "250px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            overflowY: "auto",
                            paddingRight:"5px"
                        }}>
                            <button onClick={createNewNote}>New Note +</button>

                            <input
                                type="text"
                                placeholder="Search by title..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                style={{ padding: "6px" }}
                            />

                            {allLabels.length > 0 && (
                                <div className="labelFilterGroup" style={{
                                    border: "1px solid #ddd",
                                    borderRadius: "6px",
                                    overflow: "hidden"
                                }}>
                                    <div
                                        onClick={() => setShowLabelFilter(prev => !prev)}
                                        style={{
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "space-between",
                                            padding: "6px 10px",
                                            cursor: "pointer",
                                            userSelect: "none"
                                        }}
                                    >
                                        <p style={{opacity:"0.6",fontSize:"13px",margin:0}}>
                                            Filter by Labels{checkedLabels.length > 0 ? ` (${checkedLabels.length})` : ""}
                                        </p>
                                        <span style={{
                                            display: "inline-block",
                                            transition: "transform 0.15s ease",
                                            transform: showLabelFilter ? "rotate(90deg)" : "rotate(0deg)",
                                            fontSize: "12px",
                                            opacity: 0.6
                                        }}>
                                            ▶
                                        </span>
                                    </div>

                                    {showLabelFilter && (
                                        <div style={{ padding: "0 6px 6px 6px" }}>
                                            {allLabels.map(label => (
                                                <label key={label} style={{ display: "inline-block", margin:"5px", fontSize: "0.85em" }}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checkedLabels.includes(label)}
                                                        onChange={() => toggleLabelFilter(label)}
                                                        style={{marginRight:"5px"}}
                                                    />
                                                    {label}
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {filteredNotes.length === 0 ? (
                                <p style={{ color: "#888", textAlign: "center", marginTop: "12px" }}>
                                    No notes match your search/filters.
                                </p>
                            ) : (
                                filteredNotes.map(note => (
                                    <div
                                        key={note.id}
                                        className={`notesListItem${note.id === selectedNoteId ? " selected" : ""}`}
                                        onClick={() => openNote(note)}
                                        style={{
                                            padding: "10px",
                                            border: "1px solid #ccc",
                                            borderRadius: "6px",
                                            cursor: "pointer",
                                            background: note.id === selectedNoteId ? "#eee" : "transparent"
                                        }}
                                    >
                                        <div style={{ fontWeight: "bold",opacity:"0.6",margin:"5px 0 10px 0" }}>
                                            {note.title || "Untitled Note"}
                                        </div>
                                        <div style={{ fontSize: "0.8em", color: "#666",marginBottom:"10px"}}>
                                            {note.lastModified
                                                ? new Date(note.lastModified).toLocaleString()
                                                : ""}
                                        </div>
                                        {note.labels && note.labels.length > 0 && (
                                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px", marginTop: "4px" }}>
                                                {note.labels.map(label => (
                                                    <span key={label} style={{
                                                        fontSize: "0.7em",
                                                        padding: "2px 6px",
                                                        borderRadius: "10px",
                                                        background: "#ddd"
                                                    }}>
                                                        {label}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    )}

                    {/* ---- Editor panel ---- */}
                    {(!isMobile || showEditorOnMobile) && selectedNote && (
                        <div className="notesEditorPanel" style={{
                            width: isMobile ? "100%" : "500px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                            overflow:"hidden"
                        }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                <button onClick={closeEditor} style={{ padding: "5px 10px", cursor: "pointer", outline: "none", border: "none", background: "rgb(182 184 189)", borderRadius: "5px"}}>← Back</button>
                                <button onClick={() => deleteNote(selectedNoteId)} style={{ padding: "5px 10px", cursor: "pointer", outline: "none", borderRadius: "5px", border: "1px solid red", background: "white", color: "red",marginLeft:"20px" }}>Delete</button>
                                {isDirty && (
                                    <button onClick={saveNote} style={{ padding: "5px 10px", cursor: "pointer", outline: "none", border: "none", background: "var(--base_color)", color: "white", borderRadius: "5px",marginLeft:"auto" }}>
                                        Save
                                    </button>
                                )}
                            </div>

                            <input
                                type="text"
                                value={editTitle}
                                onChange={(e) => setEditTitle(e.target.value)}
                                placeholder="Note title"
                                style={{ fontSize: "1.1em", padding: "10px" }}
                            />

                            {/* ---- Labels ---- */}
                            <div className="labelsEditor">
                                <div
                                    style={{
                                    display: "flex",
                                    flexDirection: "row",
                                    gap: "10px",
                                    overflowX: "auto",
                                    whiteSpace: "nowrap",
                                    paddingBottom: "6px"
                                    }}
                                    className="labelsScroll"
                                >
                                    {editLabels.map(label => (
                                    <span
                                        key={label}
                                        style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        fontSize: "0.8em",
                                        padding: "2px 8px",
                                        borderRadius: "10px",
                                        background: "#ddd",
                                        margin: "10px 0"
                                        }}
                                    >
                                        {label}
                                        <span
                                        onClick={() => removeLabel(label)}
                                        style={{ cursor: "pointer", fontWeight: "bold" }}
                                        >
                                        ×
                                        </span>
                                    </span>
                                    ))}
                                </div>

                                <input
                                    type="text"
                                    value={labelInput}
                                    onChange={(e) => setLabelInput(e.target.value)}
                                    onKeyDown={handleLabelKeyDown}
                                    onBlur={addLabel}
                                    placeholder="Add label + Enter"
                                    style={{
                                    padding: "10px",
                                    fontSize: "0.85em",
                                    display: "block",
                                    width:"100%"
                                    }}
                                />
                                </div>


                            <textarea
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                placeholder="Start writing..."
                                style={{ flex: 1, resize: "none", padding: "8px" }}
                            />
                        </div>
                    )}

                    {!isMobile && !selectedNote && (
                        <div className="notesEditorPanel" style={{
                            width: "500px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            color: "#888"
                        }}>
                            Select a note to edit
                        </div>
                    )}

                    {isMobile && showEditorOnMobile && !selectedNote && (
                        <div style={{ padding: "20px", textAlign: "center", color: "#888" }}>
                            Note not found. 
                            <button onClick={closeEditor}>← Back to notes</button>
                        </div>
                    )}

                </div>
            )}
        </div>
    )
}

export default NotesWidget;