const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  callApi: (action, params, payload) => ipcRenderer.invoke('api-call', { action, params, payload })
});
