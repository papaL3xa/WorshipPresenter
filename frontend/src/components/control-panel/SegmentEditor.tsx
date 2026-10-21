import React, { useState, useEffect, useRef } from 'react';

interface AutoResizeTextareaProps {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  className?: string;
  rows?: number;
  style?: React.CSSProperties;
}

export const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({ value, onChange, className, rows, style }) => {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [value, style]);
  return <textarea ref={ref} value={value} onChange={onChange} className={className} rows={rows} style={style} />;
};

interface SegmentEditorProps {
  value: string;
  onChange: (newValue: string) => void;
  className?: string;
  style?: React.CSSProperties;
}

export const SegmentEditor: React.FC<SegmentEditorProps> = ({ value, onChange, className, style }) => {
  const isBilingual = value && typeof value === 'string' && value.includes('\n[kuning]') && value.endsWith('[/kuning]');
  const is2Kolom = value && typeof value === 'string' && value.includes('\n[kolom2]') && value.endsWith('[/kolom2]');
  const [force2Kolom, setForce2Kolom] = useState(false);

  if (isBilingual) {
    const parts = value.split('\n[kuning]');
    const left = parts[0];
    const right = parts[1].replace('[/kuning]', '');
    return (
      <div className="flex flex-col gap-2 w-full">
        <AutoResizeTextarea
          value={left}
          onChange={(e) => onChange(e.target.value + '\n[kuning]' + right + '[/kuning]')}
          className={className}
          style={style}
          rows={2}
        />
        <div className="flex items-center gap-2">
          <div className="h-px bg-indigo-100 dark:bg-slate-700/50 flex-1"></div>
          <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Terjemahan</span>
          <div className="h-px bg-indigo-100 dark:bg-slate-700/50 flex-1"></div>
        </div>
        <AutoResizeTextarea
          value={right}
          onChange={(e) => onChange(left + '\n[kuning]' + e.target.value + '[/kuning]')}
          className={(className || '').replace('text-slate-800', 'text-yellow-700').replace('dark:text-slate-200', 'dark:text-yellow-300').replace('text-slate-700', 'text-yellow-700').replace('dark:text-slate-300', 'dark:text-yellow-300')}
          style={style}
          rows={2}
        />
      </div>
    );
  }

  if (is2Kolom || force2Kolom) {
    const parts = is2Kolom ? value.split('\n[kolom2]') : [value, ''];
    const left = parts[0] || '';
    const right = parts[1] ? parts[1].replace('[/kolom2]', '') : '';

    return (
      <div className="flex gap-2 w-full">
        <div className="flex-1 flex flex-col gap-1">
          <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kolom Kiri</div>
          <AutoResizeTextarea
            value={left}
            onChange={(e) => {
              const newLeft = e.target.value;
              if (!newLeft && !right) { setForce2Kolom(false); onChange(''); }
              else if (!right) onChange(newLeft);
              else onChange(newLeft + '\n[kolom2]' + right + '[/kolom2]');
            }}
            className={className}
            style={style}
            rows={2}
          />
        </div>
        <div className="flex-1 flex flex-col gap-1">
          <div className="flex justify-between items-center">
            <div className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Kolom Kanan</div>
            <button
              type="button"
              onClick={() => { setForce2Kolom(false); onChange(left); }}
              className="text-xs text-red-500 dark:text-red-400 hover:text-red-600 font-bold px-1.5 py-0.5 rounded hover:bg-red-500/10 transition"
              title="Hapus Kolom Kanan"
            >
              ✕ Tutup
            </button>
          </div>
          <AutoResizeTextarea
            value={right}
            onChange={(e) => {
              const newRight = e.target.value;
              if (!newRight && !left) { setForce2Kolom(false); onChange(''); }
              else if (!newRight) onChange(left);
              else onChange(left + '\n[kolom2]' + newRight + '[/kolom2]');
            }}
            className={className}
            style={style}
            rows={2}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="relative group w-full">
      <AutoResizeTextarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={className}
        style={style}
        rows={2}
      />
      <button
        type="button"
        onClick={() => setForce2Kolom(true)}
        className="absolute bottom-2 right-2 text-xs font-bold text-indigo-600 dark:text-[#C5A059] bg-white/90 dark:bg-slate-800/90 hover:bg-indigo-50 dark:hover:bg-slate-700 border border-indigo-200 dark:border-slate-700 px-2 py-0.5 rounded shadow-sm opacity-0 group-hover:opacity-100 transition-all backdrop-blur-sm"
        title="Bagi menjadi 2 kolom"
      >
        + 2 Kolom
      </button>
    </div>
  );
};
