export async function callApi(action: string, params: Record<string, string> = {}, options: { method?: 'GET' | 'POST'; payload?: any; } = { method: 'GET' }) {
  // Bridge to Electron if running as Desktop App
  if (typeof window !== 'undefined' && (window as any).electronAPI) {
    return await (window as any).electronAPI.callApi(action, params, options.payload);
  }
  
  // Jika dijalankan di browser biasa (bukan Electron), lempar error karena aplikasi ini sekarang 100% offline
  console.error('Aplikasi ini hanya dapat dijalankan di Desktop App (Electron) untuk akses database offline.');
  return { success: false, message: 'Harap jalankan aplikasi melalui WorshipPresenter.exe (Desktop App).' };
}
