# Loglama, izleme ve alarm

Amaç: canlıda bir sorun olduğunda **kullanıcı bize söylemeden önce** haberdar olmak, sorunun hangi istekte, hangi kullanıcıda, hangi sürümde ve kodun neresinde olduğunu dakikalar içinde bulmak, ve bunu kişisel veri sızdırmadan yapmak.

## 1. Bugünkü durum

- Backend'de toplam ~45 `slog` çağrısı var, varsayılan **metin** biçiminde (aranamaz, filtrelenemez).
- **İstek kimliği (request ID) yok:** bir hata logunu, onu üreten istekle veya kullanıcının şikayetiyle eşleştirmenin yolu yok.
- **Erişim logu yok:** hangi uç noktanın ne kadar sürede, hangi durum koduyla yanıt verdiği bilinmiyor.
- Çökmeler yalnızca 3 handler'da yakalanıyor ve `"request panic"` yazılıyor; **hangi satırda olduğu (stack trace) yazılmıyor.**
- Hatalar çoğu yerde `"X operation failed"` + hata metni olarak yazılıyor; kullanıcı, rota, süre bilgisi yok.
- Arka plan işleri (push, iade senkronu) başarılarını hiç, hatalarını kısmen yazıyor.
- **Mobil ve yönetici panelinde hiçbir hata raporlaması yok.** Kullanıcının telefonunda uygulama çökerse bunu hiç öğrenmiyoruz.
- Metrik, panel, alarm ve kesinti takibi yok. Loglar yalnızca `docker logs` ile, sunucuya SSH yapılarak okunabiliyor ve döndürülmediği için diski doldurabilir.

## 2. Genel mimari

Dört ayrı sinyal, dört ayrı iş:

| Sinyal | Soru | Araç |
|---|---|---|
| **Loglar** | Ne oldu, tam olarak hangi istekte? | Backend JSON log → toplayıcı → **Grafana Loki** |
| **Metrikler** | Sistem şu an sağlıklı mı, eğilim ne? | Backend `/metrics` (Prometheus biçimi) → **Grafana** |
| **Hatalar** | Hangi hata, kaç kullanıcıyı, hangi sürümden beri etkiliyor? | **Sentry** (backend + mobil + yönetici paneli) |
| **Kesinti takibi** | Dışarıdan bakınca uygulama ayakta mı? | **Dış uptime servisi** (UptimeRobot / Better Stack) |

```
 Mobil (RN) ──── çökme/hata ────────────────────────┐
 Yönetici paneli ── JS hatası ──────────────────────┤
                                                     ▼
 API (Go) ─┬─ stdout JSON log ─► Docker ─► Alloy ─► Loki ─┐        Sentry ──► e-posta/Telegram
           ├─ /metrics ─────────────────► Alloy ─► Prometheus ─► Grafana ──► alarm ──► Telegram
           ├─ panik/5xx ───────────────────────────────────► Sentry
           └─ denetim olayları ─► PostgreSQL (audit_log) ─► Yönetici paneli
 Uptime servisi ─► https://api/ready (dakikada bir) ──────────────────► Telegram/SMS
 Yedek işi ─► başarı sinyali (heartbeat) ─► Uptime servisi ──────────► gelmezse alarm
```

### Barındırma seçeneği (karar senden)

| Seçenek | Artı | Eksi |
|---|---|---|
| **A. Grafana Cloud ücretsiz katman + Sentry ücretsiz katman** (öneri) | Kurulum ~1 saat, sunucuya yük yok, sunucu çökse bile loglar dışarıda durur. Ücretsiz katman: 50 GB log, 10 bin metrik serisi, 14 gün saklama; Sentry 5 bin hata/ay. | Loglar yurt dışında (AB bölgesi seçilir). KVKK yurt dışı aktarım nedeniyle **gizlilik metninde belirtilmeli**; loglara kişisel veri konmadığı için risk düşük. |
| **B. Aynı sunucuda kendi Loki + Prometheus + Grafana** | Veri yurt içinde ve bizde, ücret yok. | ~1,5 GB ek RAM, bakım bizde, sunucu çökünce loglar da erişilemez. |
| **C. Hibrit** | Sentry bulutta (en çok değer onda), loglar ve metrikler kendi sunucumuzda. | B'nin bakım yükü. |

