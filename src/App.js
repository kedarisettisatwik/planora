
import React from 'react';
import { Routes, Route } from "react-router-dom";
import ProtectedRoute from "./authentication/ProtectedRoute";
import { Toaster } from 'react-hot-toast';
import Home from "./pages/Home";
import Log from "./pages/Log";

function App() {
  return (
    <>
      <Toaster
        position="top-center"
        reverseOrder={true}
      />
      <Routes>
        <Route path="/" element={<Log />} />
        <Route path="/log" element={<Log />} />
        <Route
          path="/home"
          element={
            <ProtectedRoute>
              <Home />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;