import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

export function FooterClock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="flex items-center gap-3 bg-white/60 dark:bg-black/20 px-3 py-1.5 rounded-lg border border-white/60 dark:border-white/10 shadow-sm dark:shadow-none">
      <div className="text-right border-r border-indigo-900/20 dark:border-white/10 pr-2">
        <div className="text-[9px] font-bold text-indigo-900/60 dark:text-[#C5A059]/80 uppercase tracking-wider">
          {currentTime.toLocaleDateString('id-ID', { weekday: 'long' })}
        </div>
        <div className="text-[10px] font-semibold text-indigo-950 dark:text-[#C5A059]">
          {currentTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>
      </div>
      <div className="font-mono font-bold text-base text-indigo-950 dark:text-[#D4B872] tracking-wider">
        {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}
