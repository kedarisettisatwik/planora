import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import '../Styles/MobileHome.css'

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

import { doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";

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
  Teams: "Teams"
};

function MobileHome({ setLoading, email, setPopup, setPopupContent, signOut }){

    const [navOpen, setNavOpen] = useState(false);
    const [userName, setUserName] = useState("O");
    const [homeWidget, setHomeWidget] = useState(null);
    const [widgets, setWidgets] = useState({});
    const EmptyWidget = () => null;
    const [RenderComponent, setRenderComponent] = useState(() => EmptyWidget);

    useEffect(() => {
        if (!email) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                const [detailsSnap, widgetsSnap] = await Promise.all([
                    getDoc(doc(db, email, "generalDetails")),
                    getDoc(doc(db, email, "widgets"))
                ]);

                if (detailsSnap.exists()) {
                    setUserName(detailsSnap.data().displayName || "O");
                    setHomeWidget(detailsSnap.data().Homepage);
                    setRenderComponent(() => WIDGET_COMPONENTS[detailsSnap.data().Homepage] || EmptyWidget);
                }

                const data = widgetsSnap.exists() ? widgetsSnap.data() : {};
                setWidgets(data);

            } catch (err) {
                console.error("Error fetching data:", err);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [email]);

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
            [type]: { x: 0, y: 0 }
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
            x: 0,
            y: 0
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

    return(
        <section className={`MobileHome ${navOpen ? 'active' : ''}`} >

            <RenderComponent/>

            <div className="HomeMenuIcon" onClick={() => setNavOpen(prev => !prev)}></div>

            <nav className="DesktopNav open">
                <div className="menuDetails">
                    <h3>Planora</h3>
                    <span style={{ margin: "15px 0 10px 0",fontSize: "17px",paddingTop:"20px",width:"100%"}}>Go to </span>
                    <ul>
                        {Object.keys(WIDGET_COMPONENTS)
                            .filter((type) => (type in widgets))
                            .map((type) => (
                                <li key={type} onClick={() => setRenderComponent(() => WIDGET_COMPONENTS[type])}>{WIDGET_DISPLAY_NAMES[type]}</li>
                            ))}
                    </ul>
                    <span style={{ margin: "0px 0 10px 0",fontSize: "17px",width:"100%"}}>Add Widgets </span>

                    <ul>
                        {Object.keys(WIDGET_COMPONENTS)
                            .filter((type) => !(type in widgets))
                            .map((type) => (
                                <li key={type} onClick={() => handleAddWidget(type)}>{WIDGET_DISPLAY_NAMES[type]}</li>
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
                <div className="menuIcon1" onClick={() => setNavOpen(prev => !prev)}></div>
                <div className="UserIcon">{userName[0]}</div>
            </nav>

        </section>
    )
}

export default MobileHome;