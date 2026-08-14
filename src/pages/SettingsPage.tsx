import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/store';
import { useNavigate } from 'react-router-dom';
import { presetFridgeModels } from '@/db/presets';
import type { FridgeModel } from '@/types';

export default function SettingsPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const settings = useStore(s => s.settings);
  const updateSettings = useStore(s => s.updateSettings);
  const categories = useStore(s => s.categories);
  const areas = useStore(s => s.areas);
  const addCategory = useStore(s => s.addCategory);
  const deleteCategory = useStore(s => s.deleteCategory);
  const addArea = useStore(s => s.addArea);
  const deleteArea = useStore(s => s.deleteArea);
  const selectFridgeModel = useStore(s => s.selectFridgeModel);
  const exportData = useStore(s => s.exportData);
  const importData = useStore(s => s.importData);
  const clearAllData = useStore(s => s.clearAllData);

  const [showAddCat, setShowAddCat] = useState(false);
  const [showAddArea, setShowAddArea] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [newCatIcon, setNewCatIcon] = useState('🍽️');
  const [newAreaName, setNewAreaName] = useState('');
  const [newAreaIcon, setNewAreaIcon] = useState('📦');
  const [newAreaTemp, setNewAreaTemp] = useState(4);
  const [showFridgeModels, setShowFridgeModels] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 主题切换
  const themes = [
    { key: 'light' as const, label: t('settings.light'), icon: '☀️' },
    { key: 'dark' as const, label: t('settings.dark'), icon: '🌙' },
    { key: 'system' as const, label: t('settings.system'), icon: '📱' },
  ];

  // 语言切换
  const languages = [
    { key: 'zh-CN' as const, label: '中文' },
    { key: 'en' as const, label: 'English' },
  ];

  const handleLanguageChange = (lang: 'zh-CN' | 'en') => {
    i18n.changeLanguage(lang);
    localStorage.setItem('language', lang);
    updateSettings({ language: lang });
  };

  const isEn = i18n.language === 'en';

  // 导出
  const handleExport = async () => {
    const data = await exportData();
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fridge-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 导入
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        await importData(ev.target?.result as string);
        alert(t('common.success'));
      } catch {
        alert(t('common.error'));
      }
    };
    reader.readAsText(file);
  };

  // 清除数据
  const handleClear = async () => {
    if (confirm(t('settings.confirmClear'))) {
      await clearAllData();
    }
  };

  // 添加分类
  const handleAddCat = async () => {
    if (!newCatName.trim()) return;
    await addCategory({
      name: newCatName,
      nameEn: newCatName,
      icon: newCatIcon,
      color: '#6b7280',
      defaultShelfLife: { fridge: 7, freezer: 30, fresh: 5 },
      sortOrder: categories.length + 1,
      isPreset: false,
    });
    setNewCatName('');
    setShowAddCat(false);
  };

  // 添加区域
  const handleAddArea = async () => {
    if (!newAreaName.trim()) return;
    await addArea({
      name: newAreaName,
      nameEn: newAreaName,
      icon: newAreaIcon,
      temperature: newAreaTemp,
      sortOrder: areas.length + 1,
      isPreset: false,
    });
    setNewAreaName('');
    setShowAddArea(false);
  };

  return (
    <div className="page-container animate-fade-in">
      <h1 className="page-title">{t('settings.title')}</h1>

      <div className="space-y-4">
        {/* 主题 */}
        <div className="card">
          <h3 className="section-title">☀️ {t('settings.theme')}</h3>
          <div className="flex gap-2">
            {themes.map(theme => (
              <button
                key={theme.key}
                onClick={() => updateSettings({ theme: theme.key })}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  settings?.theme === theme.key
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {theme.icon} {theme.label}
              </button>
            ))}
          </div>
        </div>

        {/* 语言 */}
        <div className="card">
          <h3 className="section-title">🌐 {t('settings.language')}</h3>
          <div className="flex gap-2">
            {languages.map(lang => (
              <button
                key={lang.key}
                onClick={() => handleLanguageChange(lang.key)}
                className={`flex-1 py-3 rounded-xl text-sm font-medium transition-all ${
                  i18n.language === lang.key
                    ? 'bg-primary-500 text-white shadow-sm'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                }`}
              >
                {lang.label}
              </button>
            ))}
          </div>
        </div>

        {/* 冰箱型号选择 */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h3 className="section-title mb-0">🧊 {isEn ? 'Fridge Model' : '冰箱型号'}</h3>
            <button onClick={() => setShowFridgeModels(!showFridgeModels)} className="text-primary-500 text-sm">
              {showFridgeModels ? (isEn ? 'Collapse' : '收起') : (isEn ? 'Change' : '更换')}
            </button>
          </div>
          {showFridgeModels ? (
            <div className="space-y-2">
              {presetFridgeModels.map(model => (
                <button
                  key={model.id}
                  onClick={async () => {
                    if (confirm(isEn ? 'Switching fridge model will reset all zones. Continue?' : '更换冰箱型号将重置所有区域，是否继续？')) {
                      await selectFridgeModel(model);
                      setShowFridgeModels(false);
                    }
                  }}
                  className="w-full text-left card flex items-center gap-3 active:scale-[0.98] transition-transform"
                >
                  <span className="text-3xl">{model.icon}</span>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{isEn ? model.nameEn : model.name}</p>
                    <p className="text-xs text-gray-400">{isEn ? model.descriptionEn : model.description}</p>
                    <p className="text-xs text-primary-500 mt-1">{model.zones.length} {isEn ? 'zones' : '个区域'}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <span className="text-lg">🧊</span>
              <span>{areas.length} {isEn ? 'zones configured' : '个区域已配置'}</span>
            </div>
          )}
        </div>

        {/* 冰箱区域管理 */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h3 className="section-title mb-0">🧊 {t('area.title')}</h3>
            <button onClick={() => setShowAddArea(true)} className="text-primary-500 text-sm">+ {t('area.add')}</button>
          </div>
          <div className="space-y-2">
            {areas.map(area => (
              <div key={area.id} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{area.icon}</span>
                  <span className="text-sm font-medium">{area.name}</span>
                  {area.temperature !== undefined && (
                    <span className="text-xs text-gray-400">{area.temperature}°C</span>
                  )}
                </div>
                {!area.isPreset && (
                  <button onClick={() => deleteArea(area.id)} className="text-danger-400 text-xs">
                    {t('common.delete')}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 分类管理 */}
        <div className="card">
          <div className="flex justify-between items-center mb-3">
            <h3 className="section-title mb-0">📂 {t('category.title')}</h3>
            <button onClick={() => setShowAddCat(true)} className="text-primary-500 text-sm">+ {t('category.add')}</button>
          </div>
          <div className="flex flex-wrap gap-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg px-2 py-1">
                <span>{cat.icon}</span>
                <span className="text-xs">{cat.name}</span>
                {!cat.isPreset && (
                  <button onClick={() => deleteCategory(cat.id)} className="text-danger-400 text-xs ml-1">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 提醒设置 */}
        <div className="card">
          <h3 className="section-title">🔔 {t('settings.reminder')}</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm">{t('settings.enableNotification')}</span>
              <button
                onClick={() => {
                  const enabled = !settings?.reminder.notificationEnabled;
                  if (enabled && 'Notification' in window) {
                    Notification.requestPermission();
                  }
                  updateSettings({
                    reminder: { ...settings!.reminder, notificationEnabled: enabled }
                  });
                }}
                className={`w-12 h-6 rounded-full transition-all ${
                  settings?.reminder.notificationEnabled ? 'bg-primary-500' : 'bg-gray-300 dark:bg-gray-600'
                }`}
              >
                <span className={`block w-5 h-5 rounded-full bg-white shadow transition-all ${
                  settings?.reminder.notificationEnabled ? 'translate-x-6' : 'translate-x-0.5'
                }`} />
              </button>
            </div>
          </div>
        </div>

        {/* 数据管理 */}
        <div className="card">
          <h3 className="section-title">💾 {t('settings.data')}</h3>
          <div className="space-y-2">
            <button onClick={handleExport} className="btn-secondary w-full text-left flex items-center gap-2">
              📤 {t('settings.export')}
            </button>
            <button onClick={() => fileInputRef.current?.click()} className="btn-secondary w-full text-left flex items-center gap-2">
              📥 {t('settings.import')}
            </button>
            <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} className="hidden" />
            <button onClick={handleClear} className="btn-danger w-full text-left flex items-center gap-2">
              🗑️ {t('settings.clearAll')}
            </button>
          </div>
        </div>

        {/* 关于 */}
        <div className="card">
          <h3 className="section-title">ℹ️ {t('settings.about')}</h3>
          <div className="space-y-2 text-sm text-gray-500">
            <div className="flex justify-between">
              <span>{t('settings.version')}</span>
              <span>1.0.0</span>
            </div>
            <div className="flex justify-between">
              <span>冰箱管家 Fridge Manager</span>
              <span>PWA</span>
            </div>
          </div>
        </div>
      </div>

      {/* 添加分类弹窗 */}
      {showAddCat && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl p-6 animate-slide-up">
            <h2 className="text-lg font-bold mb-4">{t('category.add')}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('category.icon')}</label>
                <input type="text" value={newCatIcon} onChange={e => setNewCatIcon(e.target.value)} className="input-field w-20 text-center text-2xl" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('category.name')}</label>
                <input type="text" value={newCatName} onChange={e => setNewCatName(e.target.value)} className="input-field" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddCat(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
                <button onClick={handleAddCat} className="btn-primary flex-1">{t('common.add')}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 添加区域弹窗 */}
      {showAddArea && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl p-6 animate-slide-up">
            <h2 className="text-lg font-bold mb-4">{t('area.add')}</h2>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('area.icon')}</label>
                <input type="text" value={newAreaIcon} onChange={e => setNewAreaIcon(e.target.value)} className="input-field w-20 text-center text-2xl" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('area.name')}</label>
                <input type="text" value={newAreaName} onChange={e => setNewAreaName(e.target.value)} className="input-field" />
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('area.temperature')}</label>
                <input type="number" value={newAreaTemp} onChange={e => setNewAreaTemp(parseInt(e.target.value) || 0)} className="input-field" />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowAddArea(false)} className="btn-secondary flex-1">{t('common.cancel')}</button>
                <button onClick={handleAddArea} className="btn-primary flex-1">{t('common.add')}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
