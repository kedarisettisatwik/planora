import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Log from './pages/Log';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Log />} />
      <Route path="/log" element={<Log />} />
      <Route path="/home" element={<Home />} />
    </Routes>
  );
}

export default App;
