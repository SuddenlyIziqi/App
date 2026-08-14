import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/store';
import type { FoodItem, FridgeArea } from '@/types';

interface DragState {
  foodId: string;
  foodName: string;
  image?: string;
  startX: number;
  startY: number;
  currentX: number;
  currentY: number;
  sourceAreaId: string;
}

export default function FridgeViewPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const foods = useStore(s => s.foods);
  const areas = useStore(s => s.areas);
  const transferFood = useStore(s => s.transferFood);
  const updateFood = useStore(s => s.updateFood);
  const isEn = i18n.language === 'en';

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [selectedFood, setSelectedFood] = useState<string | null>(null);
  const [showMoveModal, setShowMoveModal] = useState(false);
  const [moveFoodId, setMoveFoodId] = useState<string | null>(null);
  const dragRef = useRef<HTMLDivElement>(null);

  // 按区域分组食物 (使用 slotId 或 areaId)
  const foodsByArea: Record<string, FoodItem[]> = {};
  for (const area of areas) {
    foodsByArea[area.id] = foods.filter(f => f.slotId === area.id || (!f.slotId && f.areaId === area.id));
  }

  // 获取区域类型颜色
  const getZoneColor = (area: FridgeArea) => {
    if (area.name.includes('冷冻') || area.nameEn.includes('Freezer')) return 'bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700';
    if (area.name.includes('保鲜') || area.nameEn.includes('Fresh')) return 'bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700';
    if (area.name.includes('门') || area.nameEn.includes('Door')) return 'bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700';
    return 'bg-cyan-100 dark:bg-cyan-900/30 border-cyan-300 dark:border-cyan-700';
  };

  const getZoneIcon = (area: FridgeArea) => {
    if (area.name.includes('冷冻') || area.nameEn.includes('Freezer')) return '❄️';
    if (area.name.includes('保鲜') || area.nameEn.includes('Fresh')) return '🥬';
    if (area.name.includes('门') || area.nameEn.includes('Door')) return '🚪';
    return '🧊';
  };

  // 获取食物状态颜色
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'fresh': return 'border-green-400 bg-green-50 dark:bg-green-900/20';
      case 'normal': return 'border-blue-400 bg-blue-50 dark:bg-blue-900/20';
      case 'expiring': return 'border-orange-400 bg-orange-50 dark:bg-orange-900/20';
      case 'expired': return 'border-red-400 bg-red-50 dark:bg-red-900/20';
      default: return 'border-gray-400 bg-gray-50 dark:bg-gray-900/20';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'fresh': return isEn ? 'Fresh' : '新鲜';
      case 'normal': return isEn ? 'Normal' : '正常';
      case 'expiring': return isEn ? 'Expiring' : '临期';
      case 'expired': return isEn ? 'Expired' : '过期';
      default: return status;
    }
  };

  // === 桌面端 HTML5 拖拽 ===
  const handleDragStart = (e: React.DragEvent, food: FoodItem) => {
    e.dataTransfer.setData('text/plain', food.id);
    e.dataTransfer.effectAllowed = 'move';
    setDropTarget(food.areaId);
  };

  const handleDragOver = (e: React.DragEvent, areaId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropTarget(areaId);
  };

  const handleDragLeave = () => {
    setDropTarget(null);
  };

  const handleDrop = async (e: React.DragEvent, targetAreaId: string) => {
    e.preventDefault();
    const foodId = e.dataTransfer.getData('text/plain');
    if (foodId) {
      const food = foods.find(f => f.id === foodId);
      if (food && food.areaId !== targetAreaId) {
        await updateFood(foodId, { slotId: targetAreaId });
        await transferFood(foodId, targetAreaId);
      }
    }
    setDropTarget(null);
  };

  // === 移动端触摸拖拽 ===
  const handleTouchStart = (e: React.TouchEvent, food: FoodItem) => {
    const touch = e.touches[0];
    setDragState({
      foodId: food.id,
      foodName: food.name,
      image: food.image,
      startX: touch.clientX,
      startY: touch.clientY,
      currentX: touch.clientX,
      currentY: touch.clientY,
      sourceAreaId: food.slotId || food.areaId,
    });
  };

  const handleTouchMove = useCallback((e: TouchEvent) => {
    if (!dragState) return;
    e.preventDefault();
    const touch = e.touches[0];
    setDragState(prev => prev ? { ...prev, currentX: touch.clientX, currentY: touch.clientY } : null);

    // 检测当前触摸点下方的区域
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    if (element) {
      const zoneEl = element.closest('[data-zone-id]');
      if (zoneEl) {
        setDropTarget(zoneEl.getAttribute('data-zone-id'));
      } else {
        setDropTarget(null);
      }
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

  // 移动端：点击选择食物进行移动
  const handleFoodTap = (food: FoodItem) => {
    if (dragState) {
      // 如果已经在拖拽中，点击其他区域完成移动
      return;
    }
    setMoveFoodId(food.id);
    setShowMoveModal(true);
  };

  const handleMoveToArea = async (areaId: string) => {
    if (moveFoodId) {
      const food = foods.find(f => f.id === moveFoodId);
      if (food && food.areaId !== areaId) {
        await updateFood(moveFoodId, { slotId: areaId });
        await transferFood(moveFoodId, areaId);
      }
    }
    setShowMoveModal(false);
    setMoveFoodId(null);
  };

  // 计算剩余天数
  const getDaysLeft = (food: FoodItem) => {
    const now = new Date();
    const expiry = new Date(food.expiryDate);
    const diff = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return diff;
  };

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-gray-900 pb-4">
      {/* 头部 */}
      <div className="bg-white dark:bg-gray-800 px-4 py-3 shadow-sm sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <button onClick={() => navigate(-1)} className="text-2xl">←</button>
          <h1 className="text-lg font-bold text-gray-800 dark:text-white">
            {isEn ? 'Fridge View' : '冰箱视图'}
          </h1>
          <div className="w-8" />
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-center">
          {isEn ? 'Drag food to move between zones, or tap to select' : '拖拽食物移动区域，或点击选择移动'}
        </p>
      </div>

      {/* 冰箱主体 */}
      <div className="max-w-md mx-auto mt-4 px-3">
        {/* 冰箱外壳 */}
        <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl p-2 shadow-inner">
          {areas.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <span className="text-4xl block mb-3">🧊</span>
              <p>{isEn ? 'No fridge model selected' : '未选择冰箱型号'}</p>
              <button
                onClick={() => navigate('/settings')}
                className="mt-3 px-4 py-2 bg-primary-500 text-white rounded-lg text-sm"
              >
                {isEn ? 'Go to Settings' : '去设置选择'}
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {areas.sort((a, b) => a.sortOrder - b.sortOrder).map(area => (
                <div
                  key={area.id}
                  data-zone-id={area.id}
                  className={`rounded-xl border-2 p-3 transition-all duration-200 ${getZoneColor(area)} ${
                    dropTarget === area.id ? 'ring-2 ring-primary-500 scale-[1.02]' : ''
                  }`}
                  onDragOver={(e) => handleDragOver(e, area.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, area.id)}
                >
                  {/* 区域标题 */}
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-lg">{area.icon || getZoneIcon(area)}</span>
                      <span className="font-semibold text-sm text-gray-700 dark:text-gray-200">
                        {isEn ? area.nameEn : area.name}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500 dark:text-gray-400">
                      {foodsByArea[area.id]?.length || 0} {isEn ? 'items' : '件'}
                      {area.temperature !== undefined && ` · ${area.temperature}°C`}
                    </span>
                  </div>

                  {/* 食物列表 */}
                  <div className="flex flex-wrap gap-2 min-h-[40px]">
                    {(foodsByArea[area.id] || []).length === 0 ? (
                      <div className="text-xs text-gray-400 dark:text-gray-500 italic py-2 w-full text-center">
                        {isEn ? 'Empty - drag food here' : '空 - 拖拽食物到这里'}
                      </div>
                    ) : (
                      (foodsByArea[area.id] || []).map(food => {
                        const daysLeft = getDaysLeft(food);
                        return (
                          <div
                            key={food.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, food)}
                            onTouchStart={(e) => handleTouchStart(e, food)}
                            onClick={() => handleFoodTap(food)}
                            className={`relative flex flex-col items-center w-16 h-20 rounded-lg border-2 p-1 cursor-grab active:cursor-grabbing select-none transition-transform hover:scale-105 ${getStatusColor(food.status)}`}
                            style={{ touchAction: 'none' }}
                          >
                            {food.image ? (
                              <img src={food.image} alt={food.name} className="w-10 h-10 rounded object-cover" />
                            ) : (
                              <div className="w-10 h-10 rounded bg-white/50 dark:bg-gray-800/50 flex items-center justify-center text-lg">
                                {food.name.charAt(0)}
                              </div>
                            )}
                            <span className="text-[10px] text-gray-700 dark:text-gray-300 text-center leading-tight mt-0.5 truncate w-full">
                              {food.name}
                            </span>
                            <span className={`text-[9px] leading-tight ${
                              daysLeft < 0 ? 'text-red-600 dark:text-red-400 font-bold' :
                              daysLeft <= 2 ? 'text-orange-600 dark:text-orange-400' :
                              'text-gray-500 dark:text-gray-400'
                            }`}>
                              {daysLeft < 0 ? (isEn ? `Expired` : `过期`) : `${daysLeft}${isEn ? 'd' : '天'}`}
                            </span>
                            {/* 数量角标 */}
                            {food.quantity > 1 && (
                              <span className="absolute -top-1 -right-1 bg-primary-500 text-white text-[9px] rounded-full w-4 h-4 flex items-center justify-center">
                                {food.quantity}
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 统计信息 */}
        {areas.length > 0 && (
          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
              <div className="text-lg font-bold text-gray-800 dark:text-white">{foods.length}</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{isEn ? 'Total' : '总计'}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
              <div className="text-lg font-bold text-orange-500">
                {foods.filter(f => f.status === 'expiring').length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{isEn ? 'Expiring' : '临期'}</div>
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-xl p-3 text-center shadow-sm">
              <div className="text-lg font-bold text-red-500">
                {foods.filter(f => f.status === 'expired').length}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">{isEn ? 'Expired' : '已过期'}</div>
            </div>
          </div>
        )}
      </div>

      {/* 移动端拖拽浮动元素 */}
      {dragState && (
        <div
          ref={dragRef}
          className="fixed pointer-events-none z-50"
          style={{
            left: dragState.currentX - 32,
            top: dragState.currentY - 40,
          }}
        >
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
            <h3 className="text-base font-bold text-gray-800 dark:text-white mb-3 text-center">
              {isEn ? 'Move to...' : '移动到...'}
            </h3>
            <div className="space-y-2">
              {areas.map(area => {
                const food = foods.find(f => f.id === moveFoodId);
                const isCurrentArea = food && (food.slotId === area.id || food.areaId === area.id);
                return (
                  <button
                    key={area.id}
                    onClick={() => handleMoveToArea(area.id)}
                    disabled={!!isCurrentArea}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      isCurrentArea
                        ? 'border-primary-400 bg-primary-50 dark:bg-primary-900/20 opacity-60'
                        : 'border-gray-200 dark:border-gray-600 active:bg-gray-100 dark:active:bg-gray-700'
                    }`}
                  >
                    <span className="text-2xl">{area.icon || getZoneIcon(area)}</span>
                    <div className="text-left flex-1">
                      <div className="font-medium text-gray-800 dark:text-white text-sm">
                        {isEn ? area.nameEn : area.name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {foodsByArea[area.id]?.length || 0} {isEn ? 'items' : '件'}
                      </div>
                    </div>
                    {isCurrentArea && (
                      <span className="text-xs text-primary-500">{isEn ? 'Current' : '当前'}</span>
                    )}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setShowMoveModal(false)}
              className="w-full mt-3 py-2 text-gray-500 dark:text-gray-400 text-sm"
            >
              {isEn ? 'Cancel' : '取消'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
