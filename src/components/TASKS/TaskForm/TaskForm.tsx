import React, { useState, useEffect } from 'react';
import { Button } from 'primereact/button';
import { InputText } from 'primereact/inputtext';
import { InputTextarea } from 'primereact/inputtextarea';
import { Dropdown } from 'primereact/dropdown';
import { Checkbox } from 'primereact/checkbox';
import { Task, ActionType, ScheduleType, TaskActionPayload } from '@/shared/types/task';
import { v4 as uuidv4 } from 'uuid'; // предполагается, что uuid доступен в рендерере
import { classNames } from '@/css/classnames';

interface TaskFormProps {
  task?: Task;
  onSave: (task: Task | Omit<Task, 'id'>) => void;  // <-- теперь допускается отсутствие id
  onCancel: () => void;
}

const scheduleOptions = [
  { label: 'Однократно', value: 'once' },
  { label: 'Интервал (мс)', value: 'interval' },
  { label: 'Cron-выражение', value: 'cron' },
];

const actionOptions = [
  { label: 'Уведомление', value: 'reminder' },
  { label: 'Команда в UI', value: 'react-command' },
  { label: 'Функция в main', value: 'main-function' },
  { label: 'Скрипт', value: 'script' },
  { label: 'Задача в Яндекс.Трекере', value: 'yandex-tracker' },
];

