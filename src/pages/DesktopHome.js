import { useState, useEffect, useRef, useCallback } from "react";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

import DailyGoalsWidget from "../components/DailyGoalsWidget";
import TTDWidget from "../components/TTDWidget";
import DairyWidget from "../components/DairyWidget";
import NotesWidget from "../components/NotesWidget";
import MeetingsWidget from "../components/MeetingsWidget";
import EventsWidget from "../components/EventsWidget";
import BookmarksWidget from "../components/BookmarksWidget";
import TrackExpensesWidget from "../components/TrackExpensesWidget";
import BookWidget from "../components/BookWidget";
import TrackProjectWidget from "../components/TrackProjectWidget";
import TeamsWidget from "../components/TeamsWidget";

const WIDGET_COMPONENTS = {
  DailyGoals: DailyGoalsWidget,
  TTD: TTDWidget,
  Dairy: DairyWidget,
  Notes: NotesWidget,
  Meetings: MeetingsWidget,
  Events: EventsWidget,
  Bookmarks: BookmarksWidget,
  TrackExpenses: TrackExpensesWidget,
  Book: BookWidget,
  TrackProject: TrackProjectWidget,
  Teams: TeamsWidget
};

const WIDGET_WIDTH = 260;
const WIDGET_HEIGHT = 220;
const BOTTOM_PADDING = 80;

function DesktopHome({ setLoading, email }) {
  const [widgets, setWidgets] = useState({}); // { DailyGoals: {x,y}, TTD: {x,y} }
  const [topZ, setTopZ] = useState(1);
  const [boardHeight, setBoardHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight - 120 : 700
  );

  const boardRef = useRef(null);
  const dragState = useRef(null);

  // ---- fetch widgets ----
  useEffect(() => {
    if (!email) return;

    const fetchWidgets = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, email, "widgets"));
        const data = snap.exists() ? snap.data() : {};
        // give each widget a z-index locally
        const withZ = {};
        Object.entries(data).forEach(([type, pos], i) => {
          withZ[type] = { ...pos, z: i + 1 };
        });
        setWidgets(withZ);
        setTopZ(Object.keys(withZ).length + 1);
      } catch (err) {
        console.error("Error fetching widgets:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchWidgets();
  }, [email]); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- bring to front ----
  const bringToFront = useCallback((type) => {
    setTopZ((z) => {
      const next = z + 1;
      setWidgets((ws) => ({
        ...ws,
        [type]: { ...ws[type], z: next }
      }));
      return next;
    });
  }, []);

  // ---- drag handlers ----
  const onPointerDown = (e, type) => {
    const board = boardRef.current.getBoundingClientRect();
    const box = widgets[type];
    dragState.current = {
      type,
      offsetX: e.clientX - board.left - box.x,
      offsetY: e.clientY - board.top - box.y + boardRef.current.scrollTop
    };
    bringToFront(type);
    e.target.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e) => {
    if (!dragState.current) return;
    const board = boardRef.current.getBoundingClientRect();
    const { type, offsetX, offsetY } = dragState.current;

    let x = e.clientX - board.left - offsetX;
    let y = e.clientY - board.top - offsetY + boardRef.current.scrollTop;
    x = Math.max(-40, Math.min(board.width - WIDGET_WIDTH + 120, x));
    y = Math.max(0, y);

    setBoardHeight((h) => {
      const needed = y + WIDGET_HEIGHT + BOTTOM_PADDING;
      return needed > h ? needed : h;
    });

    setWidgets((ws) => ({
      ...ws,
      [type]: { ...ws[type], x, y }
    }));

    const el = boardRef.current;
    const pointerYInBoard = e.clientY - board.top;
    const scrollZone = 60;
    if (pointerYInBoard > board.height - scrollZone) {
      el.scrollTop += 12;
    } else if (pointerYInBoard < scrollZone) {
      el.scrollTop -= 12;
    }
  };

  // ---- persist on drop ----
  const onPointerUp = async () => {
    if (!dragState.current) return;
    const { type } = dragState.current;
    const { x, y } = widgets[type];
    dragState.current = null;

    try {
      await setDoc(
        doc(db, email, "widgets"),
        { [type]: { x, y } },
        { merge: true }
      );
    } catch (err) {
      console.error("Error saving widget position:", err);
    }
  };

  return (
    <div
      ref={boardRef}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
        touchAction: "none"
      }}
    >
      <div style={{ position: "relative", width: "100%", height: boardHeight }}>
        {Object.entries(widgets).map(([type, pos]) => {
          const WidgetComponent = WIDGET_COMPONENTS[type];
          if (!WidgetComponent) {
            console.warn(`No component registered for widget type: ${type}`);
            return null;
          }

          return (
            <div
              key={type}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                zIndex: pos.z,
                minWidth:"200px",
                minHeight:"200px",
                backgroundColor:"white",
                boxShadow:"0 0 20px rgb(0,0,0,0.1)",
                borderRadius:"10px",
                overflow:"hidden"
              }}
            >
              {/* drag handle — only this strip triggers dragging */}
              <div className="dragHoldEle"
                onPointerDown={(e) => onPointerDown(e, type)}
                style={{
                  height: 10,
                  cursor: "grab",
                  background: "rgba(0,0,0,0.15)"
                }}
              />
              <WidgetComponent email={email} x={pos.x} y={pos.y} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default DesktopHome;