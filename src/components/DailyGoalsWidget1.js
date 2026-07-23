
import DairyWidget from './DairyWidget';
import NotesWidget from './NotesWidget';

function DailyGoalsWidget1 ({ key, email, x, y ,setLoading, setPopup, setPopupContent, signOut}){

    return (
        <div>

            <button onClick={() => {setPopupContent(DairyWidget);setPopup(true)} }>popup1</button>
            <button onClick={() => {setPopupContent(NotesWidget);setPopup(true)} }>popup2</button>
            <button onClick={() => setLoading(true)}>load</button> 

            
        </div>
    )
}

export default DailyGoalsWidget1;