export const TaskForm: React.FC<TaskFormProps> = ({ task, onSave, onCancel }) => {
  const [name, setName] = useState(task?.name || '');
  const [enabled, setEnabled] = useState(task?.enabled ?? true);
  const [scheduleType, setScheduleType] = useState<ScheduleType>(task?.schedule.type || 'once');
  const [scheduleValue, setScheduleValue] = useState(task?.schedule.value || '');
  const [actionType, setActionType] = useState<ActionType>(task?.action.type || 'reminder');
  const [payload, setPayload] = useState<TaskActionPayload>(task?.action.payload || {});

  useEffect(() => {
    if (task) {
      setName(task.name);
      setEnabled(task.enabled);
      setScheduleType(task.schedule.type);
      setScheduleValue(task.schedule.value);
      setActionType(task.action.type);
      setPayload(task.action.payload);
    }
  }, [task]);

const handleSubmit = (e: React.FormEvent) => {
  e.preventDefault();
  const now = new Date().toISOString();
  const taskData = {
    name,
    enabled,
    schedule: { type: scheduleType, value: scheduleValue },
    action: { type: actionType, payload },
    createdAt: task?.createdAt || now,
    updatedAt: now,
  };

  // Если редактируем, добавляем id
  onSave(task?.id ? { id: task.id, ...taskData } : taskData);
};

  const updatePayload = (field: keyof TaskActionPayload, value: any) => {
    setPayload(prev => ({ ...prev, [field]: value }));
  };

  const renderPayloadFields = () => {
    switch (actionType) {
      case 'reminder':
        return (
          <>
            <label className="block mt-2 mb-1">Заголовок уведомления</label>
            <InputText
              value={payload.title || ''}
              onChange={e => updatePayload('title', e.target.value)}
              className="w-full"
              placeholder="Встреча через 5 минут"
            />
            <label className="block mt-2 mb-1">Текст уведомления</label>
            <InputTextarea
              value={payload.body || ''}
              onChange={e => updatePayload('body', e.target.value)}
              rows={3}
              className="w-full"
              placeholder="Подробности..."
            />
          </>
        );

      case 'react-command':
        return (
          <>
            <label className="block mt-2 mb-1">Команда</label>
            <InputText
              value={payload.command || ''}
              onChange={e => updatePayload('command', e.target.value)}
              className="w-full"
              placeholder="refresh"
            />
            <label className="block mt-2 mb-1">Аргументы (JSON)</label>
            <InputTextarea
              value={payload.args ? JSON.stringify(payload.args) : ''}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updatePayload('args', parsed);
                } catch {
                  updatePayload('args', e.target.value);
                }
              }}
              rows={3}
              className="w-full"
              placeholder='{"key": "value"}'
            />
          </>
        );

      case 'main-function':
        return (
          <>
            <label className="block mt-2 mb-1">Имя функции</label>
            <InputText
              value={payload.functionName || ''}
              onChange={e => updatePayload('functionName', e.target.value)}
              className="w-full"
              placeholder="refreshBonds"
            />
            <label className="block mt-2 mb-1">Аргументы (JSON)</label>
            <InputTextarea
              value={payload.args ? JSON.stringify(payload.args) : ''}
              onChange={e => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  updatePayload('args', parsed);
                } catch {
                  updatePayload('args', e.target.value);
                }
              }}
              rows={3}
              className="w-full"
            />
          </>
        );

      case 'script':
        return (
          <>
            <label className="block mt-2 mb-1">Путь к скрипту</label>
            <InputText
              value={payload.path || ''}
              onChange={e => updatePayload('path', e.target.value)}
              className="w-full"
              placeholder="/usr/local/bin/script.sh"
            />
            <label className="block mt-2 mb-1">Аргументы (через запятую)</label>
            <InputText
              value={Array.isArray(payload.args) ? payload.args.join(', ') : ''}
              onChange={e =>
                updatePayload('args', e.target.value.split(',').map(s => s.trim()))
              }
              className="w-full"
              placeholder="arg1, arg2"
            />
          </>
        );

      case 'yandex-tracker':
        return (
          <>
            <label className="block mt-2 mb-1">Ключ очереди</label>
            <InputText
              value={payload.queue || ''}
              onChange={e => updatePayload('queue', e.target.value)}
              className="w-full"
              placeholder="TMP"
            />
            <label className="block mt-2 mb-1">Название задачи</label>
            <InputText
              value={payload.summary || ''}
              onChange={e => updatePayload('summary', e.target.value)}
              className="w-full"
              placeholder="Задача из планировщика"
            />
            <label className="block mt-2 mb-1">Описание</label>
            <InputTextarea
              value={payload.description || ''}
              onChange={e => updatePayload('description', e.target.value)}
              rows={3}
              className="w-full"
              placeholder="Описание задачи..."
            />
            <label className="block mt-2 mb-1">Тип задачи</label>
            <InputText
              value={payload.type || ''}
              onChange={e => updatePayload('type', e.target.value)}
              className="w-full"
              placeholder="bug, task и т.д."
            />
            <label className="block mt-2 mb-1">Приоритет</label>
            <Dropdown
              value={payload.priority || 'normal'}
              options={[
                { label: 'Низкий', value: 'low' },
                { label: 'Средний', value: 'normal' },
                { label: 'Высокий', value: 'high' },
              ]}
              onChange={e => updatePayload('priority', e.value)}
              className="w-full"
            />
            <label className="block mt-2 mb-1">Исполнитель (логин)</label>
            <InputText
              value={payload.assignee || ''}
              onChange={e => updatePayload('assignee', e.target.value)}
              className="w-full"
              placeholder="user123"
            />
          </>
        );

      default:
        return null;
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-fluid">
      <div className="field">
        <label htmlFor="taskName">Название задачи</label>
        <InputText
          id="taskName"
          value={name}
          onChange={e => setName(e.target.value)}
          required
        />
      </div>

      <div className="field flex align-items-center gap-2 mt-3">
        <Checkbox
          inputId="taskEnabled"
          checked={enabled}
          onChange={e => setEnabled(e.checked ?? false)}
        />
        <label htmlFor="taskEnabled">Активна</label>
      </div>

      <div className="field">
        <label htmlFor="scheduleType">Тип расписания</label>
        <Dropdown
          id="scheduleType"
          value={scheduleType}
          options={scheduleOptions}
          onChange={e => setScheduleType(e.value)}
        />
      </div>

      <div className="field">
        <label htmlFor="scheduleValue">
          {scheduleType === 'once' && 'ISO-дата'}
          {scheduleType === 'interval' && 'Интервал (миллисекунды)'}
          {scheduleType === 'cron' && 'Cron-выражение'}
        </label>
        <InputText
          id="scheduleValue"
          value={scheduleValue}
          onChange={e => setScheduleValue(e.target.value)}
          required
          placeholder={
            scheduleType === 'once'
              ? '2026-05-21T15:30:00.000Z'
              : scheduleType === 'interval'
              ? '60000'
              : '*/5 * * * *'
          }
        />
      </div>

      <div className="field">
        <label htmlFor="actionType">Тип действия</label>
        <Dropdown
          id="actionType"
          value={actionType}
          options={actionOptions}
          onChange={e => setActionType(e.value)}
        />
      </div>

      <div className="field p-3 border-round-md surface-ground">
        {renderPayloadFields()}
      </div>

      <div className="flex justify-content-end gap-2 mt-3">
        <Button
          type="button"
          label="Отмена"
          icon="pi pi-times"
          className="p-button-text"
          onClick={onCancel}
        />
        <Button type="submit" label={task?.id ? 'Сохранить' : 'Создать'} icon="pi pi-check" />
      </div>
    </form>
  );
};