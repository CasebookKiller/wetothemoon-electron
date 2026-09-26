// src/main/services/gateway/selectorProfiles/SelectorProfileService.ts
import fs from 'fs/promises';
import path from 'path';
import { app } from 'electron';

export interface SelectorChain {
  chain: string[];
  description?: string;
}

export interface SelectorProfile {
  agent: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  notes?: string;
  selectors: Record<string, SelectorChain>;
}

export class SelectorProfileService {
  private profileDir: string;
  private userProfilePath: string;
  private builtinProfilePath: string;

  constructor(agent: string) {
    this.profileDir = path.join(app.getPath('userData'), 'selector_profiles');
    this.userProfilePath = path.join(this.profileDir, `${agent}.json`);
    // Путь к встроенному профилю в проекте
    this.builtinProfilePath = path.join(__dirname, 'profiles', `${agent}.v1.json`);
  }

  async load(): Promise<SelectorProfile> {
    // 1. Сначала пытаемся загрузить пользовательский профиль (обновлённый)
    try {
      const raw = await fs.readFile(this.userProfilePath, 'utf-8');
      return JSON.parse(raw) as SelectorProfile;
    } catch {
      // 2. Фолбэк на встроенный
      const raw = await fs.readFile(this.builtinProfilePath, 'utf-8');
      return JSON.parse(raw) as SelectorProfile;
    }
  }

  async save(profile: SelectorProfile): Promise<void> {
    await fs.mkdir(this.profileDir, { recursive: true });
    profile.updatedAt = new Date().toISOString();
    profile.version = (profile.version || 0) + 1;
    await fs.writeFile(this.userProfilePath, JSON.stringify(profile, null, 2), 'utf-8');
  }

  /**
   * Импорт профиля из внешнего файла (например, загруженного обновления).
   */
  async importFrom(filePath: string): Promise<void> {
    const raw = await fs.readFile(filePath, 'utf-8');
    const profile = JSON.parse(raw) as SelectorProfile;
    await this.save(profile);
  }
}