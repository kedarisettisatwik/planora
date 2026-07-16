import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Log from './pages/Log';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/home" element={<Home />} />
      <Route path="/login" element={<Log />} />
    </Routes>
  );
}

export default App;
