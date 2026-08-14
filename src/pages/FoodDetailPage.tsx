import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';
import { useStore } from '@/store';
import { getRemainingDays, getStatusColor } from '@/db';
import { compressImage } from '@/utils/imageUtils';

export default function FoodDetailPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const foods = useStore(s => s.foods);
  const categories = useStore(s => s.categories);
  const areas = useStore(s => s.areas);
  const logs = useStore(s => s.logs);
  const updateFood = useStore(s => s.updateFood);
  const deleteFood = useStore(s => s.deleteFood);
  const consumeFood = useStore(s => s.consumeFood);
  const discardFood = useStore(s => s.discardFood);
  const transferFood = useStore(s => s.transferFood);

  const food = foods.find(f => f.id === id);
  const category = categories.find(c => c.id === food?.categoryId);
  const area = areas.find(a => a.id === food?.areaId);
  const foodLogs = logs.filter(l => l.foodId === id);

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(food?.name || '');
  const [editQuantity, setEditQuantity] = useState(food?.quantity || 1);
  const [editShelfLife, setEditShelfLife] = useState(food?.shelfLifeDays || 7);
  const [editAreaId, setEditAreaId] = useState(food?.areaId || '');
  const [editNotes, setEditNotes] = useState(food?.notes || '');
  const [showActions, setShowActions] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showDiscard, setShowDiscard] = useState(false);
  const [discardReason, setDiscardReason] = useState('');
  const [showConsume, setShowConsume] = useState(false);
  const [consumeQty, setConsumeQty] = useState(1);
  const [editImage, setEditImage] = useState(food?.image || null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  if (!food) {
    return (
      <div className="page-container flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-5xl mb-4">🤷</p>
          <p className="text-gray-400">{t('common.noData')}</p>
          <button onClick={() => navigate('/foods')} className="btn-primary mt-4">
            {t('food.list')}
          </button>
        </div>
      </div>
    );
  }

  const isEn = i18n.language === 'en';
  const remainingDays = getRemainingDays(food.expiryDate);
  const statusColors: Record<string, string> = {
    fresh: 'badge-fresh',
    normal: 'badge-normal',
    expiring: 'badge-expiring',
    expired: 'badge-expired',
  };

  const handleSaveEdit = async () => {
    await updateFood(food.id, {
      name: editName,
      quantity: editQuantity,
      shelfLifeDays: editShelfLife,
      areaId: editAreaId,
      notes: editNotes,
      image: editImage || undefined,
    });
    setIsEditing(false);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImage(file);
      setEditImage(compressed);
    } catch (err) {
      console.error('Image compress failed:', err);
    }
    e.target.value = '';
  };

  const handleConsume = async () => {
    await consumeFood(food.id, consumeQty);
    setShowConsume(false);
    if (consumeQty >= food.quantity) {
      navigate('/foods');
    }
  };

  const handleDiscard = async () => {
    await discardFood(food.id, discardReason);
    navigate('/foods');
  };

  const handleTransfer = async (toAreaId: string) => {
    await transferFood(food.id, toAreaId);
    setShowTransfer(false);
  };

  const handleDelete = async () => {
    if (confirm(t('food.confirmDelete'))) {
      await deleteFood(food.id);
      navigate('/foods');
    }
  };

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-gray-900 pb-8">
      {/* 顶部 */}
      <div className="bg-gradient-to-br from-primary-400 to-primary-600 dark:from-gray-800 dark:to-gray-700 px-4 pt-6 pb-8 rounded-b-3xl">
        <div className="flex items-center justify-between mb-4">
          <button onClick={() => navigate(-1)} className="text-white text-xl">← </button>
          <div className="flex gap-2">
            <button onClick={() => setShowActions(!showActions)} className="text-white text-xl">⋯</button>
          </div>
        </div>
        <div className="text-center">
          {food.image ? (
            <img src={food.image} alt={food.name} className="w-24 h-24 rounded-2xl object-cover mx-auto border-2 border-white/30 shadow-lg" />
          ) : (
            <span className="text-5xl">{category?.icon || '📦'}</span>
          )}
          <h1 className="text-2xl font-bold text-white mt-2">{food.name}</h1>
          <div className={`inline-block mt-2 px-3 py-1 rounded-full text-sm font-medium ${statusColors[food.status]} border`}>
            {food.status === 'fresh' && `🟢 ${t('food.fresh')}`}
            {food.status === 'normal' && `🟡 ${t('food.normal')}`}
            {food.status === 'expiring' && `🟠 ${t('food.expiring')}`}
            {food.status === 'expired' && `🔴 ${t('food.expired')}`}
          </div>
        </div>
      </div>

      {/* 操作菜单 */}
      {showActions && (
        <div className="mx-4 -mt-4 card animate-slide-up z-10 relative">
          <div className="grid grid-cols-4 gap-2">
            <button onClick={() => { setIsEditing(true); setShowActions(false); }} className="flex flex-col items-center py-2 text-xs">
              <span className="text-xl mb-1">✏️</span>
              {t('food.modify')}
            </button>
            <button onClick={() => { setShowTransfer(true); setShowActions(false); }} className="flex flex-col items-center py-2 text-xs">
              <span className="text-xl mb-1">🔄</span>
              {t('food.transfer')}
            </button>
            <button onClick={handleConsume} className="flex flex-col items-center py-2 text-xs">
              <span className="text-xl mb-1">✅</span>
              {t('food.consume')}
            </button>
            <button onClick={() => { setShowDiscard(true); setShowActions(false); }} className="flex flex-col items-center py-2 text-xs text-danger-500">
              <span className="text-xl mb-1">🗑️</span>
              {t('food.discard')}
            </button>
          </div>
        </div>
      )}

      <div className="px-4 mt-4 space-y-4">
        {/* 到期信息 */}
        <div className={`card ${
          food.status === 'expired' ? 'border-danger-300 bg-danger-50 dark:bg-danger-900/10' :
          food.status === 'expiring' ? 'border-orange-200 bg-orange-50 dark:bg-orange-900/10' : ''
        }`}>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('food.purchaseDate')}</p>
              <p className="font-medium text-sm">{food.purchaseDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('food.expiryDate')}</p>
              <p className="font-medium text-sm">{food.expiryDate}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 mb-1">{t('food.status')}</p>
              <p className={`font-medium text-sm ${
                remainingDays < 0 ? 'text-danger-500' : remainingDays <= 1 ? 'text-orange-500' : 'text-primary-500'
              }`}>
                {remainingDays < 0 ? `${t('food.overdue')} ${Math.abs(remainingDays)}${t('food.dayUnit')}` :
                 remainingDays === 0 ? t('food.today') :
                 `${remainingDays}${t('food.dayUnit')}`}
              </p>
            </div>
          </div>
        </div>

        {/* 详细信息 */}
        <div className="card space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('food.category')}</span>
            <span>{category?.icon} {isEn ? category?.nameEn : category?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('food.area')}</span>
            <span>{area?.icon} {isEn ? area?.nameEn : area?.name}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('food.quantity')}</span>
            <span>{food.quantity} {food.unit}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-gray-500">{t('food.shelfLife')}</span>
            <span>{food.shelfLifeDays} {t('food.days')}</span>
          </div>
          {food.tags.length > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('food.tags')}</span>
              <div className="flex gap-1">
                {food.tags.map(tag => (
                  <span key={tag} className="badge bg-primary-100 text-primary-700 dark:bg-primary-900/30 dark:text-primary-400">
                    #{tag}
                  </span>
                ))}
              </div>
            </div>
          )}
          {food.notes && (
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t('food.notes')}</span>
              <span>{food.notes}</span>
            </div>
          )}
        </div>

        {/* 操作记录 */}
        {foodLogs.length > 0 && (
          <div>
            <h3 className="section-title">📋 {t('history.title')}</h3>
            <div className="space-y-2">
              {foodLogs.map(log => {
                const typeIcons: Record<string, string> = {
                  add: '➕', consume: '✅', discard: '🗑️', transfer: '🔄', modify: '✏️'
                };
                return (
                  <div key={log.id} className="card flex items-center gap-3 py-3">
                    <span>{typeIcons[log.type]}</span>
                    <div className="flex-1">
                      <p className="text-sm">{log.note || log.type}</p>
                      <p className="text-xs text-gray-400">{new Date(log.createdAt).toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 快捷操作按钮 */}
        <div className="grid grid-cols-3 gap-3">
          <button onClick={() => { setConsumeQty(1); setShowConsume(true); }} className="btn-primary text-sm">
            ✅ {t('food.consume')}
          </button>
          <button onClick={() => setShowTransfer(true)} className="btn-secondary text-sm">
            🔄 {t('food.transfer')}
          </button>
          <button onClick={() => setShowDiscard(true)} className="btn-danger text-sm">
            🗑️ {t('food.discard')}
          </button>
        </div>
      </div>

      {/* 编辑弹窗 */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl p-6 animate-slide-up max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{t('food.edit')}</h2>
              <button onClick={() => setIsEditing(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              {/* 图片编辑 */}
              <div>
                <label className="text-sm text-gray-500 mb-1 block">📷 {isEn ? 'Photo' : '图片'}</label>
                <div className="flex items-center gap-3">
                  {editImage ? (
                    <div className="relative">
                      <img src={editImage} alt="food" className="w-20 h-20 rounded-xl object-cover border border-gray-200 dark:border-gray-600" />
                      <button type="button" onClick={() => setEditImage(null)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-danger-500 text-white rounded-full text-xs flex items-center justify-center shadow">✕</button>
                    </div>
                  ) : null}
                  <label className="cursor-pointer px-4 py-2 rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-400 text-sm hover:border-primary-400 transition-all">
                    📷 {editImage ? (isEn ? 'Change' : '更换') : (isEn ? 'Add Photo' : '拍照')}
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageChange} className="hidden" />
                  </label>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('food.name')}</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="input-field" />
              </div>
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-sm text-gray-500 mb-1 block">{t('food.quantity')}</label>
                  <input type="number" min={1} value={editQuantity} onChange={e => setEditQuantity(parseInt(e.target.value) || 1)} className="input-field" />
                </div>
                <div className="flex-1">
                  <label className="text-sm text-gray-500 mb-1 block">{t('food.shelfLife')}</label>
                  <input type="number" min={0} value={editShelfLife} onChange={e => setEditShelfLife(parseInt(e.target.value) || 0)} className="input-field" />
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('food.area')}</label>
                <select value={editAreaId} onChange={e => setEditAreaId(e.target.value)} className="select-field">
                  {areas.map(a => (
                    <option key={a.id} value={a.id}>{a.icon} {a.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-sm text-gray-500 mb-1 block">{t('food.notes')}</label>
                <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} className="input-field resize-none" rows={2} />
              </div>
              <div className="flex gap-3">
                <button onClick={() => setIsEditing(false)} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button onClick={handleSaveEdit} className="btn-primary flex-1">
                  {t('common.save')}
                </button>
              </div>
              <button onClick={handleDelete} className="btn-danger w-full mt-2">
                🗑️ {t('food.delete')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 转移弹窗 */}
      {showTransfer && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl p-6 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{t('food.transfer')}</h2>
              <button onClick={() => setShowTransfer(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-2">
              {areas.filter(a => a.id !== food.areaId).map(a => (
                <button
                  key={a.id}
                  onClick={() => handleTransfer(a.id)}
                  className="w-full card flex items-center gap-3 active:scale-95 transition-transform"
                >
                  <span className="text-2xl">{a.icon}</span>
                  <span className="font-medium">{a.name}</span>
                  {a.temperature !== undefined && <span className="text-xs text-gray-400">{a.temperature}°C</span>}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 消耗弹窗 */}
      {showConsume && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl p-6 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">✅ {isEn ? 'Consume' : '消耗'}</h2>
              <button onClick={() => setShowConsume(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-4">
              <div className="text-center">
                <p className="text-sm text-gray-500 mb-2">
                  {isEn ? 'Current stock' : '当前库存'}: <span className="font-bold text-lg">{food.quantity} {food.unit}</span>
                </p>
              </div>
              {/* 数量选择器 */}
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => setConsumeQty(Math.max(1, consumeQty - 1))}
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-xl font-bold flex items-center justify-center active:scale-95 transition-transform"
                >−</button>
                <div className="text-center min-w-[80px]">
                  <input
                    type="number"
                    min={1}
                    max={food.quantity}
                    value={consumeQty}
                    onChange={e => setConsumeQty(Math.min(food.quantity, Math.max(1, parseInt(e.target.value) || 1)))}
                    className="w-full text-center text-3xl font-bold bg-transparent border-b-2 border-primary-500 py-2 outline-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">{food.unit}</p>
                </div>
                <button
                  onClick={() => setConsumeQty(Math.min(food.quantity, consumeQty + 1))}
                  className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 text-xl font-bold flex items-center justify-center active:scale-95 transition-transform"
                >+</button>
              </div>
              {/* 快捷数量 */}
              <div className="flex justify-center gap-2">
                {[1, Math.ceil(food.quantity / 2), food.quantity].filter((v, i, a) => a.indexOf(v) === i).map(q => (
                  <button
                    key={q}
                    onClick={() => setConsumeQty(q)}
                    className={`px-4 py-1.5 rounded-full text-sm ${
                      consumeQty === q ? 'bg-primary-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                    }`}
                  >
                    {q === food.quantity ? (isEn ? 'All' : '全部') : q} {food.unit}
                  </button>
                ))}
              </div>
              <p className="text-center text-sm text-gray-400">
                {isEn ? 'Remaining after: ' : '消耗后剩余: '}
                <span className="font-medium">{food.quantity - consumeQty} {food.unit}</span>
              </p>
              <div className="flex gap-3">
                <button onClick={() => setShowConsume(false)} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button onClick={handleConsume} className="btn-primary flex-1">
                  ✅ {isEn ? 'Confirm' : '确认消耗'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 丢弃弹窗 */}
      {showDiscard && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white dark:bg-gray-800 w-full rounded-t-3xl p-6 animate-slide-up">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold">{t('food.discard')}</h2>
              <button onClick={() => setShowDiscard(false)} className="text-gray-400 text-xl">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-sm text-gray-500 mb-1 block">丢弃原因</label>
                <div className="flex flex-wrap gap-2">
                  {['过期了', '变质了', '不想要了', '买多了'].map(reason => (
                    <button
                      key={reason}
                      onClick={() => setDiscardReason(reason)}
                      className={`px-3 py-1.5 rounded-lg text-sm ${
                        discardReason === reason ? 'bg-danger-500 text-white' : 'bg-gray-100 dark:bg-gray-700'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setShowDiscard(false)} className="btn-secondary flex-1">
                  {t('common.cancel')}
                </button>
                <button onClick={handleDiscard} className="btn-danger flex-1">
                  {t('food.discard')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