Kod tarafı üç seçenekte de **aynı**: uygulama stdout'a JSON yazar ve `/metrics` açar, nereye gönderileceğine toplayıcı (Grafana Alloy) karar verir. Yani bu karar sonradan değiştirilebilir.

## 3. Log biçimi (standart)

Her log satırı tek satırlık JSON'dur. Örnek bir istek sonu satırı:

```json
{
  "time": "2026-10-20T14:32:07.412+03:00",
  "level": "INFO",
  "msg": "http.request",
  "service": "api",
  "env": "production",
  "version": "1.4.0+4491027",
  "request_id": "01JAC3W8R5T7Q2K9X4M6N1B0ZD",
  "method": "POST",
  "route": "POST /v1/social/posts",
  "status": 201,
  "duration_ms": 184,
  "bytes_in": 412339,
  "bytes_out": 512,
  "user_id": "8c2f…",
  "account_type": "player",
  "delegated_by": null,
  "client": "ios",
  "app_version": "1.4.0 (52)",
  "ip": "85.105.12.0"
}
```

### Alanlar

| Alan | Her satırda | Açıklama |
|---|---|---|
| `time`, `level`, `msg` | ✓ | `msg` serbest cümle değil, **olay adıdır** (madde 4). |
| `service`, `env`, `version` | ✓ | `version` = uygulama sürümü + commit SHA (derlemede `-ldflags` ile gömülür). Hatanın hangi dağıtımla başladığını gösterir. |
| `request_id` | istek içinde | Her isteğe ULID. Mobil gönderirse (`X-Request-ID`) o kullanılır, yoksa üretilir. Yanıt başlığında ve **her hata yanıtının gövdesinde** döner. |
| `route` | istek içinde | Ham yol değil **kalıp**: `/v1/players/{id}`. Böylece kayıtlar gruplanabilir ve yolda ID olarak taşınan bilgi loga sızmaz. |
| `user_id`, `account_type` | oturum varsa | Kişi **ID'si**, asla e-posta veya ad. |
| `delegated_by` | geçiş oturumunda | Antrenör kulüp adına işlem yapıyorsa antrenörün ID'si. |
| `client`, `app_version` | mobilden | Mobil `X-Client: ios/android` ve `X-App-Version` başlıklarını gönderir. Hangi sürümün hata ürettiğini bulmak için kritik. |
| `ip` | erişim logunda | IPv4'ün son okteti, IPv6'nın son 80 biti sıfırlanmış (KVKK: kişisel veri olmaktan çıkar, ülke/ISP tespiti hâlâ mümkün). Tam IP yalnızca güvenlik olaylarında, 30 gün. |
| `error` | hata satırında | Sarmalanmış hata zinciri (`fmt.Errorf("...: %w", err)`). |
| `error_code` | hata satırında | Kullanıcıya dönen kod (`email_exists`, `rate_limited`, `internal_error`). |
| `stack` | yalnızca panik/5xx | Stack trace. |
| `duration_ms` | iş ve isteklerde | |

### Seviyeler

| Seviye | Ne zaman | Örnek |
|---|---|---|
| `DEBUG` | Yalnızca geliştirmede veya `LOG_LEVEL=debug` ile geçici açılır. Canlıda kapalı. | SQL sorgu süreleri, dış servis yanıt gövdesi (kişisel veri çıkarılmış). |
| `INFO` | Normal ama izlenmeye değer olaylar. | Her istek sonu, kayıt, satın alma, iş tamamlandı. |
| `WARN` | Kendiliğinden toparlanan veya kullanıcı kaynaklı ama sık olursa sorun olan durum. | Dış servis yavaş, tekrar denendi; hız sınırı aşıldı; 1 sn'yi geçen istek. |
| `ERROR` | Bir işlem başarısız oldu ve kullanıcı etkilendi. **Her ERROR bir insanın bakması gereken şeydir**; bakılmayacaksa WARN'dır. | 5xx yanıt, ödeme doğrulama hatası, push gönderilemedi (3 denemeden sonra). |
| (panik) | `ERROR` + `"panic": true` + stack. Anında alarm. | |

