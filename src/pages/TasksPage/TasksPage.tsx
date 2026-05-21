import React, { useEffect, useState } from 'react';
import { Task } from '@/shared/types/task';

export const TasksPage: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);

  const loadTasks = async () => {
    const electronAPI = (window as Window & typeof globalThis & { electronAPI?: any })?.electronAPI;
    const data = await electronAPI.tasks.getAll();
    setTasks(data);
  };

  useEffect(() => {
    loadTasks();
  }, []);

  return (
    <div>
      <h1>Задачи</h1>
      <button onClick={loadTasks}>Обновить</button>
      <pre>{JSON.stringify(tasks, null, 2)}</pre>
    </div>
  );
};