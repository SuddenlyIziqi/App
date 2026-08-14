import { useEffect } from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useStore } from './store';
import HomePage from './pages/HomePage';
import FoodListPage from './pages/FoodListPage';
import FoodAddPage from './pages/FoodAddPage';
import FoodDetailPage from './pages/FoodDetailPage';
import StatsPage from './pages/StatsPage';
import SettingsPage from './pages/SettingsPage';
import HistoryPage from './pages/HistoryPage';

function Layout() {
  const { t } = useTranslation();
  const location = useLocation();
  const loadData = useStore(s => s.loadData);
  const foods = useStore(s => s.foods);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 定时刷新状态（每分钟）
  useEffect(() => {
    const interval = setInterval(() => {
      loadData();
    }, 60000);
    return () => clearInterval(interval);
  }, [loadData]);

  // 检查通知权限
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      // 延迟请求权限
      setTimeout(() => {
        Notification.requestPermission();
      }, 3000);
    }
  }, []);

  const expiringCount = foods.filter(f => f.status === 'expiring' || f.status === 'expired').length;
  const isHidden = location.pathname.startsWith('/food/') || location.pathname === '/history';

  return (
    <div className="min-h-screen bg-primary-50 dark:bg-gray-900">
      <main className={isHidden ? '' : 'pb-16'}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/foods" element={<FoodListPage />} />
          <Route path="/add" element={<FoodAddPage />} />
          <Route path="/food/:id" element={<FoodDetailPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/history" element={<HistoryPage />} />
        </Routes>
      </main>

      {!isHidden && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 safe-area-bottom z-50">
          <div className="flex justify-around items-center max-w-lg mx-auto">
            <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <span className="text-xl">🏠</span>
              <span>{t('nav.home')}</span>
            </NavLink>
            <NavLink to="/foods" className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <span className="text-xl">📦</span>
              <span>{t('nav.foods')}</span>
            </NavLink>
            <NavLink to="/add" className="nav-item relative">
              <span className="absolute -top-2 bg-primary-500 text-white rounded-full w-12 h-12 flex items-center justify-center text-2xl shadow-lg">
                ➕
              </span>
              <span className="mt-7">{t('nav.add')}</span>
            </NavLink>
            <NavLink to="/stats" className={({ isActive }) => `nav-item ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <span className="text-xl">📊</span>
              <span>{t('nav.stats')}</span>
            </NavLink>
            <NavLink to="/settings" className={({ isActive }) => `nav-item relative ${isActive ? 'nav-item-active' : 'nav-item-inactive'}`}>
              <span className="text-xl">
                ⚙️
                {expiringCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-danger-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                    {expiringCount}
                  </span>
                )}
              </span>
              <span>{t('nav.settings')}</span>
            </NavLink>
          </div>
        </nav>
      )}
    </div>
  );
}

export default function App() {
  const settings = useStore(s => s.settings);

  // 主题管理
  useEffect(() => {
    const theme = settings?.theme || 'system';
    const root = document.documentElement;

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.remove('dark');
    } else {
      // system
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      if (mq.matches) root.classList.add('dark');
      else root.classList.remove('dark');
    }
  }, [settings?.theme]);

  return (
    <BrowserRouter>
      <Layout />
    </BrowserRouter>
  );
}
