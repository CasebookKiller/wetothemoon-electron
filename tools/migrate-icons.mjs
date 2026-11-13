// tools/migrate-icons.mjs
//
// Миграция <i className="pi pi-..."> → <AppIcon ... /> в Prana-Bindu.
//
//   node tools/migrate-icons.mjs src/components/PRANA_BINDU           # dry run
//   node tools/migrate-icons.mjs src/components/PRANA_BINDU --write   # применить
//
// НЕ добавляет import AppIcon. НЕ трогает icon="..." (PrimeReact-проп).
// Динамические className={...} пропускает.

import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.argv[2] || 'src/components/PRANA_BINDU';
const WRITE = process.argv.includes('--write');

/** Рекурсивный обход папки. Возвращает абсолютные пути ко всем .tsx/.jsx. */
function findFiles(dir, acc = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'build') continue;
      findFiles(full, acc);
    } else if (e.isFile() && /\.(tsx|jsx)$/.test(e.name)) {
      acc.push(full);
    }
  }
  return acc;
}

const files = findFiles(ROOT);
let totalChanges = 0;
let touchedFiles = 0;

/** Возвращает true, если в файле есть import AppIcon. */
function hasAppIconImport(src) {
  return /import\s+AppIcon\s+from\s+['"][^'"]*AppIcon/.test(src)
      || /import\s+\{\s*[^}]*\bAppIcon\b[^}]*\}\s+from/.test(src);
}

for (const file of files) {
  let src = fs.readFileSync(file, 'utf8');
  const orig = src;

  // 1) <i className="pi pi-X" />
  src = src.replace(
    /<i\s+className="pi pi-([a-z0-9-]+)"\s*\/>/g,
    (_, name) => `<AppIcon name="${name}" />`,
  );

  // 2) <i className="pi pi-spin pi-spinner" />
  src = src.replace(
    /<i\s+className="pi pi-spin pi-spinner"\s*\/>/g,
    `<AppIcon name="spinner" spin />`,
  );

  // 3) <i className="pi pi-X" style={{ color: 'var(--pb-accent)' }} />
  src = src.replace(
    /<i\s+className="pi pi-([a-z0-9-]+)"\s+style=\{\{\s*color:\s*['"]var\(--pb-accent\)['"]\s*\}\}\s*\/>/g,
    (_, name) => `<AppIcon name="${name}" color="accent" />`,
  );

  // 4) <i className="pi pi-X" /> Текст  (иконка перед текстом)
  src = src.replace(
    /<i\s+className="pi pi-([a-z0-9-]+)"\s*\/>\s*([^<{\n])/g,
    (_, name, after) => `<AppIcon name="${name}" /> ${after}`,
  );

  // 5) <i className="pi pi-X mr-2" />  или className="pi pi-X text-xs"
  src = src.replace(
    /<i\s+className="pi pi-([a-z0-9-]+)((?:\s+[a-z0-9-]+)+)"\s*\/>/g,
    (_, name, rest) => `<AppIcon name="${name}" className="${rest.trim()}" />`,
  );

  if (src === orig) continue;

  const before = (orig.match(/<AppIcon/g) || []).length;
  const after = (src.match(/<AppIcon/g) || []).length;
  const delta = after - before;

  if (!hasAppIconImport(src)) {
    console.log(`⚠  ${file}: +${delta} AppIcon, НЕТ import AppIcon — TS упадёт`);
  } else {
    console.log(`✓  ${file}: +${delta} AppIcon`);
  }

  totalChanges += delta;
  touchedFiles += 1;

  if (WRITE) fs.writeFileSync(file, src, 'utf8');
}

console.log(
  `\n${WRITE ? 'Применено' : 'Dry-run'}: ${totalChanges} замен в ${touchedFiles} файлах`,
);
if (!WRITE && totalChanges > 0) {
  console.log(`Перезапусти с --write, чтобы применить.`);
}