// tools/add-appicon-import.mjs
//
// Добавляет `import AppIcon from '<relative>';` в файлы, где он
// используется, но не импортирован. Относительный путь считается
// от директории файла до src/components/COMMON/AppIcon/AppIcon.
//
//   node tools/add-appicon-import.mjs           # dry run
//   node tools/add-appicon-import.mjs --write   # применить

import fs from 'node:fs';
import path from 'node:path';

const FILES = [
  'src/components/PRANA_BINDU/DodofoDebugDialog.tsx',
  'src/components/PRANA_BINDU/ExerciseCatalog.tsx',
  'src/components/PRANA_BINDU/ExerciseGraph/DetailPanel.tsx',
  'src/components/PRANA_BINDU/ExerciseGraph/ExerciseGraphDialog.tsx',
  'src/components/PRANA_BINDU/FullWeek.tsx',
  'src/components/PRANA_BINDU/GpsMapView.tsx',
  'src/components/PRANA_BINDU/MirrorDeleteDialog.tsx',
  'src/components/PRANA_BINDU/RunStreamsDrawer.tsx',
  'src/components/PRANA_BINDU/VIEWS/PlanEventView.tsx',
  'src/components/PRANA_BINDU/VIEWS/RunFactView.tsx',
];

const WRITE = process.argv.includes('--write');
const APPICON_ABS = path.resolve('src/components/COMMON/AppIcon/AppIcon');

for (const file of FILES) {
  let src = fs.readFileSync(file, 'utf8');

  if (/import\s+AppIcon\s+from/.test(src)) {
    console.log(`–  ${file}: import уже есть`);
    continue;
  }

  const fileDir = path.dirname(path.resolve(file));
  let rel = path.relative(fileDir, APPICON_ABS).replace(/\\/g, '/');
  if (!rel.startsWith('.')) rel = './' + rel;

  const lines = src.split('\n');

  // Пропускаем шапку (комментарии, shebang) до первого import.
  let i = 0;
  while (
    i < lines.length &&
    (lines[i].trim() === '' ||
      lines[i].trim().startsWith('//') ||
      lines[i].trim().startsWith('/*') ||
      lines[i].trim().startsWith('*'))
  ) i++;

  // Собираем блок import'ов (с учётом многострочных).
  let lastImportEnd = -1;
  while (i < lines.length) {
    if (!/^\s*import\s/.test(lines[i])) break;
    let j = i;
    // Продолжаем, пока не увидим закрывающие `'...';` или `"...";`
    while (j < lines.length && !/['"];?\s*$/.test(lines[j])) j++;
    lastImportEnd = j;
    i = j + 1;
  }

  const insertAt = lastImportEnd >= 0 ? lastImportEnd + 1 : i;
  lines.splice(insertAt, 0, `import AppIcon from '${rel}';`);

  console.log(`✓  ${file}: + '${rel}'`);
  if (WRITE) fs.writeFileSync(file, lines.join('\n'), 'utf8');
}

console.log(`\n${WRITE ? 'Применено' : 'Dry-run (--write, чтобы записать)'}`);