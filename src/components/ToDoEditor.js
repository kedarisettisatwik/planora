import { useState } from "react";

function ToDoEditor({ items, onChange }) {
    const [newItemText, setNewItemText] = useState("");

    const addItem = () => {
        const val = newItemText.trim();
        if (!val) return;
        onChange([...items, { id: crypto.randomUUID(), text: val, completed: false }]);
        setNewItemText("");
    };

    const toggleItem = (id) => {
        onChange(items.map(item =>
            item.id === id ? { ...item, completed: !item.completed } : item
        ));
    };

    const deleteItem = (id) => {
        onChange(items.filter(item => item.id !== id));
    };

    const handleKeyDown = (e) => {
        if (e.key === "Enter") {
            e.preventDefault();
            addItem();
        }
    };

    return (
        <div className="todoEditor">
            <div className="todoAddRow">
                <input
                    type="text"
                    value={newItemText}
                    onChange={(e) => setNewItemText(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Add an item..."
                />
                <button type="button" onClick={addItem}>Add</button>
            </div>

            <div className="todoItemsList">
                {items.length === 0 ? (
                    <p style={{ opacity: 0.5, textAlign: "center", marginTop: "20px" }}>
                        No items yet
                    </p>
                ) : (
                    items.map(item => (
                        <div key={item.id} className="todoItem">
                            <div>
                                <input
                                    type="checkbox"
                                    checked={item.completed}
                                    onChange={() => toggleItem(item.id)}
                                />
                                <span className={item.completed ? "todoTextDone" : ""}>
                                    {item.text}
                                </span>
                            </div>
                            <span
                                className="todoDeleteBtn"
                                onClick={() => deleteItem(item.id)}
                            >
                                ×
                            </span>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default ToDoEditor;