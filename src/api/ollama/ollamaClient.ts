export interface OllamaRequest {
  model: string;
  prompt: string;
  stream?: boolean;
  context?: number[];
  options?: {
    num_predict?: number;
    temperature?: number;
    top_k?: number;
    top_p?: number;
    repeat_penalty?: number;
    seed?: number;
    stop?: string[];
  };
  raw?: boolean;
  system?: string;
}

export interface StructuredResponse {
  [key: string]: any;
}

export interface OllamaBaseResponse {
  response: string;
  done: boolean;
}

export interface OllamaResponse extends OllamaBaseResponse {
  context?: number[];
}

export interface StreamOllamaResponse extends OllamaBaseResponse {
  context?: number[];
}

export class OllamaClient {
  private readonly defaultModel = 't-tech/T-lite-it-2.1:q4_K_M';
  private baseUrl: string;

  constructor(
    baseUrl: string = 'http://localhost:11434',
    private logger?: (message: string) => void
  ) {
    this.baseUrl = baseUrl;
  }

  private async processStream(
    request: OllamaRequest,
    onChunk?: (chunk: string) => void,
    onDone?: () => void
  ): Promise<{ response: string; context?: number[] | undefined }> {
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    let fullResponse = '';
    let finalContext: number[] | undefined;
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data: StreamOllamaResponse = JSON.parse(line);
            fullResponse += data.response;

            if (data.context) {
              finalContext = data.context;
            }

            if (onChunk) {
              onChunk(data.response);
            }

            if (data.done && onDone) {
              onDone();
            }
          } catch (error) {
            console.warn('Failed to parse stream chunk:', error);
          }
        }
      }
    }

    return { response: fullResponse, context: finalContext };
  }

  private async callOllama(
    request: OllamaRequest,
    onStreamChunk?: (chunk: string) => void,
    onStreamDone?: () => void
  ): Promise<OllamaResponse> {
    if (request.stream) {
      const result = await this.processStream(request, onStreamChunk, onStreamDone);
      return {
        response: result.response,
        done: true,
        context: result.context
      };
    }

    // Обычная логика для не-стриминга
    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    return await response.json();
  }

  private async callOllamaWithRetry(request: OllamaRequest, maxRetries = 3): Promise<OllamaResponse> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.callOllama(request);
      } catch (error: any) {
        if (attempt === maxRetries) throw error;
        if (error.message.includes('network') || error.message.includes('timeout')) {
          await new Promise(resolve => setTimeout(resolve, attempt * 1000));
          continue;
        }
        throw error;
      }
    }
    throw new Error('Unreachable');
  }

  // 1. Простой запрос без context и истории
  async simpleRequest(
    prompt: string,
    model: string = this.defaultModel,
    options?: OllamaRequest['options'],
    useStream: boolean = false,
    onChunk?: (chunk: string) => void,
    onDone?: () => void
  ): Promise<string> {
    if (useStream) {
      return this.streamRequest(prompt, model, options, onChunk, onDone);
    }

    const request: OllamaRequest = {
      model,
      prompt,
      stream: false,
      options
    };

    // реализовать в остальных методах
    this.logger?.(`${useStream?'Stream':'Simple'} request to ${this.baseUrl}: ${JSON.stringify(request)}`);

    const response = await this.callOllama(request);
    return response.response;
  }

  async streamRequest(
    prompt: string,
    model: string = this.defaultModel,
    options?: OllamaRequest['options'],
    onChunk?: (chunk: string) => void,
    onDone?: () => void
  ): Promise<string> {
    const request: OllamaRequest = {
      model,
      prompt,
      stream: true,
      options
    };

    const result = await this.processStream(request, onChunk, onDone);
    return result.response;
  }

  async simpleJsonRequest(
    prompt: string,
    jsonSchema: object,
    model: string = this.defaultModel
  ): Promise<StructuredResponse> {
    const jsonPrompt = this.buildJsonPrompt(prompt, jsonSchema);
    const result = await this.simpleRequest(jsonPrompt, model);
    return this.parseJsonResponse(result);
  }

  // 2. Запрос с передачей context
  async contextRequest(
    prompt: string,
    context: number[] | undefined,
    model: string = this.defaultModel,
    options?: OllamaRequest['options'],
    useStream: boolean = false,
    onChunk?: (chunk: string) => void,
    onDone?: () => void
  ): Promise<{ response: string; newContext: number[] | undefined }> {
    if (useStream) {
      return this.contextStreamRequest(prompt, context, model, options, onChunk, onDone);
    }

    const request: OllamaRequest = {
      model,
      prompt,
      context,
      stream: false,
      options
    };

    const response = await this.callOllama(request);

    return {
      response: response.response,
      newContext: response.context
    };
  }

  async contextStreamRequest(
    prompt: string,
    context: number[] | undefined,
    model: string = this.defaultModel,
    options?: OllamaRequest['options'],
    onChunk?: (chunk: string) => void,
    onDone?: () => void
  ): Promise<{ response: string; newContext: number[] | undefined }> {
    const request: OllamaRequest = {
      model,
      prompt,
      stream: true,
      options
    };
    const result = await this.processStream(request, onChunk, onDone);
    return {
      response: result.response,
      newContext: result.context
    };
  }

  async contextJsonRequest(
    prompt: string,
    context: number[] | undefined,
    jsonSchema: object,
    model: string = this.defaultModel
  ): Promise<{ response: StructuredResponse; newContext: number[] | undefined }> {
    const jsonPrompt = this.buildJsonPrompt(prompt, jsonSchema);
    const result = await this.contextRequest(jsonPrompt, context, model);

    return {
      response: this.parseJsonResponse(result.response),
      newContext: result.newContext
    };
  }

  // 3. Запрос с историей диалога
  async historyRequest(
    prompt: string,
    history: Array<{ role: 'user' | 'assistant' | 'error'; content: string }>,
    model: string = this.defaultModel,
    options?: OllamaRequest['options'],
    systemPrompt?: string,
    useStream: boolean = false,
    onChunk?: (chunk: string) => void,
    onDone?: () => void
  ): Promise<string> {
    const fullPrompt = this.buildHistoryPrompt(prompt, history, systemPrompt);

    if (useStream) {
      return this.historyStreamRequest(
        prompt,
        history,
        model,
        options,
        systemPrompt,
        onChunk,
        onDone
      );
    }

    const request: OllamaRequest = {
      model,
      prompt: fullPrompt,
      stream: false,
      options,
      system: systemPrompt
    };

    const response = await this.callOllama(request);
    return response.response;
  }


  async historyStreamRequest(
    prompt: string,
    history: Array<{ role: 'user' | 'assistant' | 'error'; content: string }>,
    model: string = this.defaultModel,
    options?: OllamaRequest['options'],
    systemPrompt?: string,
    onChunk?: (chunk: string) => void,
    onDone?: () => void
  ): Promise<string> {
    const fullPrompt = this.buildHistoryPrompt(prompt, history, systemPrompt);

    const request: OllamaRequest = {
      model,
      prompt: fullPrompt,
      stream: true,
      options,
      system: systemPrompt
    };

    const response = await fetch(`${this.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.status} ${response.statusText}`);
    }

    let fullResponse = '';
    const reader = response.body?.getReader();
    const decoder = new TextDecoder();

    if (!reader) {
      throw new Error('Response body is not readable');
    }

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');

      for (const line of lines) {
        if (line.trim()) {
          try {
            const data: StreamOllamaResponse = JSON.parse(line);
            fullResponse += data.response;

            if (onChunk) {
              onChunk(data.response);
            }

            if (data.done && onDone) {
              onDone();
            }
          } catch (error) {
            console.warn('Failed to parse stream chunk:', error);
          }
        }
      }
    }

    return fullResponse;
  }


  async historyJsonRequest(
    prompt: string,
    history: Array<{ role: 'user' | 'assistant'; content: string }>,
    jsonSchema: object,
    model: string = this.defaultModel,
    systemPrompt?: string
  ): Promise<StructuredResponse> {
    const fullPrompt = this.buildHistoryPrompt(prompt, history, systemPrompt);
    const jsonPrompt = this.buildJsonPrompt(fullPrompt, jsonSchema);

    const result = await this.simpleRequest(jsonPrompt, model);
    return this.parseJsonResponse(result);
  }

  // 4. Запрос с инструментами (tools)
  async toolsRequest(
    prompt: string,
    tools: Array<{
      name: string;
      description: string;
      parameters: object;
    }>,
    model: string = this.defaultModel,
    options?: OllamaRequest['options']
  ): Promise<{
    response: string;
    toolCalls: Array<{ toolName: string; arguments: object }> | null;
  }> {
    const toolsPrompt = this.buildToolsPrompt(prompt, tools);

    const request: OllamaRequest = {
      model,
      prompt: toolsPrompt,
      stream: false,
      options
    };

    const response = await this.callOllama(request);

    try {
      const parsed = JSON.parse(response.response);
      if (parsed.tool_calls && Array.isArray(parsed.tool_calls)) {
        return {
          response: parsed.answer || '',
          toolCalls: parsed.tool_calls.map((call: any) => ({
            toolName: call.tool_name,
            arguments: call.arguments
          }))
        };
      }
      return { response: response.response, toolCalls: null };
    } catch {
      return { response: response.response, toolCalls: null };
    }
  }

  async toolsJsonRequest(
    prompt: string,
    tools: Array<{
      name: string;
      description: string;
      parameters: object;
    }>,
    jsonSchema: object,
    model: string = this.defaultModel
  ): Promise<StructuredResponse> {
    const toolsPrompt = this.buildToolsPrompt(prompt, tools);
    const jsonPrompt = this.buildJsonPrompt(toolsPrompt, jsonSchema);

    const result = await this.simpleRequest(jsonPrompt, model);
    return this.parseJsonResponse(result);
  }

  // Вспомогательные методы
  private buildJsonPrompt(prompt: string, schema: object): string {
    const maxPromptLength = 4000; // Ограничение для Ollama
    const truncatedPrompt = prompt.length > maxPromptLength
    ? prompt.substring(0, maxPromptLength - 3) + '...'
    : prompt;
    return `Ответь строго в формате валидного JSON по следующей схеме:\n${JSON.stringify(schema, null, 2)}\n\nПравила:\n- Все строки в двойных кавычках\n- Никаких комментариев вне JSON\n- Верни ТОЛЬКО JSON без дополнительного текста\n\nЗапрос пользователя: "${truncatedPrompt}"\n\nJSON ответ:`;
  }

  private parseJsonResponse(response: string): StructuredResponse {
    try {
      return JSON.parse(response);
    } catch (e) {
      // Ищем JSON между первыми { и последним }
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          return JSON.parse(jsonMatch[0]);
        } catch {}
      }

      // Если есть ```json, извлекаем содержимое
      const codeBlockMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
      if (codeBlockMatch) {
        try {
          return JSON.parse(codeBlockMatch[1]);
        } catch {}
      }

      throw new Error(`Не удалось распарсить JSON: ${response}`);
    }
  }


  private buildHistoryPrompt(
    currentPrompt: string,
    history: Array<{ role: 'user' | 'assistant' | 'error'; content: string }>,
    systemPrompt?: string
  ): string {
    let prompt = '';

    if (systemPrompt) {
      prompt += `Системный промт: ${systemPrompt}\n\n`;
    }

    prompt += 'История диалога:\n';
    history.forEach(msg => {
      prompt += `${msg.role.toUpperCase()}: ${msg.content}\n`;
    });

    prompt += `\nТекущий запрос пользователя: ${currentPrompt}`;
    return prompt;
  }

  private buildToolsPrompt(
    prompt: string,
    tools: Array<{ name: string; description: string; parameters: object }>
  ): string {
    const toolsDescription = tools.map(tool =>
      `Инструмент: ${tool.name}
Описание: ${tool.description}
Параметры: ${JSON.stringify(tool.parameters)}
`
    ).join('\n');

    return `Ты — умный ассистент с доступом к инструментам.

Доступные инструменты:
${toolsDescription}

Правила использования инструментов:
1. Если для ответа нужен инструмент, верни JSON с полями:
   - "tool_calls": массив вызовов инструментов
   - "arguments": параметры для вызова
2. Если инструмент не нужен, верни обычный текст ответа
3. Верни ТОЛЬКО JSON или текст, без дополнительных комментариев

История диалога и текущий запрос:
${prompt}

Ответ:`;
  }
}

