fetch('https://script.google.com/macros/s/AKfycbxtiocm9f0K_39AP1dfTadWuHoVLgCMsyTUodm0d9jeO1TRcchbnvm5cpiQd2v8k-dJ/exec?action=getPlaylists').then(r=>r.text()).then(console.log).catch(console.error);
