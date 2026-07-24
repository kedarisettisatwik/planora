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
import FormsWidget from '../components/FormsWidget';
import SchedulesWidget from '../components/SchedulesWidget';

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

function MobileHome({ setLoading, email, setPopup, setPopupContent, signOut }){

    const [navOpen, setNavOpen] = useState(false);
    const [userName, setUserName] = useState("O");
    const [homeWidget, setHomeWidget] = useState(null);
    const [widgets, setWidgets] = useState({});
    const [activeWidget, setActiveWidget] = useState(null);

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

    const changeHomeWidget = async (e) => {
        const type = e.target.value;

        setHomeWidget(type);
        setRenderComponent(() => WIDGET_COMPONENTS[type] || EmptyWidget);

        try {
            await updateDoc(doc(db, email, "generalDetails"), {
                Homepage: type
            });
        } catch (err) {
            console.error("Error updating home widget:", err);
            toast('Error !! ', {
                duration: 2000,
                position: 'top-center',
                icon: '❌',
                style: {"backgroundColor":"var(--toast_error)","color":"white"}
            });
        }
    };

    useEffect(() => {
        if (homeWidget) {
            setRenderComponent(() => WIDGET_COMPONENTS[homeWidget]);
            setActiveWidget(homeWidget);
        }
        }, [homeWidget]);

    return(
        <section className={`MobileHome ${navOpen ? 'active' : ''}`} >

            <RenderComponent setLoading={setLoading} email={email} setPopup={setPopup} setPopupContent={setPopupContent} signOut={signOut}/>

            <div className='MenuBar'>
                
                <select
                    value={activeWidget || ""}
                    onChange={(e) => {
                        const type = e.target.value;
                        setRenderComponent(() => WIDGET_COMPONENTS[type]);
                        setActiveWidget(type); // track active widget
                    }}
                    >
                    {Object.keys(WIDGET_COMPONENTS)
                        .filter((type) => type in widgets)
                        .map((type) => (
                        <option key={type} value={type}>
                            {WIDGET_DISPLAY_NAMES[type]}
                        </option>
                        ))}
                </select>

            </div>

            <div className='menuBtn' onClick={() => setNavOpen(prev => !prev)}>
                <div className="HomeMenuIcon"></div>
            </div>

            <nav className="DesktopNav open mobile">
                <div className="menuDetails">
                    <h3>Planora</h3>

                    <span style={{ margin: "0px 0 10px 0",fontSize: "17px",width:"100%", paddingTop:"20px"}}>Add Widgets </span>

                    <ul style={{marginBottom:"5px"}}>
                        {Object.keys(WIDGET_COMPONENTS)
                            .filter((type) => !(type in widgets))
                            .map((type) => (
                                <li key={type} onClick={() => handleAddWidget(type)}>{WIDGET_DISPLAY_NAMES[type]}</li>
                            ))}
                    </ul>

                    <span style={{ margin: "0px 0 10px 0",fontSize: "15px",width:"100%", paddingTop:"20px"}}>Home Page : </span>

                    <select value={homeWidget || ""} onChange={changeHomeWidget}>
                        {Object.keys(WIDGET_COMPONENTS)
                            .filter((type) => (type in widgets))
                            .map((type) => (
                                <option key={type} value={type}>{WIDGET_DISPLAY_NAMES[type]}</option>
                        ))}
                    </select>

                    <p style={{paddingTop:"20px",borderTop:"1px dashed rgb(0, 0, 0, 0.2)",cursor:"pointer",opacity:"0.6"}} onClick={() => window.location.reload()}>
                        Refresh Data<i className="fas fa-sync" style={{display:"inline-block",marginLeft:"10px"}}></i>
                    </p>
                    
                    <p><a href="https://github.com/kedarisettisatwik/planora" target="_blank">FAQ ?</a></p>
                    
                    <i className="nameChange">change Name</i>
                    <i className="out" onClick={() => {signOut()}}>Log Out</i>

                </div>

                <div className="nameEmail">
                        <label style={{display:"block"}}>{userName}</label>
                        <label style={{display:"block"}}>{email}</label>
                </div>
                <div className="UserIcon">{userName[0]}</div>
                
                <div className='sideClose' onClick={() => setNavOpen(false)}>
                        <i className="fas fa-chevron-right"></i>
                </div>
            </nav>

        </section>
    )
}

export default MobileHome;