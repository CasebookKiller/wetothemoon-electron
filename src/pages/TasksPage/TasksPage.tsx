import React, { useState, useEffect, useCallback } from 'react';
import { Panel } from 'primereact/panel';
import { Button } from 'primereact/button';
import { Dialog } from 'primereact/dialog';
import { Task } from '@/shared/types/task';
import { TaskList } from '@/components/TASKS/TaskList/TaskList';
import { TaskForm } from '@/components/TASKS/TaskForm/TaskForm';
import { classNames } from '@/css/classnames';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | undefined>();

  const loadTasks = useCallback(async () => {
    try {
      const api = (window as any).electronAPI;
      console.log('[Renderer] electronAPI:', api);
      if (!api?.tasks?.getAll) {
        console.error('Метод tasks.getAll отсутствует в electronAPI');
        return;
      }
      const data = await api.tasks.getAll();
      console.log('[Renderer] Получены задачи:', data);
      setTasks(data);
    } catch (err) {
      console.error('[Renderer] Ошибка загрузки задач:', err);
    }
  }, []);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleSave = async (task: Task | Omit<Task, 'id'>) => {
    try {
      const api = (window as any).electronAPI;
      if ('id' in task && task.id) {
        await api.tasks.update(task);
      } else {
        await api.tasks.add(task);
      }
      loadTasks();
      setDialogVisible(false);
      setEditingTask(undefined);
    } catch (err) {
      console.error('Ошибка сохранения:', err);
    }
  };

  const handleDelete = async (id: string) => {
    const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;
    await electronAPI.tasks.delete(id);
    loadTasks();
  };

  const handleEdit = (task: Task) => {
    setEditingTask(task);
    setDialogVisible(true);
  };

  const handleCreateNew = () => {
    setEditingTask(undefined);
    setDialogVisible(true);
  };

 const header = (
    <div className="flex align-items-center justify-content-between w-full">
      <span className="app font-size-subheading font-bold">Планировщик задач</span>
    </div>
  );

  const emptyState = (
    <div className="flex flex-column align-items-center justify-content-center py-6 text-color-secondary">
      <i className="pi pi-calendar text-5xl mb-3" style={{ opacity: 0.3 }}></i>
      <p className="text-lg mb-3">Нет запланированных задач</p>
      <Button
        icon="pi pi-plus"
        label="Создать первую задачу"
        className="p-button-outlined"
        onClick={handleCreateNew}
      />
    </div>
  );

  return (
    <div className="app p-0">
      <Panel header={header} className="shadow-5 mx-1">
        {tasks.length === 0 ? (
          emptyState
        ) : (
          <>
            <div className="flex justify-content-end mb-2">
              <Button
                icon="pi pi-plus"
                label="Новая задача"
                className="p-button-outlined p-button-sm"
                onClick={handleCreateNew}
              />
            </div>
            <TaskList tasks={tasks} onEdit={handleEdit} onDelete={handleDelete} />
          </>
        )}
      </Panel>

      <Dialog
        visible={dialogVisible}
        style={{ width: '50vw' }}
        header={editingTask ? 'Редактирование задачи' : 'Новая задача'}
        modal
        onHide={() => setDialogVisible(false)}
      >
        <TaskForm
          task={editingTask}
          onSave={handleSave}
          onCancel={() => setDialogVisible(false)}
        />
      </Dialog>
    </div>
  );
};