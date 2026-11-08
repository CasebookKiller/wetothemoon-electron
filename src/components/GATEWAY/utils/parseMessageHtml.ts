// src/components/GATEWAY/utils/parseMessageHtml.ts

export type ChatMessageFileKind = 'text' | 'image' | 'binary';

export interface ChatMessageBlock {
  type: 'text' | 'code' | 'file';
  content: string;
  language?: string;
  size?: string;
  mime?: string;
  fileKind?: ChatMessageFileKind;
  thumbUrl?: string;
  fileId?: string;
}

export interface ChatMessage {
  id?: string;
  role: 'user' | 'assistant';
  thinking?: string;
  blocks: ChatMessageBlock[];
  fullHtml?: string;
  messageHash?: string | null;
  pwKey?: string | null;
  // 5.7: branching
  branchTotal?: number;
  branchIndex?: number;
}

export function parseMessageHtml(entry: { role: string; html: string; key?: string | number }): ChatMessage | null {
  const div = document.createElement('div');
  div.innerHTML = entry.html;

  if (entry.role === 'user') {
    const blocks: ChatMessageBlock[] = [];

    // 1) File-чипы: контейнер .eafda4ae > чип ._25c7358
    const chipContainer = div.querySelector('.eafda4ae');
    if (chipContainer) {
      chipContainer.querySelectorAll('._25c7358').forEach((chip) => {
        const nameEl = chip.querySelector('.e70accd6');
        const metaEl = chip.querySelector('._7103a25');
        const name = nameEl?.textContent?.trim() || '';
        if (!name) return;
        const metaText = metaEl?.textContent?.trim() || '';
        const parts = metaText.split(/\s+/).filter(Boolean);
        const mime = (parts[0] || '').toUpperCase();
        const size = parts.slice(1).join(' ');

        let fileKind: ChatMessageFileKind = 'binary';
        if (/^(TXT|MD|JSON|CSV|LOG|XML|YAML|YML|JS|TS|PY|HTML|CSS|SQL)$/.test(mime)) {
          fileKind = 'text';
        } else if (/^(PNG|JPG|JPEG|GIF|WEBP|SVG|BMP|HEIC)$/.test(mime)) {
          fileKind = 'image';
        }

        const imgEl = chip.querySelector('img');
        const thumbUrl =
          imgEl?.getAttribute('src') || imgEl?.getAttribute('data-src') || undefined;

        blocks.push({
          type: 'file',
          content: name,
          mime,
          size,
          fileKind,
          thumbUrl,
        });
      });
    }

    // 2) Текст (если есть)
    const fbb = div.querySelector('.fbb737a4');
    const text = fbb?.textContent?.trim() || '';
    if (text) {
      blocks.push({ type: 'text', content: text });
    }

    if (blocks.length === 0) return null;
    return {
      id: entry.key ? String(entry.key) : undefined,
      role: 'user',
      blocks,
    };
  }

  let thinking: string | undefined;
  const thinkingEl = div.querySelector('div.e1675d8b.ds-think-content');
  if (thinkingEl) {
    thinking = thinkingEl.textContent?.trim() || '';
  }

  const assistantMain = div.querySelector('div.ds-markdown.ds-assistant-message-main-content');
  if (!assistantMain) return null;

  const blocks: any[] = [];
  assistantMain.childNodes.forEach((node) => {
    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as HTMLElement;
      if (element.classList.contains('md-code-block')) {
        const langEl = element.querySelector('span.d813de27');
        const codeEl = element.querySelector('pre');
        const language = langEl?.textContent?.trim() || 'text';
        const code = codeEl?.textContent || '';
        if (code.trim()) {
          blocks.push({ type: 'code', content: code, language });
        }
      } else {
        const text = element.textContent?.trim() || '';
        if (text) {
          blocks.push({ type: 'text', content: text });
        }
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() || '';
      if (text) {
        blocks.push({ type: 'text', content: text });
      }
    }
  });

  if (blocks.length === 0) {
    const text = assistantMain.textContent?.trim() || '';
    if (text) {
      blocks.push({ type: 'text', content: text });
    }
  }

  return {
    id: entry.key ? String(entry.key) : undefined,
    role: 'assistant',
    thinking,
    blocks,
    fullHtml: (assistantMain as HTMLElement).innerHTML,
  };
}