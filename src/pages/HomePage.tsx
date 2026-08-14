import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';
import { getRemainingDays, getStatusColor } from '@/db';
import type { FoodItem } from '@/types';

function StatusBadge({ status }: { status: FoodItem['status'] }) {
  const { t } = useTranslation();
  const labels: Record<string, string> = {
    fresh: t('food.fresh'),
    normal: t('food.normal'),
    expiring: t('food.expiring'),
    expired: t('food.expired'),
  };
  return (
    <span className={`badge badge-${status}`}>
      {labels[status]}
    </span>
  );
}

function OverviewCard({ icon, label, count, color }: { icon: string; label: string; count: number; color: string }) {
  return (
    <div className={`card flex flex-col items-center justify-center py-4 ${color}`}>
      <span className="text-3xl mb-1">{icon}</span>
      <span className="text-2xl font-bold">{count}</span>
      <span className="text-xs text-gray-500 dark:text-gray-400">{label}</span>
    </div>
  );
}

export default function HomePage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const foods = useStore(s => s.foods);
  const logs = useStore(s => s.logs);
  const categories = useStore(s => s.categories);
  const areas = useStore(s => s.areas);

  const total = foods.length;
  const freshCount = foods.filter(f => f.status === 'fresh').length;
  const normalCount = foods.filter(f => f.status === 'normal').length;
  const expiringCount = foods.filter(f => f.status === 'expiring').length;
  const expiredCount = foods.filter(f => f.status === 'expired').length;

  // 本周需消耗
  const weekLater = new Date();
  weekLater.setDate(weekLater.getDate() + 7);
  const weekAlertFoods = foods.filter(f => {
    const expiry = new Date(f.expiryDate);
    return expiry <= weekLater && f.status !== 'expired';
  });

  // 紧急提醒（临期+过期）
  const urgentFoods = foods
    .filter(f => f.status === 'expiring' || f.status === 'expired')
    .sort((a, b) => new Date(a.expiryDate).getTime() - new Date(b.expiryDate).getTime());

  // 最近操作
  const recentLogs = logs.slice(0, 5);

  // 新鲜度分布（按分类）
  const categoryStats = categories.map(cat => {
    const catFoods = foods.filter(f => f.categoryId === cat.id);
    return {
      ...cat,
      count: catFoods.length,
      fresh: catFoods.filter(f => f.status === 'fresh' || f.status === 'normal').length,
      expiring: catFoods.filter(f => f.status === 'expiring').length,
      expired: catFoods.filter(f => f.status === 'expired').length,
    };
  }).filter(c => c.count > 0);

  const getCategoryName = (catId: string) => {
    const cat = categories.find(c => c.id === catId);
    return cat ? `${cat.icon} ${cat.name}` : '';
  };

  const getAreaName = (areaId: string) => {
    const area = areas.find(a => a.id === areaId);
    return area ? `${area.icon} ${area.name}` : '';
  };

  return (
    <div className="page-container animate-fade-in">
      {/* 标题 */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="page-title mb-0">{t('home.title')}</h1>
        <button onClick={() => navigate('/history')} className="text-sm text-primary-600 dark:text-primary-400">
          📋 {t('home.recentOps')}
        </button>
      </div>

      {/* 概览卡片 */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <OverviewCard icon="📦" label={t('home.total')} count={total} color="" />
        <OverviewCard icon="🟢" label={t('home.fresh')} count={freshCount + normalCount} color="" />
        <OverviewCard icon="🟠" label={t('home.expiring')} count={expiringCount} color="" />
        <OverviewCard icon="🔴" label={t('home.expired')} count={expiredCount} color="" />
      </div>

      {/* 紧急提醒 */}
      <div className="mb-6">
        <h2 className="section-title">⚠️ {t('home.urgentAlert')}</h2>
        {urgentFoods.length === 0 ? (
          <div className="card text-center py-6 text-gray-400">
            <p className="text-lg mb-1">🎉</p>
            <p>{t('home.noAlert')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {urgentFoods.slice(0, 5).map(food => {
              const days = getRemainingDays(food.expiryDate);
              return (
                <div
                  key={food.id}
                  onClick={() => navigate(`/food/${food.id}`)}
                  className={`card flex items-center justify-between cursor-pointer active:scale-[0.98] transition-transform ${
                    food.status === 'expired' ? 'border-danger-300 bg-danger-50 dark:bg-danger-900/10' : 'border-orange-200 bg-orange-50 dark:bg-orange-900/10'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl">
                      {categories.find(c => c.id === food.categoryId)?.icon || '📦'}
                    </span>
                    <div>
                      <p className="font-medium">{food.name}</p>
                      <p className="text-xs text-gray-500">
                        {getAreaName(food.areaId)} · {food.quantity}{food.unit}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <StatusBadge status={food.status} />
                    <p className={`text-xs mt-1 ${days < 0 ? 'text-danger-500' : 'text-orange-500'}`}>
                      {days < 0 ? t('reminder.expiredDays', { days: Math.abs(days) }) : t('reminder.daysLeft', { days })}
                    </p>
                  </div>
                </div>
              );
            })}
            {urgentFoods.length > 5 && (
              <button
                onClick={() => navigate('/foods?status=expiring')}
                className="w-full text-center text-sm text-primary-600 dark:text-primary-400 py-2"
              >
                {t('reminder.viewAll')} ({urgentFoods.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* 快速操作 */}
      <div className="mb-6">
        <h2 className="section-title">⚡ {t('home.quickActions')}</h2>
        <div className="grid grid-cols-2 gap-3">
          <button onClick={() => navigate('/add')} className="card-accent flex items-center gap-3 active:scale-95 transition-transform">
            <span className="text-3xl">➕</span>
            <span className="font-medium">{t('home.addFood')}</span>
          </button>
          <button
            onClick={() => navigate('/foods?status=expiring')}
            className="card flex items-center gap-3 active:scale-95 transition-transform border-orange-200"
          >
            <span className="text-3xl">⏰</span>
            <span className="font-medium">{t('home.viewExpiring')}</span>
            {expiringCount > 0 && (
              <span className="ml-auto bg-orange-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                {expiringCount}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 新鲜度分布 */}
      {categoryStats.length > 0 && (
        <div className="mb-6">
          <h2 className="section-title">🌿 {t('home.freshness')}</h2>
          <div className="space-y-2">
            {categoryStats.map(cat => (
              <div key={cat.id} className="card flex items-center gap-3">
                <span className="text-xl">{cat.icon}</span>
                <span className="font-medium text-sm w-16">{cat.name}</span>
                <div className="flex-1 h-4 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden flex">
                  {cat.fresh > 0 && (
                    <div
                      className="bg-green-400 h-full"
                      style={{ width: `${(cat.fresh / cat.count) * 100}%` }}
                    />
                  )}
                  {cat.expiring > 0 && (
                    <div
                      className="bg-orange-400 h-full"
                      style={{ width: `${(cat.expiring / cat.count) * 100}%` }}
                    />
                  )}
                  {cat.expired > 0 && (
                    <div
                      className="bg-red-400 h-full"
                      style={{ width: `${(cat.expired / cat.count) * 100}%` }}
                    />
                  )}
                </div>
                <span className="text-xs text-gray-400 w-8">{cat.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 最近操作 */}
      {recentLogs.length > 0 && (
        <div className="mb-6">
          <h2 className="section-title">📋 {t('home.recentOps')}</h2>
          <div className="space-y-2">
            {recentLogs.map(log => {
              const typeIcons: Record<string, string> = {
                add: '➕', consume: '✅', discard: '🗑️', transfer: '🔄', modify: '✏️'
              };
              const typeLabels: Record<string, string> = {
                add: t('history.add'),
                consume: t('history.consume'),
                discard: t('history.discard'),
                transfer: t('history.transfer'),
                modify: t('history.modify'),
              };
              return (
                <div key={log.id} className="card flex items-center gap-3 py-3">
                  <span className="text-lg">{typeIcons[log.type]}</span>
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{log.foodName}</span>
                      <span className="text-gray-400 mx-1">·</span>
                      <span className="text-gray-500">{typeLabels[log.type]}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-xs text-gray-400">
                    {log.quantity} {foods.find(f => f.id === log.foodId)?.unit || ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
