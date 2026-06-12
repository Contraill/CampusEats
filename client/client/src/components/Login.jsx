import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { LockKeyhole, Mail } from 'lucide-react';
import { api, setSession } from '../api.js';
import { SettingsControls, useSettings } from '../i18n.jsx';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function FieldError({ message }) {
  return message ? <small className="fieldError">{message}</small> : null;
}

export default function Login() {
  const navigate = useNavigate();
  const { t } = useSettings();
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function validateLocal() {
    const next = {};
    if (!form.email.trim()) next.email = t('requiredField');
    else if (!emailRegex.test(form.email.trim())) next.email = t('invalidEmail');
    if (!form.password) next.password = t('requiredField');
    return next;
  }

  async function submit(event) {
    event.preventDefault();
    const localErrors = validateLocal();
    setErrors(localErrors);
    if (Object.keys(localErrors).length) {
      setError(t('validationFailed'));
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: form });
      setSession(data.token, data.user);
      navigate(data.user.role === 'ADMIN' ? '/admin' : '/manager');
    } catch (err) {
      const apiErrors = {};
      for (const item of err.data?.errors || []) apiErrors[String(item.path || '_global').split('.')[0]] = item.message;
      setErrors(apiErrors);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function useDemo(type) {
    if (type === 'admin') setForm({ email: 'admin@local.test', password: 'admin123!' });
    else setForm({ email: 'manager@local.test', password: 'manager123!' });
    setErrors({});
    setError('');
  }

  return (
    <main className="loginScreen">
      <div className="loginTop"><Link to="/" className="miniBrand">CampusEats</Link><SettingsControls compact /></div>
      <form className="loginCard" onSubmit={submit} noValidate>
        <div className="brandIcon large">CE</div>
        <h1>{t('panelLogin')}</h1>
        <p className="muted">{t('loginSubtitle')}</p>
        <label>
          <span>{t('email')}</span>
          <div className="inputIcon"><Mail size={17} /><input inputMode="email" autoComplete="username" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
          <FieldError message={errors.email} />
        </label>
        <label>
          <span>{t('password')}</span>
          <div className="inputIcon"><LockKeyhole size={17} /><input type="password" autoComplete="current-password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
          <FieldError message={errors.password} />
        </label>
        {error && <div className="errorBox">{error}</div>}
        <button className="primaryBtn full" disabled={loading}>{loading ? '...' : t('login')}</button>
        <div className="demoButtons">
          <button type="button" className="ghostBtn" onClick={() => useDemo('manager')}>{t('useManagerDemo')}</button>
          <button type="button" className="ghostBtn" onClick={() => useDemo('admin')}>{t('useAdminDemo')}</button>
        </div>
      </form>
    </main>
  );
}
