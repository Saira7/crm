// src/layouts/CRMLayout.jsx
import React, { useContext, useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import {
  LayoutDashboard,
  UsersRound,
  LogOut,
  Bell,
  AlertCircle,
  Clock,
  FileText,
  File,
  Folders,
  BarChart3,
} from 'lucide-react';
import StickyNotesPanel from '../components/StickyNotes';

function NotificationBell({ notifications, onToggle, isOpen }) {
  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className="p-2 rounded-lg hover:bg-gray-100 transition-colors relative"
        aria-label="Notifications"
      >
        <Bell className="w-6 h-6 text-gray-700" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full"></span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="p-3 border-b border-gray-100 font-semibold text-gray-800">
            Notifications
          </div>
          <div className="max-h-72 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-sm text-gray-500 text-center">
                No notifications
              </div>
            ) : (
              notifications.map((note, idx) => (
                <div
                  key={note.key || idx}
                  className={`p-4 border-b border-gray-100 flex items-start gap-3 ${
                    !note.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="mt-0.5">
                    {note.type === 'due' ? (
                      <Clock className="w-5 h-5 text-blue-500" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-gray-800">{note.message}</p>
                    <p className="text-xs text-gray-500 mt-1">{note.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function CRMLayout() {
  const { user, token, setToken, setUser } = useContext(AuthContext);
  const [notifications, setNotifications] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const navigate = useNavigate();

  const userRole = user?.role
    ? typeof user.role === 'string'
      ? user.role
      : user.role?.name ?? String(user.role)
    : 'user';

const handleLogout = () => {
  try {
    // Clear any persisted auth if you use it
    localStorage.removeItem('token');
    localStorage.removeItem('user');

    // Clear context state
    setToken(null);
    setUser(null);

    // Go straight to login page
    navigate('/login', { replace: true });
  } catch (e) {
    console.error('Logout error', e);
    navigate('/login', { replace: true });
  }


  };

  // ---- Notifications Logic (unchanged) ----
  useEffect(() => {
    if (!user?.id || !token) return;

    let cancelled = false;

    const checkLeads = async () => {
      try {
        const data = await apiFetch('/leads', token);
        if (!Array.isArray(data)) return;

        const myLeads = data.filter((lead) => {
          if (lead.assignedToId === user.id) return true;

          const leadTeam = lead.teamName || null;
          const userTeam =
            typeof user?.team === 'string' ? user.team : user?.team?.name;

          if (userRole.toLowerCase() === 'team_lead' && leadTeam && userTeam)
            return leadTeam === userTeam;

          return false;
        });

        const now = new Date();
        const newNotes = [];

        myLeads.forEach((lead) => {
          if (!lead.dueDate) return;
          const due = new Date(lead.dueDate);
          if (isNaN(due)) return;

          const msDiff = due - now;
          const diffH = msDiff / (1000 * 60 * 60);

          const msgKey = `due-${lead.id}-${diffH <= 0 ? 'late' : diffH <= 48 ? 'soon' : ''}`;

          if (diffH < 0) {
            newNotes.push({
              key: msgKey,
              type: 'due',
              message: `Lead "${lead.companyName}" is overdue.`,
              time: due.toLocaleString(),
              read: false,
            });
          } else if (diffH <= 48) {
            newNotes.push({
              key: msgKey,
              type: 'due',
              message: `Lead "${lead.companyName}" is due soon.`,
              time: due.toLocaleString(),
              read: false,
            });
          }
        });

        if (cancelled) return;

        setNotifications((prev) => {
          const existing = new Set(prev.map((p) => p.key));
          const fresh = newNotes.filter((n) => !existing.has(n.key));
          return [...fresh, ...prev].slice(0, 20);
        });
      } catch {
        // Handle errors silently
      }
    };

    checkLeads();
    const interval = setInterval(checkLeads, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, token, userRole]);

  // ---- Navigation Items ----
  const normRole = (userRole || '').toLowerCase();
  const isAdmin = normRole === 'admin';

  const navItems = [];

  if (isAdmin) {
    navItems.push(
      { path: '/admin-dashboard', label: 'Admin Dashboard', icon: BarChart3 },
      { path: '/team', label: 'Team', icon: UsersRound },
      { path: '/team-overview', label: 'Team Overview', icon: Folders },
      { path: '/files', label: 'Files', icon: File },
      { path: '/leads', label: 'Leads', icon: FileText }

    );
  } else {
    navItems.push(
      { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
      { path: '/leads', label: 'Leads', icon: FileText }
    );

    if (
      userRole === 'admin' ||
      userRole === 'team_lead' ||
      userRole === 'Team Lead'
    ) {
      navItems.push(
        { path: '/team', label: 'Team', icon: UsersRound },
        { path: '/team-overview', label: 'Team Overview', icon: Folders }
      );
    }

    navItems.push({ path: '/files', label: 'Files', icon: File });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* ---- TOP NAVBAR ---- */}
        <header className="h-16 bg-white border-b flex items-center justify-between px-6">
          {/* Left Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center">
              CRM
            </div>
            <span className="text-lg font-semibold text-gray-900">
              LeadFlow
            </span>
          </div>

          {/* Center Nav */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 text-sm font-semibold ${
                    isActive
                      ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                      : 'text-gray-700 hover:text-blue-600'
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* Right Section (Notifications + Profile + Logout) */}
          <div className="flex items-center gap-4">
            <NotificationBell
              notifications={notifications}
              isOpen={bellOpen}
              onToggle={() => {
                setBellOpen(!bellOpen);
                setNotifications((prev) =>
                  prev.map((n) => ({ ...n, read: true }))
                );
              }}
            />

            {/* Profile Avatar */}
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 text-white font-medium flex items-center justify-center">
              {user?.name
                ? user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .toUpperCase()
                    .slice(0, 2)
                : 'U'}
            </div>

            {/* Logout Button */}
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-gray-100 hover:bg-gray-200 transition"
            >
              <LogOut className="w-4 h-4" />
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </header>

        {/* Mobile Nav */}
        <nav className="flex md:hidden gap-4 px-4 py-3 bg-white border-b overflow-x-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-1 text-sm font-medium whitespace-nowrap ${
                  isActive
                    ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                    : 'text-gray-700'
                }`
              }
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Main content + sticky notes */}
        <div className="flex flex-1 overflow-hidden">
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <div className="max-w-5xl mx-auto px-4 py-6">
              <Outlet />
            </div>
          </main>

          <div className="w-80 border-l bg-white flex-shrink-0">
            <StickyNotesPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
