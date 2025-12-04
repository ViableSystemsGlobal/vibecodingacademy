import prisma from '../config/database';
import { SettingType } from '@prisma/client';

export class SettingsService {
  async getAll() {
    const settings = await prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    return settings.reduce((acc, setting) => {
      let value: any = setting.value;
      if (setting.type === SettingType.BOOL) {
        value = value === 'true';
      } else if (setting.type === SettingType.NUMBER) {
        value = parseFloat(value);
      }
      acc[setting.key] = value;
      return acc;
    }, {} as Record<string, any>);
  }

  async get(key: string) {
    const setting = await prisma.setting.findUnique({
      where: { key },
    });

    if (!setting) {
      return null;
    }

    let value: any = setting.value;
    if (setting.type === SettingType.BOOL) {
      value = value === 'true';
    } else if (setting.type === SettingType.NUMBER) {
      value = parseFloat(value);
    }

    return value;
  }

  async set(key: string, value: any, type: SettingType) {
    const stringValue = String(value);
    console.log(`Setting ${key} = ${stringValue.substring(0, 20)}... (type: ${type})`);
    const result = await prisma.setting.upsert({
      where: { key },
      update: {
        value: stringValue,
        type,
      },
      create: {
        key,
        value: stringValue,
        type,
      },
    });
    console.log(`Setting ${key} saved successfully`);
    return result;
  }

  async setMultiple(settings: Array<{ key: string; value: any; type: SettingType }>) {
    return Promise.all(
      settings.map((s) => this.set(s.key, s.value, s.type))
    );
  }
}

export const settingsService = new SettingsService();

