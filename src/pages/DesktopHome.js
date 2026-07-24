import { useState, useEffect, useRef, useCallback } from "react";
import toast from 'react-hot-toast';

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

import '../Styles/DesktopNav.css';

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
import FormsWidget from '../components/FormsWidget';
import SchedulesWidget from '../components/SchedulesWidget';

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
  Teams: TeamsWidget,
  Forms:FormsWidget,
  Schedules: SchedulesWidget
};

const WIDGET_DISPLAY_NAMES = {
  DailyGoals: "Daily Goals",
  TTD: "Things to do",
  Dairy: "Diary",
  Notes: "Notes",
  Meetings: "Meetings",
  Events: "Events",
  Bookmarks: "Bookmarks",
  TrackExpenses: "Track Expenses",
  Book: "Books",
  TrackProject: "Track Project",
  Teams: "Teams",
  Forms:"Forms",
  Schedules:"Schedules"
};

const WIDGET_WIDTH = 260;
const WIDGET_HEIGHT = 220;
const BOTTOM_PADDING = 80;

function DesktopHome({ setLoading, email, setPopup, setPopupContent, signOut }) {

  const [userName, setUserName] = useState("O");

  const [widgetsChanged,setwidgetsChanged] = useState(false); 

  const [navOpen, setNavOpen] = useState(false);

  const [widgets, setWidgets] = useState({}); // { DailyGoals: {x,y}, TTD: {x,y} }
  const [topZ, setTopZ] = useState(1);
  const [boardHeight, setBoardHeight] = useState(
    typeof window !== "undefined" ? window.innerHeight - 120 : 700
  );
  const [boardWidth, setBoardWidth] = useState(
    typeof window !== "undefined" ? window.innerWidth : 300
  );

  const boardRef = useRef(null);
  const dragState = useRef(null);


  const [animatingWidget, setAnimatingWidget] = useState(null);
  // { type, mode: 'closing' | 'opening', from: {x,y,opacity}, to: {x,y,opacity}, phase: 'start' | 'end' }

  const getRandomY = () =>
    Math.random() * Math.max(0, boardHeight - WIDGET_HEIGHT - BOTTOM_PADDING);

  const handleCloseClick = (type) => {
    const pos = widgets[type];
    if (!pos) return;
    setAnimatingWidget({
      type,
      mode: "closing",
      from: { x: pos.x, y: pos.y, opacity: 1 },
      to: { x: 0, y: getRandomY(), opacity: 0 },
      phase: "start"
    });
  };

  const handleOpenClick = (type) => {
    const pos = widgets[type];
    if (!pos) return;
    setAnimatingWidget({
      type,
      mode: "opening",
      from: { x: 0, y: getRandomY(), opacity: 0 },
      to: { x: pos.x, y: pos.y, opacity: 1 },
      phase: "start"
    });
  };

  const handleListClick = (type) => {
    const isClosed = widgets[type]?.close === "true";
    isClosed ? handleOpenClick(type) : handleCloseClick(type);
  };

  // flip from "start" to "end" one frame after mount, so the browser
  // paints the "from" position first and the transition has something to animate
  useEffect(() => {
    if (!animatingWidget || animatingWidget.phase !== "start") return;
    const raf1 = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setAnimatingWidget((aw) =>
          aw && aw.phase === "start" ? { ...aw, phase: "end" } : aw
        );
      });
    });
    return () => cancelAnimationFrame(raf1);
  }, [animatingWidget?.type, animatingWidget?.phase]);

  const handleTransitionEnd = (e, type) => {
    if (e.propertyName !== "opacity") return;
    if (!animatingWidget || animatingWidget.type !== type) return;

    const mode = animatingWidget.mode;
    setWidgets((ws) => {
      const current = ws[type];
      if (!current) return ws;
      return {
        ...ws,
        [type]: { ...current, close: mode === "closing" ? "true" : "false" }
      };
    });
    setAnimatingWidget(null);
  };

  // ---- fetch widgets ----
  useEffect(() => {
    if (!email) return;

    const fetchWidgets = async () => {
      setLoading(true);
      try {
        const snap = await getDoc(doc(db, email, "widgets"));
        const data = snap.exists() ? snap.data() : {};

        const withZ = {};
        Object.entries(data).forEach(([type, pos], i) => {
          withZ[type] = { ...pos, z: i + 1 };
        });
        setWidgets(withZ);
        setTopZ(Object.keys(withZ).length + 1);

        const getName = await getDoc(doc(db, email, "generalDetails"));
        if (getName.exists()) {
          setUserName(getName.data().displayName || "O");
        }
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
    x = Math.max(0, x);
    y = Math.max(0, y);

    setBoardHeight((h) => {
      const needed = y + WIDGET_HEIGHT + BOTTOM_PADDING;
      return needed > h ? needed : h;
    });

    setBoardWidth((w) => {
      const needed = x + WIDGET_WIDTH + BOTTOM_PADDING; // reuse padding or add RIGHT_PADDING
      return needed > w ? needed : w;
    });

    setWidgets((ws) => {
      const current = ws[type];
      // only flag as changed if position actually moved
      if (current && (current.x !== x || current.y !== y)) {
        setwidgetsChanged(true);
      }
      return {
        ...ws,
        [type]: { ...current, x, y }
      };
    });

    const el = boardRef.current;
    const pointerYInBoard = e.clientY - board.top;
    const scrollZone = 60;
    if (pointerYInBoard > board.height - scrollZone) {
      el.scrollTop += 12;
    } else if (pointerYInBoard < scrollZone) {
      el.scrollTop -= 12;
    }
  };

  const saveWidgets = async () => {
    setLoading(true);
    try {
      await setDoc(doc(db, email, "widgets"), widgets, { merge: true });
      console.log("Widgets saved!");
      setwidgetsChanged(false);
    } catch (err) {
      console.error("Error saving widgets:", err);
    }finally{
      setLoading(false);
    }
  };

  const onPointerUp = () => {
    if (!dragState.current) return;
    dragState.current = null;
  };

  const handleAddWidget = async (type) => {
    setLoading(true);

     try {
      await setDoc(
        doc(db, email, type),
        { empty: true },
        { merge: true }
      );

      await updateDoc(
        doc(db,email,"widgets"),
        {
          [type]: { x: boardWidth / 2 - WIDGET_WIDTH / 2, y: boardHeight / 2 - WIDGET_HEIGHT / 2, close:"false"}
        }
      )

      toast('Added !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '✅',
        style: {"backgroundColor":"var(--toast_success)","color":"white"}
      });

      setWidgets((prev) => ({
        ...prev,
        [type]: {
          x: boardWidth / 2 - WIDGET_WIDTH / 2,
          y: boardHeight / 2 - WIDGET_HEIGHT / 2
        }
      }));

    } catch (err) {
      console.error("Error adding widget:", err);
      toast('Error !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });

    }finally{
      setLoading(false);
    }
  };

  const toggleWidgetClose = (type) => {
    setWidgets((ws) => {
      const current = ws[type];
      if (!current) return ws;
      const newClose = current.close === "true" ? "false" : "true";
      return {
        ...ws,
        [type]: { ...current, close: newClose }
      };
    });
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
        overflow:"auto",
        touchAction: "none"
      }}
      className="boardDesktop"
    >
      <div style={{ position: "relative", height: boardHeight, width:boardWidth}}>

        {Object.entries(widgets).map(([type, pos]) => {
          const WidgetComponent = WIDGET_COMPONENTS[type];
          if (!WidgetComponent) return null;

          const isAnimating = animatingWidget?.type === type;
          if (pos.close === "true" && !isAnimating) return null;

          let left, top, opacity, transitionStyle;
          if (isAnimating) {
            const { from, to, phase } = animatingWidget;
            const current = phase === "start" ? from : to;
            left = current.x;
            top = current.y;
            opacity = current.opacity;
            transitionStyle = "left 0.4s ease, top 0.4s ease, opacity 0.4s ease";
          } else {
            left = pos.x;
            top = pos.y;
            opacity = 1;
            transitionStyle = "none";
          }

          return (
            <div
              key={type}
              onTransitionEnd={(e) => isAnimating && handleTransitionEnd(e, type)}
              style={{
                position: "absolute",
                left,
                top,
                opacity,
                zIndex: pos.z,
                minWidth: "200px",
                minHeight: "200px",
                backgroundColor: "white",
                boxShadow: "0 0 20px rgb(0,0,0,0.1)",
                borderRadius: "10px",
                transition: transitionStyle,
                pointerEvents: isAnimating ? "none" : "auto"
              }}
            >
              <div
                className="dragHoldEle"
                onPointerDown={(e) => onPointerDown(e, type)}
                style={{ height: 45, cursor: "grab" }}
              >

              <h1 style={{paddingLeft:15,fontFamily:"Englebert",fontSize:"20px",lineHeight:"45px",opacity:"0.6",letterSpacing:"1px"}}>{WIDGET_DISPLAY_NAMES[type]}</h1>

              <div
                className="closeWidget"
                style={{
                  position: "absolute", top: "5px", right: "15px",
                  transform: "scaleX(2.1)", cursor: "pointer",
                  fontSize: "20px",fontWeight:"bold",opacity:"0.5"
                }}
                onClick={() => handleCloseClick(type)}
              >
                -
              </div>

              </div>

              <WidgetComponent
                email={email}
                x={pos.x}
                y={pos.y}
                setLoading={setLoading}
                setPopup={setPopup}
                setPopupContent={setPopupContent}
              />
            </div>
          );
        })}

      </div>
      <nav className={`DesktopNav desk ${navOpen ? 'open' : ''}`}>

          <div className="menuDetails">
              <h3>Planora</h3>
              <span style={{ margin: "30px 0 10px 0",fontSize: "17px"}}>
                Active Widgets
              </span>

              <ul style={{ marginBottom: "0px" }} className="ActiveWidgets">
                {Object.keys(WIDGET_COMPONENTS)
                  .filter((type) => (type in widgets))
                  .map((type) => (
                    <li
                      key={type}
                      className={widgets[type].close !== "true" ? "active" : ""}
                      onClick={() => handleListClick(type)}
                    >
                      {WIDGET_DISPLAY_NAMES[type]}
                    </li>
                  ))}
              </ul>

              <span style={{ margin: "30px 0 10px 0",fontSize: "17px"}}>Add Widgets </span>
              
              <ul>
                {Object.keys(WIDGET_COMPONENTS)
                  .filter((type) => !(type in widgets))
                  .map((type) => (
                    <li key={type} onClick={() => handleAddWidget(type)}>
                      {WIDGET_DISPLAY_NAMES[type]}
                    </li>
                  ))}
              </ul>

              <p><a href="https://github.com/kedarisettisatwik/planora" target="_blank">FAQ ?</a></p>
              <i className="nameChange">change Name</i>
              <i className="out" onClick={() => {signOut()}}>Log Out</i>
          </div>

          <div className="nameEmail">
                <label style={{display:"block"}}>{userName}</label>
                <label style={{display:"block"}}>{email}</label>
          </div>
          <div className="menuIcon" onClick={() => setNavOpen(prev => !prev)}></div>
          <div className="UserIcon">{userName[0]}</div>
      </nav>
      <button className="savePositions active" onClick={() => saveWidgets()}>save</button>
    </div>
  );
}

export default DesktopHome;