4xx yanıtlar (geçersiz form, yetkisiz) **hata değildir**; yalnızca erişim logunda durum koduyla görünür. İstisna: 401/403'ler güvenlik olayı olarak sayılır (madde 7).

## 4. Olay adları

`msg` alanı `alan.eylem[.sonuç]` biçiminde sabit adlardır, serbest cümle değildir. Bu sayede "son 1 saatte kaç `payment.verify.failed`" sorusu tek sorgudur ve kod içinde aranabilir.

| Alan | Olaylar |
|---|---|
| `http` | `http.request`, `http.slow`, `http.panic` |
| `auth` | `auth.register`, `auth.login`, `auth.login.failed`, `auth.logout`, `auth.password.changed`, `auth.password.reset_requested`, `auth.email.verified`, `auth.switch`, `auth.switch.denied`, `auth.account.deleted` |
| `admin` | `admin.login`, `admin.login.failed`, `admin.2fa.failed`, `admin.action` (ayrıntısı denetim kaydında) |
| `payment` | `payment.verify`, `payment.verify.failed`, `payment.granted`, `payment.refund`, `payment.webhook.rejected` |
| `media` | `media.upload`, `media.rejected`, `media.busy` (semafor dolu) |
| `social` | `social.post.created`, `social.report`, `social.block` |
| `abuse` | `abuse.rate_limited`, `abuse.quota_exceeded` |
| `job` | `job.run` (her çalıştırmada: ad, süre, işlenen kayıt, hata sayısı), `job.failed` |
| `push` | `push.sent`, `push.failed`, `push.token_invalid` |
| `mail` | `mail.sent`, `mail.failed` |
| `db` | `db.slow_query`, `db.pool_exhausted` |
| `upstream` | `upstream.failed` (TFF, Google Play, App Store, FCM) + `upstream` alanında servis adı |
| `system` | `system.start`, `system.stop`, `system.migration` |

Liste kod içinde sabitler olarak tutulur (`internal/platform/logging/events.go`); yeni olay eklemek bu listeye eklemek demektir.

## 5. Kişisel veri politikası (asla loglanmayanlar)

Loga **asla** yazılmaz: şifre, oturum anahtarı, `Authorization` başlığı, çerez, doğrulama/sıfırlama kodu, ödeme makbuzu/JWS, push token, e-posta adresi, telefon, doğum tarihi, boy/kilo, mesaj ve gönderi metni, medya içeriği, istek ve yanıt gövdeleri.

Nasıl garanti edilir:
- Loglar yalnızca `logging` paketinin yardımcılarıyla yazılır; istek gövdesini loglayan bir yardımcı **yoktur**.
- Hassas tipler (`Password`, `Token`, `Email`) `slog.LogValuer` uygular ve her zaman `"[gizli]"` olarak yazılır; yanlışlıkla loglansa bile sızmaz.
- Bir test, uçtan uca senaryoları (kayıt, giriş, şifre sıfırlama, ödeme) çalıştırıp çıkan tüm log satırlarında test e-postası, şifresi ve token'ının **geçmediğini** doğrular. CI'da kalıcı.
- Sentry'de `sendDefaultPii: false`, istek gövdesi ve çerezler gönderilmez, kullanıcı yalnızca ID ile tanımlanır.

## 6. Backend uygulaması

### 6.1 `internal/platform/logging` paketi (yeni)
- `New(service, env, version, level)` → JSON handler'lı `*slog.Logger`; `slog.SetDefault` ile tüm kod onu kullanır.
- `WithRequest(ctx)` / `FromContext(ctx)`: istek kimliği, kullanıcı ve rota bilgisi context'e konur; handler'lar `logging.FromContext(r.Context()).Error(...)` ile yazar, alanları tekrar yazmak zorunda kalmaz.
- Gizli tipler, olay adı sabitleri, IP maskeleme.

