import React from 'react';
import { Clock } from 'lucide-react';

interface CountdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  value: string;
  onChange: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const CountdownModal: React.FC<CountdownModalProps> = ({
  isOpen,
  onClose,
  value,
  onChange,
  onSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex justify-center items-center p-4 backdrop-blur-sm">
      <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl p-8 rounded-2xl shadow-2xl max-w-md w-full border border-white/40 dark:border-slate-700/50 flex flex-col">
        <h2 className="text-2xl font-bold text-indigo-900 dark:text-[#C5A059] mb-2 flex items-center gap-2">
          <Clock size={24} /> Tambah Hitung Mundur
        </h2>
        <form onSubmit={onSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-bold text-indigo-900/70 dark:text-slate-300 mb-2">
              Masukkan durasi (misal: 5 untuk 5 menit, 30s untuk 30 detik, 5m 30s)
            </label>
            <input
              autoFocus
              className="w-full text-lg bg-white dark:bg-slate-800 border-2 border-indigo-200 dark:border-slate-700 dark:text-white rounded-xl p-3 focus:outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-100 dark:focus:ring-indigo-500/20 transition-all font-medium"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="5m 30s"
            />
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
              type="submit"
              className="px-6 py-2 rounded-xl font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md transition"
            >
              Tambahkan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
