import { useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react';

export interface RichEditorRef {
  applyColor: (colorTag: string, colorHex: string) => void;
  focus: () => void;
}

interface RichEditorProps {
  value: string;
  onChange: (val: string) => void;
  onSelectChange?: (hasSelection: boolean) => void;
  placeholder?: string;
  className?: string;
}

const colors: Record<string, string> = {
  merah: '#ef4444',
  kuning: '#eab308',
  hijau: '#22c55e',
  biru: '#3b82f6',
  ungu: '#c084fc',
  oranye: '#fb923c'
};

const hexToTag: Record<string, string> = {
  '#ef4444': 'merah', 'rgb(239,68,68)': 'merah',
  '#eab308': 'kuning', 'rgb(234,179,8)': 'kuning',
  '#22c55e': 'hijau', 'rgb(34,197,94)': 'hijau',
  '#3b82f6': 'biru', 'rgb(59,130,246)': 'biru',
  '#c084fc': 'ungu', 'rgb(192,132,252)': 'ungu',
  '#fb923c': 'oranye', 'rgb(251,146,60)': 'oranye'
};

const toHtml = (raw: string) => {
  if (!raw) return '';
  let html = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  html = html.replace(/\n/g, '<br/>');
  
  for (const [tag, hex] of Object.entries(colors)) {
    const regex = new RegExp(`\\[${tag}\\](.*?)\\[\\/${tag}\\]`, 'gi');
    html = html.replace(regex, `<span data-color="${tag}" style="color: ${hex}; font-weight: bold;">$1</span>`);
  }
  return html;
};

const toRawText = (node: Node): string => {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || '';
  }
  if (node.nodeName === 'BR') {
    return '\n';
  }
  if (node.nodeType === Node.ELEMENT_NODE) {
    const el = node as HTMLElement;
    let inner = '';
    el.childNodes.forEach(child => {
      inner += toRawText(child);
    });
    
    let matchedTag: string | null = null;
    if (el.hasAttribute('data-color')) {
      matchedTag = el.getAttribute('data-color');
    } else if (el.style && el.style.color) {
       const colorStr = el.style.color.replace(/\s/g, '');
       matchedTag = hexToTag[colorStr] || null;
    } else if (el.tagName === 'FONT') {
       const c = el.getAttribute('color') || '';
       matchedTag = hexToTag[c.toLowerCase()] || null;
    }
    
    if (matchedTag && inner.length > 0) {
      return `[${matchedTag}]${inner}[/${matchedTag}]`;
    }
    
    if (el.tagName === 'DIV' || el.tagName === 'P') {
       return '\n' + inner;
    }
    
    return inner;
  }
  return '';
};

export const RichEditor = forwardRef<RichEditorRef, RichEditorProps>(({ value, onChange, onSelectChange, placeholder, className }, ref) => {
  const editorRef = useRef<HTMLDivElement>(null);

  // Parse HTML string from raw text when value changes from OUTSIDE
  // Avoid changing innerHTML while typing to prevent cursor jump
  useEffect(() => {
    if (editorRef.current) {
      const currentRaw = toRawText(editorRef.current).replace(/^\n/, ''); // cleanup leading div newline
      if (currentRaw !== value) {
        editorRef.current.innerHTML = toHtml(value);
      }
    }
  }, [value]);

  const handleInput = () => {
    if (!editorRef.current) return;
    let newRaw = '';
    editorRef.current.childNodes.forEach(child => {
      newRaw += toRawText(child);
    });
    // Remove accidental leading newline caused by first div
    newRaw = newRaw.replace(/^\n/, '');
    onChange(newRaw);
  };

  const handleSelection = useCallback(() => {
    if (!onSelectChange) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      // Ensure the selection is actually inside our editor
      if (editorRef.current && editorRef.current.contains(sel.anchorNode)) {
        onSelectChange(true);
        return;
      }
    }
    onSelectChange(false);
  }, [onSelectChange]);

  useEffect(() => {
    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
    };
  }, [handleSelection]);

  useImperativeHandle(ref, () => ({
    applyColor: (_colorTag: string, colorHex: string) => {
      if (!editorRef.current) return;
      editorRef.current.focus();
      document.execCommand('styleWithCSS', false, 'true'); // forces spans instead of <font> in some browsers
      document.execCommand('foreColor', false, colorHex);
      document.execCommand('bold', false); // add bold implicitly
      
      // Post-process the DOM to add data-color attribute for consistency (optional but helps parsing robustness)
      handleInput(); 
    },
    focus: () => {
      editorRef.current?.focus();
    }
  }));

  return (
    <div
      ref={editorRef}
      contentEditable
      className={className}
      onInput={handleInput}
      onFocus={() => {}}
      onBlur={() => {}}
      style={{ minHeight: '100px', outline: 'none' }}
      data-placeholder={placeholder}
    />
  );
});

RichEditor.displayName = 'RichEditor';