### 6.2 Ara katmanlar (sırasıyla, `cmd/api/main.go` içinde tek yerde)
1. **RequestID:** `X-Request-ID`'yi okur/üretir, context'e ve yanıt başlığına koyar.
2. **Recover:** tüm handler'ları sarar; panikte stack ile `http.panic` loglar, Sentry'ye gönderir, kullanıcıya `internal_error` + `request_id` döner. Mevcut 3 ayrı `recover` kaldırılır.
3. **AccessLog:** yanıt bittiğinde tek `http.request` satırı (durum, süre, boyut). `/health`, `/ready`, `/metrics` loglanmaz. 1 saniyeyi geçenler ek olarak `http.slow` (WARN).
4. **Metrics:** istek sayısı ve süre histogramı (madde 8).
5. **Auth bağlamı:** oturum çözülünce `user_id`, `account_type`, `delegated_by` context'e eklenir; erişim logu bunları otomatik yazar.

### 6.3 Hata yanıtları
Her hata yanıtı gövdesine `requestId` eklenir: `{"error":{"code":"internal_error","message":"…","requestId":"01JAC…"}}`. Mobil bunu hata ekranında küçük gri yazıyla gösterir ("Destek kodu: 01JAC3W8"); kullanıcı destek talebinde bu kodu verince loglarda tam o istek bulunur.

### 6.4 Mevcut ~45 çağrının dönüşümü
Her `slog.Error("X operation failed", "error", err)` → `log.Error(event, "error", err, …bağlam)`; 4xx'e düşen beklenen hatalar (bulunamadı, yetkisiz) ERROR'dan çıkarılır. Hatalar katmanlar boyunca `%w` ile sarmalanır ki zincir görünsün (`create post: insert media: context deadline exceeded`).

### 6.5 Arka plan işleri
`jobs.Run(ctx, "push.dispatch", interval, fn)` sarmalayıcısı: her çalıştırmada `job.run` (süre, işlenen, hata), panik yakalama, son başarı zamanı metriği. İşler: push dağıtımı, Google iade senkronu, oturum ve bildirim temizliği, e-posta kuyruğu, yedek (sunucu tarafında).

### 6.6 Veritabanı
- pgx `QueryTracer`: 300 ms'yi geçen sorgular `db.slow_query` (sorgu adı/ilk 200 karakter, parametreler **olmadan**, süre, `request_id`).
- Postgres: `log_min_duration_statement=500ms`, `pg_stat_statements` açık. En yavaş 20 sorgu Grafana panelinde.
- Havuz istatistikleri metrik olarak (madde 8).

### 6.7 Dış servisler
TFF, App Store, Google Play, FCM, e-posta servisi çağrıları ortak bir `http.Client` sarmalayıcısından geçer: süre, durum, deneme sayısı; hata olunca `upstream.failed` + servis adı. Bir servis 5 dakikada 5'ten fazla hata verirse alarm.

## 7. Denetim ve güvenlik kayıtları

Bunlar uygulama logundan **ayrıdır**: veritabanında, değiştirilemez (yalnızca INSERT yetkisi), uzun süre saklanır, yönetici panelinden okunur.

```sql
CREATE TABLE audit_log (
  id          bigserial PRIMARY KEY,
  at          timestamptz NOT NULL DEFAULT now(),
  actor_type  text NOT NULL,          -- user | admin | system
  actor_id    uuid,                   -- silinen hesapta NULL olur, kayıt kalır
  delegated_by uuid,                  -- antrenör kulüp adına ise
  action      text NOT NULL,          -- admin.pro.grant, auth.password.changed …
  target_type text,
  target_id   text,
  details     jsonb NOT NULL DEFAULT '{}',  -- kişisel veri içermez (önce/sonra değerleri ID ve sayılar)
  ip          inet,
  request_id  text
);
```

Kaydedilenler:
- **Tüm yönetici işlemleri:** Pro verme, hediye, sezon/görev değişikliği, kullanıcı askıya alma, içerik silme, başvuru onayı, duyuru, giriş/çıkış, 2FA kurulumu.
- **Hesap güvenliği:** şifre değişikliği/sıfırlama, e-posta doğrulama, tüm cihazlardan çıkış, hesap silme, antrenörün kulübe geçişi ve geçiş oturumunda yapılan her yazma işlemi.
- **Para:** satın alma onayı, iade, elle Pro verme.

