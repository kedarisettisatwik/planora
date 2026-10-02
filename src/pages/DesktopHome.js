import { useState } from "react";

import '../Styles/DesktopNav.css';

import DailyGoalsWidget from "../components/DailyGoalsWidget";
import TTDWidget from "../components/TTDWidget";
import NotesWidget from "../components/NotesWidget";

const WIDGET_COMPONENTS = {
  DailyGoals: DailyGoalsWidget,
  TTD: TTDWidget,
  Notes: NotesWidget,
};

const WIDGET_DISPLAY_NAMES = {
  DailyGoals: "Daily Goals",
  TTD: "Things to do",
  Notes: "Notes",
};

// label shown in nav -> widget key
const TABS = [
  { label: "Goals",  widget: "DailyGoals" },
  { label: "Tasks",  widget: "TTD" },
  { label: "Notes",  widget: "Notes" }
];

function DesktopHome({
  setLoading, email, setPopup, setPopupContent, signOut,
  userName = email?.split("@")[0] || "User",
  widgets = WIDGET_COMPONENTS,   // pass the real ones from parent if you have them
  homeWidget = "DailyGoals",
  changeHomeWidget = () => {},
  goalPoints = 0,
  setGoalPoints = () => {}
}) {
  const [activeTab, setActiveTab] = useState(homeWidget);
  const [navOpen, setNavOpen] = useState(false);

  const ActiveWidget = WIDGET_COMPONENTS[activeTab];

  return (
    <section className="desktopMain">
      <main>
        <nav style={{ marginBottom: "20px" }}>
          <ul>
            {TABS.map(({ label, widget }) => (
              <li
                key={widget}
                className={activeTab === widget ? "active" : ""}
                onClick={() => setActiveTab(widget)}
              >
                {label}
              </li>
            ))}
            <li onClick={() => setNavOpen(true)}>Settings</li>
            <li className="points">{goalPoints} points</li>
          </ul>
        </nav>

        <div className="desktopWidgets">
          <ActiveWidget
            setLoading={setLoading}
            email={email}
            setPopup={setPopup}
            setPopupContent={setPopupContent}
            signOut={signOut}
            goalPoints={goalPoints}
            setGoalpoints={setGoalPoints}
          />
        </div>

          <aside className={`DesktopNav ${navOpen ? "open" : ""} mobile`}>
          <div className="menuDetails">
            <h3>Planora <span style={{ fontSize: "10px", color: "black" }}>v 4.5</span></h3>

            <p style={{marginTop:"20px"}}><a href="https://github.com/kedarisettisatwik/planora" target="_blank" rel="noreferrer">FAQ ?</a></p>

            <i className="out" onClick={() => signOut()}>Log Out</i>
          </div>

          <div className="nameEmail">
            <label style={{ display: "block" }}>{userName}</label>
            <label style={{ display: "block" }}>{email}</label>
          </div>
          <div className="UserIcon">{userName[0]}</div>

          <div className="sideClose" onClick={() => setNavOpen(false)}>
            <i className="fas fa-chevron-right"></i>
          </div>
        </aside>
        
      </main>

      {/* Settings side panel */}
      {navOpen && <div className="navBackdrop" onClick={() => setNavOpen(false)} />}

      
    </section>
  );
}

export default DesktopHome;