
import { useState, useEffect } from "react";
import toast from 'react-hot-toast';
import { isMobile } from "react-device-detect";
import { useMemo } from "react"; // add to your existing react import

import '../Styles/Home.css'
import '../Styles/TTD.css'

import { doc, getDoc, setDoc, arrayUnion, updateDoc } from "firebase/firestore";
import { auth, db } from "../firebase";


function TTDWidget ({ key, email, x, y ,setLoading, setPopup, setPopupContent, signOut}){

    const [addTaskPage,setAddTaskPage] = useState(false);
    const [viewAllTasksPage,setViewAllTasksPage] = useState(false);


    const [newTaskTitle, setNewTaskTitle] = useState(""); 
    const [desc, setNewTaskDesc] = useState(""); 
    const today = new Date().toISOString().split("T")[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState("");

    
   const [connections,setConnections] = useState([]);
 
    const [assignSelf, setAssignSelf] = useState(true); // self checked by default, adjust if not desired
    const [assignConnections, setAssignConnections] = useState([]); // selected connection emails
    const [assignOthers, setAssignOthers] = useState([]); // dynamic "others" email inputs, starts empty (hidden until "+")
    const [showOthersInputs, setShowOthersInputs] = useState(false);

    useEffect(() => {
        if (!email) return;

        const fetchConnections = async () => {
        try {
            const snap = await getDoc(doc(db, email, "Connections"));
            const data = snap.exists() ? snap.data().List || [] : [];

            setConnections(data);
            console.log(data);
        } catch (err) {
            console.error("Error fetching connections:", err);
        }
        };

        fetchConnections();
    }, [email]); 

    const toggleAssignConnection = (conn) => {
    setAssignConnections((prev) =>
        prev.includes(conn) ? prev.filter((c) => c !== conn) : [...prev, conn]
    );
    };

    const addOtherEmailField = () => {
    setShowOthersInputs(true);
    setAssignOthers((prev) => [...prev, ""]);
    };

    const updateOtherEmail = (idx, value) => {
    setAssignOthers((prev) => {
        const updated = [...prev];
        updated[idx] = value;
        return updated;
    });
    };

    const removeOtherEmail = (idx) => {
    setAssignOthers((prev) => prev.filter((_, i) => i !== idx));
    };

    const buildAssignedEmails = () => {
        const emails = [];

        if (assignSelf) emails.push(email); // current user's own email

        assignConnections.forEach((conn) => {
            if (!emails.includes(conn)) emails.push(conn);
        });

        assignOthers
            .map((m) => m.trim().toLowerCase())
            .filter(Boolean)
            .forEach((mail) => {
            if (!emails.includes(mail)) emails.push(mail);
            });

        return emails;
    };

    const createTaskDB = async () => {
        if (!newTaskTitle.trim()) {
            toast("Please enter a task title.", {
            duration: 2000,
            position: 'top-center',
            icon: '❌',
            style: {"backgroundColor":"var(--toast_error)","color":"white"}
            });
            return;
        }

        const assignedEmails = buildAssignedEmails();

        if (assignedEmails.length === 0) {
            toast("Please assign the task to at least one person.", {
            duration: 2000,
            position: 'top-center',
            icon: '❌',
            style: {"backgroundColor":"var(--toast_error)","color":"white"}
            });
            return;
        }

        const taskId = Date.now().toString();
        const taskData = {
            id: taskId,
            title: newTaskTitle.trim(),
            description: desc.trim(),
            startDate,
            endDate,
            createdBy: email,
            createdAt: new Date().toISOString(),
            completed: false,
        };

        setLoading(true);
        try {
            // loop through each assigned email and write the task into their own TTD > List
            for (const assignedEmail of assignedEmails) {
            await setDoc(
                doc(db, assignedEmail, "TTD"),
                { List: arrayUnion(taskData) },
                { merge: true }
            );
            }

            // reset form on success
            setAddTaskPage(false);
            setNewTaskTitle("");
            setNewTaskDesc("");
            setStartDate("");
            setEndDate("");
            setAssignSelf(true);
            setAssignConnections([]);
            setAssignOthers([]);
            setShowOthersInputs(false);

            toast('Task assigned successfully !!', {
            duration: 2000,
            position: 'top-center',
            icon: '✅',
            style: {"backgroundColor":"var(--toast_success)","color":"white"}
            });
        } catch (err) {
            console.error("Error creating task:", err);
            toast("Something went wrong while saving the task. Please try again.", {
            duration: 2000,
            position: 'top-center',
            icon: '❌',
            style: {"backgroundColor":"var(--toast_error)","color":"white"}
            });
        } finally {
            setLoading(false);
        }
    };


    return (
        <div className={`defaultWidgetDiv TTDMain ${isMobile ? 'mobile' : 'desk'} ${addTaskPage ? 'add' : ''} ${viewAllTasksPage ? 'viewall' : ''}` }  style={{padding:"10px 10px 10px"}}>

            {
                <>
                <span style={{ fontWeight: "bold", opacity: 0.6, letterSpacing: "1px", fontSize: "14px",display:"block" }}>Active Tasks</span>

                {/* 
                <ul className={TasksForSelectedDate.length === 0 ? "NoTasks TasksAsOfDate" : "TasksAsOfDate"}>
                    
                </ul> */}
                
                <span style={{ fontWeight: "bold", opacity: 0.6, letterSpacing: "1px", fontSize: "14px",display:"block"  }}>Active Requests</span>

                <span style={{ fontWeight: "bold", opacity: 0.6, letterSpacing: "1px", fontSize: "14px",display:"block"  }}>Completed Tasks</span>

                <span style={{ fontWeight: "bold", opacity: 0.6, letterSpacing: "1px", fontSize: "14px",display:"block"  }}>Completed Requests</span>
                
                <span style={{position: "absolute",top: "10px",right: "10px",fontSize: "12px",fontWeight: "bold",opacity: 0.6,cursor: "pointer",letterSpacing:"1px"}} onClick={() => setViewAllTasksPage(true)}>view All</span>
                <button style={{position:"absolute",bottom:"10px",right:"10px",padding:"10px",cursor:"pointer",border:"none",outline:"none",background:"var(--base_color)",color:"white",borderRadius:"10px"}} onClick={() => setAddTaskPage(true)}>New Task + </button>
                

                </>
                
          }

          <div className="addNewTask">
            <div style={{marginBottom:"30px"}}>
              <i className="fa-solid fa-chevron-left" style={{display:"inline-block"}} onClick={() => setAddTaskPage(false)}></i>
              <h3 style={{display:"inline-block"}}>SetUp New Task</h3>
            </div>
            <span style={{display:"block"}}>Title : </span>
            <input value={newTaskTitle} placeholder="Create Doc .." onChange={(e) => setNewTaskTitle(e.target.value)}></input>
            <span style={{display:"block"}}>Description : </span>
            <textarea placeholder="What need to be done, etc .. " value={desc} onChange={(e) => setNewTaskDesc(e.target.value)}></textarea>
            <div className="Dates" style={{display:"flex"}}>
                <div>
                    <span style={{display:"block"}} >Start's From : </span>
                    <input type="date" className="DateIn" value={startDate} onChange={(e) => setStartDate(e.target.value)}></input>
                </div>
                <div style={{marginLeft:"20px"}}>
                    <span style={{display:"block"}}>DeadLine : </span>
                    <input type="date" className="DateIn" value={endDate} onChange={(e) => setEndDate(e.target.value)}></input>
                </div>
            </div>
            
            <span style={{display:"block",marginTop:"20px"}}>Assign to : </span>

            <div className="assignTo">
            <div className="assignRow">
                <input
                type="checkbox"
                checked={assignSelf}
                onChange={() => setAssignSelf((prev) => !prev)}
                />
                <span>self</span>
            </div>

            {Array.isArray(connections) && connections.length > 0 && (
                <>
                <span className="assignSubLabel">Your connections</span>
                {connections.map((conn) => (
                    <div className="assignRow assignRowIndented" key={conn}>
                    <input
                        type="checkbox"
                        checked={assignConnections.includes(conn)}
                        onChange={() => toggleAssignConnection(conn)}
                    />
                    <span>{conn}</span>
                    </div>
                ))}
                </>
            )}

            <span className="assignSubLabel">Others :</span>
            {assignOthers.map((mail, idx) => (
                <div className="assignRow assignRowIndented" key={idx}>
                <input
                    type="email"
                    className="assignOtherInput"
                    placeholder="friend@gmail.com"
                    value={mail}
                    onChange={(e) => updateOtherEmail(idx, e.target.value)}
                />
                <button type="button" className="repeatRemoveDate" onClick={() => removeOtherEmail(idx)}>×</button>
                </div>
            ))}
            <button type="button" className="repeatAddDate" onClick={addOtherEmailField} style={{ padding: "10px", cursor: "pointer", borderRadius: "10px", border: "none" }}>
                + Add email
            </button>
            </div>


            <button className="saveNewTaskBtn" onClick={createTaskDB}> Save</button>
            
          </div>

          <div className="viewAllTasks">
              <div style={{marginBottom:"30px"}}>
                <i className="fa-solid fa-chevron-left" style={{display:"inline-block"}} onClick={() => setViewAllTasksPage(false)}></i>
                <h3 style={{display:"inline-block"}}>Tasks : </h3>
              </div>

              <div className="listTasks">
                
              </div>
             
              <button style={{position:"absolute",top:"10px",right:"10px",padding:"10px",cursor:"pointer",border:"none",outline:"none",background:"var(--base_color)",color:"white",borderRadius:"10px"}} onClick={() => setAddTaskPage(true)}>New Task + </button>  
          </div>

            
        </div>
    )
}

export default TTDWidget;