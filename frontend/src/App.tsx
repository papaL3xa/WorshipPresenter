import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import ControlPanel from './pages/ControlPanel';
import DisplayWindow from './pages/DisplayWindow';
import StageDisplay from './pages/StageDisplay';
import LowerThird from './pages/LowerThird';
import Library from './pages/Library';
import Settings from './pages/Settings';
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

    if (!localStorage.getItem('worship_role')) {
      localStorage.setItem('worship_role', 'admin');
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
        {/* Rute Navigasi Aplikasi */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/display" element={<DisplayWindow />} />
        <Route path="/stage" element={<StageDisplay />} />
        <Route path="/lower-third" element={<LowerThird />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/control" element={<ControlPanel />} />
        <Route path="/library" element={<Library />} />
        <Route path="/settings" element={<Settings />} />
      </Routes>
    </HashRouter>
  );
}

export default App;
