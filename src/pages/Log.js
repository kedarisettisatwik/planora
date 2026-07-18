
// import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
 import { toast } from 'react-toastify';
import './Log.css';
import login_image from '../assests/login.png';
import signup_image from '../assests/signup.png';
import reset_image from '../assests/reset_password.png';
import eye_hide from '../assests/eye_hide.png';
import eye_show from '../assests/eye_show.png';

function Log() {
  // const navigate = useNavigate();
  const [activeForm, setActiveForm] = useState('login');
  const [contentVisible, setContentVisible] = useState(false);

  const [show_password,setShow_password] = useState('hide');

  const headingRef = useRef(null);

  useEffect(() => {
    const el = headingRef.current;
    if (!el) return;

    const text = el.textContent;
    el.innerHTML = '';

    const spans = [...text].map((ch) => {
      const s = document.createElement('span');
      s.textContent = ch === ' ' ? '\u00A0' : ch;
      s.style.display = 'inline-block';
      s.style.transition = 'transform 0.8s cubic-bezier(0.22, 1, 0.36, 1), opacity 0.6s ease';
      s.style.opacity = '0';
      el.appendChild(s);
      return s;
    });

    const scatter = () => {
      spans.forEach((s) => {
        const x = (Math.random() - 0.5) * 300;
        const y = (Math.random() - 0.5) * 150;
        const r = (Math.random() - 0.5) * 180;
        s.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg)`;
        s.style.opacity = '0';
      });
    };

    const assemble = () => {
      spans.forEach((s, i) => {
        setTimeout(() => {
          s.style.opacity = '1';
          s.style.transform = 'translate(0,0) rotate(0deg)';
        }, i * 30);
      });
    };

    scatter();
    const startDelay = 100;
    const timer = setTimeout(assemble, startDelay);

    // total time = start delay + last letter's stagger offset + its own transition duration
    const lastLetterDelay = (spans.length - 1) * 30;
    const transitionDuration = 800;
    const totalDuration = startDelay + lastLetterDelay + transitionDuration;

    const revealTimer = setTimeout(() => {
      setContentVisible(true);
    }, totalDuration);

    return () => {
      clearTimeout(timer);
      clearTimeout(revealTimer);
    };
  }, []);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup form state
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupConfirmPassword, setSignupConfirmPassword] = useState('');

  // Reset form state
  const [resetEmail, setResetEmail] = useState('');

  const LoginSubmitForm = (event) => {
    event.preventDefault();

    if (loginEmail.length == 0 || loginPassword.length == 0){
      toast("All Fields Required *",{
        style: { background: 'var(--toast_error)', color: '#fff',letterSpacing:'1px' },
      });
      return ;
    }

    toast("submitted",{
      style: { background: 'var(--toast_success)', color: '#fff',letterSpacing:'1px' },
    });

  }

  return (
    <section className='log section'>
      <main className='main'>
        <h1 id='heading_animation' ref={headingRef}>planora</h1>
        <div className={`page_content ${contentVisible ? 'visible' : ''}`}>
            <p className='description'>Your productivity hub starts here — sign in to take control of your day</p>

            {activeForm === 'login' && (<div className='logs loginForm'>
              <form onSubmit={LoginSubmitForm}>
                  <h3>Hey there, ready to log in? </h3>
                  <div className='input_box'>
                    <label>Email</label>
                    <input type='email' placeholder='example@gmail.com' autoComplete="off" value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}></input>
                  </div>
                  <div className={`input_box ${show_password}`}>
                    <label>Password</label>
                    <input type={`${show_password === 'show' ? 'text' : 'password'}`} placeholder='********' autoComplete="off" value={loginPassword}
                      onChange={(e) => setLoginPassword(e.target.value)}></input>
                    <img src={eye_hide} className='eye_hide' onClick={() => setShow_password('hide')}></img>
                    <img src={eye_show} className='eye_show' onClick={() => setShow_password('show')}></img>
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
                    <input type='text' placeholder='Hi Mr / Ms ?' autoComplete="off" value={signupName}
                      onChange={(e) => setSignupName(e.target.value)}></input>
                  </div>
                  <div className='input_box'>
                    <label>Email</label>
                    <input type='email' placeholder='example@gmail.com' autoComplete="off" value={signupEmail}
                      onChange={(e) => setSignupEmail(e.target.value)}></input>
                  </div>
                  <div className='input_box'>
                    <label>Password</label>
                    <input type='password' placeholder='********' autoComplete="off" value={signupPassword}
                      onChange={(e) => setSignupPassword(e.target.value)}></input>
                  </div>
                  <div className='input_box'>
                    <label>Confirm Password</label>
                    <input type='text' placeholder='secret ***' autoComplete="off" value={signupConfirmPassword}
                      onChange={(e) => setSignupConfirmPassword(e.target.value)}></input>
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
                    <input type='email' placeholder='example@gmail.com' autoComplete="off"></input>
                  </div>
                  <input type='submit' value='Reset Password' className='submit' value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}></input>
                  <p>Back to Login Page ? Click here - <span onClick={() => setActiveForm('login')}>LogIn</span></p>
              </form>
              <img src={reset_image} className='reset_image img'></img>
            </div>
            )}
      </div>
      </main>
    </section>
  );
}

export default Log;
