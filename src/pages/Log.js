
import { useNavigate } from 'react-router-dom';
import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';

import '../Styles/Log.css';

import login_image from '../assests/login.png';
import signup_image from '../assests/signup.png';
import reset_image from '../assests/reset_password.png';
import eye_hide from '../assests/eye_hide.png';
import eye_show from '../assests/eye_show.png';

import LoadingBtn from '../components/LoadingBtn';

import { SignUpLog } from "../authentication/SignUpLog";
import {LogInLog} from "../authentication/LogInLog";
import { ResetPasswordLog } from '../authentication/ResetPasswordLog';
import {GoogleLog} from '../authentication/GoogleLog';

import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";

function Log() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate('/home');
      }
    });

    return () => unsubscribe(); // cleanup listener on unmount
  }, [navigate]);
  
  const [activeForm, setActiveForm] = useState('login');
  const [contentVisible, setContentVisible] = useState(false);
  const [loadingForm, setLoadingForm] = useState(false);

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

  const SignInGoogle = async (event) => {
    setLoadingForm(true);
    try {
      const user = await GoogleLog();
      console.log("Welcome", user.displayName);
      toast('Logged In Succesfully !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '✅',
        style: {"backgroundColor":"var(--toast_success)","color":"white"}
      });
      setLoadingForm(false);

      navigate('/home');

    } catch (err) {
      toast(err.message, {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      setLoadingForm(false);
    }
  }

  const LoginSubmitForm = async (event) => {
    event.preventDefault();

    if (loginEmail.length == 0 || loginPassword.length == 0){
      toast('All fields Required !!', {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return ;
    }
    
    setLoadingForm(true);

    const result = await LogInLog(loginEmail, loginPassword);

    if (result.success) {

      console.log("Logged In:", result.user);
      toast('Logged In Succesfully !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '✅',
        style: {"backgroundColor":"var(--toast_success)","color":"white"}
      });
      setLoadingForm(false);

      navigate('/home');

    } else {
      console.log(result.error);
      toast(result.error, {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      setLoadingForm(false);
    }

  }

  const signUpSubmitForm = async (event) => {
    event.preventDefault();

    if (signupName.length == 0 || signupEmail.length == 0 || signupPassword.length == 0 || signupConfirmPassword.length == 0){
      toast('All fields Required !!', {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return ;
    }
    if (signupConfirmPassword != signupPassword){
      toast('Password confirmation failed', {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return ;
    }
    if (signupPassword.length <= 5){
      toast('Password should have more than 5 characters', {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return ;
    }

    setLoadingForm(true);

    const result = await SignUpLog(signupEmail,signupPassword,signupName);

    if (result.success) {

      console.log("Signed up:", result.user);
      toast('Account created Succesfully !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '✅',
        style: {"backgroundColor":"var(--toast_success)","color":"white"}
      });
      setLoadingForm(false);

    } else {
      console.log(result.error);
      toast(result.error, {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      setLoadingForm(false);
    }
    
  }

  const resetSubmitForm = async (event) => {
    event.preventDefault();

    if (resetEmail.length == 0){
      toast('All fields Required !!', {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      return ;
    }
    setLoadingForm(true);

    const result = await ResetPasswordLog(resetEmail);

    if (result.success) {

      console.log("Signed up:", result);
      toast('Reset Email sent Succesfully !! ', {
        duration: 2000,
        position: 'top-center',
        icon: '✅',
        style: {"backgroundColor":"var(--toast_success)","color":"white"}
      });
      setLoadingForm(false);

    } else {
      console.log(result.error);
      toast(result.error, {
        duration: 2000,
        position: 'top-center',
        icon: '❌',
        style: {"backgroundColor":"var(--toast_error)","color":"white"}
      });
      setLoadingForm(false);
    }

  }

  return (
    <section className='log section'>
      <main className={`main ${loadingForm ? 'loading' : ''}`}>
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
                  <div className='btns'>
                    <input type='submit' value='Log In' className='submit'></input>
                    <button type='button' onClick={(e) => SignInGoogle(e)} value='Sign In with Google'> Sign In with Google</button>
                  </div>
                  <p>New to Planora ? - <span onClick={() => setActiveForm('signup')}>Signup</span></p>
                  <p>Forgot Password ? - <span onClick={() => setActiveForm('reset')}>Reset Password</span></p>
              </form>
              <img src={login_image} className='login_image img'></img>
            </div>
          )}

            {activeForm === 'signup' && (<div className='logs singUpForm'>
              <form onSubmit={signUpSubmitForm}>
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
                  <p>Already have account ? - <span onClick={() => setActiveForm('login')}>Log In</span></p>
              </form>
              <img src={signup_image} className='signup_image img'></img>
            </div>
            )}

            {activeForm === 'reset' && (<div className='logs resetForm'>
              <form onSubmit={resetSubmitForm}>
                  <h3>Forgot Password ? Don't worry</h3>
                  <div className='input_box'>
                    <label>Email</label>
                    <input type='email' placeholder='example@gmail.com' autoComplete="off" value={resetEmail}  onChange={(e) => setResetEmail(e.target.value)}></input>
                  </div>
                  <input type='submit' value='Reset Password' className='submit'></input>
                  <p>Back to Login Page ? - <span onClick={() => setActiveForm('login')}>LogIn</span></p>
              </form>
              <img src={reset_image} className='reset_image img'></img>
            </div>
            )}
        </div>
        <div className='loading'><LoadingBtn/></div>
      </main>
    </section>
  );
}

export default Log;
