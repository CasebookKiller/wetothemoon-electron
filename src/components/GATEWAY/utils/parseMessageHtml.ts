// src/components/GATEWAY/utils/parseMessageHtml.ts

export type ChatMessageFileKind = 'text' | 'image' | 'binary';

export interface WebSource {
  url: string;
  title: string;
  snippet?: string;
  siteIcon?: string;
  siteName?: string;
}

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
  sources?: WebSource[];
  blocks: ChatMessageBlock[];
  fullHtml?: string;
  messageHash?: string | null;
  pwKey?: string | null;
  branchTotal?: number;
  branchIndex?: number;
}

export function parseMessageHtml(entry: { role: string; html: string; key?: string | number }): ChatMessage | null {
  const div = document.createElement('div');
  div.innerHTML = entry.html;

  if (entry.role === 'user') {
    const blocks: ChatMessageBlock[] = [];

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

        blocks.push({ type: 'file', content: name, mime, size, fileKind, thumbUrl });
      });
    }

    const fbb = div.querySelector('.fbb737a4');
    const text = fbb?.textContent?.trim() || '';
    if (text) blocks.push({ type: 'text', content: text });

    if (blocks.length === 0) return null;
    return { id: entry.key ? String(entry.key) : undefined, role: 'user', blocks };
  }

  let thinking: string | undefined;
  const thinkingEl = div.querySelector('div.e1675d8b.ds-think-content');
  if (thinkingEl) thinking = thinkingEl.textContent?.trim() || '';

  // Источники из DOM (только favicon+count). Полный список — из IndexedDB.
  const sources: WebSource[] = [];
  const sourcesEl = div.querySelector('div.f93f59e4');
  if (sourcesEl) {
    const iconEls = sourcesEl.querySelectorAll('div._8e95474 img.site_logo_img');
    iconEls.forEach((img) => {
      const iconUrl = img.getAttribute('src') || '';
      let host = '';
      const m = iconUrl.match(/site-icons\/([^\/]+)/);
      if (m) host = m[1];
      if (host) {
        sources.push({
          url: `https://${host}`,
          title: host,
          siteIcon: iconUrl,
          siteName: host,
        });
      }
    });
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
        const code = (codeEl?.textContent || '').replace(/\n+$/, '');
        if (code.trim()) {
          blocks.push({ type: 'code', content: code, language });
        }
      } else {
        const text = element.textContent?.trim() || '';
        if (text) blocks.push({ type: 'text', content: text });
      }
    } else if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent?.trim() || '';
      if (text) blocks.push({ type: 'text', content: text });
    }
  });

  if (blocks.length === 0) {
    const text = assistantMain.textContent?.trim() || '';
    if (text) blocks.push({ type: 'text', content: text });
  }

  let fullHtml = (assistantMain as HTMLElement).innerHTML;
  if (fullHtml) {
    fullHtml = fullHtml.replace(/>\s+</g, '><');
  }
  return {
    id: entry.key ? String(entry.key) : undefined,
    role: 'assistant',
    thinking,
    sources: sources.length > 0 ? sources : undefined,
    blocks,
    fullHtml,
  };
}