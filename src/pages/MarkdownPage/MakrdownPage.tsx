import React, { FC, useEffect, useState } from 'react';
import { Suspense } from 'react';
// https://remarkjs.github.io/react-markdown/
// https://github.com/remarkjs/remark/blob/main/doc/plugins.md#list-of-plugins
// https://github.com/rehypejs/rehype/blob/main/doc/plugins.md#list-of-plugins
import { MarkdownHooks } from 'react-markdown';

import { unified } from 'unified';

import rehypeRaw from 'rehype-raw';
import rehypeHighlight from 'rehype-highlight';

import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { Prism as SyntaxHighlighter, SyntaxHighlighterProps } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/cjs/styles/prism';
import CodeBlock from '@/components/AI/CodeBlock/CodeBlock';

import 'highlight.js/styles/github-dark.css'; // Темная тема

  const markdown = `
# A demo of \`react-markdown\`

\`react-markdown\` is a markdown component for React.

👉 Changes are re-rendered as you type.

👈 Try writing some markdown on the left.

## Overview

* Follows [CommonMark](https://commonmark.org)
* Optionally follows [GitHub Flavored Markdown](https://github.github.com/gfm/)
* Renders actual React elements instead of using \`dangerouslySetInnerHTML\`
* Lets you define your own components (to render \`MyHeading\` instead of \`'h1'\`)
* Has a lot of plugins

## Contents

Here is an example of a plugin in action
([\`remark-toc\`](https://github.com/remarkjs/remark-toc)).
**This section is replaced by an actual table of contents**.

## Syntax highlighting

Here is an example of a plugin to highlight code:
[\`rehype-starry-night\`](https://github.com/rehypejs/rehype-starry-night).

\`\`\`javascript
import React from 'react'
import ReactDom from 'react-dom'
import {MarkdownHooks} from 'react-markdown'
import rehypeStarryNight from 'rehype-starry-night'

const markdown = \`
# Your markdown here
\`

ReactDom.render(
  <MarkdownHooks rehypePlugins={[rehypeStarryNight]}>{markdown}</MarkdownHooks>,
  document.querySelector('#content')
)
\`\`\`

Pretty neat, eh?

## GitHub flavored markdown (GFM)

For GFM, you can *also* use a plugin:
[\`remark-gfm\`](https://github.com/remarkjs/react-markdown#use).
It adds support for GitHub-specific extensions to the language:
tables, strikethrough, tasklists, and literal URLs.

These features **do not work by default**.
👆 Use the toggle above to add the plugin.

| Feature    | Support              |
| ---------: | :------------------- |
| CommonMark | 100%                 |
| GFM        | 100% w/ \`remark-gfm\` |

~~strikethrough~~

* [ ] task list
* [x] checked item

https://example.com

## HTML in markdown

⚠️ HTML in markdown is quite unsafe, but if you want to support it, you can
use [\`rehype-raw\`](https://github.com/rehypejs/rehype-raw).
You should probably combine it with
[\`rehype-sanitize\`](https://github.com/rehypejs/rehype-sanitize).

<blockquote>
  👆 Use the toggle above to add the plugin.
</blockquote>

## Components

You can pass components to change things:

\`\`\`js
import React from 'react'
import ReactDom from 'react-dom'
import Markdown from 'react-markdown'
import MyFancyRule from './components/my-fancy-rule.js'

const markdown = \`
# Your markdown here
\`

ReactDom.render(
  <Markdown
    components={{
      // Use h2s instead of h1s
      h1: 'h2',
      // Use a component instead of hrs
      hr(props) {
        const {node, ...rest} = props
        return <MyFancyRule {...rest} />
      }
    }}
  >
    {markdown}
  </Markdown>,
  document.querySelector('#content')
)
\`\`\`

## More info?

Much more info is available in the
[readme on GitHub](https://github.com/remarkjs/react-markdown)!

***

A component by [Espen Hovlandsdal](https://espen.codes/)

# Заголовок

Обычный текст Markdown, который не должен быть в \`рамке\`.

\`\`\`javascript
const helloWorld = () => {
  console.log('Hello, World!');
};
\`\`\`

Ещё обычный текст после кода.

\`\`\`python
def hello_world():
    print("Hello, World!")
\`\`\`

# Заголовки
---


# H1
## H2
### H3
#### H4
##### H5
###### H6

Кроме того, H1 и H2 можно обозначить подчеркиванием:

Alt-H1
======

Alt-H2
------


# Выделение
---

Курсив обозначается *звездочками* или _подчеркиванием_.

Полужирный шрифт - двойными **звездочками** или __подчеркиванием__.

Комбинированное выделение **звездочками и _подчеркиванием_**.

Для зачеркнутого текста используются две тильды . ~~Уберите это.~~


# Списки
---

1. Первый пункт нумерованного списка
2. Второй пункт
   * Ненумерованный вложенный список.
1. Сами числа не имеют значения, лишь бы это были цифры
   1. Нумерованный вложенный список
4. И еще один пункт.

   Внутри пунктов списка можно вставить абзацы с таким же отступом. Обратите внимание на пустую строку выше и на пробелы в начале (нужен по меньшей мере один, но здесь мы добавили три, чтобы также выровнять необработанный Markdown).

   Чтобы вставить разрыв строки, но не начинать новый параграф, нужно добавить два пробела перед новой строкой.⋅⋅
   Этот текст начинается с новой строки, но находится в том же абзаце.⋅⋅
   (В некоторых обработчиках, например на Github, пробелы в начале новой строки не нужны.)

* Ненумерованный список можно размечать звездочками
- Или минусами
+ Или плюсами

- Пункт 1
  - Подпункт 1.1
  - Подпункт 1.2
- Пункт 2
  - Подпункт 2.1
    - Подподпункт 2.1.1


# Ссылки
---

[Обычная ссылка в строке](https://www.google.com)

[Обычная ссылка с title](https://www.google.com "Сайт Google")

[Ссылка со сноской][Произвольный регистронезависимый текст]

[Относительная ссылка на документ](../blob/master/LICENSE)

[Для ссылок со сноской можно использовать цифры][1]

Или можно просто вставить ссылку в квадратные скобки [текст ссылки]

Произвольный текст, после которого можно привести ссылки.

[произвольный регистронезависимый текст]: https://www.mozilla.org
[1]: http://slashdot.org
[текст ссылки]: http://www.reddit.com

  `;