// Пример использования класса
export async function exampleOllamaUsage() {
  const client = new OllamaClient();

  (async function (on: boolean) {
    // 1. Простой запрос
    if (!on) return;
  
    console.log('=== ПРОСТОЙ ЗАПРОС ===');
    const simpleResponse = await client.simpleRequest('Привет!');//'Расскажи о TypeScript');
    console.log(simpleResponse);
  })(false);

  (async function (on: boolean) {
    // 2. Запрос с context
    if (!on) return;
    console.log('\n=== ЗАПРОС С CONTEXT ===');
    let context: number[] | undefined;
    const contextResult1 = await client.contextRequest(
      'Привет! Расскажи о JavaScript',
      context
    );
    console.log('Ответ 1:', contextResult1.response);
    context = contextResult1.newContext;

    const contextResult2 = await client.contextRequest(
      'А чем он отличается от TypeScript?',
      context
    );
    console.log('Ответ 2:', contextResult2.response);
  })(false);

  (async function (on: boolean) {
    // 3. Пример использования стриминга
    if (!on) return;
    console.log('\n=== СТРИМИНГОВЫЙ ЗАПРОС ===');
    const streamResponse = await client.streamRequest(
      'Расскажи подробно о принципах работы нейросетей',
      undefined,
      { temperature: 0.7 },
      (chunk) => {
        console.log(chunk); // Показываем текст по мере поступления
      },
      () => {
        console.log('\n\n--- Стриминг завершён ---');
      }
    );
    console.log('\nПолный ответ:', streamResponse);
  })(false);

  (async function (on: boolean) {
    if (!on) return;
    // 4. Запрос с историей диалога
    console.log('\n=== ЗАПРОС С ИСТОРИЕЙ ===');
    const history: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: 'Привет! Расскажи о программировании' },
      { role: 'assistant', content: 'Программирование — это...' }
    ];
    const historyResponse = await client.historyRequest(
      'А что такое TypeScript?',
      history
    );
    console.log(historyResponse);
  })(false);

  (async function (on: boolean) {
    // 5.Пример использования historyStreamRequest
    if (!on) return;
    console.log('\n=== СТРИМИНГОВЫЙ ЗАПРОС С ИСТОРИЕЙ ===');
    const historyStream: Array<{ role: 'user' | 'assistant'; content: string }> = [
      { role: 'user', content: 'Привет! Расскажи о программировании' },
      { role: 'assistant', content: 'Программирование — это процесс создания инструкций для компьютера...' }
    ];

    const streamHistoryResponse = await client.historyStreamRequest(
      'А что такое TypeScript?',
      historyStream,
      undefined,
      { temperature: 0.7 },
      'Отвечай кратко и понятно',
      (chunk) => {
        console.log(chunk); // Показываем текст по мере поступления
      },
      () => {
        console.log('\n\n--- Стриминг с историей завершён ---');
      }
    );
    console.log('\nПолный ответ с историей:', streamHistoryResponse);  
  })(true);
  
  (async function (on: boolean) {
    // 6. Запрос с инструментами
    if (!on) return;
    console.log('\n=== ЗАПРОС С ИНСТРУМЕНТАМИ ===');
    const tools = [
      {
        name: 'get_weather',
        description: 'Получить погоду в указанном городе',
        parameters: {
          city: { type: 'string', description: 'Название города' }
        }
      }
    ];
    const toolsResult = await client.toolsRequest(
      'Какая погода в Москве?',
      tools
    );
    console.log('Ответ:', toolsResult.response);
    console.log('Вызовы инструментов:', toolsResult.toolCalls);
  })(true);

  (async function (on: boolean) {
    // JSON-запросы
    if (!on) return;
  
    console.log('\n=== JSON-ЗАПРОСЫ ===');
    const jsonSchema = {
      type: 'object',
      properties: {
        reasoning: { type: 'string' },
        answer: { type: 'string' },
        use_tool: { anyOf: [{ type: 'string' }, { type: 'null' }] }
      },
      required: ['reasoning', 'answer', 'use_tool']
    };

    const jsonResponse = await client.simpleJsonRequest(
      'Умножь 15 на 8',
      jsonSchema
    );
    console.log('JSON ответ:', jsonResponse);
  })(false);  
}


