# Sunucu sağlamlığı, medya ve yedekleme

## 1. Fotoğrafları küçültüp şifreleyerek veritabanında saklamak sorun mu?

Üç ayrı soru var:

**Küçültmek: kesinlikle evet.** Şu an fotoğraf 4 MB'a, video 30 MB'a kadar olduğu gibi saklanıyor. Önerilen:
- Mobilde yüklemeden önce en uzun kenar 1600 px, JPEG kalite 0,8 (`react-native-image-picker`'ın `maxWidth/maxHeight/quality` ayarları). Tipik fotoğraf 4 MB → 200–400 KB; yükleme de hızlanır.
- Sunucuda iki boy üretilir: **küçük** (400 px, liste ve avatar için, ~30 KB) ve **orta** (1600 px). Akış küçük olanı çeker; veri ve RAM kullanımı ~10 kat düşer.
- Avatar zaten 512 px'e indirilebilir.

**Şifrelemek: uygulama içinde gerek yok.** Fotoğraflar zaten uygulamada başkalarına gösterilen içerik; asıl koruma **erişim kontrolüdür** (kimin görebileceği, bkz. [gizlilik.md](gizlilik.md)). Uygulama düzeyinde şifreleme anahtar yönetimi, her istekte şifre çözme maliyeti ve önbelleğe alınamama getirir, ama kazancı yok. Bunun yerine:
- Sunucu diski şifreli (sağlayıcının disk şifrelemesi veya LUKS).
- Yedekler **mutlaka** şifreli (madde 2).
- Nesne depolamaya geçilince dosyalar özel (private) kovada, kısa süreli imzalı bağlantılarla verilir.

**Veritabanında saklamak: küçük fotoğraflar için kabul edilebilir, videolar için değil.** Sorun veritabanının kendisi değil, şunlar:
- Her medya isteği tüm dosyayı RAM'e alıp veritabanı bağlantısını meşgul ediyor (havuz 10 bağlantı; 10 yavaş video indirmesi API'yi kilitler).
- Yedek boyutu medyayla birlikte büyür; 50 GB'lık bir yedeği almak ve geri yüklemek saatler sürer.
- CDN ile önbelleğe alınamaz, her izleme sunucuya yük olur.
- Şu an kota yok: tek hesap 5 saniyede bir 30 MB gönderiyle günde ~500 GB yazabilir.

