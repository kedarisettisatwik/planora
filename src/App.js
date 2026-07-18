import React from 'react';
import { ToastContainer } from 'react-toastify';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Log from './pages/Log';

function App() {
  return (
    <>
      <ToastContainer 
      position="top-center"
      autoClose={2000}
      hideProgressBar={true}
      newestOnTop={false}
      closeOnClick={true} />
      <Routes>
        <Route path="/" element={<Log />} />
        <Route path="/log" element={<Log />} />
        <Route path="/home" element={<Home />} />
      </Routes>
    </>
  );
}

export default App;