// Запуск примера
//exampleOllamaUsage().catch(console.error);

/*
Ключевые особенности реализации
1. Простота использования
Каждый метод класса решает конкретную задачу и имеет понятный интерфейс.

2. Обработка JSON
buildJsonPrompt() — формирует промт с чёткими инструкциями по возврату JSON.

parseJsonResponse() — пытается распарсить JSON напрямую, а если не получается — ищет JSON внутри текста.

3. Гибкость конфигурации
Все методы принимают параметр model (по умолчанию — t-lite2.1).

Можно передавать дополнительные опции через options.

Для запросов с историей есть параметр systemPrompt.

4. Обработка ошибок
В callOllama() проверяется статус HTTP‑ответа.

В parseJsonResponse() есть обработка ошибок парсинга JSON.

5. Поддержка разных сценариев
Класс покрывает все запрошенные сценарии:

простые запросы;

запросы с context;

запросы с историей диалога;

запросы с инструментами (tools);

все варианты с возвратом в формате JSON.

Рекомендации по использованию
Для простых запросов используйте simpleRequest() или simpleJsonRequest().

Для диалогов с сохранением контекста — contextRequest() и contextJsonRequest().

Если нужно отобразить полную историю в UI — historyRequest() и historyJsonRequest().

Для расширенных возможностей с вызовом внешних инструментов — toolsRequest() и toolsJsonRequest().

При проблемах с JSON проверьте промт — возможно, модель не понимает формат. Добавьте примеры в промт.

Контролируйте длину истории в historyRequest() — длинные диалоги могут превышать лимит токенов модели.

Используйте temperature: 0.1–0.3 для более предсказуемых JSON‑ответов.

Хотите, я уточню какой‑то аспект реализации или помогу адаптировать код под ваши конкретные требования?

*/