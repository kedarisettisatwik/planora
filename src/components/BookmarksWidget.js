import { useState, useEffect, useRef, useMemo } from "react";
import { isMobile } from "react-device-detect";

import '../Styles/Home.css'

import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

// ---- Immutable tree helpers ----
function addNodeToTree(tree, parentId, newNode) {
    if (parentId === null) {
        return [...tree, newNode];
    }
    return tree.map(node => {
        if (node.id === parentId && node.type === "folder") {
            return { ...node, children: [...node.children, newNode] };
        }
        if (node.type === "folder") {
            return { ...node, children: addNodeToTree(node.children, parentId, newNode) };
        }
        return node;
    });
}

function removeNodeFromTree(tree, nodeId) {
    return tree
        .filter(node => node.id !== nodeId)
        .map(node =>
            node.type === "folder"
                ? { ...node, children: removeNodeFromTree(node.children, nodeId) }
                : node
        );
}

function updateNodeInTree(tree, nodeId, updates) {
    return tree.map(node => {
        if (node.id === nodeId) {
            return { ...node, ...updates };
        }
        if (node.type === "folder") {
            return { ...node, children: updateNodeInTree(node.children, nodeId, updates) };
        }
        return node;
    });
}

function getAllFolderIds(nodes) {
    let ids = [];
    nodes.forEach(node => {
        if (node.type === "folder") {
            ids.push(node.id);
            ids = ids.concat(getAllFolderIds(node.children));
        }
    });
    return ids;
}

