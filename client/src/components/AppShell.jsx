import { Link, useNavigate } from 'react-router-dom';
import { LogOut, QrCode } from 'lucide-react';
import { clearSession, getStoredUser } from '../api.js';
import { SettingsControls, useSettings } from '../i18n.jsx';

export default function AppShell({ title, subtitle, restaurantName, children }) {
  const navigate = useNavigate();
  const user = getStoredUser();
  const { t } = useSettings();

  function logout() {
    clearSession();
    navigate('/login');
  }

  return (
    <main className="appShell">
      <aside className="sidebar">
        <Link to="/" className="brand panelBrand"><span className="brandIcon"><QrCode size={20} /></span>{t('appName')}</Link>
        <div className="userCard">
          <b>{user?.name}</b>
          <span>{user?.role === 'ADMIN' ? t('admin') : t('manager')}</span>
          {restaurantName && <strong>{restaurantName}</strong>}
        </div>
        <nav className="sideNav">
          {user?.role === 'ADMIN' ? <Link to="/admin">{t('adminDashboard')}</Link> : <Link to="/manager">{t('managerDashboard')}</Link>}
        </nav>
        <div className="sidebarSettings"><SettingsControls /></div>
        <button className="ghostBtn logout" onClick={logout}><LogOut size={16} /> {t('logout')}</button>
      </aside>
      <section className="panelMain">
        <header className="panelHeader">
          <div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            {restaurantName && <p className="restaurantBadge">{t('restaurant')}: <b>{restaurantName}</b></p>}
          </div>
        </header>
        {children}
      </section>
    </main>
  );
}
