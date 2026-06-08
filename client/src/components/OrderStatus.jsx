import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { io } from 'socket.io-client';
import { Bell, CheckCircle2, Clock, CreditCard, Home, Plus, XCircle } from 'lucide-react';
import { api, money, niceStatus } from '../api.js';
import { SettingsControls, useSettings } from '../i18n.jsx';

const API_BASE = import.meta.env.VITE_API_URL || window.location.origin;

function supportKey(order, type = 'WAITER') {
  return `campuseats_support_${type}_${order.restaurant_slug}_${order.table_token}`;
}

function canSendSupport(order, type) {
  const last = Number(localStorage.getItem(supportKey(order, type)) || 0);
  return Date.now() - last > 60000;
}

function markSupportSent(order, type) {
  localStorage.setItem(supportKey(order, type), String(Date.now()));
}

export default function OrderStatus() {
  const { publicId } = useParams();
  const { t } = useSettings();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [loadingCancelId, setLoadingCancelId] = useState('');
  const [supportMessage, setSupportMessage] = useState('');

  async function load() {
    const data = await api(`/api/public/orders/${publicId}`);
    setOrder(data.order);
  }

  useEffect(() => { load().catch((err) => setError(err.message)); }, [publicId]);

  useEffect(() => {
    const socket = io(API_BASE, { path: '/socket.io' });
    socket.emit('joinOrder', publicId);
    socket.on('order:updated', setOrder);
    return () => socket.disconnect();
  }, [publicId]);

  async function requestPayment(method) {
    setLoadingPayment(true);
    setError('');
    try {
      const data = await api(`/api/public/orders/${publicId}/payment-request`, { method: 'POST', body: { payment_method: method } });
      setOrder(data.order);
    } catch (err) { setError(err.message); }
    finally { setLoadingPayment(false); }
  }


  function canCancelOrder(target) {
    if (!target) return false;
    if (['COMPLETED', 'CANCELLED'].includes(target.status)) return false;
    if (!['PENDING', 'PREPARING'].includes(target.status)) return false;
    if (['WAITING_APPROVAL', 'APPROVED'].includes(target.payment_status)) return false;
    return !activeTableOrders.some((active) => active.payment_status === 'WAITING_APPROVAL' || active.status === 'PAYMENT_WAITING');
  }

  async function cancelOrder(targetPublicId) {
    if (!window.confirm(t('cancelOrderConfirm'))) return;
    setLoadingCancelId(targetPublicId);
    setError('');
    try {
      const data = await api(`/api/public/orders/${targetPublicId}/cancel`, { method: 'POST' });
      if (targetPublicId === publicId) setOrder(data.order);
      else await load();
    } catch (err) { setError(err.message); }
    finally { setLoadingCancelId(''); }
  }

  async function callWaiter() {
    if (!order) return;
    setError('');
    try {
      if (!canSendSupport(order, 'WAITER')) {
        setError(t('supportAlreadyOpen'));
        return;
      }
      const result = await api(`/api/public/restaurants/${order.restaurant_slug}/service-requests`, { method: 'POST', body: { table_token: order.table_token, type: 'WAITER', message: supportMessage || t('callWaiter') } });
      markSupportSent(order, 'WAITER');
      alert(result.duplicated ? t('supportAlreadyOpen') : t('waiterCalled'));
      setSupportMessage('');
    } catch (err) { setError(err.message); }
  }

  if (error && !order) return <main className="customerShell centeredCustomer"><div className="phoneFrame customerHome"><div className="customerPrefsFloating"><SettingsControls compact floating /></div><h1>{t('orderNotFound')}</h1><p>{error}</p></div></main>;
  if (!order) return <main className="customerShell centeredCustomer"><div className="phoneFrame customerHome"><div className="customerPrefsFloating"><SettingsControls compact floating /></div><p>{t('loadingOrder')}</p></div></main>;

  const completed = order.status === 'COMPLETED' || order.payment_status === 'APPROVED';
  const cancelled = order.status === 'CANCELLED';
  const activeTableOrders = Array.isArray(order.table_orders) ? order.table_orders : [];
  const billingStarted = activeTableOrders.some((active) => active.payment_status !== 'NOT_REQUESTED' || ['PAYMENT_WAITING', 'PAYMENT_REJECTED'].includes(active.status));
  const allActiveServed = activeTableOrders.length > 0 && activeTableOrders.every((active) => ['SERVED', 'PAYMENT_REJECTED'].includes(active.status));
  const canAddMore = !completed && !cancelled && !billingStarted && order.payment_status === 'NOT_REQUESTED';
  const canRequestPayment = !completed && !cancelled && order.payment_status === 'NOT_REQUESTED' && allActiveServed;
  const qrHome = `/r/${order.restaurant_slug}/table/${order.table_token}`;

  return (
    <main className="customerShell centeredCustomer">
      <section className="phoneFrame confirmationScreen">
        <div className="customerPrefsFloating"><SettingsControls compact floating /></div>
        <div className={`successIcon ${completed ? '' : 'waiting'}`}>{completed ? <CheckCircle2 size={70} /> : <Clock size={70} />}</div>
        <h1>{completed ? t('orderCompleted') : t('orderConfirmed')}</h1>
        <p>{completed ? t('paymentApprovedDone') : t('orderSent')}</p>

        <div className="statusCard">
          <p><span>{t('status')}</span><b>{niceStatus(order.status)}</b></p>
          <p><span>{t('payment')}</span><b>{niceStatus(order.payment_status)}</b></p>
          <p><span>{t('tableNumber')}</span><b>#{order.table_number}</b></p>
          <p><span>{t('orderNumber')}</span><b>{order.order_number}</b></p>
          <p><span>{t('total')}</span><b>{money(order.total_price)}</b></p>
        </div>

        <div className="customerOrderItems">{order.items.map((item) => <p key={item.id}><span>{item.quantity}× {item.name}</span><b>{money(item.quantity * item.unit_price)}</b></p>)}</div>

        {activeTableOrders.length > 0 && !completed && (
          <div className="tableOrdersMini statusOrdersMini">
            <b>{t('tableOrders')}</b>
            {activeTableOrders.map((active) => (
              <div className="tableOrderRow" key={active.id}>
                <Link to={`/order/${active.public_id}`}>{active.order_number} · {niceStatus(active.status)} · {money(active.total_price)}</Link>
                {canCancelOrder(active) && (
                  <button className="dangerTiny" disabled={loadingCancelId === active.public_id} onClick={() => cancelOrder(active.public_id)}>
                    <XCircle size={13} /> {loadingCancelId === active.public_id ? t('cancellingOrder') : t('cancelOrder')}
                  </button>
                )}
              </div>
            ))}
            <small>{t('tableOrdersHelp')}</small>
          </div>
        )}

        {cancelled && activeTableOrders.length > 0 && <div className="noticeBox">{t('cancelledChooseAnotherOrder')}</div>}

        <div className="customerUtility statusUtility"><input placeholder={t('supportMessage')} value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} /><button className="smallBtn" onClick={callWaiter}><Bell size={15} /> {t('callWaiter')}</button></div>

        {canAddMore && <Link className="primaryBtn full" to={`/r/${order.restaurant_slug}/table/${order.table_token}?mode=add`}><Plus size={15} /> {t('addMoreItems')}</Link>}

        {canRequestPayment ? (
          <div className="paymentRequestBox"><p>{t('requestPayment')}</p><div className="paymentMethods">{['CASH', 'CARD', 'TRANSFER'].map((method) => <button key={method} disabled={loadingPayment} onClick={() => requestPayment(method)}><CreditCard size={15} /> {niceStatus(method)}</button>)}</div></div>
        ) : (order.payment_status === 'NOT_REQUESTED' && !completed && !cancelled && <div className="noticeBox">{billingStarted ? t('paymentWaiting') : allActiveServed ? t('paymentReadyAllOrders') : t('paymentAllOrdersServed')}</div>)}

        {order.payment_status === 'WAITING_APPROVAL' && <div className="noticeBox">{t('paymentWaiting')}</div>}
        {order.payment_status === 'REJECTED' && <div className="errorBox">{t('paymentRejected')}</div>}
        {error && <div className="errorBox">{error}</div>}

        <Link to={qrHome} className="secondaryBtn full"><Home size={15} /> {t('backToHome')}</Link>
      </section>
    </main>
  );
}
