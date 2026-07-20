
import '../Styles/Home.css'

import DairyWidget from './DairyWidget';
import NotesWidget from './NotesWidget';

function DailyGoalsWidget ({ key, email, x, y ,setLoading, setPopup, setPopupContent,signOut}){
    return (
        <div className='defaultWidgetDiv'>
            <button onClick={() => {setPopupContent(DairyWidget);setPopup(true)} }>popup1</button>
            <button onClick={() => {setPopupContent(NotesWidget);setPopup(true)} }>popup2</button>
            <button onClick={() => setLoading(true)}>load</button>
        </div>
    )
}

export default DailyGoalsWidget;