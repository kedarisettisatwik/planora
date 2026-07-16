
import { useNavigate } from 'react-router-dom';
import './Log.css';
import login_image from '../assests/login.png';
import signup_image from '../assests/signup.png';
import reset_image from '../assests/reset_password.png';

function Log() {
  const navigate = useNavigate();

  return (
    <section className='log section'>
      <main className='main'>
        <h1>planora</h1>
        <p>Your productivity hub starts here — sign in to take control of your day</p>
        <img src={login_image} className='login_image img'></img>
        {/* <img src={signup_image} className='singup_image img'></img>
        <img src={reset_image} className='reset_image img'></img> */}
      </main>
    </section>
  );
}

export default Log;
