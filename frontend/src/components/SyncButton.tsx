import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function SyncButton({ isParentSyncing = false }: { isParentSyncing?: boolean }) {
  const isDesktop = typeof window !== 'undefined' && (window as any).electronAPI;
  const [syncing, setSyncing] = useState(false);
  
  if (isDesktop) return null;

  const activeSync = syncing || isParentSyncing;

  const handleSync = () => {
    if (activeSync) return;
    setSyncing(true);
    // Reload the page to fetch the freshest data from Google Sheets
    setTimeout(() => {
      window.location.reload();
    }, 300);
  };

  return (
    <button 
      onClick={handleSync}
      disabled={activeSync}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-full font-bold text-sm transition-all shadow-sm border ${
        activeSync 
          ? 'bg-slate-300/50 text-slate-500 border-slate-300/50 cursor-not-allowed dark:bg-slate-700/50 dark:text-slate-400 dark:border-slate-700/50' 
          : 'glass-button text-indigo-900'
      }`}
      title="Sinkronisasi data dengan Google Sheets"
    >
      {activeSync ? (
        <>
          Syncing <RefreshCw size={16} className="animate-spin" />
        </>
      ) : (
        <>
          Synced <span className="bg-green-400 text-white rounded-md text-[10px] w-4 h-4 flex items-center justify-center shadow-sm">✓</span>
        </>
      )}
    </button>
  );
}
