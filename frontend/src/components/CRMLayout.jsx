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
    setToken(null);
    setUser(null);
    navigate('/');
  };

  // Notifications / due date logic
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
          const normRole = (userRole || '').toString().toLowerCase();
          if (normRole === 'team_lead' && leadTeam && userTeam)
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

  const normRole = (userRole || '').toString().toLowerCase();
  const isAdmin = normRole === 'admin';

  // Build nav items (shared for desktop + mobile)
  const navItems = [];
  if (isAdmin) {
    navItems.push(
      { path: '/admin-dashboard', icon: BarChart3, label: 'Admin Dashboard' },
      { path: '/team', icon: UsersRound, label: 'Team' },
      { path: '/team-overview', icon: Folders, label: 'Team Overview' },
      { path: '/files', icon: File, label: 'Files' }
    );
  } else {
    navItems.push(
      { path: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
      { path: '/leads', icon: FileText, label: 'Leads' }
    );

    const isLeadRole =
      userRole === 'admin' ||
      userRole === 'team_lead' ||
      userRole === 'Team Lead';

    if (isLeadRole) {
      navItems.push(
        { path: '/team', icon: UsersRound, label: 'Team' },
        { path: '/team-overview', icon: Folders, label: 'Team Overview' }
      );
    }

    navItems.push({ path: '/files', icon: File, label: 'Files' });
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-gray-50">
      {/* Main Content + Sticky Notes */}
      <div className="flex-1 flex flex-col overflow-hidden w-full">
        {/* Top Bar with Horizontal Nav */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* LEFT: Logo */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-lg">
              CRM
            </div>
            <span className="font-semibold text-gray-900 text-lg">
              LeadFlow
            </span>
          </div>

          {/* CENTER: Horizontal Navigation (Desktop) */}
          <nav className="hidden md:flex items-center gap-6">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex items-center gap-2 text-sm font-medium transition-colors ${
                    isActive
                      ? 'text-blue-600 border-b-2 border-blue-600 pb-1'
                      : 'text-gray-700 hover:text-blue-600'
                  }`
                }
              >
                {item.icon && <item.icon className="w-4 h-4" />}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* RIGHT: Notifications + User */}
          <div className="flex items-center gap-4">
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

            {/* User Avatar + Menu */}
            <div className="relative group">
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-500 flex items-center justify-center text-white font-medium text-sm cursor-pointer">
                {user?.name
                  ? user.name
                      .split(' ')
                      .map((n) => n[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'U'}
              </div>

              <div className="absolute right-0 mt-2 w-40 bg-white border border-gray-200 rounded-lg shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all">
                <div className="p-3 text-sm text-gray-800 border-b capitalize">
                  {userRole.replace('_', ' ')}
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 flex items-center gap-2"
                >
                  <LogOut className="w-4 h-4" />
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Mobile Horizontal Nav */}
        <nav className="flex md:hidden overflow-x-auto gap-4 px-4 py-3 bg-white border-b">
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
              {item.icon && <item.icon className="w-4 h-4" />}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Content row: center page + right notes */}
        <div className="flex flex-1 overflow-hidden">
          {/* Main page content */}
          <main className="flex-1 overflow-y-auto bg-gray-50">
            <div className="min-h-full w-full px-4 sm:px-6 lg:px-6 py-6">
              <div className="max-w-5xl mx-auto">
                <Outlet />
              </div>
            </div>
          </main>

          {/* Always-visible sticky notes on far right */}
          <div className="w-80 border-l border-gray-200 bg-white flex-shrink-0">
            <StickyNotesPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
