// src/main/services/osint/credentials.ts

import { app, safeStorage } from 'electron';
import fs from 'fs';
import path from 'path';

interface SiteCredentials {
  login: string;
  password: string;
}

const credentialsPath = () => path.join(app.getPath('userData'), 'osint_credentials.json');

function encrypt(text: string): string {
  return safeStorage.encryptString(text).toString('base64');
}

function decrypt(base64: string): string {
  return safeStorage.decryptString(Buffer.from(base64, 'base64'));
}

export function loadCredentials(): Record<string, SiteCredentials> {
  const filePath = credentialsPath();
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    const result: Record<string, SiteCredentials> = {};
    for (const site in raw) {
      result[site] = {
        login: decrypt(raw[site].login),
        password: decrypt(raw[site].password),
      };
    }
    return result;
  } catch (e) {
    console.error('Ошибка загрузки учётных данных:', e);
    return {};
  }
}

export function saveCredentials(credentials: Record<string, SiteCredentials>): void {
  const filePath = credentialsPath();
  const encrypted: Record<string, { login: string; password: string }> = {};
  for (const site in credentials) {
    encrypted[site] = {
      login: encrypt(credentials[site].login),
      password: encrypt(credentials[site].password),
    };
  }
  fs.writeFileSync(filePath, JSON.stringify(encrypted, null, 2), 'utf-8');
}

export function getCredentials(site: string): SiteCredentials | null {
  const creds = loadCredentials();
  return creds[site] || null;
}

export function setCredentials(site: string, login: string, password: string): void {
  const all = loadCredentials();
  all[site] = { login, password };
  saveCredentials(all);
}