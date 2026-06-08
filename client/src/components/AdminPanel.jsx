import { useEffect, useState } from 'react';
import { Trash2, UserPlus, Building2, Pencil } from 'lucide-react';
import { api } from '../api.js';
import { useSettings } from '../i18n.jsx';
import AppShell from './AppShell.jsx';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phoneRegex = /^[+]?[(]?[0-9][0-9\s().-]{6,19}$/;

function normalizeApiErrors(err) {
  const result = {};
  for (const item of err.data?.errors || []) {
    const key = String(item.path || '_global').split('.')[0] || '_global';
    result[key] = item.message;
  }
  if (!Object.keys(result).length && err.message) result._global = err.message;
  return result;
}

function FieldError({ message }) {
  return message ? <small className="fieldError">{message}</small> : null;
}

function validateRestaurantForm(form, t) {
  const errors = {};
  if (!form.name.trim()) errors.name = t('requiredField');
  else if (form.name.trim().length < 2) errors.name = t('shortName');
  if (form.phone.trim() && !phoneRegex.test(form.phone.trim())) errors.phone = t('invalidPhone');
  return errors;
}

function validateManagerForm(form, t, { passwordRequired = true } = {}) {
  const errors = {};
  if (!form.name.trim()) errors.name = t('requiredField');
  else if (form.name.trim().length < 2) errors.name = t('shortName');
  if (!form.email.trim()) errors.email = t('requiredField');
  else if (!emailRegex.test(form.email.trim())) errors.email = t('invalidEmail');
  if (!form.restaurant_id) errors.restaurant_id = t('requiredField');
  if (passwordRequired || form.password) {
    if (!form.password) errors.password = t('requiredField');
    else if (form.password.length < 6) errors.password = t('passwordMin');
    else if (!/[0-9]/.test(form.password)) errors.password = t('passwordNumber');
    else if (!/[^A-Za-z0-9]/.test(form.password)) errors.password = t('passwordSpecial');
  }
  return errors;
}

export default function AdminPanel() {
  const { t } = useSettings();
  const [restaurants, setRestaurants] = useState([]);
  const [managers, setManagers] = useState([]);
  const [restaurantForm, setRestaurantForm] = useState({ name: '', address: '', phone: '' });
  const [managerForm, setManagerForm] = useState({ name: '', email: '', password: '', restaurant_id: '' });
  const [editingRestaurant, setEditingRestaurant] = useState(null);
  const [editingManager, setEditingManager] = useState(null);
  const [restaurantErrors, setRestaurantErrors] = useState({});
  const [managerErrors, setManagerErrors] = useState({});
  const [editRestaurantErrors, setEditRestaurantErrors] = useState({});
  const [editManagerErrors, setEditManagerErrors] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const [restaurantData, managerData] = await Promise.all([
      api('/api/admin/restaurants'),
      api('/api/admin/managers')
    ]);
    setRestaurants(restaurantData.restaurants);
    setManagers(managerData.managers);
    if (!managerForm.restaurant_id && restaurantData.restaurants[0]) {
      setManagerForm((current) => ({ ...current, restaurant_id: String(restaurantData.restaurants[0].id) }));
    }
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function flash(text) {
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  }

  async function createRestaurant(event) {
    event.preventDefault();
    setError('');
    const localErrors = validateRestaurantForm(restaurantForm, t);
    setRestaurantErrors(localErrors);
    if (Object.keys(localErrors).length) {
      setError(t('validationFailed'));
      return;
    }
    try {
      await api('/api/admin/restaurants', { method: 'POST', body: restaurantForm });
      setRestaurantForm({ name: '', address: '', phone: '' });
      setRestaurantErrors({});
      flash(t('restaurantCreated'));
      await load();
    } catch (err) {
      const apiErrors = normalizeApiErrors(err);
      setRestaurantErrors(apiErrors);
      setError(apiErrors._global || err.message);
    }
  }

  async function createManager(event) {
    event.preventDefault();
    setError('');
    const localErrors = validateManagerForm(managerForm, t, { passwordRequired: true });
    setManagerErrors(localErrors);
    if (Object.keys(localErrors).length) {
      setError(t('validationFailed'));
      return;
    }
    try {
      await api('/api/admin/managers', { method: 'POST', body: { ...managerForm, restaurant_id: Number(managerForm.restaurant_id) } });
      setManagerForm({ name: '', email: '', password: '', restaurant_id: managerForm.restaurant_id });
      setManagerErrors({});
      flash(t('managerCreated'));
      await load();
    } catch (err) {
      const apiErrors = normalizeApiErrors(err);
      setManagerErrors(apiErrors);
      setError(apiErrors._global || err.message);
    }
  }

  async function removeManager(id) {
    if (!confirm(t('deleteManagerConfirm'))) return;
    await api(`/api/admin/managers/${id}`, { method: 'DELETE' });
    await load();
  }

  async function removeRestaurant(id) {
    if (!confirm(t('deleteRestaurantConfirm'))) return;
    await api(`/api/admin/restaurants/${id}`, { method: 'DELETE' });
    flash(t('restaurantAndManagersDeleted'));
    await load();
  }

  function startEditRestaurant(restaurant) {
    setEditingRestaurant({ id: restaurant.id, name: restaurant.name, address: restaurant.address || '', phone: restaurant.phone || '' });
    setEditRestaurantErrors({});
  }

  async function saveRestaurantEdit(event) {
    event.preventDefault();
    setError('');
    const localErrors = validateRestaurantForm(editingRestaurant, t);
    setEditRestaurantErrors(localErrors);
    if (Object.keys(localErrors).length) {
      setError(t('validationFailed'));
      return;
    }
    try {
      await api(`/api/admin/restaurants/${editingRestaurant.id}`, {
        method: 'PATCH',
        body: {
          name: editingRestaurant.name,
          address: editingRestaurant.address,
          phone: editingRestaurant.phone
        }
      });
      setEditingRestaurant(null);
      setEditRestaurantErrors({});
      flash(t('restaurantUpdated'));
      await load();
    } catch (err) {
      const apiErrors = normalizeApiErrors(err);
      setEditRestaurantErrors(apiErrors);
      setError(apiErrors._global || err.message);
    }
  }

  function startEditManager(manager) {
    setEditingManager({ id: manager.id, name: manager.name, email: manager.email, password: '', restaurant_id: String(manager.restaurant_id || '') });
    setEditManagerErrors({});
  }

  async function saveManagerEdit(event) {
    event.preventDefault();
    setError('');
    const localErrors = validateManagerForm(editingManager, t, { passwordRequired: false });
    setEditManagerErrors(localErrors);
    if (Object.keys(localErrors).length) {
      setError(t('validationFailed'));
      return;
    }
    const payload = {
      name: editingManager.name,
      email: editingManager.email,
      restaurant_id: Number(editingManager.restaurant_id)
    };
    if (editingManager.password) payload.password = editingManager.password;
    try {
      await api(`/api/admin/managers/${editingManager.id}`, { method: 'PATCH', body: payload });
      setEditingManager(null);
      setEditManagerErrors({});
      flash(t('managerUpdated'));
      await load();
    } catch (err) {
      const apiErrors = normalizeApiErrors(err);
      setEditManagerErrors(apiErrors);
      setError(apiErrors._global || err.message);
    }
  }

  return (
    <AppShell title={t('adminDashboard')} subtitle={t('systemAdminSubtitle')}>
      {message && <div className="successBox">{message}</div>}
      {error && <div className="errorBox">{error}</div>}
      <div className="grid two">
        <section className="card">
          <div className="sectionTitle"><Building2 size={20} /><h2>{t('createRestaurant')}</h2></div>
          <form className="stack" onSubmit={createRestaurant} noValidate>
            <label>
              <span>{t('restaurantName')}</span>
              <input placeholder={t('restaurantName')} value={restaurantForm.name} onChange={(e) => setRestaurantForm({ ...restaurantForm, name: e.target.value })} />
              <FieldError message={restaurantErrors.name} />
            </label>
            <label>
              <span>{t('address')}</span>
              <input placeholder={t('address')} value={restaurantForm.address} onChange={(e) => setRestaurantForm({ ...restaurantForm, address: e.target.value })} />
              <FieldError message={restaurantErrors.address} />
            </label>
            <label>
              <span>{t('phone')}</span>
              <input placeholder="+90 555 000 0000" inputMode="tel" value={restaurantForm.phone} onChange={(e) => setRestaurantForm({ ...restaurantForm, phone: e.target.value })} />
              <FieldError message={restaurantErrors.phone} />
            </label>
            <button className="primaryBtn">{t('createRestaurant')}</button>
          </form>
        </section>
        <section className="card">
          <div className="sectionTitle"><UserPlus size={20} /><h2>{t('addManager')}</h2></div>
          <form className="stack" onSubmit={createManager} noValidate>
            <label>
              <span>{t('managerName')}</span>
              <input placeholder={t('managerName')} value={managerForm.name} onChange={(e) => setManagerForm({ ...managerForm, name: e.target.value })} />
              <FieldError message={managerErrors.name} />
            </label>
            <label>
              <span>{t('email')}</span>
              <input placeholder="manager@example.com" inputMode="email" autoComplete="off" value={managerForm.email} onChange={(e) => setManagerForm({ ...managerForm, email: e.target.value })} />
              <FieldError message={managerErrors.email} />
            </label>
            <label>
              <span>{t('password')}</span>
              <input placeholder={t('passwordRule')} type="password" autoComplete="new-password" value={managerForm.password} onChange={(e) => setManagerForm({ ...managerForm, password: e.target.value })} />
              <FieldError message={managerErrors.password} />
            </label>
            <label>
              <span>{t('restaurant')}</span>
              <select value={managerForm.restaurant_id} onChange={(e) => setManagerForm({ ...managerForm, restaurant_id: e.target.value })}>
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
              </select>
              <FieldError message={managerErrors.restaurant_id} />
            </label>
            <button className="primaryBtn">{t('addManager')}</button>
          </form>
        </section>
      </div>

      <section className="card">
        <h2>{t('restaurants')}</h2>
        {editingRestaurant && (
          <form className="editPanel stack" onSubmit={saveRestaurantEdit} noValidate>
            <h3>{t('editRestaurant')}</h3><p className="muted small">{t('slugFixedNote')}</p>
            <label>
              <span>{t('restaurantName')}</span>
              <input value={editingRestaurant.name} onChange={(e) => setEditingRestaurant({ ...editingRestaurant, name: e.target.value })} />
              <FieldError message={editRestaurantErrors.name} />
            </label>
            <label>
              <span>{t('address')}</span>
              <input value={editingRestaurant.address} onChange={(e) => setEditingRestaurant({ ...editingRestaurant, address: e.target.value })} />
              <FieldError message={editRestaurantErrors.address} />
            </label>
            <label>
              <span>{t('phone')}</span>
              <input inputMode="tel" value={editingRestaurant.phone} onChange={(e) => setEditingRestaurant({ ...editingRestaurant, phone: e.target.value })} />
              <FieldError message={editRestaurantErrors.phone} />
            </label>
            <div className="orderActions"><button className="primaryBtn">{t('save')}</button><button type="button" className="smallBtn" onClick={() => setEditingRestaurant(null)}>{t('cancel')}</button></div>
          </form>
        )}
        <div className="tableWrap">
          <table>
            <thead><tr><th>{t('name')}</th><th>{t('slug')}</th><th>{t('address')}</th><th>{t('managerCount')}</th><th>{t('tableCount')}</th><th>{t('phone')}</th><th></th></tr></thead>
            <tbody>
              {restaurants.map((restaurant) => (
                <tr key={restaurant.id}>
                  <td>{restaurant.name}</td>
                  <td>{restaurant.slug}</td>
                  <td>{restaurant.address || '-'}</td>
                  <td>{restaurant.manager_count}</td>
                  <td>{restaurant.table_count}</td>
                  <td>{restaurant.phone || '-'}</td>
                  <td className="tableActions">
                    <button className="smallBtn" onClick={() => startEditRestaurant(restaurant)}><Pencil size={15} /> {t('edit')}</button>
                    <button className="dangerBtn" onClick={() => removeRestaurant(restaurant.id)}><Trash2 size={15} /> {t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2>{t('managers')}</h2>
        {editingManager && (
          <form className="editPanel stack" onSubmit={saveManagerEdit} noValidate>
            <h3>{t('editManager')}</h3>
            <label>
              <span>{t('managerName')}</span>
              <input value={editingManager.name} onChange={(e) => setEditingManager({ ...editingManager, name: e.target.value })} />
              <FieldError message={editManagerErrors.name} />
            </label>
            <label>
              <span>{t('email')}</span>
              <input inputMode="email" value={editingManager.email} onChange={(e) => setEditingManager({ ...editingManager, email: e.target.value })} />
              <FieldError message={editManagerErrors.email} />
            </label>
            <label>
              <span>{t('newPasswordOptional')}</span>
              <input type="password" placeholder={t('newPasswordOptional')} autoComplete="new-password" value={editingManager.password} onChange={(e) => setEditingManager({ ...editingManager, password: e.target.value })} />
              <FieldError message={editManagerErrors.password} />
            </label>
            <label>
              <span>{t('restaurant')}</span>
              <select value={editingManager.restaurant_id} onChange={(e) => setEditingManager({ ...editingManager, restaurant_id: e.target.value })}>
                {restaurants.map((restaurant) => <option key={restaurant.id} value={restaurant.id}>{restaurant.name}</option>)}
              </select>
              <FieldError message={editManagerErrors.restaurant_id} />
            </label>
            <div className="orderActions"><button className="primaryBtn">{t('save')}</button><button type="button" className="smallBtn" onClick={() => setEditingManager(null)}>{t('cancel')}</button></div>
          </form>
        )}
        <div className="tableWrap">
          <table>
            <thead><tr><th>{t('name')}</th><th>{t('email')}</th><th>{t('restaurant')}</th><th>{t('created')}</th><th></th></tr></thead>
            <tbody>
              {managers.map((manager) => (
                <tr key={manager.id}>
                  <td>{manager.name}</td>
                  <td>{manager.email}</td>
                  <td>{manager.restaurant_name}</td>
                  <td>{new Date(manager.created_at).toLocaleString()}</td>
                  <td className="tableActions">
                    <button className="smallBtn" onClick={() => startEditManager(manager)}><Pencil size={15} /> {t('edit')}</button>
                    <button className="dangerBtn" onClick={() => removeManager(manager.id)}><Trash2 size={15} /> {t('delete')}</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </AppShell>
  );
}
