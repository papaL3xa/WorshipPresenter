import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    return localStorage.getItem('worship_dark_mode') !== 'false';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      setIsDarkMode(localStorage.getItem('worship_dark_mode') !== 'false');
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const toggleTheme = () => {
    const newMode = !isDarkMode;
    setIsDarkMode(newMode);
    localStorage.setItem('worship_dark_mode', newMode.toString());
    if (newMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  return (
    <button 
      onClick={toggleTheme}
      className="glass-button text-indigo-900 dark:text-[#C5A059] p-2 rounded-full hover:bg-white/70 dark:hover:bg-white/10 shadow-sm flex items-center justify-center transition-all !px-2.5"
      title={isDarkMode ? "Beralih ke Terang" : "Beralih ke Gelap"}
    >
      {isDarkMode ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
