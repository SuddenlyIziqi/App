import { create } from 'zustand';
import type { FoodItem, Category, FridgeArea, OperationLog, UserSettings, FridgeModel } from '@/types';
import { db, calcFoodStatusDetailed, calcExpiryDate } from '@/db';
import { v4 as uuid } from 'uuid';

interface AppState {
  // 数据
  foods: FoodItem[];
  categories: Category[];
  areas: FridgeArea[];
  logs: OperationLog[];
  settings: UserSettings | null;
  loading: boolean;

  // 加载
  loadData: () => Promise<void>;

  // 食物操作
  addFood: (food: Omit<FoodItem, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'expiryDate'>) => Promise<string>;
  updateFood: (id: string, updates: Partial<FoodItem>) => Promise<void>;
  deleteFood: (id: string) => Promise<void>;
  consumeFood: (id: string, quantity?: number) => Promise<void>;
  discardFood: (id: string, reason?: string) => Promise<void>;
  transferFood: (id: string, toAreaId: string) => Promise<void>;
  refreshStatuses: () => Promise<void>;

  // 分类操作
  addCategory: (cat: Omit<Category, 'id'>) => Promise<void>;
  updateCategory: (id: string, updates: Partial<Category>) => Promise<void>;
  deleteCategory: (id: string) => Promise<void>;

  // 区域操作
  addArea: (area: Omit<FridgeArea, 'id'>) => Promise<void>;
  updateArea: (id: string, updates: Partial<FridgeArea>) => Promise<void>;
  deleteArea: (id: string) => Promise<void>;

  // 设置
  updateSettings: (updates: Partial<UserSettings>) => Promise<void>;
  selectFridgeModel: (model: FridgeModel) => Promise<void>;

  // 数据备份恢复
  exportData: () => Promise<string>;
  importData: (json: string) => Promise<void>;
  clearAllData: () => Promise<void>;
}