Saklama: 2 yıl (ödemeyle ilgili olanlar 10 yıl). Yönetici panelinde "İşlem geçmişi" sayfası: kişiye, eyleme, tarihe göre filtre.

**Güvenlik olayları** (loglarda, `security: true` alanıyla, tam IP ile, 1 yıl): başarısız girişler, 2FA hataları, hız sınırı aşımları, 401/403'ler, geçiş oturumunun reddedilen istekleri, webhook imza hataları. Örüntü alarmları: aynı IP'den 10 dakikada 50 başarısız giriş, aynı hesaba 20 başarısız giriş, bir kullanıcının dakikada 30'dan fazla 403 alması.

## 8. Metrikler

`/metrics` uç noktası yalnızca iç ağdan (Docker ağı) erişilir, dışarı açılmaz.

| Metrik | Neden |
|---|---|
| `http_requests_total{route,method,status}` | Hata oranı, trafik |
| `http_request_duration_seconds{route}` (histogram) | p50/p95/p99 gecikme |
| `http_in_flight` | Anlık yük |
| `db_pool_acquired / idle / max`, `db_pool_wait_seconds` | Havuz tıkanması |
| `media_uploads_in_flight`, `media_rejected_total{reason}` | Bellek koruması |
| `push_queue_depth`, `push_sent_total{result}` | Bildirim sağlığı |
| `mail_queue_depth`, `mail_sent_total{result}` | |
| `job_last_success_timestamp{job}`, `job_duration_seconds{job}` | İş takılması |
| `upstream_requests_total{service,result}`, süre | Dış servis sağlığı |
| `rate_limited_total{bucket}` | Saldırı/kötüye kullanım |
| `business_events_total{event}` | Kayıt, satın alma, başvuru, gönderi sayıları (iş paneli) |
| Go çalışma zamanı (bellek, goroutine, GC) | Sızıntı tespiti |
| Sunucu: CPU, RAM, disk, ağ (node exporter) | |
| Postgres: bağlantı, boyut, en büyük tablolar, kilitler (postgres exporter) | |

### Paneller (Grafana)
1. **Genel durum:** istek/sn, hata oranı, p95 gecikme, aktif kullanıcı (son 5 dk farklı `user_id`), son dağıtım sürümü çizgisi.
2. **Uç noktalar:** en yavaş ve en çok hata veren 10 rota.
3. **Veritabanı:** havuz, yavaş sorgular, tablo boyutları (medya tablolarının büyümesi), disk.
4. **İşler ve kuyruklar:** push, e-posta, iade senkronu, yedek.
5. **İş göstergeleri:** günlük kayıt, satın alma, başvuru, gönderi, oyun oynama.
6. **Güvenlik:** başarısız girişler, hız sınırları, 403'ler.

## 9. Mobil (React Native)

- **Sentry React Native** (`@sentry/react-native`):
  - JS hataları, yerel çökmeler (iOS/Android), ANR/donmalar, uygulama başlangıç süresi.
  - Sürüm (`release` = `1.4.0`, `dist` = build numarası); her release derlemesinde **source map** ve iOS dSYM yüklenir, böylece hata satırı derlenmiş kod yerine gerçek dosya ve satırla görünür.
  - Breadcrumb'lar: ekran geçişleri (navigation entegrasyonu), API istekleri (yalnızca yöntem, rota kalıbı, durum, `request_id`; gövde ve sorgu parametreleri yok).
  - Kullanıcı yalnızca `id` ve `accountType` ile; e-posta yok.
  - Örnekleme: hatalar %100, performans izleri %10.
- **ErrorBoundary:** her ana sekmenin etrafında; çökme olursa "Bir şeyler ters gitti, tekrar dene" ekranı + hata Sentry'ye; uygulamanın tamamı beyaz ekrana düşmez.
- **API istemcisi:** her isteğe `X-Request-ID`, `X-Client`, `X-App-Version` ekler. 5xx ve ağ hataları Sentry'ye `request_id` ile gider; backend logundaki satırla birebir eşleşir.
- **Kullanıcı izni:** çökme raporlama meşru menfaat kapsamında varsayılan açık; gizlilik metninde belirtilir, `PrivacyInfo.xcprivacy`'de "Crash Data" ve "Performance Data" beyan edilir. Ayarlar'da "Hata raporlarını paylaş" anahtarı (P2).
- Canlı derlemede `console.*` çağrıları zaten yok; korunur.

