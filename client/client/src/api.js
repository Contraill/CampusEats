const API_BASE = import.meta.env.VITE_API_URL || '';

const TOKEN_KEY = 'campuseats_token';
const USER_KEY = 'campuseats_user';
const LANG_KEY = 'campuseats_lang';

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || localStorage.getItem('qr_dine_token');
}

export function setSession(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.removeItem('qr_dine_token');
  localStorage.removeItem('qr_dine_user');
}

export function updateStoredUser(user) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem('qr_dine_token');
  localStorage.removeItem('qr_dine_user');
}

export function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem(USER_KEY) || localStorage.getItem('qr_dine_user') || 'null');
  } catch {
    return null;
  }
}

export async function api(path, options = {}) {
  const headers = new Headers(options.headers || {});
  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;
  if (!headers.has('Content-Type') && options.body && !isFormData) headers.set('Content-Type', 'application/json');
  const lang = localStorage.getItem(LANG_KEY) || localStorage.getItem('qr_dine_lang') || 'tr';
  headers.set('Accept-Language', lang);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
    body: options.body && !isFormData && typeof options.body !== 'string' ? JSON.stringify(options.body) : options.body
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const firstFieldError = data?.errors?.[0]?.message;
    const error = new Error(firstFieldError || data?.message || 'Request failed.');
    error.data = data;
    error.status = response.status;
    throw error;
  }
  return data;
}

export function money(value) {
  const lang = localStorage.getItem(LANG_KEY) || localStorage.getItem('qr_dine_lang') || 'tr';
  return new Intl.NumberFormat(lang === 'tr' ? 'tr-TR' : 'en-US', { style: 'currency', currency: 'TRY' }).format(Number(value || 0));
}

export function niceStatus(status) {
  const raw = String(status || '');
  const tr = (localStorage.getItem(LANG_KEY) || localStorage.getItem('qr_dine_lang')) !== 'en';
  const map = tr ? {
    PENDING: 'Bekliyor', PREPARING: 'Hazırlanıyor', READY: 'Hazır', SERVED: 'Servis Edildi',
    PAYMENT_WAITING: 'Ödeme Bekliyor', PAYMENT_REJECTED: 'Ödeme Reddedildi', PAYMENT_APPROVED: 'Ödeme Onaylandı',
    COMPLETED: 'Tamamlandı', CANCELLED: 'İptal Edildi', NOT_REQUESTED: 'İstenmedi', WAITING_APPROVAL: 'Onay Bekliyor',
    APPROVED: 'Onaylandı', REJECTED: 'Reddedildi', OPEN: 'Açık', DONE: 'Tamamlandı', WAITER: 'Garson', QR_HELP: 'QR Destek',
    CASH: 'Nakit', CARD: 'Kart', TRANSFER: 'IBAN / Havale', TEMPLATE: 'Template'
  } : {
    CASH: 'Cash', CARD: 'Card', TRANSFER: 'IBAN Transfer', TEMPLATE: 'Template'
  };
  return map[raw] || raw.replaceAll('_', ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}
