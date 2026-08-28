import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import ControlPanel from './pages/ControlPanel';
import DisplayWindow from './pages/DisplayWindow';
import StageDisplay from './pages/StageDisplay';
import Library from './pages/Library';
import Settings from './pages/Settings';

const RequireAuth = ({ children }: { children: JSX.Element }) => {
  return children;
};

const RequireAdmin = ({ children }: { children: JSX.Element }) => {
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

    // Auto-scale UI so it never overflows when zoomed in browsers
    const handleResize = () => {
      const baseWidth = 1536; // Gunakan 1536 untuk menampung seluruh tombol header tanpa terpotong
      const currentWidth = window.innerWidth;
      
      if (currentWidth < baseWidth) {
        const scale = currentWidth / baseWidth;
        (document.body as any).style.zoom = scale;
      } else {
        (document.body as any).style.zoom = 1;
      }
    };

    window.addEventListener('resize', handleResize);
    // Observe zoom changes
    const observer = new ResizeObserver(handleResize);
    observer.observe(document.documentElement);
    
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      observer.disconnect();
    };
  }, []);
  return (
    <HashRouter>
      <Routes>
        {/* Rute Terbuka (Public) */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/display" element={<DisplayWindow />} />
        <Route path="/stage" element={<StageDisplay />} />
        
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