## 10. Yönetici paneli (web)

Sentry Browser SDK: JS hataları, başarısız API çağrıları (`request_id` ile). Yönetici kimliği yalnızca ID.

## 11. Alarmlar

Kanal: **Telegram botu** (anında, ücretsiz) + kritiklerde e-posta. Her alarm mesajında: ne oldu, ne zamandan beri, panel bağlantısı. Gürültü olmasın diye her alarm bir süre koşulu taşır ve çözülünce "düzeldi" mesajı gelir.

| Alarm | Koşul | Önem |
|---|---|---|
| API erişilemiyor | Dış uptime kontrolü 2 dakika üst üste başarısız | Kritik |
| Panik | Herhangi bir `http.panic` veya iş paniği | Kritik |
| Hata oranı | 5xx oranı 5 dakika boyunca %2'nin üstünde | Kritik |
| Gecikme | p95 10 dakika boyunca 1,5 sn'nin üstünde | Uyarı |
| Yedek | Son başarılı yedek 26 saatten eski | Kritik |
| Disk | %80 üstü (uyarı), %90 üstü (kritik) | |
| DB havuzu | 5 dakika boyunca %80 üstü dolu | Uyarı |
| Ödeme | Herhangi bir `payment.verify.failed` (mağaza tarafı hata) | Uyarı |
| Push | 15 dakikada başarısızlık %20 üstü | Uyarı |
| İş takıldı | `job_last_success` beklenen aralığın 3 katından eski | Uyarı |
| Güvenlik | Kaba kuvvet örüntüsü (madde 7) | Uyarı |
| Yeni hata türü | Sentry'de ilk kez görülen hata veya bir sürümde hızla artan hata | Uyarı |
| Mobil çökme | Çökmesiz oturum oranı %99,5'in altına düşerse | Kritik |

## 12. Saklama süreleri

| Veri | Süre |
|---|---|
| Uygulama ve erişim logları | 30 gün |
| Güvenlik olayları | 1 yıl |
| Denetim kaydı | 2 yıl (ödeme: 10 yıl) |
| Metrikler | 30 gün tam çözünürlük, 13 ay özet |
| Sentry olayları | 90 gün |
| Docker yerel log | 5 × 20 MB döner (yalnızca toplayıcı çökerse yedek) |

## 13. Uygulama sırası

| Aşama | İş | Süre | Senden |
|---|---|---|---|
| 1 | `platform/logging`, JSON log, RequestID + Recover + AccessLog ara katmanları, hata gövdesinde `requestId`, 45 çağrının dönüşümü, kişisel veri testi, Docker log döndürme | ~2 gün | — |
| 2 | Sentry: backend, mobil (ErrorBoundary, source map/dSYM yükleme), yönetici paneli; mobil başlıklar | ~1,5 gün | Sentry hesabı |
| 3 | `/metrics`, iş sarmalayıcısı, DB tracer, dış servis sarmalayıcısı | ~1,5 gün | — |
| 4 | Toplayıcı (Alloy), Loki/Prometheus/Grafana, 6 panel, alarmlar, Telegram botu, dış uptime + yedek heartbeat | ~1,5 gün | Barındırma kararı (A/B/C), Telegram |
| 5 | `audit_log` tablosu, tüm yönetici/güvenlik/para olayları, panelde "İşlem geçmişi" | ~1,5 gün | — |

Aşama 1 ve 3 hiçbir hesap gerektirmez, hemen başlanabilir. Aşama 1, diğer tüm işlerin (hesap güvenliği, gizlilik) loglarının da doğru biçimde yazılması için önce yapılmalıdır.

## 14. Karar bekleyenler

1. Barındırma: A (Grafana Cloud + Sentry, öneri), B (hepsi kendi sunucumuzda) veya C (hibrit)?
2. Alarm kanalı: Telegram uygun mu, başka biri de alarm alacak mı?
3. Mobilde "Hata raporlarını paylaş" anahtarı canlıda olsun mu (öneri: P2)?
