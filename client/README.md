# CampusEats

Firebase kullanmadan, tamamen lokal çalışan Smart QR-Based Restaurant Ordering System. Zip içeriği tek klasöre çıkarıldıktan sonra komutlar proje kök dizininden çalıştırılmalıdır; `server/package.json` ve `client/package.json` doğrudan kök klasörün altında bulunmalıdır.

## İçerik

- React customer UI + admin panel + restaurant manager panel
- Node.js / Express REST API
- SQLite lokal veritabanı (`better-sqlite3` `^12.10.0`)
- Socket.IO ile canlı sipariş ve destek isteği güncellemesi
- Sabit masa QR kodu üretimi
- Ödeme onay template akışı
- PWA kurulabilir web app desteği
- Türkçe / İngilizce dil seçimi, modern segmented butonlarla
- Aydınlık / karanlık tema, localStorage ile kalıcı
- Menü ürün resmi yükleme ve otomatik WebP resize
- Garson çağırma ve geçersiz QR destek bildirimi
- Müşteri tarafından hazırlık başlamadan önce tekil sipariş iptali

## Kurulum

```bash
npm run install:all
npm run dev
```

Açılacak adresler:

- Frontend: http://localhost:5173
- Backend API: http://localhost:4000

## Demo kullanıcıları

**System Admin**

```text
Email: admin@local.test
Password: admin123!
```

**Restaurant Manager**

```text
Email: manager@local.test
Password: manager123!
```

> Şifre politikası: minimum 6 karakter, en az 1 sayı ve en az 1 özel karakter.

## Demo akışı

1. `manager@local.test` ile giriş yap.
2. Manager panelinde **Tables & QR** sekmesine gir.
3. Masa QR linkini kopyala veya QR kodu indir.
4. QR linki `/r/campus-eats/table/<token>` formatında customer ekranını açar.
5. Müşteri ürünleri sepete ekleyip siparişi oluşturur.
6. Sipariş manager panelindeki Orders ekranına canlı düşer.
7. Müşteri **Add more items / Yeni ürün ekle** dediğinde mevcut sipariş bozulmaz; aynı masa için ikinci, üçüncü, dördüncü sipariş ayrı kart olarak açılır.
8. Müşteri masadaki aktif siparişlerden istediğini yalnızca PENDING/Bekliyor aşamasındayken tek tek iptal edebilir. İptal edilen sipariş ödeme hesabına dahil edilmez.
9. Müşteri **Call Waiter / Garson Çağır** ile destek bildirimi gönderebilir.
10. Masadaki iptal edilmemiş tüm aktif siparişler servis edildikten sonra müşteri ödeme isteği oluşturabilir; ödeme template üzerinden onaylanınca aktif masa oturumu temizlenir.
11. Aynı QR kod yeni müşteri için tekrar kullanılabilir.

## Admin notları

- Admin restoran oluşturabilir, düzenleyebilir ve silebilir.
- Restoran silindiğinde o restorana bağlı manager hesapları da silinir.
- Admin manager e-postasını, şifresini ve bağlı restoranını değiştirebilir.
- Add Restaurant Manager formunda demo/default şifre otomatik verilmez.
- Restoran adı/telefonu ve manager e-posta/şifre alanları backend ve frontend tarafında doğrulanır.
- Hatalı alanlar sayfa diline göre alan bazlı gösterilir; browser validation yerine site içi validation kullanılır.

## Menü resmi

Manager panelinde menü ürünü eklerken veya mevcut ürünün resmini değiştirirken sistem görseli:

- En fazla 900×900 içine sığacak şekilde resize eder.
- Oranı bozmaz.
- Gereksiz büyütme yapmaz.
- WebP formatında kalite 88 ile lokal olarak `server/public/uploads/menu` altına kaydeder.

## v4 düzeltmeleri

