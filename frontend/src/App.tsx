import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ControlPanel from './pages/ControlPanel';
import DisplayWindow from './pages/DisplayWindow';
import Library from './pages/Library';
import Settings from './pages/Settings';

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  const isLoggedIn = localStorage.getItem('worship_is_logged_in') === 'true';
  if (!isLoggedIn) {
    return <Navigate to="/" replace />;
  }
  return children;
};

const RequireAdmin = ({ children }: { children: JSX.Element }) => {
  const isAdmin = localStorage.getItem('worship_role') === 'admin';
  if (!isAdmin) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

import { useEffect } from 'react';

function App() {
  useEffect(() => {
    const isDark = localStorage.getItem('worship_dark_mode');
    if (isDark === 'false') {
      document.documentElement.classList.remove('dark');
    } else {
      document.documentElement.classList.add('dark');
      if (isDark === null) localStorage.setItem('worship_dark_mode', 'true');
    }
  }, []);
  return (
    <HashRouter>
      <Routes>
        {/* Rute Terbuka (Public) */}
        <Route path="/" element={<Login />} />
        <Route path="/display" element={<DisplayWindow />} />
        
        {/* Rute Terlindungi (Protected) */}
        <Route path="/dashboard" element={<RequireAuth><Dashboard /></RequireAuth>} />
        <Route path="/control" element={<RequireAuth><ControlPanel /></RequireAuth>} />
        <Route path="/library" element={<RequireAuth><Library /></RequireAuth>} />
        <Route path="/settings" element={<RequireAuth><RequireAdmin><Settings /></RequireAdmin></RequireAuth>} />
      </Routes>
    </HashRouter>
  );
}

export default App;
