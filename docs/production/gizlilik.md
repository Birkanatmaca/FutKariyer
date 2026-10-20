# Gizlilik açıkları ve KVKK

Sahiplik kontrolleri (başkasının ilanını, takımını, hediyesini, bildirimini değiştirememe) incelendi ve doğru. Açıklar, **engelleme** ile **görünürlük** kurallarının bazı yollarda uygulanmamasından geliyor.

## Açıklar (hepsi P0)

### 1. Antrenör, kulüp hesabına geçince kulübün özel verilerini okuyabiliyor
`internal/auth/transport/delegation.go`: geçiş oturumu yazma işlemlerinde yetkiye bakıyor ama **her GET isteğine izin veriyor**. Antrenör şunları görebiliyor: kulübün e-postası (`/v1/me/profile`), kabul edilmiş bağlantıların iletişim e-postaları (`/v1/connections`), bildirimler, profil ziyaretçileri, mağaza siparişleri, teknik ekip adayları.

Düzeltme: GET için de **izin listesi**. Geçiş oturumu yalnızca kulübün verdiği yetkiye ait bölümleri okuyabilir (kadro, başvurular, maçlar, ilanlar, kulüp profili). Hesap, ödeme, bağlantılar, bildirimler, ziyaretçiler ve ekip yönetimi her zaman kapalı. Bilinmeyen yol varsayılan olarak reddedilir. Tüm bölüm kuralları için tablo tabanlı test.

### 2. Engellenen kişi beğeni, yanıt ve takip yapabiliyor
`internal/social/data/postgres.go` (`lockPost`, `SetFollow`): engelleme kontrolü yok. Engellediğin kişi gönderini beğenebiliyor, yanıt yazabiliyor ve seni takip edebiliyor; takip sana bildirim olarak düşüyor.

Düzeltme: üç yola `NotBlocked` koşulu; engelleme anında var olan takip ilişkileri iki yönde de silinir.

### 3. Gönderi medyası görünürlük kontrolü olmadan veriliyor
`internal/social/transport/http.go:98`: medya ID'sini bilen her oturum açmış kullanıcı dosyayı indirebiliyor; engellenmiş veya gizli hesap kontrolü yok.

Düzeltme: medya isteğinde izleyen kişi aktarılır ve akıştaki `visibleToViewer` kuralı aynen uygulanır. Oyuncu galerisi (`players/transport/media.go`) için de aynı kontrol.

### 4. Profil fotoğrafları giriş yapmadan herkese açık
`/v1/users/{id}/avatar`: giriş istemiyor, engellemeye bakmıyor, bir gün boyunca herkese açık önbelleğe alınabiliyor; keşifte görünmek istemeyen sporcuların fotoğrafı da dahil.

Düzeltme: giriş zorunlu, engellenen kişiye 404, `Cache-Control: private`. Profil paylaşım kartları (Instagram) fotoğrafı cihazda zaten çizdiği için etkilenmez.

### 5. Silinen hesabın adı başkalarının bildirimlerinde kalıyor
Bildirim başlıkları ve moderasyon raporları, işlemi yapan kişinin adını ve içerik alıntısını metin olarak saklıyor; hesap silinince bunlar kalıyor.

Düzeltme: bildirimde ad yerine kişi ID'si saklanır, ad okuma anında çözülür (silinmişse "Silinmiş hesap"). Hesap silinince moderasyon alıntıları temizlenir, rapor kaydı ve karar kalır.

## KVKK ve mağaza gereklilikleri

| # | Konu | Öncelik | Not |
|---|---|---|---|
| 6 | **Yaş kapısı** | P0 | Kayıtta doğum tarihi zorunlu. 13 yaş altı kayıt olamaz. 13–17 için: profil varsayılan olarak keşifte gizli, boy/kilo yalnızca kabul edilmiş bağlantılara açık, yetişkinlerden gelen doğrudan mesajlar kapalı. **Karar senden:** alt sınır 13 mü, 16 mı? Veli onayı istenecek mi? (Hukukçu görüşü önerilir.) |
| 7 | **Yasal metinler** | P0 | Gizlilik politikası, KVKK aydınlatma metni, kullanım şartları. **Metinler senden** (veya hukukçudan). Uygulamada: kayıtta onay kutusu, Ayarlar'da üç bağlantı, onaylanan sürüm ve tarih `users` tablosunda saklanır; metin değişirse yeniden onay istenir. |
| 8 | **Açık rıza ayrımı** | P0 | Pazarlama bildirimleri ve profilin kulüplerce keşfedilmesi ayrı, sonradan değiştirilebilir izinler olmalı (zorunlu kayıt onayına gömülmemeli). |
| 9 | **Veri indirme hakkı** | P1 | `GET /v1/me/export`: hesabın tüm verisi (profil, gönderiler, başvurular, bağlantılar, ödemeler) tek ZIP/JSON olarak. KVKK md. 11. |
| 10 | **Saklama süreleri** | P1 | Okunmuş bildirimler 90 gün, süresi geçmiş oturumlar anında, push kuyruğu 7 gün, moderasyon kararları 2 yıl, ödeme kayıtları 10 yıl (vergi mevzuatı). Günlük temizlik işi. |
| 11 | **iOS gizlilik bildirimi** | P0 | `PrivacyInfo.xcprivacy` içinde toplanan veri türleri (ad, e-posta, fotoğraf, doğum tarihi, fiziksel ölçüler, satın alma geçmişi, cihaz kimliği) doldurulur; App Store Connect'teki "App Privacy" formu buna göre doldurulur. |
| 12 | **İlan ve mesaj şikayeti** | P1 | Gönderi ve profil şikayeti var; ilan ve mesajlar için de eklenmeli (App Store kuralı 1.2). |

## Test planı

Her açık için "saldırgan" senaryosu yazan bir entegrasyon testi: A, B'yi engeller → B'nin beğeni, yanıt, takip, medya ve avatar istekleri reddedilir; antrenör geçiş oturumuyla izin listesi dışındaki her GET 403 döner. Bu testler kalıcı olarak CI'da kalır ki açık geri gelmesin.