- Proje adı CampusEats olarak güncellendi; manifest, title, cache ve demo slug düzeltildi.
- Customer toplamı ile backend toplamı eşitlendi; backend artık %10 vergi dahil toplamı kaydeder.
- Vite dev proxy `/uploads` için düzeltildi; yüklenen ürün resimleri dev modda da görünür.
- Geçersiz QR ve hatalı link akışı panel login yerine QR destek sayfasına gider.
- Payment approve/table clear akışı güvenli hale getirildi; eski sipariş yeni masayı temizleyemez.
- Ek siparişler artık mevcut siparişe eklenmez; her yeni sepet aynı masa için ayrı sipariş kartı oluşturur.
- Manager, toplu sipariş işlemlerini artık restoran geneline değil, masa bazında uygular. Aynı masadan gelen 2., 3., 4. siparişler birlikte Preparing/Ready/Served yapılabilir ve aynı masanın bekleyen ödemeleri birlikte onaylanabilir.
- Sipariş PREPARING/Hazırlanıyor aşamasına geçince ve ödeme süreci başladığında tekil sipariş iptali engellenir; ödeme tamamlandıktan sonra Ana sayfaya dön butonu aynı QR linkine döner ve masa temizse yeni müşteri gibi menüyü açar.
- Müşteri tarafında tekil sipariş iptali vardır; iptal butonu yalnızca PENDING/Bekliyor aşamasında görünür, PREPARING/Hazırlanıyor ve sonrasında tamamen kaldırılır. İptal edilen sipariş aktif masa hesabından çıkarılır, kalan siparişler varsa ödeme akışı bu siparişler üzerinden devam eder.
- Manager menü, kategori ve masa CRUD işlemleri genişletildi.
- Karanlık tema kapsamı genişletildi; panel, tablo, customer ekranı, sepet ve ödeme ekranlarında hard-coded açık renkler azaltıldı.
- Tema ve dil butonları select yerine modern segmented kontrol haline getirildi.
- Tema ve dil tercihi `localStorage` içinde kalıcıdır; browser kapansa veya yeni QR link açılsa tercih korunur.
- Customer tarafında tema/dil kontrolü içerik akışından ayrılıp üst sağdaki küçük floating kontrol haline getirildi.
- Admin validation hataları artık sadece “Validation failed.” demiyor; hangi alanın hatalı olduğunu gösteriyor.
- Admin formlarında `noValidate` kullanıldığı için hatalı e-postayı browser değil uygulama yakalıyor.
- Restoran bilgileri admin panelinden düzenlenebilir.


## v4.6 yönetim güncellemeleri

- Manager panelindeki sekme sırası jüri demosu için yeniden düzenlendi: **Kontrol Paneli → Siparişler → Geçmiş siparişler → Masalar & QR → Menü → Destek**.
- Türkçe arayüzde `Dashboard` etiketi **Kontrol Paneli** olarak görünür.
- Yönetim kontrol panelinde **son 7 gün** ve **son 30 gün** istatistik kartları bulunur:
  - dönem geliri,
  - dönem sipariş sayısı,
  - tamamlanan sipariş sayısı,
  - iptal edilen sipariş sayısı,
  - onaylı ödemelere göre ortalama sepet.
- Dashboard’da ayrıca **haftanın en çok tercih edilenleri** ve **ayın en çok tercih edilenleri** listelenir.
- Siparişler sekmesi artık varsayılan olarak **yalnızca bugünün siparişlerini** gösterir ve siparişleri masa bazında gruplar.
- Toplu sipariş işlemleri restoran geneline uygulanmaz; yalnızca aynı masadaki aktif siparişlere uygulanır. Örneğin masa 1 çay ve Türk kahvesini ayrı siparişlerde verdiyse garson bu iki siparişi masa 1 grubundan aynı anda `Servis edildi` yapabilir.
- Bugünden önceki siparişler için **Geçmiş siparişler** ayrı bir sekmedir; siparişler güne göre gruplanır.
- Kontrol panelindeki **Sipariş geçmişini temizle** butonu ayrı bir temizlik alanına taşındı.
- Sipariş geçmişi temizleme işlemi ilk tıklamada ve ikinci onay penceresinde tekrar onay ister.
- Geçmiş temizleme artık bugün dahil tüm `COMPLETED` ve `CANCELLED` kapalı siparişleri silebilir; aktif, ödeme bekleyen veya servis sürecindeki siparişlere dokunmaz.
- Yeni masa ekleme formunda sandalye sayısı artık varsayılan sayı ile dolu gelmez; kullanıcı kapasiteyi kendisi girer.
- Ödeme süreci başlamış bir sipariş manager tarafından iptal edilemez. Böylece aynı siparişin hem tamamlanmış hem iptal edilmiş gibi görünmesi engellenir.
- Menü yönetiminde kategori ekleme/düzenleme sırasında aynı restoran içinde aynı kategori adı tekrar kullanılamaz.
- Menü yönetiminde kategori ekleme/düzenleme sırasında aynı restoran içinde aynı sıralama numarası tekrar kullanılamaz.
- Kategori adı ve sıralama tekrar kontrolleri hem frontend formunda hem backend API tarafında yapılır; hata mesajı sayfa diline göre alan bazlı gösterilir.


## v4.8 manager panel UI düzeltmeleri

- Manager panelindeki `Yenile` butonu sekme grubundan ayrıldı ve sağ üstte ayrı, orantılı bir aksiyon butonu olarak konumlandırıldı.
- Sekme butonları artık yalnızca sayfa geçişleri için kullanılır; yazıların butondan taşmaması için genişlik, satır kırılımı ve grid davranışı yeniden düzenlendi.
- Dar ekranlarda manager sekmeleri iki kolon düzenine geçer, yenile butonu ise tek başına alta/sağa hizalanarak taşma görüntüsü oluşturmaz.
- Karanlık temada yeni yenile butonu da diğer panel butonlarıyla uyumlu şekilde renklendirildi.


## v5.0 ödeme ve sipariş akışı düzeltmeleri

