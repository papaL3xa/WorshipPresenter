import React, { useRef } from 'react';
import { Plus, X } from 'lucide-react';

export interface DisplayLogo {
  id: string;
  url: string;
  scale: number;
  x: number;
  y: number;
  enabled?: boolean;
}

interface LogoManagerPanelProps {
  logos: DisplayLogo[];
  updateLogo: (id: string, patch: Partial<DisplayLogo>) => void;
  removeLogo: (id: string) => void;
  onLogoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const LogoManagerPanel: React.FC<LogoManagerPanelProps> = ({
  logos,
  updateLogo,
  removeLogo,
  onLogoUpload,
}) => {
  const logoInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col gap-3 h-full overflow-hidden">
      <div className="flex flex-col gap-2 overflow-y-auto flex-1 min-h-0 pr-1">
        {logos.map((logo, index) => (
          <div
            key={logo.id}
            className="flex gap-3 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-lg p-3 shadow-sm items-center"
          >
            <div className="w-14 h-14 rounded-md overflow-hidden bg-slate-900/50 dark:bg-black/50 shrink-0 flex items-center justify-center border border-slate-700/50 p-1 shadow-inner backdrop-blur-sm">
              <img src={logo.url} alt="Logo" className="max-w-full max-h-full object-contain drop-shadow-sm" />
            </div>
            <div className="flex-1 flex flex-col gap-3 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-indigo-900/60 dark:text-slate-400 shrink-0 w-12">
                  Logo {index + 1}
                </span>
                <span className="text-[9px] font-bold text-indigo-900/50 dark:text-slate-500">Kecil</span>
                <input
                  type="range"
                  min="0.1"
                  max="5"
                  step="0.1"
                  value={logo.scale}
                  onChange={(e) => updateLogo(logo.id, { scale: parseFloat(e.target.value) })}
                  className="flex-1 accent-indigo-600 dark:accent-[#C5A059]"
                />
                <span className="text-[9px] font-bold text-indigo-900/50 dark:text-slate-500">Besar</span>
                <span className="text-[9px] font-bold text-indigo-600 dark:text-[#C5A059] w-8 text-right mr-1">
                  {Math.round(logo.scale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => updateLogo(logo.id, { enabled: logo.enabled === false ? true : false })}
                  className={`p-1 px-2 text-[9px] font-bold rounded transition shrink-0 mr-1 ${logo.enabled !== false
                      ? 'bg-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-500/40'
                      : 'bg-slate-500/20 text-slate-700 dark:text-slate-400 hover:bg-slate-500/40'
                    }`}
                >
                  {logo.enabled !== false ? 'ON' : 'OFF'}
                </button>
                <button
                  type="button"
                  onClick={() => removeLogo(logo.id)}
                  className="text-red-400 hover:text-white hover:bg-red-500 p-1 rounded transition shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
              <div className="flex gap-2 h-7">
                <button
                  type="button"
                  onClick={() => updateLogo(logo.id, { x: 2, y: 3 })}
                  className={`flex-1 rounded text-[9px] font-bold border transition shadow-sm ${logo.x < 50 && logo.y < 50
                      ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black border-transparent'
                      : 'bg-transparent text-indigo-900/70 dark:text-slate-400 border-indigo-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700'
                    }`}
                >
                  Kiri Atas
                </button>
                <button
                  type="button"
                  onClick={() => updateLogo(logo.id, { x: 98, y: 3 })}
                  className={`flex-1 rounded text-[9px] font-bold border transition shadow-sm ${logo.x >= 50 && logo.y < 50
                      ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black border-transparent'
                      : 'bg-transparent text-indigo-900/70 dark:text-slate-400 border-indigo-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700'
                    }`}
                >
                  Kanan Atas
                </button>
                <button
                  type="button"
                  onClick={() => updateLogo(logo.id, { x: 2, y: 97 })}
                  className={`flex-1 rounded text-[9px] font-bold border transition shadow-sm ${logo.x < 50 && logo.y >= 50
                      ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black border-transparent'
                      : 'bg-transparent text-indigo-900/70 dark:text-slate-400 border-indigo-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700'
                    }`}
                >
                  Kiri Bawah
                </button>
                <button
                  type="button"
                  onClick={() => updateLogo(logo.id, { x: 98, y: 97 })}
                  className={`flex-1 rounded text-[9px] font-bold border transition shadow-sm ${logo.x >= 50 && logo.y >= 50
                      ? 'bg-indigo-600 dark:bg-[#C5A059] text-white dark:text-black border-transparent'
                      : 'bg-transparent text-indigo-900/70 dark:text-slate-400 border-indigo-200 dark:border-slate-600 hover:bg-indigo-50 dark:hover:bg-slate-700'
                    }`}
                >
                  Kanan Bawah
                </button>
              </div>
            </div>
          </div>
        ))}
        {logos.length === 0 && (
          <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-semibold italic min-h-[100px]">
            Belum ada logo — klik Tambah Logo di bawah
          </div>
        )}
      </div>

      <input
        type="file"
        accept="image/*"
        ref={logoInputRef}
        onChange={onLogoUpload}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => logoInputRef.current?.click()}
        className="w-full py-3 border-2 border-dashed border-indigo-300 dark:border-slate-600 rounded-xl text-xs text-indigo-900/60 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-[#C5A059] hover:border-indigo-400 dark:hover:border-[#C5A059] hover:bg-indigo-50/50 dark:hover:bg-white/5 font-bold transition flex items-center justify-center gap-2 shrink-0"
      >
        <Plus size={16} /> Tambah Logo
      </button>
    </div>
  );
};
