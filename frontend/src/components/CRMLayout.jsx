// src/layouts/CRMLayout.jsx
import React, { useContext, useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { AuthContext } from './AuthContext';
import { apiFetch } from '../api';
import {
  LayoutDashboard,
  Users,
  UsersRound,
  LogOut,
  Menu,
  X,
  Bell,
  AlertCircle,
  Clock,
  NoteSticky,        // 👈 NEW
} from 'lucide-react';
import StickyNotesPanel from '../components/StickyNotesPanel'; // 👈 NEW

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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [bellOpen, setBellOpen] = useState(false);
  const [notesOpen, setNotesOpen] = useState(false); // 👈 NEW
  const navigate = useNavigate();

  const userRole = user?.role
    ? (typeof user.role === 'string'
        ? user.role
        : user.role?.name ?? String(user.role))
    : 'user';

  const handleLogout = () => {
    setToken(null);
    setUser(null);
    navigate('/');
  };

  // Fetch leads periodically and create due-date notifications
  useEffect(() => {
    if (!user?.id || !token) return;

    let cancelled = false;

    const checkLeads = async () => {
      if (!token || !user?.id) return;

      try {
        const data = await apiFetch('/leads', token);
        if (!Array.isArray(data)) return;

        const myLeads = data.filter((lead) => {
          if (lead.assignedToId && user?.id) return lead.assignedToId === user.id;
          const leadTeam = lead.teamName || null;
          const userTeam =
            typeof user?.team === 'string' ? user.team : user?.team?.name;
          if (userRole === 'team_lead' && leadTeam && userTeam)
            return leadTeam === userTeam;
          return false;
        });

        const now = new Date();
        const newNotes = [];

        myLeads.forEach((lead) => {
          if (!lead.dueDate) return;
          const due = new Date(lead.dueDate);
          if (isNaN(due.getTime())) return;

          const msDiff = due.getTime() - now.getTime();
          const diffHoursFloat = msDiff / (1000 * 60 * 60);
          const diffHours = Math.floor(diffHoursFloat);
          const diffDays = Math.floor(diffHoursFloat / 24);

          const msgKey = `due:${lead.id}:${
            diffHours <= 0 ? 'overdue' : diffHours <= 48 ? 'due_soon' : 'future'
          }`;

          if (diffHours < 0) {
            const hoursAgo = Math.abs(diffHours);
            const daysAgo = Math.floor(hoursAgo / 24);

            const message =
              daysAgo > 0
                ? `Lead "${lead.companyName}" is ${daysAgo} day${
                    daysAgo !== 1 ? 's' : ''
                  } overdue.`
                : `Lead "${lead.companyName}" is ${hoursAgo} hour${
                    hoursAgo !== 1 ? 's' : ''
                  } overdue.`;

            newNotes.push({
              key: msgKey,
              type: 'due',
              leadId: lead.id,
              message,
              time: due.toLocaleString(),
              read: false,
            });
          } else if (diffHours <= 48) {
            const message =
              diffDays > 0
                ? `Lead "${lead.companyName}" is due in ${diffDays} day${
                    diffDays !== 1 ? 's' : ''
                  }.`
                : `Lead "${lead.companyName}" is due in ${diffHours} hour${
                    diffHours !== 1 ? 's' : ''
                  }.`;

            newNotes.push({
              key: msgKey,
              type: 'due',
              leadId: lead.id,
              message,
              time: due.toLocaleString(),
              read: false,
            });
          }
        });

        if (cancelled) return;

        if (newNotes.length > 0) {
          setNotifications((prev) => {
            const existingKeys = new Set(prev.map((p) => p.key));
            const uniqueNew = newNotes.filter((n) => !existingKeys.has(n.key));
            const merged = [...uniqueNew, ...prev].slice(0, 20);
            return merged;
          });
        }
      } catch (err) {
        console.warn('Notifications fetch failed:', err.message || err);
      }
    };

    checkLeads();
    const interval = setInterval(checkLeads, 60_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user, token, userRole]);

  const navItems = [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
    { path: '/leads', icon: Users, label: 'Leads' },
    ...(userRole === 'admin' ||
    userRole === 'team_lead' ||
    userRole === 'Team Lead'
      ? [
          { path: '/team', icon: UsersRound, label: 'Team' },
          { path: '/team-overview', icon: UsersRound, label: 'Team Overview' },
        ]
      : []),
  ];

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 bg-white border-r border-gray-200 flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
              CRM
            </div>
            <span className="font-semibold text-gray-900 text-lg">
              LeadFlow
            </span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-700 hover:bg-gray-50'
                }`
              }
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User Profile */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3 px-3 py-2">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium text-sm">
              {user?.name
                ? user.name
                    .split(' ')
                    .map((n) => n[0])
                    .join('')
                    .slice(0, 2)
                    .toUpperCase()
                : 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.name}
              </p>
              <p className="text-xs text-gray-500 truncate capitalize">
                {userRole.replace('_', ' ')}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar */}
      {sidebarOpen && (
        <>
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-200 z-50 lg:hidden flex flex-col">
            <div className="h-16 flex items-center justify-between px-6 border-b border-gray-200">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
                  CRM
                </div>
                <span className="font-semibold text-gray-900 text-lg">
                  LeadFlow
                </span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-500" />
              </button>
            </div>

            <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
              {navItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={() => setSidebarOpen(false)}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                      isActive
                        ? 'bg-blue-50 text-blue-700'
                        : 'text-gray-700 hover:bg-gray-50'
                    }`
                  }
                >
                  <item.icon className="w-5 h-5" />
                  {item.label}
                </NavLink>
              ))}
            </nav>

            {/* Mobile User Profile */}
            <div className="p-4 border-t border-gray-200">
              <div className="flex items-center gap-3 px-3 py-2">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium text-sm">
                  {user?.name
                    ? user.name
                        .split(' ')
                        .map((n) => n[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()
                    : 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 truncate">
                    {user?.name}
                  </p>
                  <p className="text-xs text-gray-500 truncate capitalize">
                    {userRole.replace('_', ' ')}
                  </p>
                </div>
              </div>
              <button
                onClick={handleLogout}
                className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <LogOut className="w-4 h-4" />
                Logout
              </button>
            </div>
          </aside>
        </>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <Menu className="w-6 h-6 text-gray-700" />
          </button>

          <div className="flex-1" />

          <div className="flex items-center gap-4">
            {/* Notifications */}
            <NotificationBell
              notifications={notifications}
              onToggle={() => {
                setBellOpen((prev) => !prev);
                setNotifications((prev) =>
                  prev.map((n) => ({ ...n, read: true }))
                );
              }}
              isOpen={bellOpen}
            />

            {/* 👇 Sticky Notes button in the navbar */}
            <button
              type="button"
              onClick={() => setNotesOpen(true)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-gray-200 hover:bg-gray-50 text-xs text-gray-700"
            >
              <NoteSticky className="w-4 h-4" />
              <span className="hidden sm:inline">Notes</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50">
          <div className="min-h-full w-full px-4 sm:px-6 lg:px-6 py-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Sticky Notes Panel (global, on top of layout) */}
      <StickyNotesPanel
        token={token}
        isOpen={notesOpen}
        onClose={() => setNotesOpen(false)}
      />
    </div>
  );
}
