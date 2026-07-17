
// import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import './Log.css';
import login_image from '../assests/login.png';
import signup_image from '../assests/signup.png';
import reset_image from '../assests/reset_password.png';

function Log() {
  // const navigate = useNavigate();
  const [activeForm, setActiveForm] = useState('login');

  return (
    <section className='log section'>
      <main className='main'>
        <h1>planora</h1>
        <p className='description'>Your productivity hub starts here — sign in to take control of your day</p>

        {activeForm === 'login' && (<div className='logs loginForm'>
          <form>
              <h3>Hey there, ready to log in? </h3>
              <div className='input_box'>
                <label>Email</label>
                <input type='email' placeholder='example@gmail.com' autocomplete="off"></input>
              </div>
              <div className='input_box'>
                <label>Password</label>
                <input type='password' placeholder='********' autocomplete="off"></input>
              </div>
              <input type='submit' value='Log In' className='submit'></input>
              <p>New to Planora ? Click here - <span onClick={() => setActiveForm('signup')}>Signup</span></p>
              <p>Forgot Password ? Click here - <span onClick={() => setActiveForm('reset')}>Reset Password</span></p>
          </form>
          <img src={login_image} className='login_image img'></img>
        </div>
      )}

        {activeForm === 'signup' && (<div className='logs singUpForm'>
          <form>
              <h3>Let’s Get You Started</h3>
              <div className='input_box'>
                <label>Name</label>
                <input type='text' placeholder='Hi Mr / Ms ?' autocomplete="off"></input>
              </div>
              <div className='input_box'>
                <label>Email</label>
                <input type='email' placeholder='example@gmail.com' autocomplete="off"></input>
              </div>
              <div className='input_box'>
                <label>Password</label>
                <input type='password' placeholder='********' autocomplete="off"></input>
              </div>
              <div className='input_box'>
                <label>Confirm Password</label>
                <input type='text' placeholder='********' autocomplete="off"></input>
              </div>
              <input type='submit' value='Sign Up' className='submit'></input>
              <p>Already have account ? Click here - <span onClick={() => setActiveForm('login')}>Log In</span></p>
          </form>
          <img src={signup_image} className='signup_image img'></img>
        </div>
        )}

        {activeForm === 'reset' && (<div className='logs resetForm'>
          <form>
              <h3>Forgot Password ? Don't worry</h3>
              <div className='input_box'>
                <label>Email</label>
                <input type='email' placeholder='example@gmail.com' autocomplete="off"></input>
              </div>
              <input type='submit' value='Reset Password' className='submit'></input>
              <p>Back to Login Page ? Click here - <span onClick={() => setActiveForm('login')}>LogIn</span></p>
          </form>
          <img src={reset_image} className='reset_image img'></img>
        </div>
        )}

      </main>
    </section>
  );
}

export default Log;
