import { ModelSettings } from '@/shared/types/chat';
import React from 'react';
import { NumberSetting } from '../NumberSetting/NumberSetting';
import { RangeSetting } from '../RangeSetting/RangeSetting';
import { TextSetting } from '../TextSetting/TextSetting';
import { Divider } from 'primereact/divider';
import { SelectButton, SelectButtonChangeEvent } from 'primereact/selectbutton';
import { set } from 'react-hook-form';

interface ModelSettingsPanelProps {
  settings: ModelSettings;
  onSettingsChange: (newSettings: Partial<ModelSettings>) => void;
  extended: boolean; // добавляем пропс
}

export const ModelSettingsPanel: React.FC<ModelSettingsPanelProps> = ({
  settings,
  onSettingsChange
}) => {
  const options: string[] = ['Выкл', 'Вкл'];
  const [extended, setExtended] = React.useState(settings.extended ? 'Вкл' : 'Выкл');

  const handleChange = (key: string, value: any) => {
    onSettingsChange({ [key]: value });
  };

  return (
    <div className="flex flex-column gap-3 mb-4">
      {/* Выбор модели */}
      <div>
        <label className="block text-700 font-medium mb-2">Модель</label>
        <select
          value={settings.model}
          onChange={(e) => handleChange('model', e.target.value)}
          className="w-full p-2 border-round border-1 surface-border"
        >
          <option value="t-tech/T-lite-it-2.1:q4_K_M">T-lite 2.1 (q4_K_M)</option>
          <option value="llama3.2:8b">Llama 3.2 (8B)</option>
          <option value="mistral:7b">Mistral (7B)</option>
          <option value="qwen3:4b">Qwen 3 (4B)</option>
          <option value="phi3:medium">Phi-3 (Medium)</option>
          <option value="gemma2:9b">Gemma 2 (9B)</option>
        </select>
      </div>

      {/* Температура */}
      <RangeSetting
        label="Температура"
        value={settings.temperature}
        min={0}
        max={2}
        step={0.05}
        onChange={(v) => handleChange('temperature', v)}
        description="0 = детерминированный, 2 = очень креативный"
      />

      {/* Макс. токенов */}
      <NumberSetting
        label="Макс. токенов"
        value={settings.maxTokens}
        min={100}
        max={40960}
        onChange={(v) => handleChange('maxTokens', v)}
        description="Для Qwen3 доступно до 40 960 токенов"
      />
      <Divider />
      <div>
        <label className="block text-700 text-base font-semibold mb-2">Расширенные настройки</label>
        <div className={`card flex justify-content-center mt-4 ${extended === 'Вкл' ? '': 'p-selectbutton-off'}`}>
          <SelectButton
            value={extended}
            onChange={(e: SelectButtonChangeEvent) => {
              setExtended(e.value);
              handleChange('extended', e.value === 'Вкл');
            }}
            options={options}
          />
        </div>
      </div>
      {/* Top P */}
      <RangeSetting
        label="Top P"
        value={settings.topP || 0.9}
        min={0}
        max={1}
        step={0.05}
        onChange={(v) => handleChange('topP', v)}
        description="Ядерная выборка — баланс между разнообразием и качеством"
        disabled={extended === 'Выкл'}
      />

      {/* Частота штрафа */}
      <RangeSetting
        label="Частота штрафа"
        value={settings.frequencyPenalty || 0}
        min={-2}
        max={2}
        step={0.1}
        onChange={(v) => handleChange('frequencyPenalty', v)}
        description="Штраф за повторение слов (-2 до 2)"
        disabled={extended === 'Выкл'}
      />

      {/* Присутствие штрафа */}
      <RangeSetting
        label="Присутствие штрафа"
        value={settings.presencePenalty || 0}
        min={-2}
        max={2}
        step={0.1}
        onChange={(v) => handleChange('presencePenalty', v)}
        description="Штраф за повторение тем (-2 до 2)"
        disabled={extended === 'Выкл'}
      />

      {/* Топ K */}
      <NumberSetting
        label="Топ K"
        value={settings.topK || 40}
        min={1}
        max={100}
        onChange={(v) => handleChange('topK', v)}
        description="Количество токенов для выборки (1–100)"
        disabled={extended === 'Выкл'}
      />

      {/* Длина контекста */}
      <NumberSetting
        label="Длина контекста"
        value={settings.contextLength || 40000}
        min={512}
        max={40000} // Максимальная для qwen3 длина 40960, но ограничиваем 40000
        onChange={(v) => handleChange('contextLength', v)}
        description="Максимальный контекст для модели"
        disabled={extended === 'Выкл'}
      />

      {/* Stop sequences */}
      <TextSetting
        label="Stop sequences"
        value={settings.stopSequences?.join(', ') || ''}
        placeholder="Введите через запятую: ###, END"
        onChange={(v) => {
          const sequences = v.split(',').map(s => s.trim()).filter(s => s);
          handleChange('stopSequences', sequences);
        }}
        description="Последовательности, останавливающие генерацию"
        disabled={extended === 'Выкл'}
      />

      <Divider />
    </div>
  );
};
