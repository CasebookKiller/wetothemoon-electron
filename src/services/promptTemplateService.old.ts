// старая версия, после завершения работы над новой версией - удалить
import { PromptTemplate, GeneratedPrompt } from '../types/prompt';

export class PromptTemplateService {
  private templates: PromptTemplate[] = [];

  // Шаблон по умолчанию
  private defaultTemplate: PromptTemplate = {
    name: 'Fullstack Developer (Node.js/Electron)',
    model: 'mistral',
    sections: [
      {
        id: 'role',
        title: 'Роль',
        content: 'Ты — опытный fullstack-разработчик на Node.js, Electron.js, Vite, TypeScript.',
        enabled: true
      },
      {
        id: 'task',
        title: 'Задача',
        content: 'Твоя задача — помочь с реализацией, отладкой или оптимизацией кода для десктопного приложения.',
        enabled: true
      },
      {
        id: 'context',
        title: 'Контекст проекта',
        content: `
- Используемые технологии: Node.js, Electron.js, Vite, TypeScript.
- Для работы с LLM используется Ollama.
- Серверная часть: Express, база данных — Supabase/PostgreSQL.
- Требуется поддержка типизации и современных стандартов ESM.`,
        enabled: true
      },
      {
        id: 'expectations',
        title: 'Ожидаемый результат',
        content: `
- Чистый, типизированный TypeScript-код.
- Краткое объяснение логики и особенностей реализации.
- Указание на возможные ошибки или подводные камни.
- Пример использования (если применимо).`,
        enabled: true
      },
      {
        id: 'requirements',
        title: 'Дополнительные требования',
        content: `
- Код должен быть совместим с Electron (учитывать main/renderer-процесс).
- Используй только стандартные библиотеки и указанные инструменты.
- Не добавляй лишних зависимостей без объяснения.`,
        enabled: true
      }
    ]
  };

  constructor() {
    this.templates.push(this.defaultTemplate);
  }

  getTemplates(): PromptTemplate[] {
    return this.templates;
  }

  generatePrompt(template: PromptTemplate): GeneratedPrompt {
    const selectedSections = template.sections.filter(section => section.enabled);
    const fullPrompt = selectedSections
      .map(section => `${section.title}:\n${section.content}\n`)
      .join('\n');

    return {
      fullPrompt: fullPrompt.trim(),
      selectedSections
    };
  }

  updateSectionContent(templateName: string, sectionId: string, content: string): void {
    const template = this.templates.find(t => t.name === templateName);
    if (template) {
      const section = template.sections.find(s => s.id === sectionId);
      if (section) {
        section.content = content;
      }
    }
  }

  toggleSection(templateName: string, sectionId: string, enabled: boolean): void {
    const template = this.templates.find(t => t.name === templateName);
    if (template) {
      const section = template.sections.find(s => s.id === sectionId);
      if (section) {
        section.enabled = enabled;
      }
    }
  }
}
