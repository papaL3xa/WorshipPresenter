import { useState, useEffect } from 'react';

export default function LowerThird() {
  const [liveState, setLiveState] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('worship_live_state');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [, setTheme] = useState<any>(() => {
    try {
      const raw = localStorage.getItem('worship_display_theme');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const ch = new BroadcastChannel('worship_live_sync');
    ch.onmessage = (e) => {
      if (e.data?.type === 'LIVE_STATE') {
        setLiveState(e.data.payload);
      } else if (e.data?.type === 'THEME_UPDATE') {
        setTheme(e.data.payload);
      }
    };
    return () => ch.close();
  }, []);

  const isBlank = liveState.displayMode === 'blank' || liveState.displayMode === 'logo' || liveState.displayMode === 'clear';
  const text = liveState.text || '';
  const title = liveState.title || '';

  if (isBlank || !text) {
    return <div className="w-screen h-screen bg-transparent" />;
  }

  return (
    <div className="w-screen h-screen bg-transparent flex flex-col justify-end p-8 overflow-hidden select-none">
      <div className="max-w-5xl mx-auto w-full bg-black/80 backdrop-blur-md border border-white/20 rounded-2xl p-6 text-white shadow-2xl transition-all duration-300 animate-fade-in">
        {title && (
          <div className="text-yellow-400 font-bold text-lg uppercase tracking-wider mb-2">
            {title}
          </div>
        )}
        <div
          className="text-2xl sm:text-3xl font-extrabold leading-snug whitespace-pre-line"
          dangerouslySetInnerHTML={{ __html: text.replace(/\n/g, '<br/>') }}
        />
      </div>
    </div>
  );
}
