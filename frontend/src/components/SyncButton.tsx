import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

export function SyncButton({ isParentSyncing = false }: { isParentSyncing?: boolean }) {
  const [syncing, setSyncing] = useState(false);
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
          ? 'bg-indigo-100 text-indigo-600 border-indigo-200 cursor-not-allowed' 
          : 'bg-indigo-50/80 text-indigo-800 border-indigo-200 hover:bg-indigo-100 hover:shadow-md backdrop-blur-sm'
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
