import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useStore } from '@/store';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const COLORS = ['#22c55e', '#eab308', '#f97316', '#ef4444', '#3b82f6', '#a855f7', '#06b6d4', '#d97706', '#6b7280', '#ec4899', '#14b8a6', '#8b5cf6', '#64748b'];

export default function StatsPage() {
  const { t, i18n } = useTranslation();
  const foods = useStore(s => s.foods);
  const categories = useStore(s => s.categories);
  const areas = useStore(s => s.areas);
  const logs = useStore(s => s.logs);

  const isEn = i18n.language === 'en';

  // 库存分布 - 按分类
  const categoryData = useMemo(() => {
    return categories.map((cat, i) => ({
      name: `${cat.icon} ${isEn ? cat.nameEn : cat.name}`,
      value: foods.filter(f => f.categoryId === cat.id).length,
      color: COLORS[i % COLORS.length],
    })).filter(d => d.value > 0);
  }, [foods, categories, isEn]);

  // 库存分布 - 按区域
  const areaData = useMemo(() => {
    return areas.map((area, i) => ({
      name: `${area.icon} ${isEn ? area.nameEn : area.name}`,
      value: foods.filter(f => f.areaId === area.id).length,
      color: COLORS[i % COLORS.length],
    })).filter(d => d.value > 0);
  }, [foods, areas, isEn]);

  // 状态分布
  const statusData = useMemo(() => {
    return [
      { name: t('food.fresh'), value: foods.filter(f => f.status === 'fresh').length, color: '#22c55e' },
      { name: t('food.normal'), value: foods.filter(f => f.status === 'normal').length, color: '#eab308' },
      { name: t('food.expiring'), value: foods.filter(f => f.status === 'expiring').length, color: '#f97316' },
      { name: t('food.expired'), value: foods.filter(f => f.status === 'expired').length, color: '#ef4444' },
    ].filter(d => d.value > 0);
  }, [foods, t]);

  // 本周统计
  const weekStats = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const weekLogs = logs.filter(l => new Date(l.createdAt) >= weekAgo);
    return {
      added: weekLogs.filter(l => l.type === 'add').length,
      consumed: weekLogs.filter(l => l.type === 'consume').length,
      discarded: weekLogs.filter(l => l.type === 'discard').length,
    };
  }, [logs]);

  // 本月浪费
  const monthWaste = useMemo(() => {
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    return logs.filter(l => l.type === 'discard' && new Date(l.createdAt) >= monthStart).length;
  }, [logs]);

  // 每周趋势（最近8周）
  const weeklyTrend = useMemo(() => {
    const weeks: { week: string; added: number; consumed: number; discarded: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekEnd = new Date();
      weekEnd.setDate(weekEnd.getDate() - i * 7);
      const weekStart = new Date(weekEnd);
      weekStart.setDate(weekStart.getDate() - 7);

      const weekLogs = logs.filter(l => {
        const d = new Date(l.createdAt);
        return d >= weekStart && d < weekEnd;
      });

      weeks.push({
        week: `${weekStart.getMonth() + 1}/${weekStart.getDate()}`,
        added: weekLogs.filter(l => l.type === 'add').length,
        consumed: weekLogs.filter(l => l.type === 'consume').length,
        discarded: weekLogs.filter(l => l.type === 'discard').length,
      });
    }
    return weeks;
  }, [logs]);

  // 浪费食物排行
  const wasteRanking = useMemo(() => {
    const wasteMap: Record<string, number> = {};
    logs.filter(l => l.type === 'discard').forEach(l => {
      wasteMap[l.foodName] = (wasteMap[l.foodName] || 0) + 1;
    });
    return Object.entries(wasteMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));
  }, [logs]);

  return (
    <div className="page-container animate-fade-in">
      <h1 className="page-title">{t('stats.title')}</h1>

      {/* 概览卡片 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-3xl font-bold text-primary-600">{foods.length}</p>
          <p className="text-xs text-gray-400 mt-1">{t('stats.totalItems')}</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-green-600">{weekStats.added}</p>
          <p className="text-xs text-gray-400 mt-1">{t('stats.addedThisWeek')}</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-blue-600">{weekStats.consumed}</p>
          <p className="text-xs text-gray-400 mt-1">{t('stats.consumedThisWeek')}</p>
        </div>
        <div className="card text-center">
          <p className="text-3xl font-bold text-danger-500">{monthWaste}</p>
          <p className="text-xs text-gray-400 mt-1">{t('stats.wastedThisMonth')}</p>
        </div>
      </div>

      {/* 状态分布饼图 */}
      {statusData.length > 0 && (
        <div className="card mb-4">
          <h3 className="section-title">{t('stats.byStatus')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {statusData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 分类分布饼图 */}
      {categoryData.length > 0 && (
        <div className="card mb-4">
          <h3 className="section-title">{t('stats.byCategory')}</h3>
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" outerRadius={80} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
                {categoryData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 区域分布 */}
      {areaData.length > 0 && (
        <div className="card mb-4">
          <h3 className="section-title">{t('stats.byArea')}</h3>
          <div className="space-y-2">
            {areaData.map(area => (
              <div key={area.name} className="flex items-center gap-3">
                <span className="text-sm w-24 truncate">{area.name}</span>
                <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-400 rounded-full flex items-center justify-end pr-2"
                    style={{ width: `${Math.max((area.value / foods.length) * 100, 10)}%` }}
                  >
                    <span className="text-xs text-white font-medium">{area.value}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 每周趋势 */}
      {weeklyTrend.some(w => w.added > 0 || w.consumed > 0 || w.discarded > 0) && (
        <div className="card mb-4">
          <h3 className="section-title">{t('stats.weeklyTrend')}</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={weeklyTrend}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="week" fontSize={10} />
              <YAxis fontSize={10} />
              <Tooltip />
              <Legend />
              <Bar dataKey="added" name={t('history.add')} fill="#22c55e" radius={[2, 2, 0, 0]} />
              <Bar dataKey="consumed" name={t('history.consume')} fill="#3b82f6" radius={[2, 2, 0, 0]} />
              <Bar dataKey="discarded" name={t('history.discard')} fill="#ef4444" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* 浪费排行 */}
      {wasteRanking.length > 0 && (
        <div className="card mb-4">
          <h3 className="section-title">🗑️ {t('stats.wasteAmount')}</h3>
          <div className="space-y-2">
            {wasteRanking.map((item, i) => (
              <div key={item.name} className="flex items-center gap-3">
                <span className="text-sm font-medium w-6 text-gray-400">#{i + 1}</span>
                <span className="text-sm flex-1">{item.name}</span>
                <span className="text-sm font-medium text-danger-500">{item.count}x</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {foods.length === 0 && (
        <div className="text-center py-16">
          <p className="text-5xl mb-4">📊</p>
          <p className="text-gray-400">{t('common.noData')}</p>
        </div>
      )}
    </div>
  );
}
