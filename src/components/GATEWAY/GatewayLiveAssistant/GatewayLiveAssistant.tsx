// src/components/GATEWAY/GatewayLiveAssistant/GatewayLiveAssistant.tsx

import React, { useMemo } from 'react';

interface Props {
  html: string;
}

/**
 * Закрывает незакрытые теги, если throttle оборвал стрим посередине.
 * Простой стекинг по именам тегов, игнорирует все остальные атрибуты.
 */
function balanceTags(html: string): string {
  if (!html) return '';

  const tracked = new Set([
    'pre', 'code', 'div', 'span', 'p', 'strong', 'em', 'b', 'i', 'u',
    'ul', 'ol', 'li', 'blockquote', 'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'a', 'sub', 'sup', 'del', 's',
  ]);
  const opens: Array<{ tag: string }> = [];
  const tagRe = /<\/?([a-z][a-z0-9]*)\b[^>]*>/gi;
  let match: RegExpExecArray | null;

  while ((match = tagRe.exec(html)) !== null) {
    const full = match[0];
    const tag = match[1].toLowerCase();
    if (!tracked.has(tag)) continue;

    if (full.startsWith('</')) {
      for (let i = opens.length - 1; i >= 0; i--) {
        if (opens[i].tag === tag) { opens.splice(i, 1); break; }
      }
    } else if (!full.endsWith('/>')) {
      opens.push({ tag });
    }
  }

  let result = html;
  for (let i = opens.length - 1; i >= 0; i--) {
    result += `</${opens[i].tag}>`;
  }
  return result;
}

/**
 * Нормализует PW-структуру <pre><span>line1</span><span>line2</span></pre>
 * в стандартную <pre><code>line1\nline2</code></pre>.
 *
 * Это то же, что делает renderMarkdown для синхронизированных сообщений,
 * поэтому live и sync будут выглядеть идентично.
 */
function normalizeCodeBlocks(html: string): string {
  if (!html || !html.includes('<pre')) return html;

  const doc = document.implementation.createHTMLDocument('');
  const container = doc.createElement('div');
  container.innerHTML = html;

  container.querySelectorAll('pre').forEach((pre) => {
    if (pre.querySelector('code')) return;

    const lines: string[] = [];
    pre.childNodes.forEach((node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (el.tagName === 'SPAN') {
          // Внешний <span> = одна строка, innerHTML сохраняет Prism-токены
          lines.push(el.innerHTML);
        }
      }
    });

    if (lines.length > 0) {
      const code = doc.createElement('code');
      code.innerHTML = lines.join('\n');
      pre.innerHTML = '';
      pre.appendChild(code);
    }
  });

  return container.innerHTML;
}

export const GatewayLiveAssistant: React.FC<Props> = ({ html }) => {
  const safeHtml = useMemo(() => {
    if (!html) return '';
    const balanced = balanceTags(html);
    return normalizeCodeBlocks(balanced);
  }, [html]);

  if (!safeHtml) return null;

  return (
    <div className="ds-message _63c77b1">
      <div className="ds-markdown ds-assistant-message-main-content">
        <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </div>
    </div>
  );
};