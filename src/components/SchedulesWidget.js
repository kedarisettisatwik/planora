import { useState, useEffect} from "react";
import { isMobile } from "react-device-detect";

import '../Styles/Home.css'

import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "../firebase";

function SchedulesWidget ({ key, email, x, y ,setLoading, setPopup, setPopupContent, signOut}){

    return (
        <div className='defaultWidgetDiv' style={{padding:"10px"}}>

        </div>
    )
}

export default SchedulesWidget;