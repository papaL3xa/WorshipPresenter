import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

export function FooterClock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full flex items-center justify-between gap-4 bg-white/60 dark:bg-black/20 px-4 py-2 rounded-xl border border-white/60 dark:border-white/10 shadow-sm dark:shadow-none">
      <div className="text-left border-r border-indigo-900/20 dark:border-white/10 pr-4 flex-1">
        <div className="text-xs font-bold text-indigo-900/60 dark:text-[#C5A059]/80 uppercase tracking-wider">
          {currentTime.toLocaleDateString('id-ID', { weekday: 'long' })}
        </div>
        <div className="text-sm font-bold text-indigo-950 dark:text-[#C5A059] mt-0.5">
          {currentTime.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })}
        </div>
      </div>
      <div className="font-mono font-bold text-xl lg:text-2xl text-indigo-950 dark:text-[#D4B872] tracking-widest shrink-0">
        {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
      </div>
    </div>
  );
}
