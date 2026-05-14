import { app } from 'electron';
import path from 'path';

export const resolveAppPath = (...segments: string[]): string => {
  return path.join(app.getAppPath(), ...segments);
};
