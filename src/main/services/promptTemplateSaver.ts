import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { app } from 'electron';
import { PromptTemplate, validatePromptTemplate } from '@/shared/types/promptgenerator';

/**
 * Сохраняет промпт‑шаблон в файл JSON
 * @param template — шаблон для сохранения
 * @param fileName — имя файла (опционально)
 * @returns путь к сохранённому файлу
 */
export async function savePromptTemplateToFile(
  template: PromptTemplate,
  fileName?: string
): Promise<string> {
  try {
    // Валидируем шаблон перед сохранением
    if (!validatePromptTemplate(template)) {
      throw new Error('Невалидный шаблон промпта');
    }

    // Получаем путь к папке для сохранения (в папке приложения)
    const appPath = app.getPath('userData');
    const promptsDir = path.join(appPath, 'prompt-templates');

    // Создаём директорию, если её нет
    await mkdir(promptsDir, { recursive: true });

    // Формируем имя файла
    const safeTitle = template.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const finalFileName = fileName || `${safeTitle}_${template.id.substring(0, 8)}.json`;
    const filePath = path.join(promptsDir, finalFileName);

    // Подготавливаем данные для сохранения
    const saveData = {
      ...template,
      // Гарантируем корректные даты
      createdAt: new Date(template.createdAt).toISOString().split('T')[0],
      updatedAt: new Date(template.updatedAt).toISOString().split('T')[0]
    };

    // Сохраняем в файл
    await writeFile(
      filePath,
      JSON.stringify(saveData, null, 2),
      'utf-8'
    );

    console.log(`Шаблон сохранён: ${filePath}`);
    return filePath;
  } catch (error) {
    console.error('Ошибка сохранения шаблона:', error);
    throw error;
  }
}
