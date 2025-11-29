// src/App.jsx
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
import FilesPage from './components/FileAttachment';
import AdminDashboard from './components/AdminDashboard';

export default function App() {
  const { token, user } = useContext(AuthContext);

  // Simple guard for private routes
  const RequireAuth = ({ children }) => {
    if (!token || !user) {
      return <Navigate to="/login" replace />;
    }
    return children;
  };

  // Role-based redirect for "/" (home)
  const RoleHomeRedirect = () => {
    if (!token || !user) {
      return <Navigate to="/login" replace />;
    }

    const rawRole =
      typeof user.role === 'string' ? user.role : user.role?.name ?? 'user';
    const normRole = rawRole.toLowerCase();

    return (
      <Navigate
        to={normRole === 'admin' ? '/admin-dashboard' : '/dashboard'}
        replace
      />
    );
  };

  return (
    <BrowserRouter>
      <Routes>
        {/* PUBLIC route */}
        <Route path="/login" element={<Login />} />

        {/* PROTECTED app shell */}
        <Route
          path="/"
          element={
            <RequireAuth>
              <CRMLayout />
            </RequireAuth>
          }
        >
          {/* default inside the layout => role-based */}
          <Route index element={<RoleHomeRedirect />} />

          <Route path="dashboard" element={<Dashboard />} />
          <Route path="admin-dashboard" element={<AdminDashboard />} />
          <Route path="leads" element={<LeadsPage />} />
          <Route path="team" element={<TeamPage />} />
          <Route path="team-overview" element={<TeamLeadOverview />} />
          <Route path="sticky-notes" element={<StickyNotesPanel />} />
          <Route path="files" element={<FilesPage />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