export const useStore = create<AppState>((set, get) => ({
  foods: [],
  categories: [],
  areas: [],
  logs: [],
  settings: null,
  loading: true,

  loadData: async () => {
    try {
      const [foods, categories, areas, logs, settingsArr] = await Promise.all([
        db.foods.toArray(),
        db.categories.orderBy('sortOrder').toArray(),
        db.areas.orderBy('sortOrder').toArray(),
        db.logs.orderBy('createdAt').reverse().limit(100).toArray(),
        db.settings.toArray(),
      ]);

      // 刷新所有食物状态
      const now = new Date();
      const updatedFoods = foods.map(f => ({
        ...f,
        status: calcFoodStatusDetailed(f.purchaseDate, f.shelfLifeDays),
      }));

      // 批量更新状态
      for (const f of updatedFoods) {
        const original = foods.find(of => of.id === f.id);
        if (original && original.status !== f.status) {
          await db.foods.update(f.id, { status: f.status });
        }
      }

      set({
        foods: updatedFoods,
        categories,
        areas,
        logs,
        settings: settingsArr[0] || null,
        loading: false,
      });
    } catch (e) {
      console.error('Failed to load data:', e);
      set({ loading: false });
    }
  },

  addFood: async (foodData) => {
    const id = uuid();
    const now = new Date().toISOString();
    const status = calcFoodStatusDetailed(foodData.purchaseDate, foodData.shelfLifeDays);
    const expiryDate = calcExpiryDate(foodData.purchaseDate, foodData.shelfLifeDays);

    const food: FoodItem = {
      ...foodData,
      id,
      expiryDate,
      status,
      createdAt: now,
      updatedAt: now,
    };

    await db.foods.add(food);

    // 添加操作记录
    const log: OperationLog = {
      id: uuid(),
      foodId: id,
      foodName: food.name,
      type: 'add',
      quantity: food.quantity,
      toAreaId: food.areaId,
      createdAt: now,
    };
    await db.logs.add(log);

    await get().loadData();
    return id;
  },

  updateFood: async (id, updates) => {
    const food = get().foods.find(f => f.id === id);
    if (!food) return;

    const updated = { ...food, ...updates, updatedAt: new Date().toISOString() };
    if (updates.purchaseDate || updates.shelfLifeDays) {
      updated.expiryDate = calcExpiryDate(updated.purchaseDate, updated.shelfLifeDays);
      updated.status = calcFoodStatusDetailed(updated.purchaseDate, updated.shelfLifeDays);
    }

    await db.foods.update(id, updated);

    const log: OperationLog = {
      id: uuid(),
      foodId: id,
      foodName: food.name,
      type: 'modify',
      quantity: food.quantity,
      note: '修改信息',
      createdAt: new Date().toISOString(),
    };
    await db.logs.add(log);
    await get().loadData();
  },

  deleteFood: async (id) => {
    const food = get().foods.find(f => f.id === id);
    if (!food) return;
    await db.foods.delete(id);
    await get().loadData();
  },

  consumeFood: async (id, quantity) => {
    const food = get().foods.find(f => f.id === id);
    if (!food) return;

    const consumeQty = quantity || food.quantity;
    if (consumeQty >= food.quantity) {
      await db.foods.delete(id);
    } else {
      await db.foods.update(id, { quantity: food.quantity - consumeQty, updatedAt: new Date().toISOString() });
    }

    const log: OperationLog = {
      id: uuid(),
      foodId: id,
      foodName: food.name,
      type: 'consume',
      quantity: consumeQty,
      createdAt: new Date().toISOString(),
    };
    await db.logs.add(log);
    await get().loadData();
  },

  discardFood: async (id, reason) => {
    const food = get().foods.find(f => f.id === id);
    if (!food) return;

    await db.foods.delete(id);

    const log: OperationLog = {
      id: uuid(),
      foodId: id,
      foodName: food.name,
      type: 'discard',
      quantity: food.quantity,
      reason: reason || '过期丢弃',
      createdAt: new Date().toISOString(),
    };
    await db.logs.add(log);
    await get().loadData();
  },

  transferFood: async (id, toAreaId) => {
    const food = get().foods.find(f => f.id === id);
    if (!food) return;

    const fromAreaId = food.areaId;
    await db.foods.update(id, { areaId: toAreaId, updatedAt: new Date().toISOString() });

    const log: OperationLog = {
      id: uuid(),
      foodId: id,
      foodName: food.name,
      type: 'transfer',
      fromAreaId,
      toAreaId,
      quantity: food.quantity,
      createdAt: new Date().toISOString(),
    };
    await db.logs.add(log);
    await get().loadData();
  },

  refreshStatuses: async () => {
    await get().loadData();
  },

  addCategory: async (cat) => {
    await db.categories.add({ ...cat, id: uuid() });
    await get().loadData();
  },

  updateCategory: async (id, updates) => {
    await db.categories.update(id, updates);
    await get().loadData();
  },

  deleteCategory: async (id) => {
    await db.categories.delete(id);
    await get().loadData();
  },

  addArea: async (area) => {
    await db.areas.add({ ...area, id: uuid() });
    await get().loadData();
  },

  updateArea: async (id, updates) => {
    await db.areas.update(id, updates);
    await get().loadData();
  },

  deleteArea: async (id) => {
    await db.areas.delete(id);
    await get().loadData();
  },

  updateSettings: async (updates) => {
    const current = get().settings;
    if (!current) return;
    await db.settings.update(current.id, updates);
    await get().loadData();
  },

  selectFridgeModel: async (model) => {
    // 清除旧区域，添加新模型的区域
    await db.areas.clear();
    for (const zone of model.zones) {
      await db.areas.add({
        id: zone.id,
        name: zone.name,
        nameEn: zone.nameEn,
        icon: zone.icon,
        temperature: zone.temperature,
        sortOrder: zone.row * 10 + zone.col,
        isPreset: true,
      });
    }
    // 保存选中的型号到设置
    const current = get().settings;
    if (current) {
      await db.settings.update(current.id, { defaultArea: model.zones[0]?.id || '' } as any);
    }
    await get().loadData();
  },

  exportData: async () => {
    const [foods, categories, areas, logs, shelfLives, settings] = await Promise.all([
      db.foods.toArray(),
      db.categories.toArray(),
      db.areas.toArray(),
      db.logs.toArray(),
      db.shelfLives.toArray(),
      db.settings.toArray(),
    ]);
    return JSON.stringify({ foods, categories, areas, logs, shelfLives, settings, exportDate: new Date().toISOString() }, null, 2);
  },

  importData: async (json) => {
    const data = JSON.parse(json);
    await db.transaction('rw', [db.foods, db.categories, db.areas, db.logs, db.shelfLives, db.settings], async () => {
      if (data.foods) { await db.foods.clear(); await db.foods.bulkAdd(data.foods); }
      if (data.categories) { await db.categories.clear(); await db.categories.bulkAdd(data.categories); }
      if (data.areas) { await db.areas.clear(); await db.areas.bulkAdd(data.areas); }
      if (data.logs) { await db.logs.clear(); await db.logs.bulkAdd(data.logs); }
      if (data.shelfLives) { await db.shelfLives.clear(); await db.shelfLives.bulkAdd(data.shelfLives); }
      if (data.settings) { await db.settings.clear(); await db.settings.bulkAdd(data.settings); }
    });
    await get().loadData();
  },

  clearAllData: async () => {
    await db.transaction('rw', [db.foods, db.categories, db.areas, db.logs, db.shelfLives, db.settings], async () => {
      await db.foods.clear();
      await db.categories.clear();
      await db.areas.clear();
      await db.logs.clear();
      await db.shelfLives.clear();
      await db.settings.clear();
    });
    // 重新初始化预设
    const { initPresets } = await import('@/db');
    await initPresets();
    await get().loadData();
  },
}));
