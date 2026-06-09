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
- Müşteri tarafından sipariş hazır olmadan önce tekil sipariş iptali

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
8. Müşteri masadaki aktif siparişlerden istediğini sipariş READY/Hazır aşamasına geçmeden önce tek tek iptal edebilir. İptal edilen sipariş ödeme hesabına dahil edilmez.
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
- Sipariş READY/Hazır aşamasına geçince ve ödeme süreci başladığında tekil sipariş iptali engellenir; ödeme tamamlandıktan sonra Ana sayfaya dön butonu aynı QR linkine döner ve masa temizse yeni müşteri gibi menüyü açar.
- Müşteri tarafında tekil sipariş iptali vardır; iptal butonu yalnızca PENDING/Bekliyor ve PREPARING/Hazırlanıyor aşamalarında görünür, READY/Hazır ve sonrasında kapanır. İptal edilen sipariş aktif masa hesabından çıkarılır, kalan siparişler varsa ödeme akışı bu siparişler üzerinden devam eder.
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
