// src/main/utils/protoPath.ts

import path from 'path';
import { app } from 'electron';

export function getProtoPath(protoFileName: string): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'proto', protoFileName);
  }
  // В dev-режиме __dirname – это dist/main/streams, поэтому поднимаемся на два уровня до dist/main
  return path.join(__dirname, '../../proto', protoFileName);
}