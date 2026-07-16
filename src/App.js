import React from 'react';
import { Routes, Route } from 'react-router-dom';
import Home from './pages/Home';
import Log from './pages/Log';

function App() {
  return (
    <Routes>
      <Route path="/planora" element={<Home />} />
      <Route path="/planora/home" element={<Home />} />
      <Route path="/planora/login" element={<Log />} />
    </Routes>
  );
}

export default App;
