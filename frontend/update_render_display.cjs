const fs = require('fs');
const file = '\\\\wsl.localhost\\Ubuntu\\home\\sagala\\pisgahbisdac\\PB\\frontend\\src\\pages\\ControlPanel.tsx';
let content = fs.readFileSync(file, 'utf8');

const startIdx = content.indexOf('const renderDisplayBox =');
const endIdx = content.indexOf('return (', startIdx + 500);

if (startIdx !== -1 && endIdx !== -1) {
  // Let's actually look for the end of the renderDisplayBox function which ends at line 1221 (the `  };` before `  return (`).
  const actualEndIdx = content.indexOf('  };\n\n  return (', startIdx);
  if (actualEndIdx !== -1) {
    let boxContent = content.substring(startIdx, actualEndIdx);
    
    boxContent = boxContent.replace(
      "const renderDisplayBox = (itemIdx: number, segIdx: number, isLiveBox: boolean) => {\n    return (",
      "const renderDisplayBox = (itemIdx: number, segIdx: number, isLiveBox: boolean) => {\n    const itemData = (isLiveBox && tempLiveItem) ? tempLiveItem : playlist[itemIdx];\n    if (!itemData) return <div className=\"w-full h-full bg-black rounded-xl overflow-hidden relative flex flex-col items-center justify-center pointer-events-none\"></div>;\n    return ("
    );
    
    boxContent = boxContent.replace(/playlist\[itemIdx\]/g, 'itemData');
    
    content = content.substring(0, startIdx) + boxContent + content.substring(actualEndIdx);
    
    fs.writeFileSync(file, content);
    console.log("Updated ControlPanel.tsx successfully.");
  } else {
    console.log("Could not find actualEndIdx");
  }
} else {
  console.log("Failed to find bounds");
}
