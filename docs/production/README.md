# Canlıya çıkış planı

20 Ekim 2026 tarihli canlıya hazırlık incelemesinin çıktısıdır. Her başlık ayrı dosyadadır; her maddede öncelik (P0 canlıdan önce şart, P1 canlıdan önce, P2 canlıdan sonra), yaklaşık iş büyüklüğü ve senden gereken bir şey varsa o yazılıdır.

| Dosya | Konu | Durum |
|---|---|---|
| [hesap-guvenligi.md](hesap-guvenligi.md) | E-posta doğrulama, şifre sıfırlama/değiştirme, yönetici 2FA, kaba kuvvet koruması, antrenör oturumu | Onaylandı, yapılacak |
| [gizlilik.md](gizlilik.md) | Engelleme açıkları, medya erişimi, profil fotoğrafı, antrenörün kulüp verisini görmesi, KVKK | Onaylandı, yapılacak |
| [sunucu-ve-yedekleme.md](sunucu-ve-yedekleme.md) | Yedekleme, medya saklama, sunucu sağlamlığı, güvenlik duvarı, kotalar | Öneri, karar bekliyor |
| [loglama.md](loglama.md) | Uçtan uca loglama, izleme ve alarm mimarisi | Öneri, en son birlikte incelenecek |

## Bekleyen ve bilinçli ertelenen

- **HTTPS (P0):** Kullanıcı kararıyla (20 Ekim 2026) alan adı alınınca en son yapılacak. O zamana kadar API düz HTTP; mobil `allowInsecureApi` ve iOS `NSAllowsArbitraryLoads` açık kalır. HTTPS gelince bunlar, `ADMIN_ALLOW_INSECURE_HTTP` ve 8092 portu kaldırılır, önüne Caddy konur (otomatik sertifika + HSTS). Rate limiter bu adımda vekil sunucu başlığına (`X-Forwarded-For`, yalnızca Caddy'den gelirse) geçirilmelidir; yoksa tüm kullanıcılar tek IP gibi görünür.
- **Mağaza ve dış hesaplar (P0, senden):** Firebase projesi + APNs anahtarı (push), Android yükleme anahtarı (keystore), App Store Connect'te otomatik yenilenen Pro aboneliği, e-posta gönderim servisi, yasal metinler (gizlilik politikası, KVKK aydınlatma, kullanım şartları).
- **Mobil mağaza hazırlığı (P0/P1):** `NSPhotoLibraryAddUsageDescription`, dolu `PrivacyInfo.xcprivacy`, kayıtta şartları onay kutusu, yaş kapısı, Pro'nun aboneliğe çevrilmesi ve "satın alımları geri yükle", ErrorBoundary, çevrimdışı çıkış, 401'de otomatik çıkış, çıkışta push kaydının silinmesi, ilan/mesaj şikayeti, destek bağlantısı, iPad hedefinin kapatılması.
