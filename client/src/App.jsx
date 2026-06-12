import { Navigate, Route, Routes, Link, useNavigate, useParams } from 'react-router-dom';
import { LogOut, QrCode, ShieldCheck, Store, Smartphone } from 'lucide-react';
import { api, clearSession, getStoredUser } from './api.js';
import { SettingsControls, useSettings } from './i18n.jsx';
import Login from './components/Login.jsx';
import AdminPanel from './components/AdminPanel.jsx';
import ManagerPanel from './components/ManagerPanel.jsx';
import CustomerApp, { InvalidQr } from './components/CustomerApp.jsx';
import OrderStatus from './components/OrderStatus.jsx';

function Header() {
  const user = getStoredUser();
  const navigate = useNavigate();
  const { t } = useSettings();

  function logout() {
    clearSession();
    navigate('/login');
  }

  return (
    <header className="topbar">
      <Link to="/" className="brand">
        <span className="brandIcon"><QrCode size={21} /></span>
        <span>{t('appName')}</span>
      </Link>
      <nav className="topnav">
        <SettingsControls compact />
        {user ? (
          <>
            <span className="muted small">{user.name}</span>
            <button className="ghostBtn" onClick={logout}><LogOut size={16} /> {t('logout')}</button>
          </>
        ) : (
          <Link className="ghostBtn" to="/login">{t('login')}</Link>
        )}
      </nav>
    </header>
  );
}

function Landing() {
  const { t } = useSettings();
  const navigate = useNavigate();

  async function openCustomerDemo() {
    try {
      const result = await api('/api/public/demo/table-link');
      navigate(result.path || '/r/campus-eats/table/demo-table-1');
    } catch {
      alert(t('demoOpenError'));
    }
  }

  return (
    <main className="page landingPage">
      <Header />
      <section className="hero">
        <div>
          <p className="eyebrow">{t('firebaseLocal')}</p>
          <h1>{t('appName')}</h1>
          <p className="heroText">{t('landingText')}</p>
          <div className="heroActions">
            <Link to="/login" className="primaryBtn">{t('panelLogin')}</Link>
            <button type="button" className="secondaryBtn" onClick={openCustomerDemo}>{t('customerDemo')}</button>
          </div>
        </div>
        <div className="heroCards">
          <div className="featureCard"><Smartphone /> <b>{t('customerUi')}</b><span>{t('customerUiHelp')}</span></div>
          <div className="featureCard"><Store /> <b>{t('managerDashboard')}</b><span>{t('managerHelp')}</span></div>
          <div className="featureCard"><ShieldCheck /> <b>{t('admin')}</b><span>{t('adminHelp')}</span></div>
        </div>
      </section>
      <section className="landingInfoGrid">
        <article className="quickHelp card">
          <h2>{t('landingHowTitle')}</h2>
          <p>{t('landingHowText')}</p>
        </article>
        <article className="quickHelp card">
          <h2>{t('landingTechTitle')}</h2>
          <p>{t('landingTechText')}</p>
        </article>
        <article className="quickHelp card">
          <h2>{t('quickStart')}</h2>
          <p><b>Admin:</b> admin@local.test / admin123!</p>
          <p><b>Manager:</b> manager@local.test / manager123!</p>
          <p>{t('openRealQrFromManager')}</p>
        </article>
      </section>
    </main>
  );
}

function Protected({ role, children }) {
  const user = getStoredUser();
  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to={user.role === 'ADMIN' ? '/admin' : '/manager'} replace />;
  return children;
}

function InvalidQrRoute() {
  const { slug } = useParams();
  return <InvalidQr slug={slug || ''} initialError="" generic={!slug} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/admin" element={<Protected role="ADMIN"><AdminPanel /></Protected>} />
      <Route path="/manager" element={<Protected role="RESTAURANT_MANAGER"><ManagerPanel /></Protected>} />
      <Route path="/r/:slug/table/:token" element={<CustomerApp />} />
      <Route path="/r/:slug/*" element={<InvalidQrRoute />} />
      <Route path="/order/:publicId" element={<OrderStatus />} />
      <Route path="*" element={<InvalidQrRoute />} />
    </Routes>
  );
}
