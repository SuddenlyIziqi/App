import Dexie, { type Table } from 'dexie';
import type { FoodItem, Category, FridgeArea, OperationLog, ShelfLifePreset, UserSettings } from '@/types';
import { presetCategories, presetAreas, presetShelfLives } from './presets';

export class FridgeDB extends Dexie {
  foods!: Table<FoodItem, string>;
  categories!: Table<Category, string>;
  areas!: Table<FridgeArea, string>;
  logs!: Table<OperationLog, string>;
  shelfLives!: Table<ShelfLifePreset, string>;
  settings!: Table<UserSettings, string>;

  constructor() {
    super('FridgeManagerDB');

    this.version(1).stores({
      foods: 'id, name, categoryId, areaId, status, expiryDate, purchaseDate, createdAt, *tags',
      categories: 'id, name, sortOrder',
      areas: 'id, name, sortOrder',
      logs: 'id, foodId, type, createdAt',
      shelfLives: 'id, foodName, categoryId, source',
      settings: 'id',
    });
  }
}

export const db = new FridgeDB();

// 初始化预设数据
export async function initPresets() {
  const catCount = await db.categories.count();
  if (catCount === 0) {
    await db.categories.bulkAdd(presetCategories);
  }

  const areaCount = await db.areas.count();
  if (areaCount === 0) {
    await db.areas.bulkAdd(presetAreas);
  }

  const shelfCount = await db.shelfLives.count();
  if (shelfCount === 0) {
    await db.shelfLives.bulkAdd(presetShelfLives);
  }

  const settingsCount = await db.settings.count();
  if (settingsCount === 0) {
    await db.settings.add({
      id: 'default',
      theme: 'system',
      language: 'zh-CN',
      reminder: {
        expiringDays: [3, 1, 0],
        notificationEnabled: true,
      },
      defaultArea: 'area-fridge',
      defaultUnit: '个',
    });
  }
}

// 计算食物状态
export function calcFoodStatus(expiryDate: string): FoodItem['status'] {
  const now = new Date();
  const expiry = new Date(expiryDate);
  const diffMs = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0) return 'expired';
  if (diffDays <= 1) return 'expiring';

  // 计算总保质期进度
  return 'fresh';
}

export function calcFoodStatusDetailed(purchaseDate: string, shelfLifeDays: number): FoodItem['status'] {
  const now = new Date();
  const purchase = new Date(purchaseDate);
  const expiry = new Date(purchase);
  expiry.setDate(expiry.getDate() + shelfLifeDays);

  const totalMs = expiry.getTime() - purchase.getTime();
  const elapsedMs = now.getTime() - purchase.getTime();
  const progress = elapsedMs / totalMs;

  if (progress >= 1) return 'expired';
  if (progress >= 0.8) return 'expiring';
  if (progress >= 0.5) return 'normal';
  return 'fresh';
}

// 计算到期日期
export function calcExpiryDate(purchaseDate: string, shelfLifeDays: number): string {
  const date = new Date(purchaseDate);
  date.setDate(date.getDate() + shelfLifeDays);
  return date.toISOString().split('T')[0];
}

// 获取剩余天数
export function getRemainingDays(expiryDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);
  return Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

// 获取状态颜色
export function getStatusColor(status: FoodItem['status']): string {
  switch (status) {
    case 'fresh': return 'text-green-600 bg-green-50 border-green-200';
    case 'normal': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case 'expiring': return 'text-orange-600 bg-orange-50 border-orange-200';
    case 'expired': return 'text-red-600 bg-red-50 border-red-200';
  }
}

export function getStatusEmoji(status: FoodItem['status']): string {
  switch (status) {
    case 'fresh': return '🟢';
    case 'normal': return '🟡';
    case 'expiring': return '🟠';
    case 'expired': return '🔴';
  }
}

export function getStatusLabel(status: FoodItem['status']): { zh: string; en: string } {
  switch (status) {
    case 'fresh': return { zh: '新鲜', en: 'Fresh' };
    case 'normal': return { zh: '正常', en: 'Normal' };
    case 'expiring': return { zh: '临期', en: 'Expiring' };
    case 'expired': return { zh: '已过期', en: 'Expired' };
  }
}
