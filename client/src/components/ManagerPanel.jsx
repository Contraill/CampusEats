import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { BarChart3, Bell, CheckCircle2, ClipboardList, Clock3, ImagePlus, Pencil, Plus, QrCode, RefreshCcw, Trash2, UtensilsCrossed, XCircle } from 'lucide-react';
import { api, getStoredUser, getToken, money, niceStatus, updateStoredUser } from '../api.js';
import { useSettings } from '../i18n.jsx';
import AppShell from './AppShell.jsx';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

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

function formatDateTime(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

function validateTableForm(form, t) {
  const errors = {};
  if (!String(form.table_number || '').trim()) errors.table_number = t('requiredField');
  const cap = Number(form.capacity);
  if (!Number.isInteger(cap) || cap < 1 || cap > 50) errors.capacity = t('seatCapacity');
  return errors;
}

function normalizeCategoryName(value) {
  return String(value || '').trim().toLocaleLowerCase('tr-TR');
}

function validateCategoryForm(form, t, categories = [], currentId = null) {
  const errors = {};
  const name = String(form.name || '').trim();
  const sortOrder = Number(form.sort_order);
  if (!name) errors.name = t('requiredField');
  else if (name.length < 2) errors.name = t('shortName');
  else if (categories.some((category) => category.id !== currentId && normalizeCategoryName(category.name) === normalizeCategoryName(name))) errors.name = t('categoryNameAlreadyExists');

  if (!Number.isInteger(sortOrder)) errors.sort_order = t('invalidSortOrder');
  else if (categories.some((category) => category.id !== currentId && Number(category.sort_order) === sortOrder)) errors.sort_order = t('categorySortOrderAlreadyExists');
  return errors;
}

function validateItemForm(form, t) {
  const errors = {};
  if (!form.category_id) errors.category_id = t('requiredField');
  if (!String(form.name || '').trim()) errors.name = t('requiredField');
  else if (String(form.name).trim().length < 2) errors.name = t('shortName');
  if (!String(form.price || '').trim()) errors.price = t('requiredField');
  else if (!(Number(form.price) > 0)) errors.price = t('price');
  return errors;
}

export default function ManagerPanel() {
  const user = getStoredUser();
  const { t } = useSettings();
  const [tab, setTab] = useState('dashboard');
  const [dashboard, setDashboard] = useState(null);
  const [restaurant, setRestaurant] = useState(null);
  const [tables, setTables] = useState([]);
  const [menu, setMenu] = useState({ categories: [], items: [] });
  const [orders, setOrders] = useState([]);
  const [orderHistory, setOrderHistory] = useState([]);
  const [requests, setRequests] = useState([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  async function loadAll() {
    const [dashboardData, tableData, menuData, orderData, historyData, supportData] = await Promise.all([
      api('/api/manager/dashboard'), api('/api/manager/tables'), api('/api/manager/menu'), api('/api/manager/orders'), api('/api/manager/orders?scope=history'), api('/api/manager/service-requests')
    ]);
    setDashboard(dashboardData);
    setRestaurant(dashboardData.restaurant);
    if (user && dashboardData.restaurant?.id && user.restaurant_id !== dashboardData.restaurant.id) {
      updateStoredUser({ ...user, restaurant_id: dashboardData.restaurant.id });
    }
    setTables(tableData.tables);
    setMenu(menuData);
    setOrders(orderData.orders);
    setOrderHistory(historyData.orders);
    setRequests(supportData.requests);
  }

  useEffect(() => { loadAll().catch((err) => setError(err.message)); }, []);

  useEffect(() => {
    const restaurantRoomId = restaurant?.id || user?.restaurant_id;
    if (!restaurantRoomId) return undefined;
    const socket = io(API_BASE, { path: '/socket.io', auth: { token: getToken() } });
    // Rooms are lost on reconnect, so join on every connect.
    socket.on('connect', () => socket.emit('joinRestaurant', restaurantRoomId));
    socket.on('orders:changed', () => loadAll().catch(() => undefined));
    socket.on('tables:changed', () => loadAll().catch(() => undefined));
    socket.on('menu:changed', () => loadAll().catch(() => undefined));
    socket.on('support:changed', () => loadAll().catch(() => undefined));
    return () => socket.disconnect();
  }, [restaurant?.id, user?.restaurant_id]);

  function flash(text) {
    setMessage(text);
    setTimeout(() => setMessage(''), 2500);
  }

  async function run(action, successText) {
    setError('');
    try {
      await action();
      await loadAll();
      if (successText) flash(successText);
    } catch (err) {
      const apiErrors = normalizeApiErrors(err);
      setError(apiErrors._global || err.message);
      throw err;
    }
  }

  return (
    <AppShell
      title={t('managerDashboard')}
      subtitle={t('managerSubtitle')}
      restaurantName={restaurant?.name}
      headerAction={<button className="refreshBtn managerRefreshBtn" onClick={() => run(loadAll)}><RefreshCcw size={16} /> <span>{t('refresh')}</span></button>}
    >
      <div className="managerNavRow">
        <div className="tabbar managerTabs">
          <button className={tab === 'dashboard' ? 'active' : ''} onClick={() => setTab('dashboard')}><BarChart3 size={16} /> <span>{t('dashboard')}</span></button>
          <button className={tab === 'orders' ? 'active' : ''} onClick={() => setTab('orders')}><ClipboardList size={16} /> <span>{t('orders')}</span></button>
          <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}><Clock3 size={16} /> <span>{t('pastOrderHistory')}</span></button>
          <button className={tab === 'tables' ? 'active' : ''} onClick={() => setTab('tables')}><QrCode size={16} /> <span>{t('tablesQr')}</span></button>
          <button className={tab === 'menu' ? 'active' : ''} onClick={() => setTab('menu')}><UtensilsCrossed size={16} /> <span>{t('menu')}</span></button>
          <button className={tab === 'support' ? 'active' : ''} onClick={() => setTab('support')}><Bell size={16} /> <span>{t('support')} {requests.filter((r) => r.status === 'OPEN').length ? `(${requests.filter((r) => r.status === 'OPEN').length})` : ''}</span></button>
        </div>
      </div>

      {message && <div className="successBox">{message}</div>}
      {error && <div className="errorBox">{error}</div>}

      {tab === 'dashboard' && <Dashboard dashboard={dashboard} orders={orders} run={run} t={t} />}
      {tab === 'orders' && <Orders orders={orders} run={run} t={t} />}
      {tab === 'history' && <OrderHistory orderHistory={orderHistory} run={run} t={t} />}
      {tab === 'tables' && <Tables tables={tables} run={run} t={t} />}
      {tab === 'menu' && <Menu menu={menu} run={run} t={t} />}
      {tab === 'support' && <Support requests={requests} run={run} t={t} />}
    </AppShell>
  );
}

function Dashboard({ dashboard, orders, run, t }) {
  if (!dashboard) return <div className="card">{t('loadingDashboard')}</div>;
  const cards = [
    [t('todayRevenue'), money(dashboard.today.revenue), t('approvedPaymentsToday')],
    [t('todayOrders'), dashboard.today.orders, t('ordersCreatedToday')],
    [t('activeOrders'), dashboard.totals.active_orders || 0, t('pendingPreparingReady')],
    [t('waitingPayments'), dashboard.totals.waiting_payments || 0, t('needsApproval')]
  ];
  const periodCards = [
    [t('last7Days'), money(dashboard.week?.revenue), `${dashboard.week?.orders || 0} ${t('ordersLower')} · ${dashboard.week?.completed_orders || 0} ${t('completedLower')} · ${dashboard.week?.cancelled_orders || 0} ${t('cancelledLower')}`],
    [t('last30Days'), money(dashboard.month?.revenue), `${dashboard.month?.orders || 0} ${t('ordersLower')} · ${dashboard.month?.completed_orders || 0} ${t('completedLower')} · ${dashboard.month?.cancelled_orders || 0} ${t('cancelledLower')}`],
    [t('weeklyAverageTicket'), money(dashboard.week?.average_ticket), t('approvedPaymentAverage')],
    [t('monthlyAverageTicket'), money(dashboard.month?.average_ticket), t('approvedPaymentAverage')]
  ];

  function clearHistory() {
    if (!confirm(t('clearHistoryConfirmOne'))) return;
    if (!confirm(t('clearHistoryConfirmTwo'))) return;
    run(() => api('/api/manager/orders/history', { method: 'DELETE' }), t('historyCleared'));
  }

  function SellerList({ title, items, emptyText }) {
    return (
      <section className="card">
        <h2>{title}</h2>
        <div className="miniList">
          {(!items || items.length === 0) && <p className="muted">{emptyText}</p>}
          {(items || []).map((item) => <div key={item.name}><span>{item.name}</span><b>{item.quantity} {t('sold')}</b></div>)}
        </div>
      </section>
    );
  }

  return (
    <div className="stack gap">
      <div className="statsGrid">
        {cards.map(([label, value, help]) => <div className="statCard" key={label}><span>{label}</span><strong>{value}</strong><small>{help}</small></div>)}
      </div>
      <section className="card">
        <div className="sectionHeader noAction">
          <div>
            <h2>{t('managementStats')}</h2>
            <p className="muted">{t('managementStatsHelp')}</p>
          </div>
        </div>
        <div className="statsGrid compactStats">
          {periodCards.map(([label, value, help]) => <div className="statCard" key={label}><span>{label}</span><strong>{value}</strong><small>{help}</small></div>)}
        </div>
      </section>
      <div className="grid two">
        <section className="card">
          <h2>{t('dailyRevenue')}</h2>
          <div className="barList">
            {dashboard.dailyRevenue.length === 0 && <p className="muted">{t('noApprovedRevenue')}</p>}
            {dashboard.dailyRevenue.map((day) => {
              const max = Math.max(...dashboard.dailyRevenue.map((d) => Number(d.revenue || 0)), 1);
              return <div className="barRow" key={day.day}><span>{day.day}</span><div><i style={{ width: `${Math.max((Number(day.revenue) / max) * 100, 4)}%` }} /></div><b>{money(day.revenue)}</b></div>;
            })}
          </div>
        </section>
        <SellerList title={t('bestSellers')} items={dashboard.bestSellers} emptyText={t('noOrderItems')} />
      </div>
      <div className="grid two">
        <SellerList title={t('weeklyBestSellers')} items={dashboard.weeklyBestSellers} emptyText={t('noWeeklyBestSellers')} />
        <SellerList title={t('monthlyBestSellers')} items={dashboard.monthlyBestSellers} emptyText={t('noMonthlyBestSellers')} />
      </div>
      <section className="card">
        <h2>{t('latestOrders')}</h2>
        <div className="orderPreviewGrid">{orders.slice(0, 6).map((entry) => <OrderCard key={entry.id} order={entry.full} compact t={t} />)}</div>
      </section>
      <section className="card">
        <h2>{t('cancelledOrders')}</h2>
        <p className="muted">{t('cancelledOrdersHelp')}</p>
        {(!dashboard.recentCancelledOrders || dashboard.recentCancelledOrders.length === 0) && <p className="muted">{t('noCancelledOrders')}</p>}
        <div className="orderPreviewGrid">{(dashboard.recentCancelledOrders || []).map((entry) => <OrderCard key={entry.id} order={entry.full} compact t={t} onDelete={() => run(() => api(`/api/manager/orders/${entry.id}`, { method: 'DELETE' }), t('cancelledOrderDeleted'))} />)}</div>
      </section>
      <section className="card dangerZone">
        <div>
          <h2>{t('dangerZone')}</h2>
          <p className="muted">{t('clearOrderHistoryHelp')}</p>
        </div>
        <button className="dangerBtn" onClick={clearHistory}><Trash2 size={15} /> {t('clearOrderHistory')}</button>
      </section>
    </div>
  );
}

function Orders({ orders, run, t }) {
  const groupedTables = useMemo(() => {
    const result = new Map();
    for (const entry of orders) {
      const tableNumber = entry.table_number || entry.full?.table_number || '-';
      const tableId = entry.table_id || entry.full?.table_id;
      const key = String(tableId || tableNumber);
      if (!result.has(key)) result.set(key, { tableId, tableNumber, entries: [] });
      result.get(key).entries.push(entry);
    }
    return Array.from(result.values());
  }, [orders]);

  function TableBulkActions({ group }) {
    const hasActionable = group.entries.some((entry) => entry.full?.payment_status === 'NOT_REQUESTED' && !['COMPLETED', 'CANCELLED', 'PAYMENT_WAITING'].includes(entry.full?.status));
    const hasPaymentApproval = group.entries.length > 0 && group.entries.every((entry) => (entry.full?.payment_status === 'WAITING_APPROVAL' && entry.full?.status === 'PAYMENT_WAITING') || (entry.full?.payment_status === 'NOT_REQUESTED' && entry.full?.status === 'SERVED'));
    return (
      <div className="bulkActions tableBulkActions">
        <b>{t('table')} {group.tableNumber} · {t('bulkOrderActions')}</b>
        <button className="smallBtn" disabled={!hasActionable} onClick={() => run(() => api('/api/manager/orders/bulk/status', { method: 'POST', body: { table_id: group.tableId, status: 'PREPARING' } }), t('bulkUpdated'))}>{t('markAllPreparing')}</button>
        <button className="smallBtn" disabled={!hasActionable} onClick={() => run(() => api('/api/manager/orders/bulk/status', { method: 'POST', body: { table_id: group.tableId, status: 'READY' } }), t('bulkUpdated'))}>{t('markAllReady')}</button>
        <button className="smallBtn" disabled={!hasActionable} onClick={() => run(() => api('/api/manager/orders/bulk/status', { method: 'POST', body: { table_id: group.tableId, status: 'SERVED' } }), t('bulkUpdated'))}>{t('markAllServed')}</button>
        <button className="approveBtn" disabled={!hasPaymentApproval} onClick={() => run(() => api('/api/manager/orders/bulk/payment/approve', { method: 'POST', body: { table_id: group.tableId } }), t('paymentApproved'))}>{t('approvePayment')}</button>
      </div>
    );
  }

  return (
    <section className="card">
      <h2>{t('todayOrdersPanel')}</h2>
      <p className="muted">{t('todayOrdersHelp')}</p>
      {orders.length === 0 && <p className="muted">{t('noTodayOrders')}</p>}
      <div className="tableOrderGroups">
        {groupedTables.map((group) => (
          <div className="tableOrderGroup" key={group.tableId || group.tableNumber}>
            <div className="tableOrderGroupHead"><h3>{t('table')} {group.tableNumber}</h3><span>{group.entries.length} {t('ordersLower')}</span></div>
            <TableBulkActions group={group} />
            <div className="orderGrid">
              {group.entries.map((entry) => (
                <OrderCard
                  key={entry.id}
                  order={entry.full}
                  t={t}
                  onStatus={(status) => run(() => api(`/api/manager/orders/${entry.id}/status`, { method: 'PATCH', body: { status } }), t('orderStatusUpdated'))}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OrderHistory({ orderHistory, run, t }) {
  const groupedHistory = useMemo(() => {
    const result = new Map();
    for (const entry of orderHistory) {
      const date = String(entry.created_at || entry.full?.created_at || '').slice(0, 10) || t('unknownDate');
      if (!result.has(date)) result.set(date, []);
      result.get(date).push(entry);
    }
    return Array.from(result.entries());
  }, [orderHistory, t]);

  return (
    <section className="card">
      <h2>{t('pastOrderHistory')}</h2>
      <p className="muted">{t('pastOrderHistoryHelp')}</p>
      {groupedHistory.length === 0 && <p className="muted">{t('noPastOrders')}</p>}
      <div className="historyStack">
        {groupedHistory.map(([date, entries]) => (
          <div className="historyDay" key={date}>
            <h3>{date}</h3>
            <div className="orderPreviewGrid">{entries.map((entry) => <OrderCard key={entry.id} order={entry.full} compact t={t} onDelete={entry.full?.status === 'CANCELLED' ? () => run(() => api(`/api/manager/orders/${entry.id}`, { method: 'DELETE' }), t('cancelledOrderDeleted')) : undefined} />)}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

function OrderCard({ order, compact = false, onStatus, onApprove, onReject, onDelete, t }) {
  if (!order) return null;
  const paymentTemplate = order.payment?.template_data ? JSON.parse(order.payment.template_data) : null;
  const closed = ['COMPLETED', 'CANCELLED'].includes(order.status);
  const paymentLocked = order.payment_status !== 'NOT_REQUESTED' || ['PAYMENT_WAITING', 'PAYMENT_REJECTED', 'PAYMENT_APPROVED'].includes(order.status);
  const canChangeKitchenStatus = !closed && !paymentLocked;
  const canCancel = !closed && !paymentLocked && order.status === 'PENDING';

  return (
    <article className="orderCard">
      <div className="orderHead">
        <div><b>{order.order_number}</b><span>{t('table')} {order.table_number}</span><span>{formatDateTime(order.created_at)}</span></div>
        <span className={`status ${order.status.toLowerCase()}`}>{niceStatus(order.status)}</span>
      </div>
      <div className="orderItems">{order.items.map((item) => <div key={item.id} className="orderItemLine"><span>{item.quantity}× {item.name}{item.note ? <small>{t('note')}: {item.note}</small> : null}</span><b>{money(item.quantity * item.unit_price)}</b></div>)}</div>
      <div className="orderTotal"><span>{t('total')}</span><b>{money(order.total_price)}</b></div>
      {compact && order.status === 'CANCELLED' && onDelete && <div className="orderActions"><button className="dangerBtn" onClick={() => { if (confirm(t('deleteCancelledOrderConfirm'))) onDelete(); }}><Trash2 size={15} /> {t('delete')}</button></div>}
      {!compact && (
        <>
          <div className="orderActions statusActions">
            {['PREPARING', 'READY', 'SERVED'].map((status) => <button key={status} className="smallBtn" onClick={() => onStatus?.(status)} disabled={!canChangeKitchenStatus}>{niceStatus(status)}</button>)}
            {canCancel && <button className="dangerBtn" onClick={() => onStatus?.('CANCELLED')}>{niceStatus('CANCELLED')}</button>}
          </div>
          {paymentTemplate && (
            <div className="paymentTemplate">
              <h3>{t('paymentConfirmation')}</h3>
              <p><b>{t('restaurant')}:</b> {paymentTemplate.restaurant}</p>
              <p><b>{t('table')}:</b> {paymentTemplate.table}</p>
              <p><b>{t('orderNumber')}:</b> {paymentTemplate.orderNumber}</p>
              <p><b>{t('method')}:</b> {niceStatus(paymentTemplate.method)}</p>
              <p><b>{t('amount')}:</b> {money(paymentTemplate.totalAmount)}</p>
              <p><b>{t('status')}:</b> {niceStatus(order.payment_status)}</p>
              {order.payment_status === 'WAITING_APPROVAL' && onApprove && <div className="orderActions"><button className="approveBtn" onClick={onApprove}><CheckCircle2 size={15} /> {t('approvePayment')}</button>{onReject && <button className="dangerBtn" onClick={onReject}><XCircle size={15} /> {t('reject')}</button>}</div>}
            </div>
          )}
          {order.status === 'CANCELLED' && onDelete && <div className="orderActions"><button className="dangerBtn" onClick={() => { if (confirm(t('deleteCancelledOrderConfirm'))) onDelete(); }}><Trash2 size={15} /> {t('delete')}</button></div>}
        </>
      )}
    </article>
  );
}

function Tables({ tables, run, t }) {
  const [form, setForm] = useState({ table_number: '', capacity: '' });
  const [errors, setErrors] = useState({});
  const [editing, setEditing] = useState(null);
  const [editErrors, setEditErrors] = useState({});
  const [qr, setQr] = useState(null);

  async function createTable(event) {
    event.preventDefault();
    const local = validateTableForm(form, t);
    setErrors(local);
    if (Object.keys(local).length) return;
    try {
      await run(() => api('/api/manager/tables', { method: 'POST', body: form }), t('tableCreated'));
      setForm({ table_number: '', capacity: '' });
    } catch (err) { setErrors(normalizeApiErrors(err)); }
  }

  async function saveEdit(event) {
    event.preventDefault();
    const local = validateTableForm(editing, t);
    setEditErrors(local);
    if (Object.keys(local).length) return;
    try {
      await run(() => api(`/api/manager/tables/${editing.id}`, { method: 'PATCH', body: { table_number: editing.table_number, capacity: Number(editing.capacity), is_active: Boolean(editing.is_active) } }), t('tableUpdated'));
      setEditing(null);
    } catch (err) { setEditErrors(normalizeApiErrors(err)); }
  }

  async function showQr(tableId) {
    const data = await api(`/api/manager/tables/${tableId}/qr`);
    setQr(data);
  }

  async function copy(text) {
    await navigator.clipboard.writeText(text);
    alert(t('copyLink'));
  }

  return (
    <div className="grid two uneven">
      <section className="card">
        <h2>{t('tablesQr')}</h2>
        <form className="inlineForm" onSubmit={createTable} noValidate>
          <label className="inlineLabel"><span>{t('tableNo')}</span><input value={form.table_number} onChange={(e) => setForm({ ...form, table_number: e.target.value })} /><FieldError message={errors.table_number} /></label>
          <label className="inlineLabel"><span>{t('seatCapacity')}</span><input inputMode="numeric" placeholder={t('seatCapacityPlaceholder')} value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} /><FieldError message={errors.capacity} /></label>
          <button className="primaryBtn"><Plus size={16} /> {t('addTable')}</button>
        </form>
        {editing && (
          <form className="editPanel stack" onSubmit={saveEdit} noValidate>
            <h3>{t('edit')} {t('table')} {editing.table_number}</h3>
            <label><span>{t('tableNo')}</span><input value={editing.table_number} onChange={(e) => setEditing({ ...editing, table_number: e.target.value })} /><FieldError message={editErrors.table_number} /></label>
            <label><span>{t('seatCapacity')}</span><input inputMode="numeric" value={editing.capacity} onChange={(e) => setEditing({ ...editing, capacity: e.target.value })} /><FieldError message={editErrors.capacity} /></label>
            <label className="checkRow"><input type="checkbox" checked={Boolean(editing.is_active)} onChange={(e) => setEditing({ ...editing, is_active: e.target.checked })} /> <span>{t('active')}</span></label>
            <div className="orderActions"><button className="primaryBtn">{t('save')}</button><button type="button" className="smallBtn" onClick={() => setEditing(null)}>{t('cancel')}</button></div>
          </form>
        )}
        <div className="tableCards">
          {tables.map((table) => (
            <article className="tableCard" key={table.id}>
              <div>
                <b>{t('table')} {table.table_number}</b>
                <span>{table.capacity} {t('seats')} · {table.current_order_id ? `${t('activeOrder')} ${table.current_order_number}` : t('clean')} · {table.is_active ? t('active') : t('passive')}</span>
              </div>
              <div className="orderActions">
                <button className="smallBtn" onClick={() => showQr(table.id)}><QrCode size={14} /> QR</button>
                <button className="smallBtn" onClick={() => copy(table.qr_url)}>{t('copyLink')}</button>
                <button className="smallBtn" onClick={() => setEditing({ ...table, capacity: String(table.capacity) })}><Pencil size={14} /> {t('edit')}</button>
                <button className="smallBtn" onClick={() => { if (confirm(t('regenerateQrConfirm'))) run(() => api(`/api/manager/tables/${table.id}/regenerate-qr`, { method: 'POST' }), t('qrRegenerated')); }}>{t('regenerateQr')}</button>
                {table.current_order_id && <button className="dangerBtn" onClick={() => run(() => api(`/api/manager/tables/${table.id}/clear`, { method: 'POST' }), t('tableCleared'))}>{t('clear')}</button>}
                {!table.current_order_id && <button className="dangerBtn" onClick={() => { if (confirm(t('deleteTableConfirm'))) run(() => api(`/api/manager/tables/${table.id}`, { method: 'DELETE' }), t('tableDeleted')); }}><Trash2 size={14} /> {t('delete')}</button>}
              </div>
            </article>
          ))}
        </div>
      </section>
      <section className="card qrPanel">
        <h2>{t('qrPreview')}</h2>
        {!qr && <p className="muted">{t('selectTableForQr')}</p>}
        {qr && <><img src={qr.qr_data_url} alt="QR code" /><b>{t('table')} {qr.table.table_number}</b><code>{qr.qr_url}</code><div className="orderActions"><a className="primaryBtn" href={qr.qr_data_url} download={`table-${qr.table.table_number}-qr.png`}>{t('downloadQr')}</a><button className="smallBtn" onClick={() => copy(qr.qr_url)}>{t('copyLink')}</button></div><p className="muted small">{t('fixedQrNote')}</p></>}
      </section>
    </div>
  );
}

function Menu({ menu, run, t }) {
  const [categoryForm, setCategoryForm] = useState({ name: '', sort_order: menu.categories.length + 1 });
  const [categoryErrors, setCategoryErrors] = useState({});
  const [editingCategory, setEditingCategory] = useState(null);
  const [editingCategoryErrors, setEditingCategoryErrors] = useState({});
  const firstCategoryId = menu.categories[0]?.id || '';
  const [itemForm, setItemForm] = useState({ category_id: firstCategoryId, name: '', description: '', price: '', emoji: '🍽️', image: null });
  const [itemErrors, setItemErrors] = useState({});
  const [editingItem, setEditingItem] = useState(null);
  const [editingItemErrors, setEditingItemErrors] = useState({});

  useEffect(() => { if (!itemForm.category_id && firstCategoryId) setItemForm((current) => ({ ...current, category_id: firstCategoryId })); }, [firstCategoryId]);

  async function addCategory(event) {
    event.preventDefault();
    const local = validateCategoryForm(categoryForm, t, menu.categories);
    setCategoryErrors(local);
    if (Object.keys(local).length) return;
    try {
      await run(() => api('/api/manager/categories', { method: 'POST', body: { name: categoryForm.name, sort_order: Number(categoryForm.sort_order) || menu.categories.length + 1 } }), t('categoryAdded'));
      setCategoryForm({ name: '', sort_order: menu.categories.length + 2 });
    } catch (err) { setCategoryErrors(normalizeApiErrors(err)); }
  }

  async function saveCategory(event) {
    event.preventDefault();
    const local = validateCategoryForm(editingCategory, t, menu.categories, editingCategory.id);
    setEditingCategoryErrors(local);
    if (Object.keys(local).length) return;
    try {
      await run(() => api(`/api/manager/categories/${editingCategory.id}`, { method: 'PATCH', body: { name: editingCategory.name, sort_order: Number(editingCategory.sort_order) || 0, is_active: Boolean(editingCategory.is_active) } }), t('categoryUpdated'));
      setEditingCategory(null);
    } catch (err) { setEditingCategoryErrors(normalizeApiErrors(err)); }
  }

  async function deleteCategory(category) {
    if (!confirm(t('deleteCategoryConfirm'))) return;
    await run(() => api(`/api/manager/categories/${category.id}`, { method: 'DELETE' }), t('categoryDeleted'));
  }

  async function addItem(event) {
    event.preventDefault();
    const local = validateItemForm(itemForm, t);
    setItemErrors(local);
    if (Object.keys(local).length) return;
    const formData = new FormData();
    formData.set('category_id', itemForm.category_id);
    formData.set('name', itemForm.name);
    formData.set('description', itemForm.description);
    formData.set('price', itemForm.price);
    formData.set('emoji', itemForm.emoji || '🍽️');
    if (itemForm.image) formData.set('image', itemForm.image);
    try {
      await run(() => api('/api/manager/menu-items', { method: 'POST', body: formData }), t('menuItemAdded'));
      setItemForm({ category_id: itemForm.category_id, name: '', description: '', price: '', emoji: '🍽️', image: null });
      event.currentTarget.reset();
    } catch (err) { setItemErrors(normalizeApiErrors(err)); }
  }

  async function saveItem(event) {
    event.preventDefault();
    const local = validateItemForm(editingItem, t);
    setEditingItemErrors(local);
    if (Object.keys(local).length) return;
    const formData = new FormData();
    formData.set('category_id', editingItem.category_id);
    formData.set('name', editingItem.name);
    formData.set('description', editingItem.description || '');
    formData.set('price', editingItem.price);
    formData.set('emoji', editingItem.emoji || '🍽️');
    formData.set('is_available', String(Boolean(editingItem.is_available)));
    if (editingItem.image) formData.set('image', editingItem.image);
    try {
      await run(() => api(`/api/manager/menu-items/${editingItem.id}`, { method: 'PATCH', body: formData }), t('menuItemUpdated'));
      setEditingItem(null);
    } catch (err) { setEditingItemErrors(normalizeApiErrors(err)); }
  }

  async function uploadReplacement(item, file) {
    if (!file) return;
    const formData = new FormData();
    formData.set('image', file);
    await run(() => api(`/api/manager/menu-items/${item.id}`, { method: 'PATCH', body: formData }), t('imageUpdated'));
  }

  const grouped = useMemo(() => menu.categories.map((category) => ({ ...category, items: menu.items.filter((item) => item.category_id === category.id) })), [menu]);

  return (
    <div className="grid two uneven">
      <section className="card">
        <h2>{t('menuManagement')}</h2>
        <form className="inlineForm" onSubmit={addCategory} noValidate>
          <label className="inlineLabel"><span>{t('categoryName')}</span><input placeholder={t('categoryName')} value={categoryForm.name} onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })} /><FieldError message={categoryErrors.name} /></label>
          <label className="inlineLabel"><span>{t('sortOrder')}</span><input inputMode="numeric" value={categoryForm.sort_order} onChange={(e) => setCategoryForm({ ...categoryForm, sort_order: e.target.value })} /><FieldError message={categoryErrors.sort_order} /></label>
          <button className="primaryBtn"><Plus size={16} /> {t('addCategory')}</button>
        </form>
        {editingCategory && <form className="editPanel stack" onSubmit={saveCategory} noValidate><h3>{t('editCategory')}</h3><label><span>{t('categoryName')}</span><input value={editingCategory.name} onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })} /><FieldError message={editingCategoryErrors.name} /></label><label><span>{t('sortOrder')}</span><input inputMode="numeric" value={editingCategory.sort_order} onChange={(e) => setEditingCategory({ ...editingCategory, sort_order: e.target.value })} /><FieldError message={editingCategoryErrors.sort_order} /></label><label className="checkRow"><input type="checkbox" checked={Boolean(editingCategory.is_active)} onChange={(e) => setEditingCategory({ ...editingCategory, is_active: e.target.checked })} /> <span>{t('active')}</span></label><div className="orderActions"><button className="primaryBtn">{t('save')}</button><button type="button" className="smallBtn" onClick={() => setEditingCategory(null)}>{t('cancel')}</button></div></form>}
        <div className="menuAdminList">
          {grouped.map((category) => (
            <div key={category.id} className="categoryBlock">
              <div className="categoryAdminHead"><h3>{category.name} <span className="muted small">#{category.sort_order} · {category.is_active ? t('active') : t('passive')}</span></h3><div className="orderActions"><button className="smallBtn" onClick={() => setEditingCategory({ ...category, sort_order: String(category.sort_order) })}><Pencil size={14} /> {t('edit')}</button><button className="dangerBtn" onClick={() => deleteCategory(category)}><Trash2 size={14} /> {t('delete')}</button></div></div>
              {category.items.map((item) => (
                <article key={item.id} className="adminMenuItem">
                  {item.image_url ? <img className="adminFoodImage" src={item.image_url} alt={item.name} /> : <span className="emojiBadge">{item.emoji}</span>}
                  <div><b>{item.name}</b><small>{item.description}</small></div>
                  <b>{money(item.price)}</b>
                  <div className="orderActions">
                    <label className="smallBtn fileButton"><ImagePlus size={14} /> {t('image')}<input type="file" accept="image/*" onChange={(e) => uploadReplacement(item, e.target.files?.[0])} /></label>
                    <button className="smallBtn" onClick={() => run(() => api(`/api/manager/menu-items/${item.id}`, { method: 'PATCH', body: { is_available: !item.is_available } }), t('availabilityUpdated'))}>{item.is_available ? t('active') : t('passive')}</button>
                    <button className="smallBtn" onClick={() => setEditingItem({ ...item, price: String(item.price), category_id: String(item.category_id), image: null })}><Pencil size={14} /> {t('edit')}</button>
                    <button className="dangerBtn" onClick={() => { if (confirm(t('deleteItemConfirm'))) run(() => api(`/api/manager/menu-items/${item.id}`, { method: 'DELETE' }), t('menuItemDeleted')); }}><Trash2 size={14} /> {t('delete')}</button>
                  </div>
                </article>
              ))}
            </div>
          ))}
        </div>
      </section>
      <section className="card">
        <h2>{editingItem ? t('editMenuItem') : t('addMenuItem')}</h2>
        {editingItem ? (
          <form className="stack" onSubmit={saveItem} noValidate>
            <select value={editingItem.category_id} onChange={(e) => setEditingItem({ ...editingItem, category_id: e.target.value })}>{menu.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><FieldError message={editingItemErrors.category_id} />
            <input placeholder={t('emoji')} value={editingItem.emoji || ''} onChange={(e) => setEditingItem({ ...editingItem, emoji: e.target.value })} />
            <input placeholder={t('itemName')} value={editingItem.name} onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })} /><FieldError message={editingItemErrors.name} />
            <textarea placeholder={t('description')} value={editingItem.description || ''} onChange={(e) => setEditingItem({ ...editingItem, description: e.target.value })} />
            <input inputMode="decimal" placeholder={t('price')} value={editingItem.price} onChange={(e) => setEditingItem({ ...editingItem, price: e.target.value })} /><FieldError message={editingItemErrors.price} />
            <label className="checkRow"><input type="checkbox" checked={Boolean(editingItem.is_available)} onChange={(e) => setEditingItem({ ...editingItem, is_available: e.target.checked })} /> <span>{t('active')}</span></label>
            <label><span>{t('imageResizeNote')}</span><input type="file" accept="image/*" onChange={(e) => setEditingItem({ ...editingItem, image: e.target.files?.[0] || null })} /></label>
            <div className="orderActions"><button className="primaryBtn">{t('save')}</button><button type="button" className="smallBtn" onClick={() => setEditingItem(null)}>{t('cancel')}</button></div>
          </form>
        ) : (
          <form className="stack" onSubmit={addItem} noValidate>
            <select value={itemForm.category_id} onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}>{menu.categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select><FieldError message={itemErrors.category_id} />
            <input placeholder={t('emoji')} value={itemForm.emoji} onChange={(e) => setItemForm({ ...itemForm, emoji: e.target.value })} />
            <input placeholder={t('itemName')} value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} /><FieldError message={itemErrors.name} />
            <textarea placeholder={t('description')} value={itemForm.description} onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })} />
            <input inputMode="decimal" placeholder={t('price')} value={itemForm.price} onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })} /><FieldError message={itemErrors.price} />
            <label><span>{t('imageResizeNote')}</span><input type="file" accept="image/*" onChange={(e) => setItemForm({ ...itemForm, image: e.target.files?.[0] || null })} /></label>
            <button className="primaryBtn">{t('addMenuItem')}</button>
          </form>
        )}
      </section>
    </div>
  );
}

function Support({ requests, run, t }) {
  const open = requests.filter((request) => request.status === 'OPEN');
  return (
    <section className="card">
      <h2>{t('openRequests')}</h2>
      <div className="supportList">
        {open.length === 0 && <p className="muted">{t('noRequests')}</p>}
        {open.map((request) => (
          <article className="supportCard" key={request.id}>
            <div><b>{niceStatus(request.type)} · {t('table')} {request.table_number || request.resolved_table_number || '-'}</b><span>{new Date(request.created_at).toLocaleString()}</span>{request.message && <p>{request.message}</p>}</div>
            <button className="approveBtn" onClick={() => run(() => api(`/api/manager/service-requests/${request.id}`, { method: 'PATCH', body: { status: 'DONE' } }), t('supportRequestClosed'))}>{t('markDone')}</button>
          </article>
        ))}
      </div>
    </section>
  );
}