**Öneri (iki aşama):**
- **Aşama 1 (canlıdan önce, P0):** Fotoğraflar küçültülmüş haliyle veritabanında kalır. Kotalar eklenir (madde 4). Videolar ya kapatılır ya da 15 saniye / 720p / 10 MB sınırına çekilir.
- **Aşama 2 (kullanıcı sayısı artınca, P1):** Tüm medya S3 uyumlu nesne depolamaya taşınır. Öneri: **Cloudflare R2** (dışarı veri çıkış ücreti yok, CDN hazır) veya **Hetzner Object Storage** (sunucu Hetzner'deyse). Kodda `platform/media` arkasında `Store` arayüzü (`Put/Get/Delete/SignedURL`) olur; önce `PostgresStore`, sonra `S3Store`; taşıma bir komutla arka planda yapılır. Senden: depolama hesabı.

## 2. Yedekleme nasıl yapılmalı (P0)

Şu an **hiç otomatik yedek yok**; yalnızca güncellemeden önce elle alınan `pg_dump` var ve o da aynı sunucuda duruyor. Sunucu diski bozulursa her şey gider.

Kural: **3-2-1**. Verinin 3 kopyası, 2 farklı ortamda, 1'i sunucu dışında.

**Aşama 1 (hemen, ~yarım gün):**
- Sunucuda `deploy/backup.sh` + systemd timer (veya cron), her gece 03:30:
  1. `pg_dump -Fc` (sıkıştırılmış, tek tabloyu geri yüklemeye uygun biçim)
  2. **age** ile şifreleme. Yalnızca açık anahtar sunucuda durur; özel anahtar sende (1Password'de). Sunucu ele geçirilse bile yedekler okunamaz.
  3. Sunucu dışına yükleme (`rclone` ile R2, Backblaze B2 veya Hetzner Storage Box; aylık maliyet birkaç dolar).
  4. Saklama: 7 günlük, 4 haftalık, 6 aylık. Kova tarafında silme koruması açık (object lock), böylece sunucuya giren biri yedekleri silemez.
  5. Başarı veya hata, izleme sistemine bildirilir (bkz. [loglama.md](loglama.md)). Bir gece yedek alınamazsa alarm.
- Sunucuda da son 2 günün yedeği durur (hızlı geri yükleme için).

**Aşama 2 (P1):** WAL arşivleme (**pgBackRest** veya **WAL-G**) ile anlık geri yükleme (point-in-time recovery). Örneğin "dün 14:32'de yanlışlıkla silinen veriye dön" yapılabilir; veri kaybı en fazla birkaç dakika olur.

**Geri yükleme provası (P0, ayda bir):** Yedeği hiç denenmemiş yedek, yedek sayılmaz. `deploy/restore-test.sh` en son yedeği geçici bir Postgres konteynerine açar, tablo sayılarını kontrol eder ve sonucu raporlar. Otomatik, ayda bir.

**Hedefler:** veri kaybı en fazla 24 saat (Aşama 2'de 5 dakika), geri dönüş süresi en fazla 1 saat.

## 3. Uygulama sağlamlığı (P0/P1)

| # | Sorun | Öneri | Öncelik |
|---|---|---|---|
| 3.1 | Arka plan işlerinde (push, iade senkronu) çökme yakalanmıyor; bir hata tüm API'yi kapatır. HTTP isteklerinde yalnızca 3 handler çökmeyi yakalıyor. | Tek bir global `Recover` ara katmanı + arka plan işleri için `safeGo` sarmalayıcısı. Yakalanan hata stack trace ile loglanır ve alarm üretir. | P0 |
| 3.2 | Veritabanı sorgularının süre sınırı yok; takılan bir sorgu bağlantıyı sonsuza kadar tutar. | Bağlantıda `statement_timeout=5s` (medya ve rapor sorgularında yerel olarak daha uzun), `idle_in_transaction_session_timeout=10s`; her isteğe 10 saniyelik context süresi. | P0 |
| 3.3 | Havuz sabit 10 bağlantı. | `DB_MAX_CONNS` ile ayarlanabilir; varsayılan 20. Havuz doluluğu metriği (bkz. loglama). | P1 |
| 3.4 | Eş zamanlı birkaç yükleme RAM'i bitirebilir (her yükleme 30 MB tampon + 16 MP resim çözme ~64 MB). | Yükleme ve resim işleme için semafor (aynı anda en fazla 4); dolu ise 503 + "biraz sonra dene". | P0 |
| 3.5 | `/health` veritabanına bakmıyor. | `/health` (süreç ayakta mı) ve `/ready` (DB ping, migration güncel mi). Docker healthcheck `/ready`'yi kullanır. | P0 |
| 3.6 | Push bildirimi gönderilmeden "gönderildi" işaretleniyor; başarısızlar kayboluyor, gönderim tek tek. | Teslimden sonra işaretle; 3 deneme, üstel bekleme; FCM'in "geçersiz token" yanıtında cihaz kaydı silinir; 8 işçili havuz. | P1 |
| 3.7 | Rate limiter bellekte ve her çağrıda tüm haritayı tarıyor. | Dakikada bir temizleyen arka plan süpürücüsü; HTTPS ile birlikte güvenilir vekil başlığı. Tek sunucu için bellekte tutmak yeterli, Redis gerekmez. | P1 |
| 3.8 | Güvenlik başlıkları eksik. | Ortak ara katman: `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, HTTPS ile HSTS. | P1 |
| 3.9 | Akış OFFSET 1.000.000'a kadar izin veriyor. | İmleç tabanlı sayfalama (son gönderinin zamanı + ID). | P2 |

## 4. Kotalar ve kötüye kullanım (P0)

| Kaynak | Sınır (öneri) |
|---|---|
| Gönderi | Saatte 20, günde 50 |
| Medya yükleme | Günde 200 MB / kullanıcı |
| Yanıt | Dakikada 10 |
| Beğeni / takip | Dakikada 60 / 30 |
| Tanışma isteği | Günde 30 (zaten sınırlı değilse) |
| Profil fotoğrafı | Saatte 10 |

Sınır aşılınca 429 + Türkçe açıklama; mobil bunu uyarı olarak gösterir. Sınır aşımları loglanır, tekrar edenler yönetici paneline "şüpheli hesap" olarak düşer.

## 5. Sunucu ve Docker (P0/P1)

| # | Öneri | Öncelik |
|---|---|---|
| 5.1 | **Güvenlik duvarı:** `ufw` ile yalnızca 22 (SSH) ve 80/443 açık. 8092 kapatılır (HTTPS'e kadar 80 yeterli). Not: Docker `ufw`'yu atlayabilir; portlar compose'da `127.0.0.1:` ile bağlanıp yalnızca Caddy dışarı açılacak (HTTPS adımında). | P0 |
| 5.2 | **SSH:** şifreyle giriş kapalı, yalnızca anahtar; root girişi kapatılıp `deploy` kullanıcısı + `sudo`; `fail2ban`. | P0 |
| 5.3 | **Otomatik güvenlik güncellemeleri:** `unattended-upgrades`. | P1 |
| 5.4 | **İmaj sürümleri sabit:** `postgres:16.4` gibi tam sürüm; geliştirme ve canlı aynı Postgres ana sürümü (şu an dev 18, canlı 16). | P1 |
| 5.5 | **Konteyner sınırları:** API için bellek 1 GB, Postgres için 2 GB (sunucu RAM'ine göre); Docker log sürücüsünde `max-size: 20m, max-file: 5` (yoksa log dosyası diski doldurur). | P0 |
| 5.6 | **Demo verisi ve `seed` komutu** canlı imajdan çıkarılır; ayrı bir demo ortamı istenirse ayrı compose projesi. | P1 |
| 5.7 | **Postgres ayarı:** `shared_buffers` RAM'in %25'i, `pg_stat_statements` açık (yavaş sorgular için). | P1 |
| 5.8 | **CI (GitHub Actions):** her push'ta Go testleri (Postgres servisiyle), mobil tsc/eslint/jest, admin build; main'e yalnızca yeşil testle birleştirme. | P0 |
| 5.9 | **Tekrarlanabilir dağıtım:** imaj CI'da derlenip etiketlenir (commit SHA), sunucu o etiketi çeker; geri dönüş tek komut (`IMAGE_TAG=önceki docker compose up -d`). | P1 |
| 5.10 | **Kesintisiz güncelleme:** migration'lar geriye uyumlu yazılır (önce sütun ekle, sonra kullan, sonra eski sütunu sil). Tek sunucuda birkaç saniyelik kesinti kabul edilebilir; mobil yeniden dener. | P2 |

## 6. Kapasite

Tek sunucu + Postgres, ilk birkaç on bin kullanıcı için yeterli. Sınırı medya belirler (Aşama 2 bu yüzden önemli). Sonraki adımlar sırasıyla: medya nesne depolamaya, Postgres yönetilen servise veya ayrı sunucuya, API'nin birden fazla kopyası (rate limiter o zaman Postgres/Redis'e taşınır).

## Senden gerekenler

- Sunucu sağlayıcısı ve RAM/disk bilgisi (sınırları buna göre ayarlarım).
- Yedek deposu için bir hesap (R2, B2 veya Storage Box).
- Videolar konusunda karar: canlıda kapalı mı, kısa videoya mı sınırlı?
