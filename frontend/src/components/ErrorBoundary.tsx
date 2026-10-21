import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  public handleReload = () => {
    window.location.reload();
  };

  public handleGoDashboard = () => {
    window.location.hash = '#/dashboard';
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 bg-slate-900 text-white flex flex-col items-center justify-center p-6 z-[9999]">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mb-4">
              <AlertTriangle size={32} />
            </div>
            <h2 className="text-xl font-bold mb-2">Terjadi Kendala Tampilan</h2>
            <p className="text-slate-300 text-sm mb-4 leading-relaxed">
              Aplikasi mendeteksi error pada komponen. Seluruh data ibadah & lagu Anda tetap tersimpan aman di database lokal.
            </p>
            {this.state.error?.message && (
              <div className="w-full bg-black/40 border border-slate-700/60 rounded-xl p-3 text-xs text-red-400 font-mono text-left mb-6 break-words max-h-32 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}
            <div className="flex gap-3 w-full">
              <button
                type="button"
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 px-4 rounded-xl transition shadow-md"
              >
                <RefreshCw size={16} /> Muat Ulang
              </button>
              <button
                type="button"
                onClick={this.handleGoDashboard}
                className="flex-1 flex items-center justify-center gap-2 bg-slate-700 hover:bg-slate-600 text-white font-bold py-2.5 px-4 rounded-xl transition"
              >
                <Home size={16} /> Ke Dashboard
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
