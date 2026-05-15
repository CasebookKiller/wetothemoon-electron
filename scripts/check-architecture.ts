/**
 * Архитектурный анализатор проекта Electron.
 * Проверяет:
 * - Запрещённые межслойные импорты (main ↔ renderer, preload → renderer/main)
 * - Циклические зависимости
 * - Неиспользуемые файлы (опционально)
 * - Целостность слоёв (shared не должен зависеть от main/renderer)
 */

import { Project, SourceFile, SyntaxKind } from "ts-morph";
import * as path from "path";
import { existsSync } from "fs";

// ========== КОНФИГУРАЦИЯ ==========
const PROJECT_ROOT = path.resolve(__dirname, ".."); // теперь __dirname доступен
const SRC_DIR = path.join(PROJECT_ROOT, "src");

// Слои и их допустимые зависимости (ключ → массив разрешённых слоёв)
const LAYERS: Record<string, string[]> = {
  main: ["shared"],        // main может импортировать только shared и сам себя
  renderer: ["shared"],    // renderer может импортировать только shared и сам себя
  preload: ["shared"],     // preload только shared
  shared: [],              // shared ни от кого не зависит
};

// Папки, которые принадлежат слоям (можно определить по имени или расположению)
function detectLayer(filePath: string): string | null {
  const relative = path.relative(SRC_DIR, filePath).replace(/\\/g, "/");
  if (relative.startsWith("main/")) return "main";
  if (relative.startsWith("renderer/")) return "renderer";
  if (relative === "preload.ts" || relative.startsWith("preload")) return "preload";
  if (relative.startsWith("shared/")) return "shared";
  // файлы в корне src — нейтральные, не проверяем строго
  return null;
}

// Определяет слой файла-импорта (куда ведёт импорт)
function resolveTargetLayer(importPath: string, currentFile: SourceFile): string | null {
  // Пропускаем импорты из node_modules и глобальные
  if (!importPath.startsWith(".") && !importPath.startsWith("/") && !importPath.startsWith("@/")) {
    return null;
  }
  // Разрешаем путь относительно текущего файла
  const currentDir = path.dirname(currentFile.getFilePath());
  let resolvedPath = path.resolve(currentDir, importPath);
  // Пробуем добавить расширения
  const extensions = [".ts", ".tsx", "/index.ts", "/index.tsx"];
  let found = false;
  for (const ext of extensions) {
    if (existsSync(resolvedPath + ext)) {
      resolvedPath += ext;
      found = true;
      break;
    }
    // Попробовать как папку с index
    if (require("fs").existsSync(resolvedPath + "/index.ts")) {
      resolvedPath += "/index.ts";
      found = true;
      break;
    }
  }
  if (!found) return null; // не смогли разрешить — пропускаем
  return detectLayer(resolvedPath);
}

// ========== СБОР ГРАФА ==========
const project = new Project({
  tsConfigFilePath: path.join(PROJECT_ROOT, "tsconfig.json"),
});

const sourceFiles = project.getSourceFiles().filter(f =>
  f.getFilePath().startsWith(SRC_DIR) && !f.getFilePath().includes("node_modules")
);

const dependencies = new Map<string, Set<string>>(); // filePath -> set of imported filePaths

for (const file of sourceFiles) {
  const filePath = file.getFilePath();
  if (!dependencies.has(filePath)) dependencies.set(filePath, new Set());

  const imports = file.getImportDeclarations();
  for (const imp of imports) {
    const moduleSpecifier = imp.getModuleSpecifierValue();
    const targetLayer = resolveTargetLayer(moduleSpecifier, file);
    if (targetLayer) {
      // Нам нужно абсолютное значение для графа, но достаточно слоя для проверки правил
      // Для проверки циклов нужен реальный файл
      // Попробуем разрешить реальный файл и добавить в граф
      const currentDir = path.dirname(filePath);
      let resolved = path.resolve(currentDir, moduleSpecifier);
      for (const ext of [".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        if (existsSync(resolved + ext)) {
          resolved += ext;
          break;
        }
      }
      dependencies.get(filePath)!.add(resolved);
    }
  }
}