- Sipariş numarası artık database `id` değerine göre değil, restorandaki mevcut sipariş numaralarının en büyüğüne göre oluşturulur. Tüm siparişler silindiğinde yeni sipariş tekrar `#00001` ile başlar.
- Customer ödeme yöntemi `Card / Kredi kartı` veya `IBAN / Havale` seçilirse ödeme otomatik onaylanır; manager panelinden ayrıca onay gerekmez.
- Customer `Cash / Nakit` seçerse ödeme manager/kasa onayı bekler.
- Manager, masadaki tüm aktif siparişler `Servis edildi / Served` olduktan sonra müşteri telefonu tekrar açmasa bile masa bazlı **Ödemeyi Onayla** butonuyla kasadan ödeme onaylayabilir.
- Ödeme onayı sipariş kartı bazında tek tek değil, masa bazında tek seferde yapılır. `Tüm bekleyen ödemeleri onayla` ifadesi kaldırıldı; buton artık yalnızca **Ödemeyi Onayla** olarak görünür.
- Ödemesi onaylanan siparişler aktif **Siparişler** sekmesinden çıkar ve doğrudan **Geçmiş siparişler** sekmesine düşer.
- Sipariş kartlarında tarih ve saat bilgisi görünür.
- Manager sipariş kartlarında ürün notları görünür.
- Müşteri tarafında iptal butonu yalnızca sipariş `PENDING / Bekliyor` durumundayken görünür. `PREPARING / Hazırlanıyor` aşamasından itibaren buton tamamen kaldırılır.
- Dashboard üzerinde son iptal edilen siparişler ayrı listelenir; iptal edilen siparişler tek tek silinebilir.
- Ödeme tamamlanınca masa aktif oturumu kapanır. Aynı QR linkinden dönüldüğünde sistem yeni müşteri gibi menüyü açar; eski müşteri siparişleri yeni müşterinin toplu masa işlemlerine karışmaz.
- Customer sipariş takip ekranındaki başlık artık durum değiştikçe değişir: bekliyor, hazırlanıyor, hazır, servis edildi, ödeme bekliyor, tamamlandı veya iptal edildi gibi ayrı başlıklar gösterilir.

## Production gibi lokal çalıştırma

```bash
npm run build
npm start
```

Bu komut, React build dosyalarını Express üzerinden servis eder.

## Notlar

- Sistem lokal SQLite dosyasını `server/data/campuseats.sqlite` altında oluşturur.
- Firebase kullanılmaz.
- QR kodlar sabittir; ödeme onaylanınca QR değil masanın aktif sipariş/session durumu temizlenir.

## GitHub için .gitignore notu

Bu sürümde `.gitignore` dosyası local/demo sırasında oluşan dosyaları repoya yanlışlıkla göndermemek için güncellendi:

- `node_modules/`
- `.env` ve `.env.*`
- `server/data/` içindeki local SQLite database
- `server/public/uploads/` içindeki çalışma zamanı görselleri
- `client/dist/` build çıktısı
- log/cache/editor dosyaları
- lokal export/backup arşivleri (`*.zip`, `*.rar`, `*.7z`, `*.tar.gz`)

`server/public/uploads/menu/.gitkeep` dosyası korunur; böylece upload klasörü repoda boş da olsa varlığını sürdürür.


## v4.9 UI Adjustment

- The manager refresh action was moved out of the tab row and into the main panel header, aligned with the **Manager Panel / Yönetici Paneli** title area.
- Manager tabs now contain only navigation items, preventing tab labels from overflowing or visually competing with the refresh button.

## v5.1 Customer status screen and app icon fixes

- The `Ana sayfaya dön / Back to home` button was removed from active customer order status stages where it does not make sense:
  - `Sipariş onaylandı / Order confirmed`
  - `Hazırlanıyor / Preparing`
  - `Hazırlandı / Ready`
  - `Teslim edildi / Served`
  - payment waiting/rejected active states
- The return button is kept only for closed states such as completed or cancelled orders, where returning to the same fixed QR link can start a fresh table session when the table is already cleared.
- The browser tab favicon was redesigned to look like a real QR-code style CampusEats icon instead of the previous rectangle/plus-like symbol.
- PWA icons were updated as PNG assets:
  - `/icons/icon-192.png`
  - `/icons/icon-512.png`
- `manifest.json` now uses the PNG icons for installable PWA behavior, while the SVG icon remains available as a scalable browser favicon.
- `apple-touch-icon` was added for better iOS home screen appearance.

## v5.2 Icon correction

- The browser tab favicon was replaced with the exact Lucide-style QR Code icon shape used in the application UI.
- The PWA icons were regenerated from the same QR Code shape so the installed app icon no longer appears as a rectangle/plus-like symbol.
- Updated icon files:
  - `client/public/icons/icon.svg`
  - `client/public/icons/icon-192.png`
  - `client/public/icons/icon-512.png`
  - `client/dist/icons/icon.svg`
  - `client/dist/icons/icon-192.png`
  - `client/dist/icons/icon-512.png`

### v5.3 Icon Update

- Browser tab favicon and PWA icons were updated to the final CampusEats QR icon style: a blue rounded-square background with the white Lucide QR Code symbol inside.
- Service worker cache name was bumped so browsers can refresh the new icon assets instead of keeping the old cached icons.
