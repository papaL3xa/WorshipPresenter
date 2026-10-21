import React from 'react';
import { CheckSquare } from 'lucide-react';

interface SegmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  segments: string[];
  tempVisibleSegments: number[];
  onToggleSegment: (index: number) => void;
  onSave: () => void;
  canEmbedChorus?: boolean;
  onEmbedChorus?: () => void;
}

export const SegmentModal: React.FC<SegmentModalProps> = ({
  isOpen,
  onClose,
  segments,
  tempVisibleSegments,
  onToggleSegment,
  onSave,
  canEmbedChorus,
  onEmbedChorus,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-lg w-full border border-white/40 dark:border-slate-700/50 flex flex-col max-h-[85vh]">
        <div className="flex justify-between items-center mb-2">
          <h2 className="text-2xl font-bold text-indigo-900 dark:text-[#C5A059] flex items-center gap-2">
            <CheckSquare size={24} /> Pilih Bait / Ayat
          </h2>
        </div>

        {canEmbedChorus && onEmbedChorus && (
          <button
            type="button"
            onClick={onEmbedChorus}
            className="w-full mb-3 py-2 px-3 rounded-xl font-bold text-xs text-amber-800 dark:text-amber-200 bg-amber-100 hover:bg-amber-200 dark:bg-amber-900/40 dark:hover:bg-amber-900/60 border border-amber-300 dark:border-amber-700 transition flex items-center justify-center gap-2 shadow-xs cursor-pointer"
            title="Sematkan Chorus setelah tiap bait dalam lagu ini"
          >
            ⚡ Sematkan Chorus setelah Tiap Bait
          </button>
        )}
        <div className="flex-1 overflow-y-auto space-y-2 border border-indigo-100 dark:border-slate-700 rounded-xl p-3 bg-slate-50/50 dark:bg-slate-800/50">
          {segments.map((seg: string, i: number) => {
            const isChecked = tempVisibleSegments.includes(i);
            return (
              <label
                key={i}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${isChecked
                  ? 'bg-indigo-50 dark:bg-indigo-900/30 border-indigo-200 dark:border-indigo-700'
                  : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700'
                  }`}
              >
                <input
                  type="checkbox"
                  className="mt-1 w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500"
                  checked={isChecked}
                  onChange={() => onToggleSegment(i)}
                />
                <div className="text-sm dark:text-slate-200">{seg}</div>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="px-6 py-2 rounded-xl font-bold text-indigo-900 dark:text-slate-300 bg-black/5 dark:bg-slate-800 hover:bg-black/10 dark:hover:bg-slate-700 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={onSave}
            className="px-6 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition"
          >
            Simpan Pilihan
          </button>
        </div>
      </div>
    </div>
  );
};
