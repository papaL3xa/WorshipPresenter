import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ControlPanel from './pages/ControlPanel';
import DisplayWindow from './pages/DisplayWindow';
import Library from './pages/Library';
import Settings from './pages/Settings';
import PlaylistEditor from './pages/PlaylistEditor';

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

function App() {
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
        <Route path="/playlist/new" element={<RequireAuth><PlaylistEditor /></RequireAuth>} />
        <Route path="/playlist/edit" element={<RequireAuth><PlaylistEditor /></RequireAuth>} />
      </Routes>
    </HashRouter>
  );
}

export default App;
