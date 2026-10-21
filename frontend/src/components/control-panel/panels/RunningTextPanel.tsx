import React from 'react';
import { Power } from 'lucide-react';

interface RunningTextPanelProps {
  isRtVisible: boolean;
  setIsRtVisible: (visible: boolean) => void;
  runningText: string;
  setRunningText: (text: string) => void;
  rtHeight: number;
  setRtHeight: (height: number) => void;
  rtSpeed: number;
  setRtSpeed: (speed: number) => void;
  rtPos: string;
  setRtPos: (pos: string) => void;
}

export const RunningTextPanel: React.FC<RunningTextPanelProps> = ({
  isRtVisible,
  setIsRtVisible,
  runningText,
  setRunningText,
  rtHeight,
  setRtHeight,
  rtSpeed,
  setRtSpeed,
  rtPos,
  setRtPos,
}) => {
  return (
    <div className="flex flex-col gap-4 h-full">
      <div className="flex items-center gap-3 shrink-0">
        <button
          type="button"
          onClick={() => setIsRtVisible(!isRtVisible)}
          className={`flex-1 py-3 rounded-lg font-bold text-xs shadow-sm flex items-center justify-center gap-2 transition-all ${isRtVisible ? 'bg-red-500 hover:bg-red-600 text-white shadow-red-500/20' : 'bg-indigo-600 hover:bg-indigo-700 text-white shadow-indigo-600/20'
            }`}
        >
          <Power size={14} />
          {isRtVisible ? 'MATIKAN RUNNING TEXT' : 'HIDUPKAN RUNNING TEXT'}
        </button>

        <div className="flex gap-1 bg-white dark:bg-slate-800 p-1 rounded-lg border border-indigo-100 dark:border-slate-700 shrink-0">
          <button
            type="button"
            onClick={() => setRtPos('top')}
            className={`px-3 py-1.5 rounded text-[10px] font-bold transition ${rtPos === 'top'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
          >
            Atas
          </button>
          <button
            type="button"
            onClick={() => setRtPos('bottom')}
            className={`px-3 py-1.5 rounded text-[10px] font-bold transition ${rtPos === 'bottom'
                ? 'bg-indigo-600 text-white'
                : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
              }`}
          >
            Bawah
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 flex-1 min-h-0">
        <textarea
          value={runningText}
          onChange={e => setRunningText(e.target.value)}
          placeholder="Ketik teks yang ingin ditampilkan berjalan dari kanan ke kiri..."
          className="glass-input flex-1 min-h-0 resize-none font-semibold text-sm !p-3 dark:!bg-slate-900 border border-indigo-200 dark:border-slate-700 rounded-xl"
        />
      </div>

      <div className="flex items-center gap-4 shrink-0 bg-white dark:bg-slate-800 border border-indigo-100 dark:border-slate-700 rounded-lg p-2.5">
        <div className="flex-1 flex gap-3 items-center">
          <span className="text-[10px] font-bold text-indigo-900/50 dark:text-slate-400 uppercase w-12">Ukuran</span>
          <span className="text-[9px] font-bold text-indigo-900/70 dark:text-slate-500">Kecil</span>
          <input
            type="range"
            min="3"
            max="25"
            value={rtHeight}
            onChange={e => setRtHeight(Number(e.target.value))}
            className="flex-1 accent-indigo-600 dark:accent-[#C5A059]"
          />
          <span className="text-[9px] font-bold text-indigo-900/70 dark:text-slate-500">Besar</span>
        </div>
        <div className="w-px h-6 bg-indigo-100 dark:bg-slate-700"></div>
        <div className="flex-1 flex gap-3 items-center">
          <span className="text-[10px] font-bold text-indigo-900/50 dark:text-slate-400 uppercase w-12">Speed</span>
          <span className="text-[9px] font-bold text-indigo-900/70 dark:text-slate-500">Cepat</span>
          <input
            type="range"
            min="5"
            max="40"
            value={rtSpeed}
            onChange={e => setRtSpeed(Number(e.target.value))}
            className="flex-1 accent-indigo-600 dark:accent-[#C5A059]"
          />
          <span className="text-[9px] font-bold text-indigo-900/70 dark:text-slate-500">Lambat</span>
        </div>
      </div>
    </div>
  );
};
