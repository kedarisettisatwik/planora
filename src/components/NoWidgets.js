
import React from "react";

import '../Styles/Home.css';

function NoWidgets({ setWidgetsCount, Signout, email, displayName }){
    return (
        <section className="addWidget">
            <h1><span>Hello,</span> {displayName} </h1>
            <p className='description'>No widgets yet! Start building your productivity hub by adding one now.</p>

            <button className="addBtn" onClick={() => setWidgetsCount(prevCount => prevCount + 1)}><i className="fa-solid fa-plus"></i> Add Widget</button>
            <button onClick={Signout}>Sign Out</button>
        </section>
    );
}

export default NoWidgets;