// ---- Export: tree -> Netscape Bookmark File Format (standard browser import/export format) ----
function escapeHtml(str) {
    return String(str)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function nodesToHtml(nodes, indent) {
    const pad = "    ".repeat(indent);
    let html = `${pad}<DL><p>\n`;
    nodes.forEach(node => {
        if (node.type === "folder") {
            html += `${pad}    <DT><H3>${escapeHtml(node.title)}</H3>\n`;
            html += nodesToHtml(node.children, indent + 1);
        } else {
            html += `${pad}    <DT><A HREF="${escapeHtml(node.url)}">${escapeHtml(node.title)}</A>\n`;
        }
    });
    html += `${pad}</DL><p>\n`;
    return html;
}

function exportBookmarksHtml(tree) {
    const header =
`<!DOCTYPE NETSCAPE-Bookmark-file-1>
<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">
<TITLE>Bookmarks</TITLE>
<H1>Bookmarks</H1>
`;
    return header + nodesToHtml(tree, 0);
}

// ---- Import: parse an uploaded Netscape Bookmark File back into our tree shape ----
function parseDL(dlElement) {
    const nodes = [];
    // DT elements can end up as direct children of DL, or nested inside a <p>
    // depending on how the browser's HTML parser normalizes the (intentionally
    // unclosed) legacy bookmark file tags.
    const dtElements = Array.from(dlElement.querySelectorAll(":scope > dt, :scope > p > dt"));

    dtElements.forEach(dt => {
        const h3 = dt.querySelector(":scope > h3");
        const a = dt.querySelector(":scope > a");

        if (h3) {
            let childDl = dt.querySelector(":scope > dl");
            if (!childDl && dt.nextElementSibling && dt.nextElementSibling.tagName === "DL") {
                childDl = dt.nextElementSibling;
            }
            nodes.push({
                id: crypto.randomUUID(),
                type: "folder",
                title: h3.textContent || "Folder",
                children: childDl ? parseDL(childDl) : []
            });
        } else if (a) {
            nodes.push({
                id: crypto.randomUUID(),
                type: "bookmark",
                title: a.textContent || a.getAttribute("href") || "Untitled",
                url: a.getAttribute("href") || ""
            });
        }
    });

    return nodes;
}

function BookmarksWidget ({ email, x, y, setLoading, setPopup, setPopupContent, signOut}){

    const [tree, setTree] = useState([]);
    // Snapshot of what's actually persisted in Firestore, used to detect
    // unsaved changes since we no longer auto-save on every operation.
    const [savedTree, setSavedTree] = useState([]);

    const [initialLoad, setInitialLoad] = useState(true);
    const [expandedFolders, setExpandedFolders] = useState(new Set());
    // When true, bookmark (link) rows are hidden even inside expanded folders —
    // used by "Show All Folders" to reveal folder structure only.
    const [hideLinks, setHideLinks] = useState(false);

    const [addingTo, setAddingTo] = useState(null); // { parentId, type: 'folder' | 'bookmark' }
    const [formName, setFormName] = useState("");
    const [formUrl, setFormUrl] = useState("");

    const [editingNodeId, setEditingNodeId] = useState(null);
    const [editFormName, setEditFormName] = useState("");
    const [editFormUrl, setEditFormUrl] = useState("");

    const fileInputRef = useRef(null);

    // Bookmarks stored as ONE document holding the whole tree, since folders
    // nest arbitrarily deep. doc() needs an EVEN number of path segments:
    // "email" is the collection, "Bookmarks" is the document.
    const bookmarksDocRef = () => doc(db, email, "Bookmarks");

    useEffect(() => {
        if (!email) return;
        fetchBookmarks();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [email]);

    const fetchBookmarks = async () => {
        setLoading && setLoading(true);
        try {
            const snap = await getDoc(bookmarksDocRef());
            const loadedTree = snap.exists() ? (snap.data().tree || []) : [];
            setTree(loadedTree);
            setSavedTree(loadedTree);
        } catch (err) {
            console.error("Error fetching bookmarks:", err.code, err.message);
            if (setPopupContent && setPopup) {
                setPopupContent("Failed to load bookmarks.");
                setPopup(true);
            }
        } finally {
            setLoading && setLoading(false);
            setInitialLoad(false);
        }
    };

    // Manual save only — no more persisting on every change. All add/edit/delete
    // handlers below just update local `tree` state; nothing hits Firestore
    // until the Save button is clicked.
    const saveBookmarks = async () => {
        setLoading && setLoading(true);
        try {
            await setDoc(bookmarksDocRef(), { tree, lastModified: Date.now() });
            setSavedTree(tree);
        } catch (err) {
            console.error("Error saving bookmarks:", err.code, err.message);
            if (setPopupContent && setPopup) {
                setPopupContent("Failed to save bookmarks.");
                setPopup(true);
            }
        } finally {
            setLoading && setLoading(false);
        }
    };

    const isDirty = useMemo(() => {
        return JSON.stringify(tree) !== JSON.stringify(savedTree);
    }, [tree, savedTree]);

    const toggleExpand = (id) => {
        setExpandedFolders(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const expandAll = () => {
        setHideLinks(false);
        setExpandedFolders(new Set(getAllFolderIds(tree)));
    };

    const collapseAll = () => {
        setHideLinks(false);
        setExpandedFolders(new Set());
    };

    const handleAddFolder = (parentId, name) => {
        const newNode = { id: crypto.randomUUID(), type: "folder", title: name, children: [] };
        const newTree = addNodeToTree(tree, parentId, newNode);
        setTree(newTree);
        setExpandedFolders(prev => {
            const next = new Set(prev).add(newNode.id);
            if (parentId) next.add(parentId);
            return next;
        });
    };

    const handleAddBookmark = (parentId, title, url) => {
        const safeUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
        const newNode = { id: crypto.randomUUID(), type: "bookmark", title, url: safeUrl };
        const newTree = addNodeToTree(tree, parentId, newNode);
        setTree(newTree);
        if (parentId) setExpandedFolders(prev => new Set(prev).add(parentId));
    };

    const handleDeleteNode = (nodeId) => {
        const newTree = removeNodeFromTree(tree, nodeId);
        setTree(newTree);
    };

    const submitAddForm = () => {
        if (!addingTo) return;
        if (addingTo.type === "folder") {
            if (!formName.trim()) return;
            handleAddFolder(addingTo.parentId, formName.trim());
        } else {
            if (!formName.trim() || !formUrl.trim()) return;
            handleAddBookmark(addingTo.parentId, formName.trim(), formUrl.trim());
        }
        setFormName("");
        setFormUrl("");
        setAddingTo(null);
    };

    const cancelAddForm = () => {
        setFormName("");
        setFormUrl("");
        setAddingTo(null);
    };

    const startEditing = (node) => {
        setAddingTo(null); // close any open "add" form to avoid two forms showing at once
        setEditingNodeId(node.id);
        setEditFormName(node.title);
        setEditFormUrl(node.type === "bookmark" ? node.url : "");
    };

    const cancelEditing = () => {
        setEditingNodeId(null);
        setEditFormName("");
        setEditFormUrl("");
    };

    const submitEdit = (node) => {
        if (!editFormName.trim()) return;
        const updates = { title: editFormName.trim() };
        if (node.type === "bookmark") {
            if (!editFormUrl.trim()) return;
            updates.url = /^https?:\/\//i.test(editFormUrl.trim())
                ? editFormUrl.trim()
                : `https://${editFormUrl.trim()}`;
        }
        const newTree = updateNodeInTree(tree, node.id, updates);
        setTree(newTree);
        cancelEditing();
    };

    const handleExport = () => {
        const html = exportBookmarksHtml(tree);
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "bookmarks.html";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleUploadClick = () => fileInputRef.current?.click();

    const handleFileChange = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;
        try {
            const text = await file.text();
            const parsedDoc = new DOMParser().parseFromString(text, "text/html");
            const rootDl = parsedDoc.querySelector("dl");
            const importedNodes = rootDl ? parseDL(rootDl) : [];
            if (importedNodes.length === 0) {
                setPopupContent && setPopupContent("No bookmarks found in that file.");
                setPopup && setPopup(true);
                return;
            }
            // Appends imported bookmarks as new root folders/items rather than
            // overwriting what's already in the tree. Still requires clicking
            // Save afterward to persist to Firestore, same as any other edit.
            setTree(prev => [...prev, ...importedNodes]);
        } catch (err) {
            console.error("Error parsing bookmarks file:", err);
            if (setPopupContent && setPopup) {
                setPopupContent("Failed to read that file. Make sure it's a browser bookmarks export.");
                setPopup(true);
            }
        } finally {
            e.target.value = "";
        }
    };

    const renderAddForm = () => {
        if (!addingTo) return null;
        return (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "4px 0 8px 24px" }}>
                <input
                    type="text"
                    autoFocus
                    placeholder={addingTo.type === "folder" ? "Folder name" : "Bookmark title"}
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addingTo.type === "folder" && submitAddForm()}
                    style={{ padding: "5px 8px", fontSize: "0.85em" }}
                />
                {addingTo.type === "bookmark" && (
                    <input
                        type="text"
                        placeholder="https://..."
                        value={formUrl}
                        onChange={(e) => setFormUrl(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && submitAddForm()}
                        style={{ padding: "5px 8px", fontSize: "0.85em" }}
                    />
                )}
                <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={submitAddForm} style={{ fontSize: "0.8em", padding: "4px 10px", cursor: "pointer" }}>Add</button>
                    <button onClick={cancelAddForm} style={{ fontSize: "0.8em", padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
                </div>
            </div>
        );
    };

    const renderEditForm = (node) => (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", margin: "4px 0 8px 24px" }}>
            <input
                type="text"
                autoFocus
                placeholder={node.type === "folder" ? "Folder name" : "Bookmark title"}
                value={editFormName}
                onChange={(e) => setEditFormName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && node.type === "folder" && submitEdit(node)}
                style={{ padding: "5px 8px", fontSize: "0.85em" }}
            />
            {node.type === "bookmark" && (
                <input
                    type="text"
                    placeholder="https://..."
                    value={editFormUrl}
                    onChange={(e) => setEditFormUrl(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submitEdit(node)}
                    style={{ padding: "5px 8px", fontSize: "0.85em" }}
                />
            )}
            <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => submitEdit(node)} style={{ fontSize: "0.8em", padding: "4px 10px", cursor: "pointer" }}>Save</button>
                <button onClick={cancelEditing} style={{ fontSize: "0.8em", padding: "4px 10px", cursor: "pointer" }}>Cancel</button>
            </div>
        </div>
    );

    const renderNode = (node, depth) => {
        const indent = depth * 18;

        if (node.type === "folder") {
            const isOpen = expandedFolders.has(node.id);
            return (
                <div key={node.id}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 4px", marginLeft: indent }}>
                        <span
                            onClick={() => toggleExpand(node.id)}
                            style={{
                                cursor: "pointer",
                                display: "inline-block",
                                transition: "transform 0.15s ease",
                                transform: isOpen ? "rotate(90deg)" : "rotate(0deg)",
                                fontSize: "11px",
                                opacity: 0.6
                            }}
                        >
                            ▶
                        </span>
                        <span onClick={() => toggleExpand(node.id)} style={{ fontWeight: "bold", cursor: "pointer",opacity:"0.6" }}>
                            📁 {node.title}
                        </span>
                        <span
                            onClick={() => startEditing(node)}
                            title="Rename folder"
                            style={{ marginLeft: "auto", cursor: "pointer", fontSize: "0.75em", opacity: 0.6 }}
                        >
                            ✏️
                        </span>
                        <span
                            onClick={() => setAddingTo({ parentId: node.id, type: "folder" })}
                            title="Add subfolder"
                            style={{ cursor: "pointer", fontSize: "0.75em", opacity: 0.6 }}
                        >
                            📁+
                        </span>
                        <span
                            onClick={() => setAddingTo({ parentId: node.id, type: "bookmark" })}
                            title="Add bookmark"
                            style={{ cursor: "pointer", fontSize: "0.75em", opacity: 0.6 }}
                        >
                            🔗+
                        </span>
                        <span
                            onClick={() => handleDeleteNode(node.id)}
                            title="Delete folder"
                            style={{ cursor: "pointer", fontSize: "0.9em", color: "red", opacity: 0.6 }}
                        >
                            ×
                        </span>
                    </div>

                    {editingNodeId === node.id && renderEditForm(node)}
                    {addingTo && addingTo.parentId === node.id && renderAddForm()}

                    {isOpen && (
                        node.children.length === 0 ? (
                            <p style={{ marginLeft: indent + 24, opacity: 0.4, fontSize: "0.8em" }}>Empty folder</p>
                        ) : (
                            node.children
                                // When hideLinks is on ("Show All Folders"), skip bookmark
                                // leaves entirely and only render nested folders.
                                .filter(child => !(hideLinks && child.type === "bookmark"))
                                .map(child => renderNode(child, depth + 1))
                        )
                    )}
                </div>
            );
        }

        // bookmark node
        if (hideLinks) return null;

        return (
            <div key={node.id}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "5px 4px", marginLeft: indent }}>
                    <span>🔗</span>
                    <a
                        href={node.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: "black", fontSize:"14px",width:"150px",textDecoration: "none", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}
                    >
                        {node.title}
                    </a>
                    <span
                        onClick={() => startEditing(node)}
                        title="Edit bookmark"
                        style={{ marginLeft: "auto", cursor: "pointer", fontSize: "0.75em", opacity: 0.6 }}
                    >
                        ✏️
                    </span>
                    <span
                        onClick={() => handleDeleteNode(node.id)}
                        title="Delete bookmark"
                        style={{ cursor: "pointer", fontSize: "0.9em", color: "red", opacity: 0.6 }}
                    >
                        ×
                    </span>
                </div>
                {editingNodeId === node.id && renderEditForm(node)}
            </div>
        );
    };

    return (
        <div className='defaultWidgetDiv bookmarksWidget' style={{ padding: "10px" }}>

            <div style={{ marginBottom: "10px" }}>
                <div>
                    <button onClick={() => setAddingTo({ parentId: null, type: "folder" })} style={{ padding: "8px", cursor: "pointer", marginRight: "10px", borderRadius: "5px", outline: "none", border: "none" }}>
                        New Folder +
                    </button>
                    <button onClick={expandAll} style={{ padding: "8px", cursor: "pointer", marginRight: "10px", borderRadius: "5px", outline: "none", border: "none" }}>
                        Open All
                    </button>
                    <button onClick={collapseAll} style={{ padding: "8px", cursor: "pointer", marginRight: "10px", borderRadius: "5px", outline: "none", border: "none" }}>
                        Close All
                    </button>
                    <button
                        onClick={saveBookmarks}
                        disabled={!isDirty}
                        style={{
                            padding: "8px 12px",
                            cursor: isDirty ? "pointer" : "default",
                            background: isDirty ? "var(--base_color)" : "#ccc",
                            color: "white",
                            border: "none",
                            borderRadius: "5px",
                            marginLeft: "auto"
                        }}
                    >
                        {isDirty ? "Save*" : "Saved"}
                    </button>
                </div>
                <div style={{marginTop:"10px"}}>
                    <button onClick={handleExport} style={{ padding: "8px", cursor: "pointer", marginRight: "10px", borderRadius: "5px", outline: "none", border: "none" }}>
                        Export
                    </button>
                    <button onClick={handleUploadClick} style={{ padding: "8px", cursor: "pointer", marginRight: "10px", borderRadius: "5px", outline: "none", border: "none" }}>
                        Upload
                    </button>
                </div>
                <input
                    type="file"
                    accept=".html,.htm"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    style={{ display: "none" }}
                />
            </div>

            {addingTo && addingTo.parentId === null && renderAddForm()}

            {initialLoad ? null : tree.length === 0 ? (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "200px", gap: "12px" }}>
                    <p style={{ opacity: 0.7 }}>No bookmarks yet</p>
                </div>
            ) : (
                <div style={{ maxHeight: "500px", overflowY: "auto" }}>
                    {tree.map(node => renderNode(node, 0))}
                </div>
            )}
        </div>
    )
}

export default BookmarksWidget;
