import React from 'react';
import { Button } from 'primereact/button';
import { Task } from '@/shared/types/task';
import { classNames } from '@/css/classnames';

interface TaskListProps {
  tasks: Task[];
  onEdit: (task: Task) => void;
  onDelete: (id: string) => void;
}

export const TaskList: React.FC<TaskListProps> = ({ tasks, onEdit, onDelete }) => {
  if (tasks.length === 0) {
    return (
      <div className="flex justify-content-center align-items-center text-color-secondary py-4">
        Нет задач
      </div>
    );
  }

  return (
    <div className="flex flex-column gap-2">
      {tasks.map((task) => (
        <div
          key={task.id}
          className={classNames(
            'flex align-items-center justify-content-between p-2 border-round-md',
            'shadow-1 surface-border',
            { 'opacity-60': !task.enabled }
          )}
        >
          <div className="flex align-items-center gap-3">
            <div className="flex flex-column">
              <span className="font-bold">{task.name}</span>
              <span className="text-sm text-color-secondary">
                {task.schedule.type} · {task.schedule.value} · {task.action.type}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              icon="pi pi-pencil"
              className="p-button-rounded p-button-text p-button-sm"
              onClick={() => onEdit(task)}
            />
            <Button
              icon="pi pi-trash"
              className="p-button-rounded p-button-text p-button-danger p-button-sm"
              onClick={() => onDelete(task.id)}
            />
          </div>
        </div>
      ))}
    </div>
  );
};