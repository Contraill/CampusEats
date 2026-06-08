import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Bell, Check, Minus, Plus, QrCode, Search, ShoppingCart, Store } from 'lucide-react';
import { api, money } from '../api.js';
import { SettingsControls, useSettings } from '../i18n.jsx';

function cartKey(slug, token) {
  return `campuseats_cart_${slug}_${token}`;
}

function supportKey(slug, token, type = 'WAITER') {
  return `campuseats_support_${type}_${slug}_${token}`;
}

function canSendSupport(slug, token, type) {
  const key = supportKey(slug, token, type);
  const last = Number(localStorage.getItem(key) || 0);
  return Date.now() - last > 60000;
}

function markSupportSent(slug, token, type) {
  localStorage.setItem(supportKey(slug, token, type), String(Date.now()));
}

function itemLabel(count, t) {
  return `${count} ${count === 1 ? t('itemCount') : t('itemsCount')}`;
}

export default function CustomerApp() {
  const { slug, token } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useSettings();
  const addMode = searchParams.get('mode') === 'add';
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState(() => {
    try { return JSON.parse(localStorage.getItem(cartKey(slug, token)) || '[]'); } catch { return []; }
  });
  const [showCart, setShowCart] = useState(false);
  const [loadingOrder, setLoadingOrder] = useState(false);
  const [supportMessage, setSupportMessage] = useState('');

  useEffect(() => {
    api(`/api/public/restaurants/${slug}/tables/${token}/bootstrap`)
      .then((result) => {
        setData(result);
        if (result.active_order && !addMode) navigate(`/order/${result.active_order.public_id}`);
      })
      .catch((err) => setError(err.message));
  }, [slug, token, navigate, addMode]);

  useEffect(() => {
    try { localStorage.setItem(cartKey(slug, token), JSON.stringify(cart)); } catch {}
  }, [cart, slug, token]);

  const items = useMemo(() => {
    const list = data?.menu.items || [];
    return list.filter((item) => {
      const matchesCategory = activeCategory === 'all' || item.category_id === Number(activeCategory);
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || String(item.description || '').toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [data, activeCategory, search]);

  const subtotal = cart.reduce((sum, line) => sum + line.price * line.quantity, 0);
  const taxRate = Number(data?.tax_rate ?? 0.1);
  const tax = subtotal * taxRate;
  const total = subtotal + tax;

  function addItem(item) {
    setCart((current) => {
      const exists = current.find((line) => line.id === item.id);
      if (exists) return current.map((line) => line.id === item.id ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { id: item.id, name: item.name, price: item.price, emoji: item.emoji, image_url: item.image_url, quantity: 1, note: '' }];
    });
  }

  function updateQuantity(id, delta) {
    setCart((current) => current.map((line) => line.id === id ? { ...line, quantity: line.quantity + delta } : line).filter((line) => line.quantity > 0));
  }

  function updateNote(id, note) {
    setCart((current) => current.map((line) => line.id === id ? { ...line, note } : line));
  }

  async function placeOrder() {
    setLoadingOrder(true);
    setError('');
    try {
      const payload = { restaurant_slug: slug, table_token: token, append_to_active: Boolean(data?.active_order), items: cart.map((line) => ({ menu_item_id: line.id, quantity: line.quantity, note: line.note })) };
      const result = await api('/api/public/orders', { method: 'POST', body: payload });
      localStorage.removeItem(cartKey(slug, token));
      setCart([]);
      navigate(`/order/${result.order.public_id}`);
    } catch (err) {
      if (err.status === 409 && err.data?.active_order) navigate(`/order/${err.data.active_order.public_id}`);
      else setError(err.message);
    } finally {
      setLoadingOrder(false);
    }
  }

  async function callWaiter() {
    setError('');
    try {
      if (!canSendSupport(slug, token, 'WAITER')) {
        setError(t('supportAlreadyOpen'));
        return;
      }
      const result = await api(`/api/public/restaurants/${slug}/service-requests`, { method: 'POST', body: { table_token: token, type: 'WAITER', message: supportMessage || t('callWaiter') } });
      markSupportSent(slug, token, 'WAITER');
      alert(result.duplicated ? t('supportAlreadyOpen') : t('waiterCalled'));
      setSupportMessage('');
    } catch (err) { setError(err.message); }
  }

  if (error && !data) return <InvalidQr slug={slug} initialError={error} />;

  if (!data) {
    return <main className="customerShell centeredCustomer"><div className="phoneFrame scannerScreen"><div className="scanMark"><span /><span /><span /><span /></div><p>{t('openingQrMenu')}</p></div></main>;
  }

  const totalItems = cart.reduce((sum, line) => sum + line.quantity, 0);

  return (
    <main className="customerShell">
      <section className="phoneFrame menuScreen">
        <div className="customerPrefsFloating"><SettingsControls compact floating /></div>
        <header className="customerTop">
          <div><span className="small muted">{data.restaurant.name}</span><h1>{t('table')} {data.table.table_number}</h1>{data.active_order && <p className="small noticeInline">{t('addMoreItems')}: {data.active_order.order_number}</p>}</div>
          <div className="customerLogo smallLogo"><Store size={18} /></div>
        </header>

        <div className="customerUtility">
          <input placeholder={t('supportMessage')} value={supportMessage} onChange={(e) => setSupportMessage(e.target.value)} />
          <button className="smallBtn" onClick={callWaiter}><Bell size={15} /> {t('callWaiter')}</button>
        </div>

        <div className="searchBox"><Search size={16} /><input placeholder={t('searchMenu')} value={search} onChange={(e) => setSearch(e.target.value)} /></div>
        <div className="categoryTabs"><button className={activeCategory === 'all' ? 'active' : ''} onClick={() => setActiveCategory('all')}>{t('all')}</button>{data.menu.categories.map((category) => <button key={category.id} className={activeCategory === String(category.id) ? 'active' : ''} onClick={() => setActiveCategory(String(category.id))}>{category.name}</button>)}</div>

        <div className="customerItems">
          {items.map((item) => {
            const inCart = cart.find((line) => line.id === item.id);
            return (
              <article className="customerItem" key={item.id}>
                {item.image_url ? <img className="foodPhoto image" src={item.image_url} alt={item.name} /> : <span className="foodPhoto">{item.emoji}</span>}
                <div className="foodInfo"><b>{item.name}</b><p>{item.description}</p><strong>{money(item.price)}</strong></div>
                {inCart ? <div className="qtyControls"><button onClick={() => updateQuantity(item.id, -1)}><Minus size={14} /></button><span>{inCart.quantity}</span><button className="plus" onClick={() => addItem(item)}><Plus size={14} /></button></div> : <button className="roundAdd" onClick={() => addItem(item)}><Plus size={18} /></button>}
              </article>
            );
          })}
        </div>

        {cart.length > 0 && <button className="floatingCart" onClick={() => setShowCart(true)}><span>{itemLabel(totalItems, t)}<br /><b>{money(total)}</b></span><span><ShoppingCart size={18} /> {t('viewCart')}</span></button>}
      </section>

      {showCart && (
        <div className="cartOverlay">
          <section className="phoneFrame cartScreen">
            <button className="backBtn" onClick={() => setShowCart(false)}>← {t('backToMenu')}</button>
            <h1>{t('yourCart')}</h1>
            <div className="cartLines">
              {cart.map((line) => <article className="cartLine" key={line.id}>{line.image_url ? <img className="foodPhoto small image" src={line.image_url} alt={line.name} /> : <span className="foodPhoto small">{line.emoji}</span>}<div><b>{line.name}</b><small>{money(line.price)}</small><input placeholder={t('specialNote')} value={line.note} onChange={(e) => updateNote(line.id, e.target.value)} /></div><div className="qtyControls"><button onClick={() => updateQuantity(line.id, -1)}><Minus size={14} /></button><span>{line.quantity}</span><button className="plus" onClick={() => updateQuantity(line.id, 1)}><Plus size={14} /></button></div></article>)}
            </div>
            <div className="checkoutBox">
              <p><span>{t('subtotal')}</span><b>{money(subtotal)}</b></p><p><span>{t('tax')} ({Math.round(taxRate * 100)}%)</span><b>{money(tax)}</b></p><p className="total"><span>{t('total')}</span><b>{money(total)}</b></p>
              {error && <div className="errorBox">{error}</div>}
              <button className="primaryBtn full" disabled={loadingOrder || cart.length === 0} onClick={placeOrder}>{loadingOrder ? t('sending') : t('confirmOrder')}</button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

export function InvalidQr({ slug = '', initialError = '', generic = false }) {
  const { t } = useSettings();
  const [tableNumber, setTableNumber] = useState('');
  const [message, setMessage] = useState('QR code problem.');
  const [done, setDone] = useState(false);
  const [error, setError] = useState(initialError);
  const [fieldError, setFieldError] = useState('');

  async function sendSupport(event) {
    event.preventDefault();
    setError('');
    setFieldError('');
    if (!tableNumber.trim()) {
      setFieldError(t('tableNumberRequired'));
      return;
    }
    try {
      const result = await api('/api/public/qr-help', { method: 'POST', body: { restaurant_slug: slug, table_number: tableNumber, message } });
      setDone(true);
      if (result.duplicated) setError(t('supportAlreadyOpen'));
    } catch (err) { setError(err.message); }
  }

  return (
    <main className="customerShell centeredCustomer">
      <div className="phoneFrame customerHome invalidQrScreen">
        <div className="customerPrefsFloating"><SettingsControls compact floating /></div>
        <div className="customerLogo"><QrCode /></div>
        <h1>{generic ? t('wrongPageTitle') : t('invalidQrTitle')}</h1>
        <p>{generic ? t('wrongPageText') : t('invalidQrText')}</p>
        {error && <div className={done ? 'noticeBox' : 'errorBox'}>{error}</div>}
        <p className="muted small">{t('qrHelp')}</p>
        <p className="muted small">{t('qrSupportFallback')}</p>
        {done ? <div className="successBox"><Check size={16} /> {t('supportSent')}</div> : (
          <form className="stack" onSubmit={sendSupport} noValidate>
            <label><span>{t('tableNumber')}</span><input placeholder={t('tableNumber')} value={tableNumber} onChange={(e) => setTableNumber(e.target.value)} /><FieldError message={fieldError} /></label>
            <textarea placeholder={t('supportMessage')} value={message} onChange={(e) => setMessage(e.target.value)} />
            <button className="primaryBtn full">{t('sendSupport')}</button>
          </form>
        )}
      </div>
    </main>
  );
}

function FieldError({ message }) {
  return message ? <small className="fieldError">{message}</small> : null;
}
