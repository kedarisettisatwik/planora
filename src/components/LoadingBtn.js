
import loading_circle from '../assests/loading_circle.png';
import '../Styles/Log.css'

function LoadingBtn() {

  return (
    <div className='Loading_btn'>Loading <img src={loading_circle} height='10px'></img> </div>
  );
}

export default LoadingBtn;
