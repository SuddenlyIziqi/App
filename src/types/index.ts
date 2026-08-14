// 食物新鲜度状态
export type FreshnessStatus = 'fresh' | 'normal' | 'expiring' | 'expired';

// 操作类型
export type OperationType = 'add' | 'consume' | 'discard' | 'transfer' | 'modify';

// 食物条目
export interface FoodItem {
  id: string;
  name: string;
  categoryId: string;
  areaId: string;
  quantity: number;
  unit: string;
  purchaseDate: string; // ISO date string
  shelfLifeDays: number;
  expiryDate: string; // ISO date string
  status: FreshnessStatus;
  tags: string[];
  image?: string;
  barcode?: string;
  notes?: string;
  slotId?: string; // 冰箱可视化中的位置槽位
  createdAt: string;
  updatedAt: string;
}

// 分类
export interface Category {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  color: string;
  defaultShelfLife: {
    fridge: number;
    freezer: number;
    fresh: number;
  };
  sortOrder: number;
  isPreset: boolean;
}

// 冰箱区域
export interface FridgeArea {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  temperature?: number;
  sortOrder: number;
  isPreset: boolean;
}

// 冰箱区域类型
export type FridgeZoneType = 'fridge' | 'freezer' | 'fresh' | 'door';

// 冰箱区域配置（用于冰箱型号）
export interface FridgeZone {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  type: FridgeZoneType;
  row: number;
  col: number;
  temperature?: number;
}

// 冰箱型号
export interface FridgeModel {
  id: string;
  name: string;
  nameEn: string;
  icon: string;
  description: string;
  descriptionEn: string;
  zones: FridgeZone[];
}

// 操作记录
export interface OperationLog {
  id: string;
  foodId: string;
  foodName: string;
  type: OperationType;
  fromAreaId?: string;
  toAreaId?: string;
  quantity: number;
  reason?: string;
  note?: string;
  createdAt: string;
}

// 保质期预设
export interface ShelfLifePreset {
  id: string;
  foodName: string;
  foodNameEn: string;
  categoryId: string;
  shelfLife: {
    fridge: number;
    freezer: number;
    fresh: number;
    room: number;
  };
  source: 'preset' | 'user';
}

// 提醒设置
export interface ReminderSettings {
  expiringDays: number[];
  notificationEnabled: boolean;
  quietHoursStart?: string;
  quietHoursEnd?: string;
}

// 用户设置
export interface UserSettings {
  id: string;
  theme: 'light' | 'dark' | 'system';
  language: 'zh-CN' | 'en';
  reminder: ReminderSettings;
  defaultArea: string;
  defaultUnit: string;
}

// 统计相关
export interface DailyStats {
  date: string;
  added: number;
  consumed: number;
  discarded: number;
  expired: number;
}

export interface WasteRecord {
  foodName: string;
  quantity: number;
  unit: string;
  purchaseDate: string;
  discardDate: string;
  daysInFridge: number;
  reason?: string;
}
