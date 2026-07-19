
import React from "react";

import '../Styles/Home.css';

function NoWidgets({ setWidgetsCount, Signout, email, displayName }){
    return (
        <section className="addWidget">
            <h1><span>Hello,</span> <br></br> {displayName} </h1>
            <p className='description'>No widgets yet! Start building your productivity hub by adding one now.<br></br><br></br>select one...</p>

            <ul>
                <li>Daily Goals</li>
                <li>Things to Do</li>
                <li>Meetings / Events Reminder</li>
                <li>Dairy</li>
                <li>Sticky Notes</li>
                <li>Track Expenses</li>
                <li>Book Library</li>
                <li>Track Project</li>
                <li>Teams</li>
            </ul>

            <button onClick={Signout} className="exit">Log Out</button>
        </section>
    );
}

export default NoWidgets;