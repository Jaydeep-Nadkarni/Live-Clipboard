import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import RoomPage from './pages/RoomPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/:roomId" element={<RoomPage />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
