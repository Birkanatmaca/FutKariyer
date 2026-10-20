# Hesap güvenliği

Bugünkü durum: şifreler bcrypt (cost 10) ile saklanıyor; oturum anahtarları 32 rastgele bayt ve veritabanında SHA-256 olarak duruyor; girişte zamanlama eşitleniyor; `auth_version` ile tüm oturumlar geçersiz kılınabiliyor. Eksik olan: e-postanın gerçekten kişiye ait olduğu hiç doğrulanmıyor, şifre unutulursa hesap kurtarılamıyor, yönetici paneli tek şifreyle korunuyor.

## 1. E-posta servisi (P0, senden)

Doğrulama ve sıfırlama e-postası için bir gönderim servisi gerekir. Öneri: **Resend** veya **Amazon SES** (ikisi de alan adı doğrulaması ister, yani alan adı alınınca SPF/DKIM/DMARC kayıtları eklenir). Alan adı gelene kadar geliştirmede e-postalar loga yazılır, gerçekten gönderilmez.

- Backend: `internal/platform/mail` paketi, `Sender` arayüzü (`Send(ctx, to, template, data)`), iki uygulaması: `LogSender` (geliştirme) ve `ResendSender`/`SESSender` (canlı). Şablonlar Türkçe, düz metin + basit HTML.
- Env: `MAIL_PROVIDER`, `MAIL_API_KEY`, `MAIL_FROM` (`Fut Career <no-reply@alanadi>`).
- Gönderim kuyruğu: `mail_outbox` tablosu + arka plan işçisi (push kuyruğuyla aynı desen, ama teslimden **sonra** "gönderildi" işaretlenir ve 3 deneme yapılır).

## 2. E-posta doğrulama (P0, ~1 gün)

- `users.email_verified_at` sütunu. Mevcut hesaplar migration'da doğrulanmış sayılır (geriye dönük kilitleme olmaz).
- Kayıttan sonra 6 haneli kod gönderilir (bağlantı yerine kod: uygulama içinde girilir, derin bağlantı kurulumu gerekmez). Kod veritabanında hash'li, 15 dakika geçerli, en fazla 5 deneme, yeniden gönderme 60 saniyede bir.
- Doğrulanmamış hesap uygulamaya girer ama başvuru yapamaz, gönderi paylaşamaz, mesaj/tanışma isteği gönderemez (spam hesaplarını sınırlar). Mobilde üstte "E-postanı doğrula" şeridi.
- Uç noktalar: `POST /v1/auth/verify-email`, `POST /v1/auth/verify-email/resend`.

## 3. Şifremi unuttum (P0, ~1 gün)

- `POST /v1/auth/password/forgot` (e-posta alır, hesap olsa da olmasa da **aynı yanıtı** verir) ve `POST /v1/auth/password/reset` (e-posta + 6 haneli kod + yeni şifre).
- Kod: hash'li, 15 dakika, 5 deneme, tek kullanımlık. Başarılı sıfırlamada `auth_version` artar, yani tüm cihazlardaki oturumlar kapanır; kullanıcıya "şifren değiştirildi" e-postası gider.
- IP başına ve e-posta başına ayrı hız sınırı (e-posta başına saatte 3 istek).
- Mobil: giriş ekranında "Şifremi unuttum" bağlantısı, iki adımlı ekran (e-posta → kod + yeni şifre).

## 4. Şifre değiştirme (P0, ~yarım gün)

- `PUT /v1/me/password` (mevcut şifre + yeni şifre). Başarıda `auth_version` artar ama **bu cihazın oturumu yeniden verilir**, diğer cihazlar çıkar.
- Mobil: Profil düzenleme → "Güvenlik" bölümü.
- Google ile giriş yapmış ve şifresi olmayan hesaplarda bu alan "Şifre oluştur" olarak görünür.

## 5. Şifre ve giriş kuralları (P1, ~yarım gün)

- bcrypt cost 10 → 12. Mevcut hash'ler girişte, şifre doğruysa sessizce yeniden hash'lenir.
- Giriş için IP başına sınırın yanına **hesap başına** sınır: art arda 5 hatalı denemeden sonra o hesap için artan bekleme (1, 2, 4, … en fazla 15 dakika). Kalıcı kilit yok (kötü niyetli birinin hesabı kilitlemesini önlemek için).
- Kayıt, giriş, başvuru ve hesap silme şu an aynı 20/dakika kovasını paylaşıyor; ayrı kovalara bölünür. `/v1/auth/switch` için de sınır eklenir.
- Kayıtta "bu e-posta kayıtlı" yanıtı kalsın mı? Öneri: **kalsın** (kullanıcı deneyimi daha iyi); e-posta doğrulama geldiği için başkasının e-postasıyla kayıt artık işe yaramaz.

## 6. Antrenör → kulüp oturumu (P0, ~yarım gün)

- Geçiş oturumu şu an 30 gün geçerli. **8 saate** indirilir; süre bitince uygulama antrenör hesabına geri döner.
- Okuma yetkisi: bkz. [gizlilik.md](gizlilik.md) madde 1.
- Her geçiş ve geri dönüş denetim kaydına yazılır (bkz. [loglama.md](loglama.md)).

## 7. Yönetici paneli (P0, ~1,5 gün)

- **TOTP iki aşamalı doğrulama** (Google Authenticator / 1Password): ilk girişte zorunlu kurulum, QR kod, 10 tek kullanımlık kurtarma kodu. Sır veritabanında `ADMIN_TOTP_KEY` ile AES-GCM şifreli saklanır.
- Hesap başına artan bekleme (madde 5 ile aynı).
- **Denetim kaydı:** her yönetici işlemi (Pro verme, hediye, sezon, kullanıcı engelleme, içerik silme, giriş/çıkış) `admin_audit_log` tablosuna kim/ne/ne zaman/hangi kayıt/IP ile yazılır; panelde salt okunur "İşlem geçmişi" sayfası.
- Yönetici oturumu 12 saat, 30 dakika hareketsizlikte düşer.

## 8. Oturum yönetimi (P1, ~1 gün)

- Profil → Güvenlik → "Aktif oturumlar": cihaz adı, son kullanım, "bu cihaz" etiketi, tek tek veya "diğer tüm cihazlardan çık".
- Süresi geçmiş oturumlar şu an yalnızca API açılışında siliniyor; saatlik temizlik işine taşınır.
- Push kaydı süresi geçmiş oturuma bağlıysa bildirim gönderilmez.

## Testler

Her uç nokta için tablo tabanlı testler: yanlış kod, süresi geçmiş kod, deneme sınırı, tekrar kullanım, `auth_version` artışı, hız sınırları. Şu an `auth` paketinde yalnızca 3 test var; bu iş bitince auth en iyi test edilen paket olmalı.

## Sıra

1. Şifre değiştirme + bcrypt + hız sınırları + antrenör oturum süresi (e-posta servisi gerektirmez).
2. Yönetici 2FA + denetim kaydı.
3. E-posta altyapısı (`LogSender` ile), doğrulama ve şifre sıfırlama; alan adı ve servis gelince canlı gönderici.
4. Aktif oturumlar ekranı.
