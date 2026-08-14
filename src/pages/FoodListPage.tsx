import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStore } from '@/store';
import { getRemainingDays } from '@/db';
import type { FoodItem, FridgeArea } from '@/types';

type ViewMode = 'fridge' | 'list';
type StatusFilter = 'all' | 'fresh' | 'normal' | 'expiring' | 'expired';
type SortBy = 'expiry' | 'date' | 'name';

interface DragState {
  foodId: string;
  foodName: string;
  image?: string;
  currentX: number;
  currentY: number;
  sourceAreaId: string;
}

export default function FoodListPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const foods = useStore(s => s.foods);
  const categories = useStore(s => s.categories);
  const areas = useStore(s => s.areas);
  const updateArea = useStore(s => s.updateArea);
  const addArea = useStore(s => s.addArea);
  const deleteArea = useStore(s => s.deleteArea);
  const transferFood = useStore(s => s.transferFood);
  const updateFood = useStore(s => s.updateFood);
  const isEn = i18n.language === 'en';

  const [viewMode, setViewMode] = useState<ViewMode>('fridge');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(
    (searchParams.get('status') as StatusFilter) || 'all'
  );
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortBy>('expiry');
  const [showFilter, setShowFilter] = useState(false);

  // 编辑模式
  const [editMode, setEditMode] = useState(false);
  const [editingZone, setEditingZone] = useState<string | null>(null);
  const [editZoneName, setEditZoneName] = useState('');
  const [editZoneTemp, setEditZoneTemp] = useState(0);
  const [editZoneIcon, setEditZoneIcon] = useState('');
  const [showAddZone, setShowAddZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneTemp, setNewZoneTemp] = useState(4);
  const [newZoneIcon, setNewZoneIcon] = useState('🧊');

  // 拖拽状态
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveFoodId, setMoveFoodId] = useState<string | null>(null);

  // 按区域分组食物
  const foodsByArea = useMemo(() => {
    const map: Record<string, FoodItem[]> = {};
    for (const area of areas) {
      map[area.id] = foods.filter(f => f.slotId === area.id || (!f.slotId && f.areaId === area.id));
    }
    return map;
  }, [foods, areas]);

  // 筛选后的食物
  const filteredFoods = useMemo(() => {
    let result = [...foods];
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(f => f.name.toLowerCase().includes(q) || f.tags.some(tag => tag.toLowerCase().includes(q)));
    }
    if (statusFilter !== 'all') result = result.filter(f => f.status === statusFilter);
    if (categoryFilter !== 'all') result = result.filter(f => f.categoryId === categoryFilter);
    result.sort((a, b) => {
      switch (sortBy) {
        case 'expiry': return new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime();
        case 'date': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'name': return a.name.localeCompare(b.name);
        default: return 0;
      }
    });
    return result;
  }, [foods, search, statusFilter, categoryFilter, sortBy]);

  // 区域颜色
  const getZoneColor = (area: FridgeArea) => {
    const n = (area.name + area.nameEn).toLowerCase();
    if (n.includes('冷冻') || n.includes('freezer')) return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
    if (n.includes('保鲜') || n.includes('fresh') || n.includes('果蔬') || n.includes('crisper')) return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
    if (n.includes('门') || n.includes('door')) return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
    if (n.includes('变温') || n.includes('variable')) return 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-700';
    return 'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fresh': return 'border-green-400 bg-green-50 dark:bg-green-900/20';
      case 'normal': return 'border-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'expiring': return 'border-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'expired': return 'border-red-400 bg-red-50 dark:bg-red-900/20';
      default: return 'border-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getCategoryIcon = (catId: string) => categories.find(c => c.id === catId)?.icon || '📦';
  const getAreaName = (areaId: string) => areas.find(a => a.id === areaId)?.name || '';

  const getDaysText = (food: FoodItem) => {
    const days = getRemainingDays(food.expiryDate);
    if (days < 0) return `${isEn ? 'Expired' : '过期'} ${Math.abs(days)}${isEn ? 'd' : '天'}`;
    if (days === 0) return isEn ? 'Today' : '今天';
    if (days === 1) return isEn ? 'Tomorrow' : '明天';
    return `${days}${isEn ? 'd' : '天'}`;
  };

  const getDaysLeft = (food: FoodItem) => {
    return Math.ceil((new Date(food.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  };

  const statusFilters: { key: StatusFilter; label: string; emoji: string }[] = [
    { key: 'all', label: isEn ? 'All' : '全部', emoji: '📋' },
    { key: 'fresh', label: isEn ? 'Fresh' : '新鲜', emoji: '🟢' },
    { key: 'normal', label: isEn ? 'Normal' : '正常', emoji: '🟡' },
    { key: 'expiring', label: isEn ? 'Expiring' : '临期', emoji: '🟠' },
    { key: 'expired', label: isEn ? 'Expired' : '过期', emoji: '🔴' },
  ];

  // === 桌面端 HTML5 拖拽 ===
  const handleDragStart = (e: React.DragEvent, food: FoodItem) => {
    if (editMode) return;
    e.dataTransfer.setData('text/plain', food.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, areaId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(areaId);
  };
  const handleDragLeave = () => setDropTarget(null);
  const handleDrop = async (e: React.DragEvent, targetAreaId: string) => {
    e.preventDefault();
    const foodId = e.dataTransfer.getData('text/plain');
    if (foodId) {
      const food = foods.find(f => f.id === foodId);
      if (food && (food.slotId || food.areaId) !== targetAreaId) {
        await updateFood(foodId, { slotId: targetAreaId });
        await transferFood(foodId, targetAreaId);
      }
    }
    setDropTarget(null);
  };

  // === 移动端触摸拖拽 ===
  const handleTouchStart = (e: React.TouchEvent, food: FoodItem) => {
    if (editMode) return;
    const touch = e.touches[0];
    setDragState({
      foodId: food.id, foodName: food.name, image: food.image,
      currentX: touch.clientX, currentY: touch.clientY,
      sourceAreaId: food.slotId || food.areaId,
    });
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!dragState) return;
    e.preventDefault();
    const touch = e.touches[0];
    setDragState(prev => prev ? { ...prev, currentX: touch.clientX, currentY: touch.clientY } : null);
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (el) {
      const zoneEl = el.closest('[data-zone-id]');
      setDropTarget(zoneEl ? zoneEl.getAttribute('data-zone-id') : null);
    }
  }, [dragState]);

  const handleTouchEnd = useCallback(async () => {
    if (!dragState) return;
    if (dropTarget && dropTarget !== dragState.sourceAreaId) {
      const food = foods.find(f => f.id === dragState.foodId);
      if (food) {
        await updateFood(dragState.foodId, { slotId: dropTarget });
        await transferFood(dragState.foodId, dropTarget);
      }
    }
    setDragState(null);
    setDropTarget(null);
  }, [dragState, dropTarget, foods, updateFood, transferFood]);

  useEffect(() => {
    if (dragState) {
      document.addEventListener('touchmove', handleTouchMove, { passive: false });
      document.addEventListener('touchend', handleTouchEnd);
      return () => {
        document.removeEventListener('touchmove', handleTouchMove);
        document.removeEventListener('touchend', handleTouchEnd);
      };
    }
  }, [dragState, handleTouchMove, handleTouchEnd]);

  // 点击食物 → 移动弹窗 / 详情
  const handleFoodTap = (food: FoodItem) => {
    if (editMode) return;
    if (dragState) return;
    if (viewMode === 'fridge') {
      setMoveFoodId(food.id);
      setShowMoveModal(true);
    } else {
      navigate(`/food/${food.id}`);
    }
  };

  const handleMoveToArea = async (areaId: string) => {
    if (moveFoodId) {
      const food = foods.find(f => f.id === moveFoodId);
      if (food && (food.slotId || food.areaId) !== areaId) {
        await updateFood(moveFoodId, { slotId: areaId });
        await transferFood(moveFoodId, areaId);
      }
    }
    setShowMoveModal(false);
    setMoveFoodId(null);
  };

  // === 区域编辑 ===
  const startEditZone = (area: FridgeArea) => {
    setEditingZone(area.id);
    setEditZoneName(isEn ? area.nameEn : area.name);
    setEditZoneTemp(area.temperature ?? 4);
    setEditZoneIcon(area.icon);
  };

  const saveEditZone = async (areaId: string) => {
    await updateArea(areaId, { name: editZoneName, nameEn: editZoneName, temperature: editZoneTemp, icon: editZoneIcon });
    setEditingZone(null);
  };

  const handleAddZone = async () => {
    if (!newZoneName.trim()) return;
    await addArea({
      name: newZoneName, nameEn: newZoneName, icon: newZoneIcon,
      temperature: newZoneTemp, sortOrder: areas.length + 1, isPreset: false,
    });
    setNewZoneName('');
    setShowAddZone(false);
  };

  const sortedAreas = [...areas].sort((a, b) => a.sortOrder - b.sortOrder);

  // 图标选择列表
  const zoneIcons = ['🧊', '❄️', '🌡️', '🚪', '🥬', '🥩', '🍎', '🥤', '🧂', '🍱', '📦'];

  return (
    <div className="page-container animate-fade-in">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3">
        <h1 className="page-title mb-0">{isEn ? 'Fridge & Foods' : '冰箱与食物'}</h1>
        <div className="flex gap-1.5">
          {viewMode === 'fridge' && (
            <button
              onClick={() => { setEditMode(!editMode); setEditingZone(null); setShowAddZone(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${editMode ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}
            >
              {editMode ? (isEn ? 'Done' : '完成') : (isEn ? 'Edit' : '编辑')}
            </button>
          )}
        </div>
      </div>

      {/* 视图切换 + 搜索 */}
      <div className="flex gap-2 mb-3">
        <div className="flex-1 relative">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder={t('food.search')} className="input-field pl-10" />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
        </div>
        <button onClick={() => setShowFilter(!showFilter)}
          className={`px-3 rounded-xl border transition-all ${showFilter ? 'bg-primary-500 text-white border-primary-500' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600'}`}>
          ⚙️
        </button>
      </div>

      {/* 视图模式切换 */}
      <div className="flex gap-1 mb-3">
        <button onClick={() => setViewMode('fridge')}
          className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${viewMode === 'fridge' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-600'}`}>
          🧊 {isEn ? 'Fridge View' : '冰箱视图'}
        </button>
        <button onClick={() => setViewMode('list')}
          className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${viewMode === 'list' ? 'bg-primary-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-600'}`}>
          📋 {isEn ? 'List View' : '列表视图'}
        </button>
      </div>

      {/* 筛选面板 */}
      {showFilter && (
        <div className="card mb-3 animate-slide-up space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{isEn ? 'Sort' : '排序'}</label>
            <div className="flex gap-2">
              {[
                { key: 'expiry' as SortBy, label: isEn ? 'By Expiry' : '按到期' },
                { key: 'date' as SortBy, label: isEn ? 'By Date' : '按日期' },
                { key: 'name' as SortBy, label: isEn ? 'By Name' : '按名称' },
              ].map(s => (
                <button key={s.key} onClick={() => setSortBy(s.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${sortBy === s.key ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300'}`}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">{isEn ? 'Category' : '分类'}</label>
            <div className="flex gap-2 flex-wrap">
              <button onClick={() => setCategoryFilter('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${categoryFilter === 'all' ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                {isEn ? 'All' : '全部'}
              </button>
              {categories.map(cat => (
                <button key={cat.id} onClick={() => setCategoryFilter(cat.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${categoryFilter === cat.id ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'}`}>
                  {cat.icon} {cat.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 状态标签 */}
      <div className="flex gap-1 mb-3 overflow-x-auto pb-1">
        {statusFilters.map(sf => (
          <button key={sf.key} onClick={() => setStatusFilter(sf.key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${statusFilter === sf.key ? 'bg-primary-500 text-white shadow-sm' : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-600'}`}>
            {sf.emoji} {sf.label}
            {sf.key !== 'all' && <span className="ml-1">({foods.filter(f => sf.key === 'all' || f.status === sf.key).length})</span>}
          </button>
        ))}
      </div>

      {/* ============ 冰箱视图 ============ */}
      {viewMode === 'fridge' && (
        <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl p-2 shadow-inner">
          {areas.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <span className="text-4xl block mb-3">🧊</span>
              <p>{isEn ? 'No fridge zones configured' : '未配置冰箱区域'}</p>
              <button onClick={() => { setEditMode(true); setShowAddZone(true); }}
                className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm">
                + {isEn ? 'Add Zone' : '添加区域'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {sortedAreas.map(area => {
                const areaFoods = search
                  ? (foodsByArea[area.id] || []).filter(f => f.name.toLowerCase().includes(search.toLowerCase()))
                  : (statusFilter !== 'all'
                    ? (foodsByArea[area.id] || []).filter(f => f.status === statusFilter)
                    : (categoryFilter !== 'all'
                      ? (foodsByArea[area.id] || []).filter(f => f.categoryId === categoryFilter)
                      : foodsByArea[area.id] || []));
                const isEditing = editingZone === area.id;

                return (
                  <div key={area.id} data-zone-id={area.id}
                    className={`rounded-xl border-2 p-3 transition-all duration-200 ${getZoneColor(area)} ${dropTarget === area.id ? 'ring-2 ring-primary-500 scale-[1.02]' : ''}`}
                    onDragOver={e => handleDragOver(e, area.id)}
                    onDragLeave={handleDragLeave}
                    onDrop={e => handleDrop(e, area.id)}>

                    {/* 区域标题 */}
                    {isEditing ? (
                      <div className="space-y-2 mb-2">
                        <div className="flex gap-2 items-center">
                          <div className="flex gap-1 flex-wrap">
                            {zoneIcons.map(ic => (
                              <button key={ic} onClick={() => setEditZoneIcon(ic)}
                                className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${editZoneIcon === ic ? 'bg-primary-500 ring-2 ring-primary-300' : 'bg-white/50 dark:bg-gray-800/50'}`}>
                                {ic}
                              </button>
                            ))}
                          </div>
                        </div>
                        <input type="text" value={editZoneName} onChange={e => setEditZoneName(e.target.value)}
                          className="input-field text-sm" placeholder={isEn ? 'Zone name' : '区域名称'} />
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-500">{isEn ? 'Temp' : '温度'}:</span>
                          <button onClick={() => setEditZoneTemp(editZoneTemp - 1)} className="w-8 h-8 rounded-lg bg-white/60 dark:bg-gray-700 text-lg font-bold">−</button>
                          <span className="text-sm font-bold w-14 text-center">{editZoneTemp}°C</span>
                          <button onClick={() => setEditZoneTemp(editZoneTemp + 1)} className="w-8 h-8 rounded-lg bg-white/60 dark:bg-gray-700 text-lg font-bold">+</button>
                        </div>
                        <div className="flex gap-2">
                          <button onClick={() => setEditingZone(null)} className="flex-1 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-600 text-xs">{isEn ? 'Cancel' : '取消'}</button>
                          <button onClick={() => saveEditZone(area.id)} className="flex-1 py-1.5 rounded-lg bg-primary-500 text-white text-xs">{isEn ? 'Save' : '保存'}</button>
                          {!area.isPreset && (
                            <button onClick={async () => {
                              if (confirm(isEn ? 'Delete this zone?' : '确定删除此区域？')) {
                                await deleteArea(area.id);
                                setEditingZone(null);
                              }
                            }} className="py-1.5 px-3 rounded-lg bg-red-500 text-white text-xs">🗑️</button>
                          )}
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-1.5">
                            <span className="text-lg">{area.icon}</span>
                            <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                              {isEn ? area.nameEn : area.name}
                            </span>
                            {area.temperature !== undefined && (
                              <span className="text-xs text-gray-500 dark:text-gray-400 bg-white/40 dark:bg-gray-800/40 px-1.5 py-0.5 rounded">
                                {area.temperature}°C
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              {areaFoods.length} {isEn ? 'items' : '件'}
                            </span>
                            {editMode && (
                              <button onClick={() => startEditZone(area)} className="text-xs text-primary-600 dark:text-primary-400 font-medium">
                                ✏️
                              </button>
                            )}
                          </div>
                        </div>

                        {/* 食物卡片 */}
                        <div className="flex flex-wrap gap-2 min-h-[40px]">
                          {areaFoods.length === 0 ? (
                            <div className="text-xs text-gray-400 dark:text-gray-500 italic py-2 w-full text-center">
                              {editMode ? (isEn ? 'Empty zone' : '空区域') : (isEn ? 'Empty - drag food here' : '空 - 拖拽食物到这里')}
                            </div>
                          ) : (
                            areaFoods.map(food => {
                              const daysLeft = getDaysLeft(food);
                              return (
                                <div key={food.id} draggable={!editMode}
                                  onDragStart={e => handleDragStart(e, food)}
                                  onTouchStart={e => handleTouchStart(e, food)}
                                  onClick={() => handleFoodTap(food)}
                                  className={`relative flex flex-col items-center w-16 h-20 rounded-lg border-2 p-1 cursor-grab active:cursor-grabbing select-none transition-transform hover:scale-105 ${getStatusColor(food.status)}`}
                                  style={{ touchAction: 'none' }}>
                                  {food.image ? (
                                    <img src={food.image} alt={food.name} className="w-10 h-10 rounded object-cover" />
                                  ) : (
                                    <div className="w-10 h-10 rounded bg-white/50 dark:bg-gray-800/50 flex items-center justify-center text-lg">
                                      {food.name.charAt(0)}
                                    </div>
                                  )}
                                  <span className="text-[10px] text-gray-700 dark:text-gray-300 text-center leading-tight mt-0.5 truncate w-full">{food.name}</span>
                                  <span className={`text-[9px] leading-tight ${daysLeft < 0 ? 'text-red-600 dark:text-red-400 font-bold' : daysLeft <= 2 ? 'text-orange-600 dark:text-orange-400' : 'text-gray-500 dark:text-gray-400'}`}>
                                    {daysLeft < 0 ? (isEn ? 'Expired' : '过期') : `${daysLeft}${isEn ? 'd' : '天'}`}
                                  </span>
                                  {food.quantity > 1 && (
                                    <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">{food.quantity}</span>
                                  )}
                                </div>
                              );
                            })
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* 编辑模式：添加区域 */}
          {editMode && (
            <div className="mt-2">
              {showAddZone ? (
                <div className="rounded-xl border-2 border-dashed border-primary-400 p-3 bg-white/50 dark:bg-gray-800/50 space-y-2">
                  <div className="flex gap-1 flex-wrap">
                    {zoneIcons.map(ic => (
                      <button key={ic} onClick={() => setNewZoneIcon(ic)}
                        className={`w-8 h-8 rounded-lg text-lg flex items-center justify-center transition-all ${newZoneIcon === ic ? 'bg-primary-500 ring-2 ring-primary-300' : 'bg-white/50 dark:bg-gray-700'}`}>
                        {ic}
                      </button>
                    ))}
                  </div>
                  <input type="text" value={newZoneName} onChange={e => setNewZoneName(e.target.value)}
                    className="input-field text-sm" placeholder={isEn ? 'Zone name' : '区域名称'} />
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{isEn ? 'Temp' : '温度'}:</span>
                    <button onClick={() => setNewZoneTemp(newZoneTemp - 1)} className="w-8 h-8 rounded-lg bg-white/60 dark:bg-gray-700 text-lg font-bold">−</button>
                    <span className="text-sm font-bold w-14 text-center">{newZoneTemp}°C</span>
                    <button onClick={() => setNewZoneTemp(newZoneTemp + 1)} className="w-8 h-8 rounded-lg bg-white/60 dark:bg-gray-700 text-lg font-bold">+</button>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddZone(false)} className="flex-1 py-1.5 rounded-lg bg-gray-200 dark:bg-gray-600 text-xs">{isEn ? 'Cancel' : '取消'}</button>
                    <button onClick={handleAddZone} className="flex-1 py-1.5 rounded-lg bg-primary-500 text-white text-xs">{isEn ? 'Add' : '添加'}</button>
                  </div>
                </div>
              ) : (
                <button onClick={() => setShowAddZone(true)}
                  className="w-full py-3 rounded-xl border-2 border-dashed border-gray-400 dark:border-gray-500 text-gray-500 dark:text-gray-400 text-sm flex items-center justify-center gap-1 active:bg-gray-100 dark:active:bg-gray-700 transition-all">
                  + {isEn ? 'Add Zone' : '添加区域'}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ============ 列表视图 ============ */}
      {viewMode === 'list' && (
        <>
          <div className="flex justify-between items-center mb-3">
            <span className="text-sm text-gray-400">{filteredFoods.length} {isEn ? 'items' : '件'}</span>
          </div>
          {filteredFoods.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-5xl mb-4">🧊</p>
              <p className="text-gray-400 mb-2">{foods.length === 0 ? (isEn ? 'Fridge is empty' : '冰箱空空如也') : (isEn ? 'No results' : '没有找到匹配的食物')}</p>
              {foods.length === 0 && (
                <button onClick={() => navigate('/add')} className="btn-primary mt-4">➕ {isEn ? 'Add Food' : '录入食物'}</button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredFoods.map(food => (
                <div key={food.id} onClick={() => navigate(`/food/${food.id}`)}
                  className={`card flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-transform ${food.status === 'expired' ? 'border-danger-300' : food.status === 'expiring' ? 'border-orange-200' : ''}`}>
                  {food.image ? (
                    <img src={food.image} alt={food.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
                  ) : (
                    <span className="text-2xl flex-shrink-0">{getCategoryIcon(food.categoryId)}</span>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{food.name}</p>
                    <p className="text-xs text-gray-400">{getAreaName(food.areaId)} · {food.quantity}{food.unit}</p>
                  </div>
                  <div className="text-right">
                    <span className={`badge badge-${food.status} text-xs`}>{getDaysText(food)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* 统计 */}
      {viewMode === 'fridge' && areas.length > 0 && (
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
            <div className="text-lg font-bold text-gray-800 dark:text-white">{foods.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{isEn ? 'Total' : '总计'}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
            <div className="text-lg font-bold text-orange-500">{foods.filter(f => f.status === 'expiring').length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{isEn ? 'Expiring' : '临期'}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
            <div className="text-lg font-bold text-red-500">{foods.filter(f => f.status === 'expired').length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400">{isEn ? 'Expired' : '已过期'}</div>
          </div>
        </div>
      )}

      {/* 移动端拖拽浮动元素 */}
      {dragState && (
        <div className="fixed pointer-events-none z-50" style={{ left: dragState.currentX - 32, top: dragState.currentY - 40 }}>
          <div className="w-16 h-16 rounded-xl bg-primary-500/80 shadow-lg flex flex-col items-center justify-center text-white border-2 border-white">
            {dragState.image ? (
              <img src={dragState.image} alt={dragState.foodName} className="w-10 h-10 rounded object-cover" />
            ) : (
              <span className="text-xl">📦</span>
            )}
            <span className="text-[9px] truncate w-full text-center px-1">{dragState.foodName}</span>
          </div>
        </div>
      )}

      {/* 移动端点击移动弹窗 */}
      {showMoveModal && moveFoodId && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center" onClick={() => setShowMoveModal(false)}>
          <div className="bg-white dark:bg-gray-800 rounded-t-2xl w-full max-w-md p-4 pb-8" onClick={e => e.stopPropagation()}>
            <div className="flex gap-2 mb-3">
              <button onClick={() => { const food = foods.find(f => f.id === moveFoodId); if (food) navigate(`/food/${food.id}`); setShowMoveModal(false); }}
                className="flex-1 py-2 rounded-lg bg-primary-500 text-white text-sm font-medium">
                {isEn ? 'View Detail' : '查看详情'}
              </button>
              <button onClick={() => { setShowMoveModal(false); setMoveFoodId(null); }}
                className="py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-600 text-sm">{isEn ? 'Close' : '关闭'}</button>
            </div>
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3 text-center">{isEn ? 'Move to...' : '移动到...'}</h3>
            <div className="space-y-2">
              {sortedAreas.map(area => {
                const food = foods.find(f => f.id === moveFoodId);
                const isCurrent = food && (food.slotId === area.id || food.areaId === area.id);
                return (
                  <button key={area.id} onClick={() => handleMoveToArea(area.id)} disabled={!!isCurrent}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${isCurrent ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 opacity-60' : 'border-gray-200 dark:border-gray-600 active:bg-gray-100 dark:active:bg-gray-700'}`}>
                    <span className="text-2xl">{area.icon}</span>
                    <div className="text-left flex-1">
                      <div className="font-medium text-gray-800 dark:text-white text-sm">{isEn ? area.nameEn : area.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">{foodsByArea[area.id]?.length || 0} {isEn ? 'items' : '件'} · {area.temperature ?? '--'}°C</div>
                    </div>
                    {isCurrent && <span className="text-xs text-primary-500">{isEn ? 'Current' : '当前'}</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
