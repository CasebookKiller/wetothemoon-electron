// src/shared/types/task.ts

export type ScheduleType = 'cron' | 'interval' | 'once';

export type ActionType =
  | 'reminder'
  | 'react-command'
  | 'main-function'
  | 'script'
  | 'yandex-tracker';   // сразу заложим под будущую интеграцию

export interface TaskActionPayload {
  // для reminder
  title?: string;
  body?: string;
  // для react-command
  command?: string;
  args?: any;
  // для main-function
  functionName?: string;
  // для script
  path?: string;
  // для yandex-tracker
  summary?: string;
  queue?: string;
  description?: string;
  type?: string;
  priority?: string;
  assignee?: string;
}

export interface Task {
  id: string;               // UUID
  name: string;
  enabled: boolean;
  schedule: {
    type: ScheduleType;
    value: string;          // cron, ms или ISO-дата
  };
  action: {
    type: ActionType;
    payload: TaskActionPayload;
  };
  lastRun?: string;         // ISO
  nextRun?: string;         // ISO
  createdAt: string;
  updatedAt: string;
}