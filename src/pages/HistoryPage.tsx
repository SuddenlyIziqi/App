import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { useStore } from '@/store';

type LogType = 'all' | 'add' | 'consume' | 'discard' | 'transfer' | 'modify';

export default function HistoryPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const logs = useStore(s => s.logs);
  const foods = useStore(s => s.foods);
  const areas = useStore(s => s.areas);

  const [typeFilter, setTypeFilter] = useState<LogType>('all');

  const typeIcons: Record<string, string> = {
    add: '➕',
    consume: '✅',
    discard: '🗑️',
    transfer: '🔄',
    modify: '✏️',
  };

  const typeLabels: Record<string, string> = {
    add: t('history.add'),
    consume: t('history.consume'),
    discard: t('history.discard'),
    transfer: t('history.transfer'),
    modify: t('history.modify'),
  };

  const filteredLogs = useMemo(() => {
    if (typeFilter === 'all') return logs;
    return logs.filter(l => l.type === typeFilter);
  }, [logs, typeFilter]);

  // 按日期分组
  const groupedLogs = useMemo(() => {
    const groups: Record<string, typeof filteredLogs> = {};
    filteredLogs.forEach(log => {
      const date = new Date(log.createdAt).toLocaleDateString();
      if (!groups[date]) groups[date] = [];
      groups[date].push(log);
    });
    return Object.entries(groups);
  }, [filteredLogs]);

  const getAreaName = (areaId?: string) => {
    if (!areaId) return '';
    return areas.find(a => a.id === areaId)?.name || '';
  };

  const filters: { key: LogType; label: string; icon: string }[] = [
    { key: 'all', label: t('food.all'), icon: '📋' },
    { key: 'add', label: t('history.add'), icon: '➕' },
    { key: 'consume', label: t('history.consume'), icon: '✅' },
    { key: 'discard', label: t('history.discard'), icon: '🗑️' },
    { key: 'transfer', label: t('history.transfer'), icon: '🔄' },
    { key: 'modify', label: t('history.modify'), icon: '✏️' },
  ];

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-gray-900 pb-8">
      {/* 顶部 */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-gray-400 text-xl">←</button>
          <h1 className="text-xl font-bold">{t('history.title')}</h1>
        </div>

        {/* 类型筛选 */}
        <div className="flex gap-1 overflow-x-auto pb-1">
          {filters.map(f => (
            <button
              key={f.key}
              onClick={() => setTypeFilter(f.key)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all ${
                typeFilter === f.key
                  ? 'bg-primary-500 text-white shadow-sm'
                  : 'bg-white dark:bg-gray-800 text-gray-500 border border-gray-200 dark:border-gray-600'
              }`}
            >
              {f.icon} {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* 时间线 */}
      <div className="px-4">
        {groupedLogs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-4">📋</p>
            <p className="text-gray-400">{t('history.empty')}</p>
          </div>
        ) : (
          groupedLogs.map(([date, dayLogs]) => (
            <div key={date} className="mb-6">
              <h3 className="text-sm font-medium text-gray-400 mb-2 sticky top-0 bg-primary-50 dark:bg-gray-900 py-1">
                📅 {date}
              </h3>
              <div className="space-y-2">
                {dayLogs.map(log => (
                  <div
                    key={log.id}
                    className="card flex items-center gap-3 py-3 animate-fade-in"
                  >
                    <span className="text-xl">{typeIcons[log.type]}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">
                        <span className="font-medium">{log.foodName}</span>
                        <span className="text-gray-400 mx-1">·</span>
                        <span className="text-gray-500">{typeLabels[log.type]}</span>
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-400 mt-0.5">
                        <span>{new Date(log.createdAt).toLocaleTimeString()}</span>
                        {log.type === 'transfer' && log.fromAreaId && log.toAreaId && (
                          <span>{getAreaName(log.fromAreaId)} → {getAreaName(log.toAreaId)}</span>
                        )}
                        {log.reason && <span>({log.reason})</span>}
                      </div>
                    </div>
                    <span className="text-xs text-gray-400">
                      {log.quantity}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
