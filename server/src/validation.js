import { ZodError } from 'zod';

export function getLang(req) {
  const raw = String(req.headers['accept-language'] || 'tr').toLowerCase();
  return raw.startsWith('en') ? 'en' : 'tr';
}

const fieldNames = {
  tr: {
    name: 'Ad', email: 'E-posta', password: 'Şifre', restaurant_id: 'Restoran', restaurantId: 'Restoran', restaurant_slug: 'Restoran bağlantısı',
    phone: 'Telefon', address: 'Adres', table_number: 'Masa numarası', table_token: 'Masa QR kodu', capacity: 'Sandalye sayısı',
    price: 'Fiyat', category_id: 'Kategori', itemName: 'Ürün adı', description: 'Açıklama', sort_order: 'Sıralama', emoji: 'Emoji',
    payment_method: 'Ödeme yöntemi', reason: 'Red nedeni', message: 'Mesaj', type: 'İstek türü', items: 'Ürünler', quantity: 'Adet'
  },
  en: {
    name: 'Name', email: 'Email', password: 'Password', restaurant_id: 'Restaurant', restaurantId: 'Restaurant', restaurant_slug: 'Restaurant link',
    phone: 'Phone', address: 'Address', table_number: 'Table number', table_token: 'Table QR code', capacity: 'Seat capacity',
    price: 'Price', category_id: 'Category', itemName: 'Item name', description: 'Description', sort_order: 'Sort order', emoji: 'Emoji',
    payment_method: 'Payment method', reason: 'Reject reason', message: 'Message', type: 'Request type', items: 'Items', quantity: 'Quantity'
  }
};

const messageMap = {
  tr: {
    'Invalid email address.': 'E-posta adresi geçersiz.',
    'Invalid phone number.': 'Telefon numarası geçersiz.',
    'Password must be at least 6 characters.': 'Şifre en az 6 karakter olmalı.',
    'Password must include at least one number.': 'Şifre en az 1 sayı içermeli.',
    'Password must include at least one special character.': 'Şifre en az 1 özel karakter içermeli.',
    'Only image files are allowed.': 'Sadece resim dosyası yüklenebilir.',
    'Image is too large. Maximum 5 MB.': 'Resim çok büyük. En fazla 5 MB olabilir.',
    'Uploaded file is not a valid image.': 'Yüklenen dosya geçerli bir resim değil.',
    'Payment waiting can only be started by the customer after payment.': 'Ödeme bekleme durumu sadece müşteri ödeme isteği oluşturduktan sonra başlatılabilir.',
    'An order can be completed only after payment approval.': 'Sipariş sadece ödeme onaylandıktan sonra tamamlanabilir.',
    'Payment must be requested by the customer before approval.': 'Ödeme onayından önce müşteri ödeme isteği oluşturmalı.',
    'This order does not have a waiting payment request.': 'Bu sipariş için onay bekleyen ödeme isteği yok.',
    'This order is already closed.': 'Bu sipariş zaten kapalı.',
    'Payment process has started for this table. Orders cannot be cancelled now.': 'Bu masa için ödeme süreci başladı. Artık sipariş iptal edilemez.',
    'Prepared orders cannot be cancelled by the customer.': 'Hazır olan sipariş müşteri tarafından iptal edilemez.',
    'Order cancelled.': 'Sipariş iptal edildi.',
    'A category with this name already exists.': 'Bu isimde bir kategori zaten var.',
    'A category with this sort order already exists.': 'Bu sıralama numarasına sahip bir kategori zaten var.'
  },
  en: {
    'Invalid email address.': 'Invalid email address.',
    'Invalid phone number.': 'Invalid phone number.',
    'Password must be at least 6 characters.': 'Password must be at least 6 characters.',
    'Password must include at least one number.': 'Password must include at least one number.',
    'Password must include at least one special character.': 'Password must include at least one special character.',
    'Only image files are allowed.': 'Only image files are allowed.',
    'Image is too large. Maximum 5 MB.': 'Image is too large. Maximum 5 MB.',
    'Uploaded file is not a valid image.': 'Uploaded file is not a valid image.',
    'Payment waiting can only be started by the customer after payment.': 'Payment waiting can only be started by the customer after payment.',
    'An order can be completed only after payment approval.': 'An order can be completed only after payment approval.',
    'Payment must be requested by the customer before approval.': 'Payment must be requested by the customer before approval.',
    'This order does not have a waiting payment request.': 'This order does not have a waiting payment request.',
    'This order is already closed.': 'This order is already closed.',
    'Payment process has started for this table. Orders cannot be cancelled now.': 'Payment process has started for this table. Orders cannot be cancelled now.',
    'Prepared orders cannot be cancelled by the customer.': 'Prepared orders cannot be cancelled by the customer.',
    'Order cancelled.': 'Order cancelled.',
    'A category with this name already exists.': 'A category with this name already exists.',
    'A category with this sort order already exists.': 'A category with this sort order already exists.'
  }
};

