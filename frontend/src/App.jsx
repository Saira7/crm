import React, { useContext } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext } from './components/AuthContext';
import Login from './components/Login';
import CRMLayout from './components/CRMLayout';
import Dashboard from './components/Dashboard';
import LeadsPage from './components/LeadsPage';
import TeamPage from './components/TeamPage';
import TeamLeadOverview from './components/TeamLeadOverview'; 
import StickyNotesPanel from './components/StickyNotes';

export default function App() {
  const { token } = useContext(AuthContext);

  if (!token) {
    return <Login />;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<CRMLayout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="team-overview" element={<TeamLeadOverview />} /> 
          <Route path="sticky-notes" element={<StickyNotesPanel />} />
        </Route>
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
