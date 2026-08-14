import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store';
import { getRemainingDays } from '@/db';
import type { FoodItem } from '@/types';

type ViewMode = 'grid' | 'list';
type StatusFilter = 'all' | 'fresh' | 'normal' | 'expiring' | 'expired';
type SortBy = 'expiry' | 'date' | 'name';

export default function FoodListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const foods = useStore(s => s.foods);
  const categories = useStore(s => s.categories);
  const areas = useStore(s => s.areas);

  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter) || 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('expiry');
  const [showFilter, setShowFilter] = useState(false);

  const filteredFoods = useMemo(() => {
    let result = [...foods];

    // 搜索
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f =>
        f.name.toLowerCase().includes(q) ||
        f.tags.some(tag => tag.toLowerCase().includes(q))
      );
    }

    // 状态筛选
    if (statusFilter !== 'all') {
      result = result.filter(f => f.status === statusFilter);
    }

    // 分类筛选
    if (categoryFilter !== 'all') {
      result = result.filter(f => f.categoryId === categoryFilter);
    }

    // 区域筛选
    if (areaFilter !== 'all') {
      result = result.filter(f => f.areaId === areaFilter);
    }

    // 排序
    result.sort((a, b) => {
      switch (sortBy) {
        case 'expiry':
          return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        case 'date':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return result;
  }, [foods, search, statusFilter, categoryFilter, areaFilter, sortBy]);

  const getCategoryIcon = (catId: string) => {
    return categories.find(c => c.id === catId)?.icon || '📦';
  };

  const getAreaName = (areaId: string) => {
    return areas.find(a => a.id === areaId)?.name || '';
  };

  const statusFilters: { key: StatusFilter; label: string; emoji: string }[] = [
    { key: 'all', label: t('food.all'), emoji: '📋' },
    { key: 'fresh', label: t('food.fresh'), emoji: '🟢' },
    { key: 'normal', label: t('food.normal'), emoji: '🟡' },
    { key: 'expiring', label: t('food.expiring'), emoji: '🟠' },
    { key: 'expired', label: t('food.expired'), emoji: '🔴' },
  ];

  const getDaysText = (food: FoodItem) => {
    const days = getRemainingDays(food.expiryDate);
    if (days < 0) return `${t('food.overdue')} ${Math.abs(days)}${t('food.dayUnit')}`;
    if (days === 0) return t('food.today');
    if (days === 1) return t('food.tomorrow');
    return `${days}${t('food.dayUnit')}`;
  };

  return (
    <div className="page-container animate-fade-in">
      <h1 className="page-title">{t('food.list')}</h1>

      {/* 搜索栏 */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={t('food.search')}
            className="input-field pl-10"
          />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        </div>
        <button
          onClick={() => setShowFilter(!showFilter)}
          className={`px-3 rounded-xl border transition-all ${showFilter ? 'bg-primary-500 text-white border-primary-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'}`}
        >
          ⚙️
        </button>
      </div>

      {/* 筛选面板 */}
      {showFilter && (
        <div className="card mb-3 animate-slide-up space-y-3">
          {/* 排序 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('food.sort')}</label>
            <div className="flex gap-2">
              {[
                { key: 'expiry' as SortBy, label: t('food.sortByExpiry') },
                { key: 'date' as SortBy, label: t('food.sortByDate') },
                { key: 'name' as SortBy, label: t('food.sortByName') },
              ].map(s => (
                <button
                  key={s.key}
                  onClick={() => setSortBy(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    sortBy === s.key ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* 分类筛选 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('food.category')}</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  categoryFilter === 'all' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                }`}
              >
                {t('food.all')}
              </button>
              {categories.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    categoryFilter === cat.id ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>

          {/* 区域筛选 */}
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{t('food.area')}</label>
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => setAreaFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  areaFilter === 'all' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                }`}
              >
                {t('food.all')}
              </button>
              {areas.map(area => (
                <button
                  key={area.id}
                  onClick={() => setAreaFilter(area.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    areaFilter === area.id ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                  }`}
                >
                  {area.icon} {area.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 状态标签 */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {statusFilters.map(sf => (
          <button
            key={sf.key}
            onClick={() => setStatusFilter(sf.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
              statusFilter === sf.key
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'
            }`}
          >
            {sf.emoji} {sf.label}
            {sf.key !== 'all' && (
              <span className="ml-1">
                ({foods.filter(f => sf.key === 'all' || f.status === sf.key).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* 视图切换 */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm text-gray-400">{filteredFoods.length} {t('food.all')}</span>
        <div className="flex gap-1">
          <button
            onClick={() => setViewMode('grid')}
            className={`px-2 py-1 rounded text-xs ${viewMode === 'grid' ? 'bg-primary-100 text-primary-600' : 'text-gray-400'}`}
          >
            {t('food.gridView')}
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`px-2 py-1 rounded text-xs ${viewMode === 'list' ? 'bg-primary-100 text-primary-600' : 'text-gray-400'}`}
          >
            {t('food.listView')}
          </button>
        </div>
      </div>

      {/* 食物列表 */}
      {filteredFoods.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">🧊</p>
          <p className="text-gray-400 mb-2">{foods.length === 0 ? t('food.empty') : t('food.noResults')}</p>
          {foods.length === 0 && (
            <button onClick={() => navigate('/add')} className="btn-primary mt-4">
              ➕ {t('food.add')}
            </button>
          )}
        </div>
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-2 gap-3">
          {filteredFoods.map(food => (
            <div
              key={food.id}
              onClick={() => navigate(`/food/${food.id}`)}
              className={`card cursor-pointer active:scale-[0.97] transition-transform overflow-hidden ${
                food.status === 'expired' ? 'border-danger-300' : food.status === 'expiring' ? 'border-orange-200' : ''
              }`}
            >
              {food.image ? (
                <div className="w-full h-28 -mx-4 -mt-4 mb-2 overflow-hidden">
                  <img src={food.image} alt={food.name} className="w-full h-full object-cover" />
                </div>
              ) : null}
              <div className="flex items-start justify-between mb-2">
                <span className="text-2xl">{getCategoryIcon(food.categoryId)}</span>
                <span className={`badge badge-${food.status} text-xs`}>
                  {getDaysText(food)}
                </span>
              </div>
              <p className="font-medium text-sm truncate">{food.name}</p>
              <p className="text-xs text-gray-400 mt-1">
                {getAreaName(food.areaId)} · {food.quantity}{food.unit}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {filteredFoods.map(food => (
            <div
              key={food.id}
              onClick={() => navigate(`/food/${food.id}`)}
              className={`card flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform ${
                food.status === 'expired' ? 'border-danger-300' : food.status === 'expiring' ? 'border-orange-200' : ''
              }`}
            >
              {food.image ? (
                <img src={food.image} alt={food.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              ) : (
                <span className="text-2xl flex-shrink-0">{getCategoryIcon(food.categoryId)}</span>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{food.name}</p>
                <p className="text-xs text-gray-400">
                  {getAreaName(food.areaId)} · {food.quantity}{food.unit}
                </p>
              </div>
              <div className="text-right">
                <span className={`badge badge-${food.status} text-xs`}>
                  {getDaysText(food)}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