function label(path, lang) {
  const parts = Array.isArray(path) ? path : String(path || '').split('.');
  const key = String(parts.find((part) => Number.isNaN(Number(part))) || parts[0] || '');
  return fieldNames[lang][key] || key || (lang === 'tr' ? 'Alan' : 'Field');
}

export function translateMessage(message, reqOrLang = 'tr') {
  const lang = typeof reqOrLang === 'string' ? reqOrLang : getLang(reqOrLang);
  return messageMap[lang][message] || message;
}

function translateIssue(issue, lang) {
  const field = label(issue.path, lang);
  const mapped = messageMap[lang][issue.message];
  if (mapped) return mapped;

  if (issue.code === 'invalid_type' || issue.code === 'invalid_date') {
    return lang === 'tr' ? `${field} zorunlu.` : `${field} is required.`;
  }
  if (issue.code === 'invalid_string' && issue.validation === 'email') {
    return lang === 'tr' ? 'E-posta adresi geçersiz.' : 'Invalid email address.';
  }
  if (issue.code === 'too_small') {
    if (issue.type === 'string') return lang === 'tr' ? `${field} en az ${issue.minimum} karakter olmalı.` : `${field} must be at least ${issue.minimum} characters.`;
    if (issue.type === 'array') return lang === 'tr' ? `${field} için en az ${issue.minimum} seçim gerekli.` : `${field} needs at least ${issue.minimum} item(s).`;
    return lang === 'tr' ? `${field} değeri en az ${issue.minimum} olmalı.` : `${field} must be at least ${issue.minimum}.`;
  }
  if (issue.code === 'too_big') {
    if (issue.type === 'string') return lang === 'tr' ? `${field} en fazla ${issue.maximum} karakter olabilir.` : `${field} must be at most ${issue.maximum} characters.`;
    return lang === 'tr' ? `${field} değeri en fazla ${issue.maximum} olabilir.` : `${field} must be at most ${issue.maximum}.`;
  }
  if (issue.code === 'invalid_enum_value') return lang === 'tr' ? `${field} değeri geçersiz.` : `${field} value is invalid.`;
  return issue.message || (lang === 'tr' ? `${field} geçersiz.` : `${field} is invalid.`);
}

export function formatZodError(error, req) {
  const lang = getLang(req);
  const errors = error.errors.map((issue) => ({
    path: issue.path.join('.'),
    message: translateIssue(issue, lang),
    code: issue.code
  }));
  return {
    message: lang === 'tr' ? 'Lütfen hatalı alanları düzelt.' : 'Please fix the highlighted fields.',
    errors
  };
}

export function localizedError(req, message, statusCode = 400) {
  const error = new Error(translateMessage(message, req));
  error.statusCode = statusCode;
  return error;
}

export function validate(schema, source = 'body') {
  return (req, res, next) => {
    try {
      req[source] = schema.parse(req[source]);
      return next();
    } catch (error) {
      if (error instanceof ZodError) return res.status(400).json(formatZodError(error, req));
      return next(error);
    }
  };
}