// ========== ПРОВЕРКИ ==========
console.log("🔍 Анализ архитектуры проекта...\n");

// 1. Запрещённые межслойные импорты
let layerViolations = 0;
for (const file of sourceFiles) {
  const filePath = file.getFilePath();
  const layer = detectLayer(filePath);
  if (!layer || !LAYERS[layer]) continue;

  const allowedTargets = LAYERS[layer];
  const fileDeps = dependencies.get(filePath);
  if (!fileDeps) continue;

  for (const depPath of fileDeps) {
    const depLayer = detectLayer(depPath);
    if (!depLayer) continue;
    // Сам себе слой разрешён
    if (depLayer === layer) continue;
    if (!allowedTargets.includes(depLayer)) {
      console.error(
        `❌ Запрещённый импорт: ${path.relative(PROJECT_ROOT, filePath)} (${layer}) → ${path.relative(PROJECT_ROOT, depPath)} (${depLayer})`
      );
      layerViolations++;
    }
  }
}

if (layerViolations === 0) {
  console.log("✅ Межслойные импорты в порядке");
}

// 2. Поиск циклических зависимостей (простой DFS)
console.log("\n🔁 Проверка циклов...");
const visited = new Set<string>();
const recursionStack = new Set<string>();
let cycleFound = false;

function hasCycle(node: string): boolean {
  if (!visited.has(node)) {
    visited.add(node);
    recursionStack.add(node);
    const neighbors = dependencies.get(node);
    if (neighbors) {
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor) && hasCycle(neighbor)) {
          return true;
        } else if (recursionStack.has(neighbor)) {
          console.error(`⚠️  Обнаружен цикл: ${path.relative(PROJECT_ROOT, node)} ↔ ${path.relative(PROJECT_ROOT, neighbor)}`);
          cycleFound = true;
          return true;
        }
      }
    }
  }
  recursionStack.delete(node);
  return false;
}

for (const filePath of dependencies.keys()) {
  if (!visited.has(filePath)) {
    hasCycle(filePath);
  }
}

if (!cycleFound) {
  console.log("✅ Циклические зависимости не обнаружены");
}

// 3. Неиспользуемые файлы (опционально, проверяем, импортирует ли кто-то файл)
console.log("\n📄 Поиск потенциально неиспользуемых файлов...");
const allImportTargets = new Set<string>();
for (const [, targets] of dependencies) {
  for (const t of targets) {
    allImportTargets.add(t);
  }
}
const unusedFiles: string[] = [];
// Считаем точками входа файлы, не импортированные никем, но не считаем index.ts и main-процессы
const entryPoints = [
  path.join(SRC_DIR, "main/index.ts"),
  path.join(SRC_DIR, "preload.ts"),
  path.join(SRC_DIR, "renderer/windows/main/index.tsx"),
  path.join(SRC_DIR, "renderer/windows/ai/index.tsx"),
  // добавьте другие точки входа при необходимости
];
for (const file of sourceFiles) {
  const fp = file.getFilePath();
  if (allImportTargets.has(fp)) continue;
  if (entryPoints.includes(fp)) continue;
  // Не считаем неиспользуемыми файлы в корне src (например, index.tsx)
  if (path.relative(SRC_DIR, fp).split(path.sep).length === 1) continue;
  unusedFiles.push(fp);
}

if (unusedFiles.length > 0) {
  console.warn("⚠️  Возможные неиспользуемые файлы (не импортируются никем):");
  unusedFiles.forEach(f => console.warn("   - " + path.relative(PROJECT_ROOT, f)));
} else {
  console.log("✅ Все файлы либо импортируются, либо являются точками входа");
}

console.log("\n🏁 Проверка завершена.");
if (layerViolations > 0 || cycleFound) {
  console.error("Обнаружены проблемы, см. выше.");
  process.exit(1);
} else {
  console.log("Архитектура в норме.");
  process.exit(0);
}