// Функция для извлечения языка из className
const getLanguageFromClassName = (className: string | undefined): string => {
  if (!className) return 'text';
  const match = className.match(/language-(\w+)/);
  return match ? match[1] : 'text';
};

async function extractCodeBlocks(markdown: string): Promise<{ language: string; content: string }[]> {
  const file = await unified()
    .use(remarkParse)
    .parse(markdown);

  const codeBlocks: Array<{ language: string; content: string }> = [];
  // Рекурсивная функция для обхода AST
  const traverse = (node: any) => {
    if (node.type === 'code') {
      codeBlocks.push({
        language: node.lang || 'text',
        content: node.value || ''
      });
    }
    if (node.children) {
      node.children.forEach((child: any) => traverse(child));
    }
  };

  traverse(file);
  return codeBlocks;
}

export const MarkdownPage:FC = () => {
  const [extractedCode, setExtractedCode] = useState<Array<{ language: string; content: string }>>([]);

  useEffect(() => {
    const extractCode = async () => {
      try {
        setExtractedCode(await extractCodeBlocks(markdown));
      } catch (error) {
        console.error('Error extracting code blocks:', error);
      }
    };

    extractCode();
  }, [markdown]);

  
  return (
    <div
      className='p-2 markdown'
      >
      <h1>MarkdownPage</h1>
      <Suspense fallback={<div>Загрузка подсветки синтаксиса...</div>}>
      {
        true && 
          <MarkdownHooks
            remarkPlugins={[
              //[remarkToc],
              [remarkRehype],
              [remarkGfm],
            ]}
            rehypePlugins={[
              //[rehypeSanitize],
              [rehypeRaw],
              [rehypeHighlight, {
                ignoreMissing: true,
                // Применяем стили только к блокам кода
                detect: false,
                // Для inline‑кода используем кастомные классы
                code: (className: any, node: any) => {
                  // Проверяем, является ли код inline
                  const parent = node.parent;
                  if (parent && parent.tagName !== 'pre') {
                    return 'inline-code';
                  }
                  return className;
                }
              }]
            ]}
            components={{
              table: ({ node, ...props }) => (
                <table className="markdown-table" {...props} />
              ),
              thead: ({ node, ...props }) => <thead {...props} />,
              tbody: ({ node, ...props }) => <tbody {...props} />,
              tr: ({ node, ...props }) => <tr {...props} />,
              th: ({ align, children, ...props }) => {
                const alignment = align ? `text-align-${align}` : '';
                return <th className={alignment} {...props}>{children}</th>;
              },
              td: ({ align, children, ...props }) => {
                const alignment = align ? `text-align-${align}` : '';
                return <td className={alignment} {...props}>{children}</td>;
              },
              h1: 'h2',
              h2: 'h3',
              h3: 'h4',
              h4: 'h5',
              h5: 'h6',
              
              code: ({ node, className, children, ...props }) => {
                const language = getLanguageFromClassName(className);
                // Находим соответствующий блок кода по языку и содержимому
                const codeBlock = extractedCode.find(block =>
                  block.language === language
                );
                console.log('node', node);
                console.log('className', className);
                console.log('children', children);
                console.log('props', props);

                // Если это inline-код (в одной строке), отображаем без рамки
                if (node?.data?.meta || String(children).includes('\n')) {
                  return (
                    <CodeBlock
                      language={language}
                      className={className}
                      codeString={codeBlock?.content || String(children)}
                    >
                      {children}
                    </CodeBlock>
                  );
                }

                // Inline-код — просто оборачиваем в <code>
                return <code className={className} {...props}>{children}</code>;
              }
            }}
          >
            {markdown}
          </MarkdownHooks>

      }

      </Suspense>

    </div>
  );
};