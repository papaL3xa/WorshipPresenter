import { useState, useEffect } from 'react';
import { Heart } from 'lucide-react';

export function FooterClock() {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <footer className="w-full shrink-0 glass-panel mt-auto p-2 md:p-3 flex justify-between items-center shadow-sm border-white/50 z-10 relative">
      <div className="flex flex-col pl-2">
        <div className="text-indigo-900/70 text-xs font-extrabold tracking-widest">WorshipPresenter</div>
        <div className="text-indigo-900/50 text-[10px] font-bold flex items-center gap-1.5 mt-0.5">
          PISGAH BISDAC Multimedia Team
        </div>
        <div className="text-indigo-900/50 text-[10px] font-bold flex items-center gap-1.5 mt-0.5">
          <Heart size={10} className="text-red-500 fill-red-500" /> GOD BLESS US
        </div>
      </div>
      <div className="flex items-center gap-3 bg-white/60 px-5 py-2 rounded-xl border border-white/60 shadow-sm">
        <div className="text-right border-r border-indigo-900/20 pr-3">
          <div className="text-[11px] font-bold text-indigo-900/60 uppercase tracking-wider">
            {currentTime.toLocaleDateString('id-ID', { weekday: 'long' })}
          </div>
          <div className="text-xs font-semibold text-indigo-950">
            {currentTime.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="font-mono font-bold text-lg md:text-xl text-indigo-950 tracking-wider">
          {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
      </div>
    </footer>
  );
}
