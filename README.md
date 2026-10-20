# Fut Career

Futbolcuları, kulüpleri ve antrenörleri bir araya getiren futbol ağı. React web yönetici paneli, React Native 0.84.1 + TypeScript mobil istemci, Go API ve PostgreSQL kullanır. Go, React Native ve PostgreSQL ürünün zorunlu teknoloji üçlüsüdür. Yönetici web paneli frontend/, diğer kullanıcıların uygulaması mobile/, ortak servis backend/ altındadır.

## Bu sürüm

- Yaş sınırı olmadan herkese açık sporcu ve antrenör kaydı; kulüp/organizasyon başvurusu; yönetici tarafından da açılabilen kulüp/antrenör hesapları
- Kayıt, giriş, oturum geri yükleme, hesap bilgileri ve çıkış
- Profesyonel koyu mobil tema; Ana Sayfa, Ligler, Bildirimler ve Diğer sekmeleri; ortada Sosyal, Profil, Takımlar ve Oyunlar'ı açan 66 piksel futbol topu merkez düğmesi, Diğer içinde Ayarlar ve Haberler
- Kalıcı PostgreSQL kullanıcı/oturum verisi; bcrypt şifre hash'i, rastgele bearer token ve sunucuda yalnızca token hash'i
- Go repository/uygulama/HTTP katmanları; mobil özellik modülleri ve merkezi tasarım tokenları
- Oyuncu profili temel alanları, uygunluk ve keşif tercihi; PostgreSQL kalıcılığı ve hesap türü yetkilendirmesi
- pgx üzerinden ortak bağlantı havuzu ve Goose ile sürümlü SQL migration yapısı
- /securityadmin adresinde ayrı web yönetici girişi ve kullanıcı/kulüp paneli; arama ve sunucuda 20 kayıtlık sayfalama
- Yönetici için HttpOnly cookie, diğer hesaplar için mobil bearer oturumu; sunucuda ayrılmış oturum kullanım alanları
- Kullanıcı ve kulüp oluşturma, okuma, düzenleme, silme; erişimi durdurma ve şifre yenileme
- Yönetici tarafından kulüp/antrenör doğrulaması; gerçek, yetkili ve sayfalı mobil keşif
- Oyuncu aramasında isim, mevki, baskın ayak ve uygunluk filtreleri; özel iletişim bilgisi içermeyen profil detayı
- Sporcu profilinde dairesel fotoğraf alanı, futbol bilgileri ve düzenle butonu; Fotoğraflar/Videolar sekmeleri ve üç sütunlu kare galeri düzeni
- Kişisel karşılama kartı ve gerçek profil görüntüleme, takipçi ve takip edilen sayaçları
- Yönetici panelinden JPEG/PNG reklam görseli yükleme, sıralama ve yayınlama; mobilde sabit 1200×600 (2:1) reklam görseli alanı
- Haber oluşturma/düzenleme/silme; ayrı yayın ve “Ana sayfada göster” tercihleri, mobil haber listesi ve tam metin ekranı
- Yönetici lig oluşturma/yayınlama, kulüp takımları, fikstür ve skor yönetimi; maç sonuçlarından hesaplanan puan durumu ve lig istatistikleri
- Etkin kulüplerin takım rehberi; yönetici tarafından düzenlenen takım tanıtımı, saha adresleri ve antrenman programı
- Oyuncu başına üç ücretsiz takım katılma başvurusu; 2/5/10 hak paketleri, satın alma akışı ve yönetici ödeme geçmişi
- Profil paylaşma: Profil sayfasında "Profili düzenle"nin yanındaki paylaş ikonu 9:16 profil kartını Instagram Hikâye, WhatsApp veya sistem paylaşım menüsüyle paylaşır (react-native-view-shot + react-native-share; doğrudan hikâye düzenleyicisi için `mobile/src/shared/lib/config.ts` içindeki `facebookAppId` doldurulmalı)
- Pro üyelik (30 gün/49 TL, dönem başına +3 "Pro hakkı"), "Profilini kim görüntüledi" ziyaretçi ekranı, Pro'ya özel gizli gezinme, PRO rozeti ve Takımlar başlığında başvuru hakkı rozeti
- Merkez düğmesindeki Oyunlar sayfası; Arma İzi (gerçek armalarla futbolcu tahmini), Beyaz Nokta (penaltı düellosu), üç oyun kalbi ve başarıyla kazanılan başvuru hakkı; ücretsiz Kafa Kafaya (gerçek puan durumundan iki kulüp karşılaştırması ve en iyi seri)

Oyuncu profili temel alanları Go API üzerinden kaydedilir. Keşifte görünme tercihi liste ve detay erişimini kontrol eder. Sporcular doğrulanmış kulüp/antrenörleri; doğrulanmış kulüp/antrenörler görünür oyuncuları keşfeder. Sporcu profil galerisine fotoğraf/video yüklenebilir; sosyal gönderi medyası da bağlıdır. E-posta doğrulama ve şifre kurtarma henüz eklenmemiştir. Kullanıcı kararıyla üyelik yaş sınırı ve yaş onayı kaldırılmıştır.

## Güncel geliştirme durumu — 20 Ekim 2026: Kulüp ana sayfası ve TFF Ankara bağlantısı

- **Antrenör Saha menüsü:** aktif kulübü olan antrenörde Takımlar yerine Takımım (kulüp, görev, kadro, bekleyen başvuru, yetkiler, Kulübe geç, lig kartı) ve yeni Keşif sayfası (Keşfet filtreleri + İzleme listem). `00038_player_watchlist.sql`; `mobile/src/app/CoachTeamTab.tsx`, `mobile/src/features/clubs/ui/CoachTeamView.tsx`, `mobile/src/features/discovery/ui/ScoutScreen.tsx`.
- **Kulüp Ligler sekmesi:** Maçlarım | Ligler; Maçlarım kulübün fikstürü, tam puan tablosu ve haftalık grup maçları (`mobile/src/features/clubs/ui/ClubMatchesView.tsx`, `backend/internal/clubs/application/leagues.go`).
- **Kulüp ana sayfası:** Merhaba kartı (bekleyen işler kartın içinde), yaklaşan maç / puan durumu / son maç sayfalı kaydırılan lig kartı, yan yana ince haber düğmeleri ve Sporcular/Kadro/Turnuvalar bölümlerinin yerine Hızlı işlemler kutucukları (`mobile/src/features/clubs/ui/ClubHelloCard.tsx`, `ClubLeagueCarousel.tsx`, `ClubHomeSections.tsx`). Profil tamamlanma kartı Profili düzenle ekranına taşındı. Ürün kuralları PROJECT.md "Kulüp profili ve ana sayfası" bölümündedir.
- **TFF Ankara bağlantısı:** `00037_club_tff_link.sql` (`clubs.tff_season/league/group/team/label`). Kulüp takımını Profili düzenle > TFF Ankara ligi'nden seçer (`ClubTffLinkScreen`, futbol özelliğindeki `AnkaraTeamPicker`). Kulüp merkezi bağlı grubu önbellekli TFF Ankara puan/fikstür sayfasından okur (`backend/internal/clubs/application/tff.go`). Demo verisinde Barışspor ve Mamak Belediyespor 2026-2027 U14 Ligi 1. GRUP'a bağlıdır.

| Metot | Yol | İşlev |
|---|---|---|
| PUT | /v1/me/club-profile/tff | `{ season, league, group, team }`; takım o grubun TFF tablosunda yoksa 422, TFF sayfasına ulaşılamazsa 503; güncel kulüp profilini döner |
| DELETE | /v1/me/club-profile/tff | TFF bağlantısını kaldırır; güncel kulüp profilini döner |
| GET | /v1/me/club-center | Artık `tffLinked`, her ligde `source` ve `standings`, maçlarda `dateOnly`, `venue`, `opponentId` ve `opponentAvatarVersion` alanlarıyla |
| GET | /v1/me/coach-team | Antrenörün Takımım'ı: `{ invitations, teams: [{ clubId, clubName, avatarVersion, district, role, permissions, pendingApplications, squadCount, tffLinked, league }] }` |
| GET | /v1/me/watchlist | Doğrulanmış antrenörün İzleme listesi (keşifte görünen oyuncular, en yeni önce) |
| PUT / DELETE | /v1/me/watchlist/{playerId} | Oyuncuyu listeye ekler / çıkarır (204; en fazla 200) |
| GET | /v1/me/club-leagues | Maçlarım: `{ tffLinked, leagues: [{ ...lig özeti, matches, weeks: [{ number, matches: [{ homeName, awayName, homeGoals, awayGoals, kickoffAt, dateOnly, venue, own }] }], currentWeek }] }` |

## Güncel geliştirme durumu — 19 Ekim 2026: Popup reklamlar ve görselli demo verisi

- **Popup reklamlar:** `00036_popup_ads.sql` (`popup_ads`, `popup_ad_views`). Ürün kuralları PROJECT.md "Popup reklamlar" bölümündedir. Web panelinde yeni **Popup reklamlar** bölümü (`frontend/src/features/popups`), mobil yöneticide İçerik > Popup sekmesi, uygulamada açılış popup'ı (`mobile/src/features/content/ui/LaunchPopup.tsx`).
- **Demo verisi:** her etkin demo hesabına profil fotoğrafı veya arma, 18 görselli gönderi (sporcu ve antrenör fotoğrafları profilde de görünür), 5 galeri fotoğrafı, 5 haber kapağı ve Barışspor teknik ekibinde doğrulanmış demo antrenör. Fotoğraflar Unsplash Lisanslı stok fotoğraflardır; kaynaklar `backend/internal/demo/domain/assets/SOURCES.md`.

| Metot | Yol | İşlev |
|---|---|---|
| GET | /v1/content/popup | Bu hesap için şimdi gösterilecek popup (`{ popup: { id, imageId, format } }`) veya `{ popup: null }` |
| POST | /v1/content/popup/{id}/views | Popup gösterildi; aralık ve sınır dışındaki tekrarlar sayılmaz (204) |
| GET | /v1/admin/content/popups?page=N | Yönetici: popup listesi, gösterim ve ulaşılan hesap sayısıyla |
| POST, PUT, DELETE | /v1/admin/content/popups[/{id}] | Yönetici: `{ title, imageId, active, intervalMinutes, maxViews }`; biçim görsel boyutundan çıkarılır |

## Güncel geliştirme durumu — 19 Ekim 2026: Antrenör profili, teknik ekip ve kulüp hesabına geçiş

Ürün kuralları PROJECT.md "Antrenör profili ve kulüp teknik ekibi" bölümündedir. Teknik özet:

- **Migration:** `00035_coach_profiles_and_club_staff.sql` — `coach_profiles` (dört `show_*` görünürlük anahtarı varsayılan kapalı), `club_staff` (davet/aktif, görev, bölüm izinleri), `sessions.acting_user_id`/`acting_auth_version` (kulüp adına açılan oturum) ve `staff` bildirim türü.
- **Backend:** `internal/coaches` modülü; `POST /v1/auth/switch` ve tüm API'yi saran `auth/transport.DelegationGuard`. Geçişli oturumda yazma varsayılan kapalıdır; bölüm kuralları okuma ve yazmayı birlikte açar.
- **Antrenör kaydı:** `POST /v1/auth/register` artık `role: coach` ve `licenseLevel` kabul eder; hesap hemen açılır (doğrulanmamış) ve `coach_profiles` aynı transaction'da futbol türü ve lisansla yazılır. Mobilde Hesap oluştur'da Antrenör seçeneği vardır.
- **Mobil:** `features/coaches` (antrenör profili ve bilgileri, Kulüplerim, Teknik ekip, izin sayfası, Geçiş yap düğmesi, kulüp şeridi). Kulüp oturumu ikinci Keychain servisinde tutulur; `NavigationContainer` hesap kimliğiyle anahtarlanır.

| Metot | Yol | İşlev |
|---|---|---|
| GET/PUT | /v1/me/coach-profile | Antrenörün kendi bilgileri ve görünürlük anahtarları |
| GET | /v1/me/staff | Kulübün teknik ekibi ve sınırı (`{ staff, limit }`); yalnızca kulübün kendi oturumu |
| GET | /v1/me/staff/candidates?q= | Davet için antrenör arama (en az 2 harf) |
| POST | /v1/me/staff | `{ coachId, role, permissions }` ile davet; aynı antrenöre ikinci davet 409 |
| PUT/DELETE | /v1/me/staff/{coachId} | Görev/izin güncelleme; daveti iptal etme veya ekipten çıkarma |
| GET | /v1/me/coach-clubs | Antrenörün davetleri ve aktif kulüpleri |
| PUT | /v1/me/coach-clubs/{clubId} | `{ accept: true/false }` ile daveti yanıtlama |
| DELETE | /v1/me/coach-clubs/{clubId} | Kulüpten ayrılma |
| GET | /v1/staff/clubs/{clubId}, /v1/staff/coaches/{coachId} | Kulübün aktif teknik ekibi; antrenör kartı (kulüp ve antrenörün kendisi tamamını, diğerleri yalnızca açık grupları görür) |
| POST | /v1/auth/switch | `{ clubId }` ile kulüp adına oturum; yalnızca antrenörün kendi oturumundan ve aktif ekip kaydıyla |

## Önceki geliştirme durumu — 15 Ekim 2026: Mağaza satın alma, moderasyon, profil galerisi, push

Ürün kuralları PROJECT.md içindedir ("Mağaza içi satın alma", "Bildirme, engelleme ve hesap silme", "Oyuncu profili dilimi", "Bildirim merkezi"). Teknik özet:

- **Migration'lar:** `00027_store_purchases.sql` (paket/Pro planına `apple_product_id`/`google_product_id`, Google iade imleci), `00028_moderation.sql` (`user_blocks`, `content_reports`), `00029_player_media.sql` (`player_media`), `00030_push_devices.sql` (oturuma bağlı `push_devices`, `notifications.pushed_at`).
- **Mağaza satın alma:** `internal/payments` — `POST /v1/me/store-orders` sipariş açar ve hesap jetonunu (Apple `appAccountToken` UUID'i / Google `obfuscatedAccountId`) döner; `POST /v1/me/store-purchases` satın almayı mağaza kaydından doğrular (App Store JWS'i gömülü Apple Root CA G3'e karşı yerelde, Google Play'i Developer API ile) ve mevcut tek seferlik `ApplyEvent` akışından hakları/Pro'yu verir. `POST /v1/payments/app-store/notifications` App Store Server Notifications V2 iade/iptallerini işler; Google iadeleri saatte bir voided purchases listesinden çekilir. Mobilde `react-native-iap` 16.7.2 (`features/payments`), yarım kalan işlemler her açılışta yeniden gönderilir; ürünler tüketilebilir olarak bitirilir.
- **Moderasyon:** `internal/moderation` — `POST /v1/reports`, `GET/PUT/DELETE /v1/me/blocks[/{userId}]`, yönetici `GET /v1/admin/reports`, `POST /v1/admin/reports/{id}/resolve` (`dismiss`/`remove`/`suspend`). Engel filtresi (`moderation/data.NotBlocked`) sosyal akış/yanıtlar, keşif listesi/detayı/takip ve tanışma isteğinde uygulanır. Hesap silme `DELETE /v1/auth/account` (şifre onayı).
- **Profil galerisi:** `internal/players` — `POST /v1/players/me/media`, `DELETE /v1/players/me/media/{id}`, `GET /v1/players/{id}/media[/{mediaId}]`. Medya doğrulaması sosyal ile ortak `internal/platform/media` paketindedir. Mobilde seçici/medya kaynağı/video oynatıcı `shared` altına taşındı.
- **Push:** `PUT /v1/me/push-devices` cihaz token'ını oturuma bağlar; `notifications` dispatcher'ı 5 saniyede bir yeni bildirimleri FCM HTTP v1 ile gönderir (Google servis hesabı token'ı `internal/platform/googleauth`).

### Native kurulum (derlemeden önce)

- **iOS:** `cd mobile/ios && pod install` (react-native-iap, nitro-modules, Firebase, react-native-share ve react-native-view-shot pod'ları). Firebase için `GoogleService-Info.plist` dosyasını Xcode projesine ekle, Podfile'a `use_frameworks! :linkage => :static` ve `$RNFirebaseAsStaticFramework = true` ekle, AppDelegate'te `FirebaseApp.configure()` çağır; Signing & Capabilities'te In-App Purchase, Push Notifications ve Background Modes → Remote notifications aç. APNs anahtarını Firebase konsoluna yükle.
- **Android:** `android/app/google-services.json` ekle; `android/build.gradle` içine `com.google.gms:google-services` classpath'i, `android/app/build.gradle` içine `apply plugin: 'com.google.gms.google-services'` ekle. Play Billing için ek ayar gerekmez.
- **Mağazalar:** App Store Connect'te `com.futcareer.rights.2/5/10` (Consumable) ve `com.futcareer.pro.30days` (Non-Renewing Subscription); Play Console'da aynı kimliklerle tek seferlik ürünler oluştur (kimlikler yönetici panelinden değiştirilebilir). App Store Server Notifications V2 adresi: `https://<api>/v1/payments/app-store/notifications`.
- Firebase yapılandırılmadan uygulama çalışır; push kapalı kalır, bildirim merkezi çalışmaya devam eder.

## Önceki geliştirme durumu — 15 Ekim 2026: Pro üyelik ve profil ziyaretçileri

Ürün kuralları PROJECT.md "Pro üyelik ve profil ziyaretçileri" bölümündedir. Teknik özet:

- Migration `00026_pro_membership_and_profile_visitors.sql`: `profile_views` tablosuna `last_viewed_at` ve `private` sütunları (eski satırlarda gün başlangıcı), tek satırlık `pro_plans` (30 gün, +3 hak, 4900 kuruş, TRY), `pro_memberships` (kullanıcı başına bitiş ve gizli gezinme), `pro_periods` (ödeme veya yönetici dönemi; `payment_id` UNIQUE) ve `team_request_payments.product` (`team_rights` | `pro`, Pro siparişinde `package_credits=0`, `pro_plan_id`).
- Backend `internal/pro` (durum, gizli gezinme, yönetici ver/kaldır, transaction içi `ActivateInTx`/`RefundInTx`); ziyaretçi sıralaması ve ücretsiz/Pro yanıt projeksiyonu `internal/discovery` (domain `RankVisitors`, application `BuildVisitors`). Pro planı ve siparişleri `internal/payments` içindedir; webhook ödeme `paid` olduğunda Pro dönemini aynı transaction'da açar, `refunded` olduğunda dönemi kısaltır.
- Adapter'ın checkout isteğine `product` alanı eklendi (`team_rights` veya `pro`); Pro siparişinde `credits` 0'dır. Webhook gövdesi değişmedi.
- Mobil `src/features/pro` (Pro'ya geç, Ziyaretçiler, Ayarlar'daki gizli gezinme anahtarı), ortak `shared/ui/ProBadge`, Takımlar başlığında `RightsBadge` (TopBar `accessory`). Mobil ve web yönetici ödeme ekranlarında Pro planı fiyat/satış yönetimi ve hesap düzenleyicide Pro ver/kaldır bulunur.

## Güncel geliştirme durumu — 14 Ekim 2026: Oyunlar

Kullanıcı kararıyla oyunların görünen adları değişti: Futbolcuyu Bul artık **Arma İzi**, Penaltı Atışı artık **Beyaz Nokta**. İç tanımlar ve API yolları (football-guess, penalty) aynı kaldı. Oyunlar ekranı üç oyun kartından oluşur; her kartta çizilmiş küçük bir sahne, ad ve tek satırlık slogan bulunur. Kurallar karttaki "?" düğmesiyle açılan kısa sayfada ve ekran okuyucu ipucundadır.

Kullanıcı kararıyla (14 Ekim 2026) Arma İzi havuzu büyütüldü ve döngüsel tekrar kaldırıldı. Katalog Wikidata'dan (CC0) çevrimdışı üretilir: 819 futbolcu (185 kolay, 242 orta, 392 zor), 778 kulüp, bunlardan 427'sinin 128 px ESPN arması API'ye gömülüdür; 183 soruda Galatasaray, Fenerbahçe, Beşiktaş veya Trabzonspor durağı vardır. Şıklar oyun başında aynı zorluktan, benzer yaş/mevki öncelikli seçilir. `00025_football_guess_history.sql` ile eklenen football_guess_seen tablosu kullanıcının gördüğü futbolcuları ve zamanını tutar; yeni oyun önce görülmemiş, sonra en eski görülmüş futbolcuları seçer ve geçmiş oyun oluşturma transaction'ında yazılır. Soru yükündeki her kulüp `{ id, name, hasCrest }` içerir; arması olmayan kulüp mobilde baş harfli kalkan rozetiyle gösterilir. Mevcut API'yi güncellemeden önce `go run ./cmd/migrate up` çalıştırılmalıdır.

Üçüncü oyun **Kafa Kafaya**: altı büyük ligden (Süper Lig, Premier League, La Liga, Serie A, Bundesliga, Ligue 1) her turda rastgele biri seçilir, aynı ligden iki gerçek kulüp ve tek bir soru gösterilir (puan, atılan gol, yenen gol, sıra, galibiyet veya averaj; yenen gol ve sırada küçük olan kazanır). Değerleri eşit olan çiftler sorulmaz ve bir seride aynı çift tekrarlanmaz. Doğru seçim seriyi bir artırır ve yeni tur getirir; yanlış seçim oyunu bitirir ve iki kulübün gerçek değerlerini gösterir. 17 Ekim 2026'dan itibaren her yeni seri Kafa Kafaya'nın günlük haklarından birini kullanır ve her doğru tahmin global ratingde 1 puandır; kullanıcı başına en iyi seri ve oynama sayısı tutulur. Turlar sunucunun 10 dakikalık ESPN puan durumu önbelleğinden üretilir; kaynak alınamazsa API 502 `upstream_unavailable` döner ve uygulama yeniden deneme durumu gösterir.

| Yöntem / adres | İşlem |
|---|---|
| GET /v1/games/head-to-head | `{ best, plays }` |
| POST /v1/games/head-to-head/runs | Yeni seri ve ilk tur; gövde boş. İlk tur yanıtlanmadan tekrarlanan istek aynı seriyi döndürür |
| POST /v1/games/head-to-head/runs/{id}/answers | `{ "roundId", "pick": "left" \| "right" }` → `{ roundId, pick, correct, values: { left, right }, streak, best, gameOver, nextRound }` |

Tur yükü `{ id, league: { name, logoUrl }, question: { metric, label }, left: { name, logoUrl }, right: { name, logoUrl } }` biçimindedir; değerler ve kazanan taraf yanıt kaydedilmeden istemciye gönderilmez. Seri durumu `00024_head_to_head.sql` ile eklenen head_to_head_runs tablosunda tutulur; yanıtlar diğer oyunlarla aynı hesap satırı kilidi ve transaction içinde işlenir, aynı yanıtın tekrarı aynı sonucu döndürür, farklı seçim 409 alır. Mevcut API'yi güncellemeden önce `go run ./cmd/migrate up` çalıştırılmalıdır.

### Avrupa kupaları ve TFF Ankara seçimleri — 14 Ekim 2026

Ligler ekranında "Büyük ligler" ile TFF Ankara kartı arasına **Avrupa kupaları** bölümü eklendi: Şampiyonlar Ligi, Avrupa Ligi ve Konferans Ligi (ESPN kodları uefa.champions, uefa.europa, uefa.europa.conf), aynı aydınlatılmış rozetli kartlarla, satır başına üç. `GET /v1/football/competitions` yanıtına ayrı bir `cups` dizisi eklendi; `competitions` altı yurt içi ligi taşımaya devam eder (eski uygulama sürümleri bozulmaz, Kafa Kafaya yalnızca bu altı ligi kullanır). Standings/live/results/stats uç noktaları kupa slug'larını (champions-league, europa-league, conference-league) kabul eder. Kupa puan durumu 36 takımlı lig aşamasıdır; "Qualifies for round of 16", "Knockout phase playoffs - seeded/unseeded" ve "Eliminated" notları uygulamada "Son 16'ya kalır", "Play-off turu" ve "Elendi" olarak gösterilir. Kupa takviminde maç günleri yerine tarihli turlar bulunduğundan ve ESPN tarih aralığı sorgusunu reddettiğinden, son sonuçlar bu ay ile önceki ayın scoreboard'undan (`?dates=YYYYMM&limit=200`, takvim turlarıyla örtüşen aylar) okunur; içinde bulunulan ay 30 saniye, önceki ay 10 dakika önbelleğe alınır. Konferans Ligi için ESPN istatistik vermediğinde mevcut boş durum gösterilir.

TFF Ankara Puan durumu sekmesindeki çip satırları sırayla seçilen üç açılır alanla değiştirildi: 1 Sezon, 2 Lig, 3 Grup. Liste alanın altında açılır (en fazla 320 px, kaydırılabilir), seçili öğe onay simgesi ve marka rengiyle işaretlenir; lig listesi Amatör/Altyapı/Kız/Play-off/Diğer başlıklarıyla gruplanır. Önceki adımı seçilmemiş alan kilitli görünür; sezon değişince lig ve grup, lig değişince grup temizlenir; yalnızca "Grup yok" varsa grup alanı gizlenir. Seçili sezonda beşten az lig varsa sezon alanının yanında küçük "Önceki" düğmesi bulunur.

## Önceki geliştirme durumu — 12 Ekim 2026

Sosyal üst menüsünde Keşfet, Takip ettiklerin ve Oyunlar bulunur. Arma İzi (eski adıyla Futbolcuyu Bul), 20 futbolculuk havuzdan rastgele 4 kolay, 3 orta ve 3 zor soru seçer; her soruda kronolojik takım armaları ve rastgele sıralanmış dört şık gösterir. Kariyer ve arma kaynakları [oyun kaynakları](backend/internal/games/catalog/SOURCES.md) dosyasında tutulur. Armalar API binary'sine gömülüdür; çalışma sırasında dış CDN gerekmez. En az 7 doğruyla bitiren sporcuya 1 takım başvurusu hakkı verilir. Kulüp/antrenör hesapları oynayıp istatistik biriktirebilir; sporcu başvuru hakkı kazanmaz.

17 Ekim 2026'dan itibaren kalp yoktur: her oyunun Türkiye saatiyle gece yarısı yenilenen günlük 5 başlatma hakkı vardır (`00031_global_rating.sql`, `game_daily_plays`). Yarım oyuna devam hak harcamaz. Oyunlar başvuru hakkı vermez; doğru cevap, gol ve doğru tahmin global rating sezonuna 1 puan yazar (bkz. PROJECT.md › Global rating). Sunucu saatiyle geri sayım, bağlantı sonrası aynı seçimi yeniden gönderme, kaydedilen ilerlemeyi yükleme, doğru/yanlış geri bildirimi ve sonuç ekranı bağlıdır. Soru, puan, kalp ve ödül PostgreSQL transaction'ında doğrulanır; yalnızca mevcut soru gönderilir. Bir oyun için ödül yalnızca bir kez kaydedilir. Kazanılan haklar başvuru kotasında satın alınan haklardan ayrı görünür ve kullanılabilir toplamına katılır.

Oyun API'si aktif mobil Bearer oturumu ister:

| Yöntem / adres | İşlem |
|---|---|
| GET /v1/games/football-guess | Günlük haklar, sezon puanı, sayaçlar ve son/kayıtlı oyun |
| GET /v1/rating | Görünen sezon, sıralama (ilk 50), hesabın sırası ve görevler |
| POST /v1/rating/tasks/{kind}/claim | Tamamlanan görevin puanını sezonda bir kez alır |
| POST /v1/games/football-guess/runs | Yeni oyun veya mevcut oyuna devam; gövde boş |
| POST /v1/games/football-guess/runs/{id}/answers | Mevcut soruya `{ "questionId", "optionId" }` yanıtı |
| GET /v1/games/logos/{id} | Gömülü PNG arma; herkese açık, yalnızca bilinen dosyalar |

`00015_football_games.sql` kalpleri, oyun ilerlemesini ve tekil ödül kayıtlarını ekler. Mevcut API'yi güncellemeden önce backend/ içinde DATABASE_URL tanımlı olarak `go run ./cmd/migrate up` çalıştırılmalıdır. Bu görevde kullanıcının mevcut veritabanları değiştirilmedi; kontrol için ayrı geçici PostgreSQL sunucusu kullanıldı.

## Önceki geliştirme durumu — 11 Ekim 2026

Sosyal ekranın üstünde Keşfet ve Takip ettiklerin sekmeleri, sağ altta tabbar üzerinde dairesel + butonu bulunur. Sosyal başlığı ve akış içinde açık paylaşım formu kaldırıldı. Keşfet tüm aktif mobil hesapların gönderilerini, takip sekmesi mevcut profile_follows ile takip edilenlerin gönderilerini en yeni önce gösterir. Sosyal kartlardan aktif mobil hesapları takip et/bırak işlemi aynı gerçek takip sayaçlarını günceller; kendini takip ve yetkisiz profil/özel iletişim erişimi engellenir.

+ ayrı Yeni gönderi ekranını açar: 500 karaktere kadar metin, tek JPEG/PNG görsel (4 MiB/16 milyon piksel) veya tek MP4 video (30 MiB) ve isteğe bağlı metin yayınlanabilir. Önizleme/değiştirme/kaldırma, yayın sırasında kilitleme ve hata halinde taslağı koruma bağlıdır. Gönderi ve medya aynı PostgreSQL transaction'ında saklanır; sahibi silince medya da silinir. Görsel metadata'sı yeniden kodlama ile çıkarılır; MP4 kutu yapısı, video izi ve medya verisi doğrulanır, video transcoding yapılmaz. Oynatma kullanıcı isteğiyle başlar; desteklenmeyen video codec'i hata gösterir. Medya API'si mobil Bearer oturumu ve aktif yazar kontrolü ister; native Range, tarayıcı bellek blob URL'si kullanır. Dosya seçimi ve oynatma dar native/.web adaptörlerindedir. Dış medya sağlayıcısı seçilmedi; kişisel profil galerisi yüklemesi bu kapsama dahil değildir.

Beğeni, metin yanıt, sahibinin silmesi, cursor sayfalama ve yenileme korunur. Kartlarda yalnızca ad/rol/doğrulama/takip durumu görünür; özel hesap bilgisi veya yetkisiz profil bağlantısı yoktur. API metinleri 500 karakterle sınırlar, gönderiler arasında 5 saniye ve yanıtlar arasında 3 saniye beklemeyi aynı transaction içindeki kalıcı sayaçla uygular; silme hız sınırını sıfırlamaz. Boş akışa örnek içerik eklenmez.

Alt gezinme Ana Sayfa, Ligler, merkez düğmesi, Bildirimler ve Diğer sırasındadır (19 Ekim 2026). Ehekim merkez butonundan esinlenen 66 piksel çapındaki merkez düğmesi ("Saha") boştayken futbol topunu gösterir; topa dokununca yukarı doğru Sosyal, Profil, Takımlar ve Oyunlar seçenekleri açılır; seçilen sayfa açıkken düğmede o sayfanın çizimi (3B konuşma balonu, 3B oyuncu büstü, stadyum, oyun kolu) büyük görünür ve bir kez kendine özgü hareketini yapar, başka sekmeye geçince düğme topa döner (çizimler src/app/HubArt.tsx; Sosyal ve Profil görselleri `python scripts/hub-art.py` ile numpy ve Pillow kullanılarak mobile/assets/hub altına render edilir). Organizasyon hesabında merkezde yalnızca Takımlar vardır. Diğer'in en üstündeki profil kartı Profil sayfasını açar. Haberler ve Ayarlar Diğer menüsündedir; Keşfet ve İstekler Sosyal başlığındadır. Bildirimler takım başvurusu ve ödeme durumlarını gösterir; okunmamış sayısı sekme rozetinde görünür ve kayıtlar tek tek veya topluca okundu işaretlenebilir. Oyuncular Diğer içindeki Takım başvurularım alanından kalan haklarını ve kulüp yanıtlarını izler; kulüp hesapları Takım başvuruları alanından gelen istekleri yönetir. Ana sayfadaki profil kısayolu aynı profile gider. Keşif, profil düzenleme ve geri dönüşler korunur. Ligler yönetici tarafından oluşturulan yayınlanmış ligleri, puan durumunu, fikstürü ve maç istatistiklerini gösterir. Takımlar sekmesi tüm etkin kulüp hesaplarını rehberde listeler; takım ayrıntısı saha ve antrenman bilgilerini sunar.

Ana sayfa tek kişisel kart (karşılama ve kendi sayaçları), reklam kaydırıcısı ve haberler alanını sunar. Görüntülemeler yetkili keşif detayları açıldığında kaydedilir; aynı görüntüleyenin aynı profile UTC günü içinde tekrar girişi tek sayılır. Takipçi/takip edilen sayaçları gerçek takip kayıtlarından, aktif hesaplar için hesaplanır. Keşif detayındaki takip düğmesi mevcut rol, görünürlük ve doğrulama kurallarını aşmaz; özel iletişim açmaz. Sayaçlar yalnızca oturum sahibine döndürülür.

Takımlar sayfası (merkez düğmesi → Takımlar) etkin kulüp hesaplarının tümünü ad/ilçe araması ve sayfalama ile listeler. Ayrıntılar takım tanıtımını, maç sahası adresini, antrenman sahası adresini ve antrenman programını gösterir. Yönetici bu bilgileri /securityadmin/clubs içindeki kulüp düzenleyicisinden kaydeder. Oyuncular üç ücretsiz katılma başvurusu alır; ek hakları 2 hak/100 TL, 5 hak/200 TL ve 10 hak/300 TL paketleriyle satın alabilir. Başvuru beklerken, kabul veya ret sonrasında hak kullanılmış kalır ve aynı takıma tekrar başvuru yapılamaz. Oyuncu Diğer → Takım başvurularım yolundan kullanım sayısını, kalan hakkı, takım/ilçe bilgisini, gönderim tarihini ve yanıtı görür. Kulüpler Diğer → Takım başvuruları yolundan bekleyen başvuruları kabul veya reddeder. Başvuru ekranı oyuncunun adını gösterir; e-posta ve giriş kullanıcı adı paylaşılmaz. Bu istekler tanışma bağlantılarından ayrıdır.

Sporcu Diğer menüsündeki Hak satın al alanından güncel paketleri görür. Sipariş ve ödeme teyidi sunucu üzerinden yürür; istemcinin geri dönüşü tek başına hak tanımlamaz. Belirli bir ödeme sağlayıcısı seçilmediği için gerçek tahsilat, `PAYMENT_ADAPTER_URL` ile tanımlanan güvenilir HTTPS adapter'ına devredilir. Adapter yanıtındaki checkout URL de HTTPS olmalıdır. Checkout açılmadan önce adapter isteği ham gövde üzerinde HMAC-SHA256 ile imzalanır (`X-FutCareer-Signature`, hex); adapter ve API aynı en az 32 baytlık `PAYMENT_ADAPTER_SECRET` değerini kullanır. API'ye gelen ödeme bildirimi de aynı başlıkla imzalanır ve `{ "eventId", "orderId", "provider", "providerPaymentId", "status" }` alanlarını taşır. `status` yalnızca `paid`, `failed` veya `refunded` olabilir. Tekrarlanan event kimlikleri güvenli biçimde yok sayılır; haklar `paid` ile verilir, iade (`refunded`) satın alınmış hak bakiyesini azaltır. Adapter ayarları yoksa katalog görünür kalır, satın alma başlatılmaz.

Web panelinde Reklamlar ve Haberler bölümleri eklendi. Reklamlarda görsel, başlık, sıra ve yayın tercihi; haberlerde başlık, özet, düz metin, isteğe bağlı kapak görseli, yayın tercihi ve “Ana sayfada göster” ayrı yönetilir. Ana sayfa seçilen yayındaki en yeni üç haberi gösterir; buradaki haber kartı veya başlık Haberler sayfasına açılır. Haberler listesinde tüm yayındaki haberler 20 kayıtlık sayfalarla gösterilir; listeden haberin tam metni açılır. Reklamlar sıra önceliğine göre ilk 20 aktif kayıttan oluşur ve tüm mobil hesap türlerine ortak gösterilir. Birden fazla görsel beş saniyede bir kayar; elle kaydırma/düğmeler ve azaltılmış hareket desteği vardır.

00007_home_content_and_profile_insights.sql içerik, görsel, takip ve görüntüleme tablolarını; 00008_leagues.sql lig, mevcut kulüp hesabı bağlantısı ve maç tablolarını; 00009_teams_and_join_requests.sql takım rehberi ve başvuru tablolarını; 00010_team_request_payments.sql hak paketleri, ödeme kayıtları ve webhook tekrar korumasını; 00011_notifications.sql uygulama içi bildirimleri; 00012_social_feed.sql sosyal gönderi, beğeni, yanıt ve yazma hız sınırı tablolarını; 00013_social_media.sql gönderiye bağlı görsel/video verisini ve medya/metin bütünlük kısıtlarını ekler. Migration dosyaları kaynakta hazırdır; yeni API'den önce DATABASE_URL tanımlı olarak backend klasöründe `go run ./cmd/migrate up` çalıştırılmalıdır.

Yönetici içerik görselleri mevcut PostgreSQL içinde saklanır; yeni depolama sağlayıcısı eklenmedi. Yükleme JPEG/PNG, en fazla 4 MiB, 16 milyon piksel ve kenar başına 8192 piksel kabul eder. Sunucu görseli tam çözümler ve yeniden kodlayarak metadata'yı çıkarır. Yayındaki reklama veya habere bağlı görseller herkese açık varlıklardır; taslak ve henüz kullanılmayan görseller yalnızca yönetici cookie oturumuyla açılır. Yayından kaldırılan içeriğin görsel erişimi sonraki istekte kapanır; ortak görsel başka yayında kullanılıyorsa açık kalır. Kullanılmayan yüklemeler saklanır, otomatik temizleme henüz yoktur. Sporcu fotoğraf/video yüklemesi bu içerik modülünden ayrıdır ve henüz bağlı değildir.

## Sporcu profili ve keşif geliştirmesi — 10 Ekim 2026

Sporcu profili Instagram benzeri başlık ve galeri düzenine geçti. Üstte profil fotoğrafı alanı, ad, mevki, baskın ayak, deneyim, uygunluk ve kulüp beyanı; altta önce Fotoğraflar, sonra Videolar sekmesi bulunur. Küçük resimler satır başına üç kare olarak dizilir. Kendi profilindeki düzenle butonu mevcut futbol bilgileri formunu açar; geri dönüldüğünde kayıtlı veriler yeniden yüklenir. Özel hesap bilgileri ve çıkış sağ üstteki hesap ayarlarından açılır. Keşifteki sporcu detayı aynı profil sunumunu kullanır, düzenleme ve özel hesap bilgilerini göstermez. Medya yükleme/depolama henüz bağlı değildir; fotoğraf yerine baş harfler, galeride boş durumlar gösterilir. Bu değişiklik medya sağlayıcısı seçmez ve yeni API/migration gerektirmez.

Keşif kabuğu gerçek Go/PostgreSQL sorgularına bağlandı. Mobil ekran isim araması, oyuncular için mevki/baskın ayak/uygunluk filtreleri, 20 kayıtlık sayfalar ve profil detayı sunar. Liste ve detay aynı aktiflik, Ankara pilotu, görünürlük ve doğrulama kurallarını uygular. Oyuncunun mevcut kulübü oyuncu beyanı olarak belirtilir; keşif API'si e-posta, giriş kullanıcı adı, şifre, token veya varsayılan şehir döndürmez. Uygunluk görünürlükten bağımsızdır; görüşmüyor olan oyuncu görünürlüğünü açmışsa keşifte bulunabilir.

Yönetici panelinin hesap düzenleme ekranında kulüp ve antrenör kimliği için doğrulama kontrolü, listede ayrı doğrulama sütunu bulunur. Hesap oluşturmak doğrulama sağlamaz. Yeni 00006_verification_and_discovery.sql migration'ı mevcut hesapları doğrulanmamış olarak başlatır; yeni alanın yalnızca kulüp/antrenörlerde açılmasını veritabanında da zorunlu tutar. Doğrulama kaldırıldığında mevcut mobil oturumla yapılan sonraki keşif isteği 403 döner; hesap ayrıca sporcu keşfinden çıkar. Gizlenen veya erişimi kapatılan profil doğrudan detay adresinde de bulunamaz. Migration geri alımı doğrulama verisini kaldırır.

Mevcut veritabanında yeni API'den önce backend klasöründe `go run ./cmd/migrate up` çalıştırılmalıdır. Bu görevde kullanıcının mevcut veritabanları değiştirilmedi; tüm veritabanı ve tarayıcı kontrolleri ayrı geçici PostgreSQL sunucusundaki test verisiyle yapıldı. Sonraki işler medya depolama kararı ve tanışma istekleridir.

## Önceki geliştirme durumu — 8 Ekim 2026

Oyuncu profili ve PostgreSQL geçişinden sonra yönetici hesap yönetimi ayrı web paneline taşındı. Yönetici yalnızca /securityadmin web girişinden oturum açar. Sporcu, kulüp ve antrenör mobil uygulamayı kullanır; mobilde yönetici ekranı yoktur. Kulüp kullanıcı adı/şifresini yönetici belirler; sporcular kendi kayıt olur. Yöneticiye ait API yollarında rol ve oturum kullanım alanı her istekte sunucuda doğrulanır. Sonraki işler kulüp/antrenör doğrulama akışı, medya depolama kararı, gerçek keşif sorgusu ve tanışma istekleridir.

## Backend'i başlat

Go 1.26 veya üstü ve PostgreSQL gerekir. Yerel PostgreSQL 18 için Docker Desktop açıkken proje kökünden:

    docker compose up -d --wait postgres
    $env:DATABASE_URL = 'postgres://futcareer:futcareer_local@localhost:5432/futcareer?sslmode=disable'
    cd backend
    go mod download
    go run ./cmd/migrate up
    go run ./cmd/api

Yukarıdaki ortam değişkeni satırı PowerShell içindir. Başka bir PostgreSQL sunucusu kullanıyorsan DATABASE_URL değerini o sunucunun bağlantı bilgileriyle ayarla. Yerel Compose servisi yalnızca 127.0.0.1:5432 adresine açılır; örnek parolası yerel geliştirme içindir. Veriler kalıcı Docker volume'unda saklanır.

PostgreSQL zaten çalışıyorsa backend klasöründe DATABASE_URL tanımlandıktan sonra:

    go run ./cmd/migrate up
    go run ./cmd/api

API varsayılan olarak 8080 portunda çalışır. Örnek ayarlar backend/.env.example içindedir; uygulama işletim sistemi ortam değişkenlerini okur, .env dosyasını otomatik yüklemez. PostgreSQL bağlantısı veya şema sürümü hazır değilse API başlangıcı açıklayıcı hatayla durur.

| Değişken | Varsayılan |
|---|---|
| LISTEN_ADDR | :8080 |
| DATABASE_URL | Zorunlu PostgreSQL bağlantı adresi |
| SESSION_TTL | 720h |
| ADMIN_ORIGIN | http://localhost:5175; yazma istekleri bu origin ile eşleşir |
| ADMIN_FRONTEND_DIR | Boş; ayarlanırsa derlenen web paneli Go tarafından sunulur |
| PAYMENT_ADAPTER_URL | Boş; HTTPS sağlayıcı adapter'ı checkout adresi |
| PAYMENT_ADAPTER_SECRET | Boş; adapter istekleri ve webhook için ortak en az 32 baytlık HMAC anahtarı |
| APPLE_BUNDLE_ID | Boş; ayarlanırsa App Store satın almaları doğrulanır (iOS bundle id) |
| GOOGLE_PLAY_PACKAGE_NAME | Boş; Android uygulama kimliği, aşağıdaki dosyayla birlikte |
| GOOGLE_PLAY_SERVICE_ACCOUNT_FILE | Boş; Play Console'da "finansal verileri görüntüleme" izni olan servis hesabı JSON dosyası |
| FIREBASE_SERVICE_ACCOUNT_FILE | Boş; ayarlanırsa yeni bildirimler FCM ile push olarak gönderilir |

### Arma İzi kataloğunu yeniden üret

Arma İzi havuzu (backend/internal/games/catalog/questions.json, clubs.json ve assets/) çevrimdışı üretilir; API bu dosyaları binary'ye gömer ve çalışırken Wikidata veya ESPN'e bağlanmaz. Kaynaklar ve seçim kuralları [SOURCES.md](backend/internal/games/catalog/SOURCES.md) dosyasındadır. Backend klasöründen:

    go run ./cmd/gamecatalog -cache /tmp/gamecatalog-cache

Komut Wikidata SPARQL uç noktasına açıklayıcı User-Agent ile, sorgu başına 1 saniye arayla ve hata/429 durumunda yeniden denemeyle gider; ESPN geçmiş puan durumlarını ve 128 px armaları indirir. İlk çalıştırma yaklaşık 15 dakika sürer; `-cache` ile ham yanıtlar saklanır, eşikleri değiştirip yeniden çalıştırmak ağa çıkmaz. Aynı Wikidata yanıtları aynı çıktıyı üretir (her şey sıralanır). Mevcut clubs.json okunur; eski kulüp kimlikleri ve armaları kayıtlı oyunlar için korunur. Çıktı yazıldıktan sonra katalog doğrulaması çalışır ve her zorluktan rastgele örnek sorular (`-sample 15`, `-seed`) yazdırılır; bunlarla milli takım, altyapı takımı, sıra veya ad hatası olup olmadığı kontrol edilmelidir. Eşikler `-easy`, `-medium`, `-hard`, `-superlig-bonus`, `-min-links`, `-min-links-superlig` bayraklarıyla ayarlanır. Ardından `go test ./internal/games/...` çalıştırılmalıdır.

### Migration düzeni

backend/migrations altında sıralı SQL dosyaları bulunur: 00001_create_auth.sql hesap ve oturumları, 00002_create_player_profiles.sql oyuncu profillerini, 00003_create_admin_and_clubs.sql yönetici/kulüp bilgilerini, 00004_separate_admin_sessions.sql web ve mobil oturum kullanım alanlarını oluşturur. 00004 eski yönetici bearer oturumlarını iptal eder; mevcut mobil kullanıcı oturumları korunur. 00005 yaş onayını kaldırır; 00006 kulüp/antrenör doğrulamasını ve keşif indekslerini; 00007 içerik, görsel, takip ve görüntüleme tablolarını; 00008 ligleri, mevcut kulüp hesaplarının lig üyeliğini ve maçları; 00009 takım rehberi ve başvuruları; 00010 hak paketleri ve ödeme kayıtlarını; 00011 takım başvurusu ve ödeme bildirimlerini; 00012 sosyal akış tablolarını; 00013 gönderi medyasını; 00014 futbol türü/lisans ve keşif tercihlerini; 00015 oyun kalbi, ilerleme ve başvuru ödüllerini; sonraki dosyalar penaltı maçlarını, hediyeleri, bildirim merkezini, kulüp profilini, tanışma isteklerini, kadro/ilanları, turnuvaları ve hesap başvurularını; 00024 Kafa Kafaya serilerini; 00025 Arma İzi'nde kullanıcının gördüğü futbolcu geçmişini (football_guess_seen) ekler. Her dosyada Goose Up ve Down bölümleri vardır. SQL dosyaları binary'ye gömülür; çalışma dizinine bağlı değildir.

Backend klasöründen:

    go run ./cmd/migrate status
    go run ./cmd/migrate up

up bekleyen migration'ları uygular ve yeniden çalıştırıldığında uygulanmış dosyaları atlar. PostgreSQL advisory lock aynı anda iki migration işleminin çakışmasını önler. API açılışında yalnızca şema sürümü kontrol edilir; tablo oluşturma repository'lerin sorumluluğu değildir.

    go run ./cmd/migrate down

down en son migration'ı geri alır. Başlangıç migration'larının Down bölümleri ilgili tabloları ve içlerindeki veriyi kaldırır. 00003 geri alımı; yönetici hesabı, kullanıcı adı kullanan hesap, e-postası olmayan hesap veya erişimi kapalı kullanıcı varsa reddedilir. Bu koruma giriş bilgilerini kaybetmeyi ve kapalı hesapları yanlışlıkla açmayı önler; önce bu hesapların verisi için uygun bir geçiş planlanmalıdır.

00004 geri alımı da web yönetici oturumlarını iptal eder; onları mobil bearer oturumlarına dönüştürmez.

Yeni şema değişikliğini bir sonraki sıralı dosyaya ekle (örneğin 00016_...). Uygulanmış migration dosyasını düzenleme. Geçiş PostgreSQL şemasını kurar; eski SQLite dosyalarından otomatik veri aktarımı yapmaz. Bu görev sırasında depoda aktarılacak SQLite veri dosyası bulunmadı.

Sürücü [pgx](https://pkg.go.dev/github.com/jackc/pgx/v5/stdlib), migration sağlayıcısı [Goose](https://pkg.go.dev/github.com/pressly/goose/v3) kullanılır. Goose'un kendi test bağımlılığı nedeniyle go.mod içinde SQLite dolaylı bağımlılığı görünebilir; uygulama ve proje testleri PostgreSQL kullanır.

### Demo verisi (isteğe bağlı) — 15 Ekim 2026

Kullanıcı kararıyla demo/test ortamı için kurgusal veri hazırlandı. Karar: demo verisi **migration değildir**, çünkü migration her ortama kalıcı olarak giderdi. Ayrı ve idempotent `cmd/seed` komutuyla kurulur ve kaldırılır (sunucuda `docker compose exec -T api /app/seed demo`; bkz. [deploy/README.md](deploy/README.md)). Backend klasöründen:

    go run ./cmd/seed demo                              # kur; önceki demo verisini silip yeniden oluşturur
    go run ./cmd/seed demo --follow-email sen@ornek.com # ayrıca mevcut bir hesabı demo etkileşimine kat
    go run ./cmd/seed demo --status                     # demo kayıt sayıları
    go run ./cmd/seed demo --remove                     # tüm demo verisini sil

- Kurulum tek transaction içinde önce eski demo verisini siler, sonra yeniden kurar; iki kez çalıştırmak çoğaltmaz. Kimlikler sabit anahtarlardan türetilir, zamanlar çalıştırma anına göre geçmişe yayılır; rastgele olan tek şey şifredir.
- Her çalıştırma crypto/rand ile tek bir şifre üretir, mevcut `auth.PasswordHash` ile hash'ler ve tüm demo hesaplarına verir. Şifre ve giriş listesi yalnızca stdout'a yazılır (dosyaya yazılmaz); sayılar stderr'dedir.
- Tanıma kuralı: sporcular `@demo.futcareer.test` e-postası; kulüp ve organizasyonlar `demo.` ile başlayan kullanıcı adı **ve** aynı alan adındaki e-posta. Ayrılmış .test alan adı gerçek bir girişle karışmaz. Ligin sahibi olmadığından demo ligi sabit kimliğiyle silinir.
- İçerik (tamamı Türkçe ve kurgusal kişiler; kulüp adları kullanıcının isteğiyle TFF Ankara amatör kulüp adları, yetkili/saha/adres/telefon bilgileri uydurmadır ve telefonlar atanmamış 000 bloğundadır): tam profilli 10 etkin ve doğrulanmış kulüp (6 amatör, 2 profesyonel, 2 halı saha), yönetici kuyruğunda 3 kulüp + 1 organizasyon bekleyen ve 1 gerekçesiyle reddedilmiş başvuru, açık turnuvası olan 1 doğrulanmış organizasyon, 18 tam profilli sporcu (15'i keşifte görünür), 49 gönderi (son üç haftaya yayılmış; 5'i kulüplerden), 149 beğeni, 14 yanıt, 127 takip (her sporcu 3–8 hesap; kulüpler de birkaç sporcuyu takip eder), 61 profil görüntüleme, 3 açık kulüp ilanı, 13 takım başvurusu (6 bekleyen, 4 kabul → kadro, 3 ret), 5 tanışma isteği, 4 yayında + 1 onay bekleyen kulüp haberi, 6 kulüplü "Ankara Demo Ligi 2026-27" (çift devre 10 hafta, 30 maç; geçmiş 4 hafta skorlu, kalan 18 maç planlı), 8 takım kapasiteli açık "Ankara Demo Kış Kupası" (1 kabul edilmiş, 1 bekleyen kulüp başvurusu) ve 59 bildirim.
- Doğum yılı şemada olmadığından 1995–2008 doğum yılları yalnızca deneyim yılını hesaplamak ve bazı gönderi metinlerinde kullanılır.
- `--remove` ve yeniden kurulum, gerçek hesapların demo içerikle etkileşimlerini de siler (takip, beğeni, tanışma isteği, bildirim). Gerçek bir sporcunun demo kulübe yaptığı takım başvurusu da silinir; hak sahte bir takıma harcandığı için geri döner (yönetici panelinden kulüp silmede başvuru korunur, bu bilinçli bir farktır).
- Kod: `backend/cmd/seed`, `backend/internal/demo` (domain: sabit veri seti, application: şifre ve doğrulama, data: PostgreSQL kurulum/kaldırma).
- Görseller ve antrenör (19 Ekim 2026): etkin her demo hesabının profil fotoğrafı (kişiler) veya arması (kulüp, organizasyon) vardır; 18 gönderi görsellidir, Emre, Zeynep, Tolga ve Elif'in galerisinde fotoğraf, 5 haberin kapağı vardır. Doğrulanmış demo antrenör `selim.kara@demo.futcareer.test`, Barışspor teknik ekibinde baş antrenördür (Başvurular, Kadro, İlanlar, Haberler, Sosyal paylaşım izinleri); "Geçiş yap" bu hesapla denenebilir. Fotoğraflar Unsplash Lisanslı stok fotoğraflardır (`backend/internal/demo/domain/assets/SOURCES.md`); fotoğraftaki kişilerin kurgusal adlarla ilgisi yoktur. Görseller seed ikilisine gömülüdür (~2,9 MB).

## Web yönetici paneli

### İlk yönetici hesabı

Önce DATABASE_URL tanımlı olarak backend klasöründe migration'ları uygula:

    go run ./cmd/migrate up

Ardından kendi bilgilerinle ilk yöneticiyi oluştur. PowerShell örneği şifreyi gizli olarak ister:

    $env:ADMIN_FULL_NAME = Read-Host 'Yönetici adı soyadı'
    $env:ADMIN_USERNAME = Read-Host 'Yönetici kullanıcı adı'
    $adminSecret = Read-Host 'Yönetici şifresi (en az 10 karakter)' -AsSecureString
    $env:ADMIN_PASSWORD = [System.Net.NetworkCredential]::new('', $adminSecret).Password
    try { go run ./cmd/admin } finally { Remove-Item Env:ADMIN_PASSWORD }
    $adminSecret = $null

Bu komut yalnızca yönetici bulunmayan veritabanında çalışır; mevcut yönetici şifresini değiştirmez. Varsayılan kullanıcı adı veya şifre yoktur. Şifre komut satırı argümanı olarak verilmez ve çıktıda yazdırılmaz. Yönetici paneli yönetici hesaplarını düzenlemeye, durdurmaya veya silmeye izin vermez.

Go API ve frontend uygulamasını başlatıp /securityadmin adresinden oluşturduğun kullanıcı adı ve şifreyle giriş yap. Yönetici kullanıcı/kulüp paneline yönlendirilir; menüdeki çıkış işlemi sunucu oturumunu da iptal eder. Diğer hesap türleri bu girişten kabul edilmez; yönetici de mobil girişten kabul edilmez.

Kullanıcılar ve Kulüpler sekmelerinde arama, toplam kayıt ve önceki/sonraki sayfa kontrolleri bulunur. Her sayfada en fazla 20 kayıt yüklenir. Düzenle ekranında bilgileri ve erişimi değiştirebilir, ayrı şifre yenileme alanını kullanabilir veya onaylayarak hesabı kalıcı silebilirsin. Kulüp eklerken ad, kullanıcı adı ve şifre zorunludur; e-posta ve ilçe isteğe bağlıdır. Giriş bilgilerini kulüp yetkilisine yönetici iletir; şifre tekrar görüntülenmez.

Mevcut kulüp hesapları migration sırasında korunur ve kulüp kaydı kazanır. Eski e-posta girişi korunur; yönetici kaydı düzenleyip kullanıcı adı tanımlayabilir. Yönetici kaydı bir doğrulama rozeti oluşturmaz.

### Frontend'i başlat

Node.js 22.12+ gerekir. Go API 8080 portunda ve ADMIN_ORIGIN=http://localhost:5175 ile çalışırken, ayrı terminalde proje kökünden:

    cd frontend
    npm ci
    npm run dev

Giriş adresi: [http://localhost:5175/securityadmin](http://localhost:5175/securityadmin).

Kullanıcı listesi /securityadmin/users, kulüp listesi /securityadmin/clubs, reklamlar /securityadmin/ads, haberler /securityadmin/news, ligler /securityadmin/leagues ve ödeme yönetimi /securityadmin/payments adresindedir. Doğrudan açma ve sayfa yenileme desteklenir. Web oturumu sunucunun HttpOnly ve SameSite=Strict cookie'sindedir; localStorage/sessionStorage kullanılmaz. Cookie sayesinde sayfa yenilendiğinde oturum geri yüklenir. Web oturumu en fazla 8 saattir (SESSION_TTL daha kısaysa o süre geçerlidir).

ADMIN_ORIGIN şema, alan adı ve varsa port içermeli; /securityadmin yolu içermemelidir. Adresi localhost yerine 127.0.0.1 ile açarsan bu ayarı da aynı host ile tanımlamalısın. HTTPS yayında cookie Secure olur; HTTP yalnızca localhost geliştirmesinde kabul edilir.

### Üretilmiş paneli Go ile sun

Frontend klasöründe:

    npm run build

Paket frontend/dist altında üretilir. Backend klasöründe DATABASE_URL tanımlı olarak:

    $env:ADMIN_FRONTEND_DIR = '../frontend/dist'
    $env:ADMIN_ORIGIN = 'http://localhost:8080'
    go run ./cmd/api

Bu kurulumda [http://localhost:8080/securityadmin](http://localhost:8080/securityadmin) kullanılır. Go /securityadmin ve alt sayfaları web giriş dosyasına, /securityadmin/assets yollarını public paket dosyalarına ve /api yollarını API'ye bağlar. Web dosyaları binary'ye gömülü değildir; yayın paketine frontend/dist de eklenmelidir. Ayrı static sunucu kullanılacaksa /securityadmin/users ve /securityadmin/clubs için aynı giriş dosyasına fallback, /api için Go proxy tanımlanmalıdır.

### Mobil tarayıcı önizlemesi

Tarayıcı önizlemesi için Node.js 22.12+ gerekir. Go API 8080 portunda çalışırken:

    cd mobile
    npm ci
    npm run web

Mobil geliştirme önizlemesi: [http://localhost:5174/](http://localhost:5174/).

Giriş, kayıt ve tab bar aynı React Native ekranlarını kullanır. [React Native Web](https://necolas.github.io/react-native-web/docs/multi-platform/) tarayıcı görünümünü sağlar; Vite /api isteklerini yerel Go API'ye aktarır. Tarayıcı oturumu yalnızca bellektedir; yenileme sonrası yeniden giriş gerekir.

8081 adresi Metro mobil geliştirme sunucusudur. Yönetici frontend'i 5175, mobil tarayıcı önizlemesi 5174 portunu kullanır. Bu bilgisayarda 5173 başka projeye ait olduğu için yönetici paneli 5175'e ayrıldı. Backend'i bir terminalde bir kez çalıştır. 8080 için bind hatası portun zaten kullanıldığını gösterir; [API sağlık adresini](http://localhost:8080/health) kontrol et.

Yerel önizleme paketini üretmek ve açmak için:

    npm run build:web
    npm run preview:web

web ve preview:web aynı 5174 portunu kullanır; aynı anda çalıştırma. Bu paket yalnızca mobil geliştirme önizlemesidir; son kullanıcılar mobil uygulamayı kullanır.

## Mobil istemci

Node.js 22.11+ ve npm gerekir. Kurulum ve Metro:

    cd mobile
    npm ci
    npm start

Ayrı terminalde Android emülatör veya bağlı cihaz için:

    cd mobile
    npm run android

Cihaza kurmadan debug APK üretmek için:

    npm run build:android

Yalnızca emülatör mimarisini derlemek için:

    npm run build:android -- --extra-params "-PreactNativeArchitectures=x86_64 --no-daemon"

Debug APK geliştirme içindir ve Metro sunucusuna ihtiyaç duyar. Fiziksel Android cihazları için varsayılan tüm mimarileri veya arm64-v8a mimarisini derle.

iOS için macOS/Xcode üzerinde:

    cd mobile
    bundle install
    cd ios
    bundle exec pod install
    cd ..
    npm run ios

Android ve iOS native kaynakları mobile/android ve mobile/ios altındadır. Proje [React Native Community CLI](https://reactnative.dev/docs/getting-started-without-a-framework) iskeleti ve [React Navigation](https://reactnavigation.org/docs/getting-started/) ile hazırlanmıştır.

Windows'ta android ve build:android komutları scripts/react-native.cjs aracılığıyla çalışır. Türkçe kullanıcı klasörlerinde native kaynaklar ve Java araç önbelleği PUBLIC altında ASCII yollarla derlenir. Kaynak dosyaların asıl konumu mobile klasörüdür; geçici kopyayı düzenleme. Android SDK kopyalanmaz, bir dizin bağlantısı kullanılır. Üretilen debug APK proje kökündeki artifacts/android/app-debug.apk konumuna alınır.

UTF-8 ve Java geçici dizin ayarları yalnızca derleme alt sürecine uygulanır. Windows'ta Metro'yu önce asıl mobile klasöründe npm start ile çalıştır; Android komutu ikinci bir Metro açmaz.

### API bağlantısı

mobile/src/shared/lib/config.ts geliştirme adresini Android emülatöründe 10.0.2.2:8080, iOS simülatöründe localhost:8080 olarak seçer. Fiziksel cihaz için developmentOverride değerine bilgisayarın yerel ağ adresini yaz; cihaz ve bilgisayar aynı ağda olmalı. Android USB bağlantısında adb reverse tcp:8080 tcp:8080 kullanıp adresi localhost'a alabilirsin.

Release için productionApiUrl alanını gerçek HTTPS servis adresiyle doldur. Boş bırakılmış bir release yapılandırması geliştirme sunucusuna bağlanmaz. iOS fiziksel cihazı için yerel HTTP yerine HTTPS geliştirme tüneli kullan.

## API

| Metot | Yol | İşlev |
|---|---|---|
| GET | /health | Servis durumu |
| POST | /v1/auth/register | Kayıt ve yeni oturum |
| POST | /v1/auth/login | Giriş ve yeni oturum |
| GET | /v1/auth/me | Bearer token ile hesap bilgileri |
| POST | /v1/auth/logout | Mevcut oturumu iptal etme |
| GET | /v1/players/me/profile | Oyuncunun kendi profilini okuma |
| PUT | /v1/players/me/profile | Oyuncunun kendi profilini güncelleme |
| GET | /v1/discovery/{kind} | Yetkili profil araması ve sayfalama |
| GET | /v1/discovery/{kind}/{id} | Aynı görünürlük kurallarıyla profil detayı |
| PUT | /v1/discovery/{kind}/{id}/follow | following boolean değeriyle takip etme/bırakma |
| GET | /v1/me/insights | Oturum sahibinin görüntüleme, takipçi ve takip edilen sayaçları |
| GET | /v1/content/home | Aktif reklamlar ve ana sayfaya seçilen yayındaki haberler |
| GET | /v1/content/news?page=1 | Yayındaki haberler, 20 kayıtlık sayfalar |
| GET | /v1/content/news/{id} | Yayındaki haberin tam metni |
| GET | /v1/content/images/{id} | Yayındaki içeriğe bağlı JPEG/PNG görsel; bearer gerektirmez |
| GET | /v1/leagues?page=1 | Oturum açmış kullanıcının görebildiği yayınlanmış/tamamlanmış ligler |
| GET | /v1/leagues/{id} | Lig, takımlar, fikstür, hesaplanan puan durumu ve istatistikler |
| GET | /v1/teams?page=1&search=... | Etkin kulüplerin takım rehberi; 20 kayıtlık sayfalar |
| GET | /v1/teams/{id} | Takım tanıtımı, ilçe, saha/antrenman bilgileri; oyuncuda başvuru durumu ve kalan hak |
| POST | /v1/teams/{id}/join-requests | Oyuncunun ücretsiz ve satın alınmış başvuru bakiyesinden bir hak |
| GET | /v1/teams/me/join-requests?status=pending | Kulübün kendi takımına gelen başvuruları |
| PUT | /v1/teams/me/join-requests/{id} | Bekleyen başvuruyu `{ "decision": "accepted" }` veya rejected ile sonuçlandırma |
| GET | /v1/me/team-join-requests?page=1 | Oyuncunun başvuru geçmişi, yanıtları ve kalan toplam hakkı |
| GET | /v1/payments/packages | Oyuncuya açık paket kataloğu ve checkout'un yapılandırılmış olup olmadığı |
| POST | /v1/me/team-request-payments | Oyuncu için güvenli checkout siparişi oluşturma |
| POST | /v1/payments/webhook | HMAC imzalı ödeme sağlayıcı bildirimi; bearer oturumu gerekmez |
| GET | /v1/payments/pro-plan | Sporcu/kulüp/antrenöre Pro planı (`days`, `bonusCredits`, fiyat, satış durumu) ve checkout'un yapılandırılmış olup olmadığı |
| POST | /v1/me/pro-payments | `{ "planId" }` ile Pro checkout siparişi; Pro yalnızca imzalı `paid` bildirimiyle açılır |
| GET | /v1/me/pro | `{ pro: { active, expiresAt, privateBrowsing, bonusCredits }, eligible }`; süresi dolan Pro `active: false` |
| PUT | /v1/me/pro/settings | `{ "privateBrowsing": true/false }`; Pro olmayan hesaba 403 `pro_required` |
| GET | /v1/me/profile-visitors | Son 30 günün ziyaretçi özeti (`summary.window`/`summary.week`, rol dağılımı) ve sıralı satırlar. Pro olmayan sahipte yalnızca bir `kind: visitor` satırı kimlik taşır; `obscured` satırlar yalnızca rol/zaman/kulüp ilçesi, `private` satırlar yalnızca zaman içerir |
| GET | /v1/me/notifications?page=1&pageSize=20 | Kullanıcının bildirimleri ve okunmamış toplamı |
| GET | /v1/me/notifications/unread-count | Diğer menüsü rozeti için okunmamış sayısı |
| PUT | /v1/me/notifications/{id}/read | Kullanıcıya ait bir bildirimi okundu işaretleme |
| PUT | /v1/me/notifications/read-all | Kullanıcının tüm bildirimlerini okundu işaretleme |
| POST | /v1/me/notifications/delete | Seçilen bildirimleri (1–100 kimlik) kalıcı silme |
| DELETE | /v1/me/notifications | Kullanıcının tüm bildirimlerini kalıcı silme |
| GET | /v1/social/users/{id}/posts | Hesabın gönderileri, en yeni önce; filter=media profilde gösterilen medyalı gönderiler |
| GET | /v1/social/posts?scope=explore&cursor=... | 20 gönderilik Keşfet akışı; scope=following yalnızca takip edilenleri döndürür |
| POST | /v1/social/posts | JSON body ile metin veya multipart body/media ile görsel/video gönderisi |
| GET | /v1/social/posts/{id} | Gönderi, medya bilgisi ve gerçek etkileşim sayaçları |
| GET | /v1/social/posts/{id}/media | Bearer oturumuyla medya; HTTP Range desteklenir |
| PUT | /v1/social/users/{id}/follow | following: true/false ile aktif mobil hesabı takip et/bırak |
| DELETE | /v1/social/posts/{id} | Yalnızca kendi gönderisini silme |
| PUT | /v1/social/posts/{id}/like | liked: true/false ile beğeni ekleme/kaldırma |
| GET | /v1/social/posts/{id}/replies?cursor=... | 20 yanıtlık cursor sayfası |
| POST | /v1/social/posts/{id}/replies | 1–500 karakter yanıt oluşturma |
| DELETE | /v1/social/posts/{id}/replies/{replyID} | Yalnızca kendi yanıtını silme |

Takım API yolları mobil bearer oturumu ister. Başvuru oluşturma ve oyuncunun kendi geçmişini okuma yalnızca oyuncuya, gelen başvuruları listeleme/sonuçlandırma yalnızca kulüp hesabına açıktır. Kota, oyuncu satırını kilitleyen tek veritabanı transaction'ı içinde kontrol edilir; üç ücretsiz hak ve doğrulanmış ödemelerden kazanılan toplam bakiye dolunca sonraki gönderim 409 `quota_exhausted` döner. Aynı takıma ikinci başvuru 409 `duplicate_request` döner. Ret, kabul ve takım hesabının silinmesi geçmiş başvuru kaydını/kota kullanımını geri almaz.

Ödeme paketleri yeni sporcuya verilen üç ücretsiz hakka eklenir. API sipariş öncesi paketin güncel fiyatını veritabanından okur ve ödeme bildirimi gelene kadar hak bakiyesini değiştirmez. Adapter'ın checkout oluşturma isteği `orderId`, `product` (`team_rights` veya `pro`), `credits` (Pro'da 0), `amountMinor`, `currency` ve `idempotencyKey` taşır. Yanıt `provider`, `providerPaymentId` ve HTTPS `checkoutUrl` içerir. Gelen webhook ham JSON gövdesiyle HMAC-SHA256 doğrulamasından geçer; bildirim alanları `eventId`, `orderId`, `provider`, `providerPaymentId` ve `status` şeklindedir. Aynı sağlayıcı event kimliği ikinci kez hak veya durum değişikliğine yol açmaz. Ödeme ve yönetici API yolları aşağıdadır.

Bildirim yolları mobil bearer oturumu ister ve her kullanıcıya yalnızca kendi kayıtlarını gösterir. Yeni takım başvurusu kulüp hesabına; kabul/ret kararı oyuncuya; ödeme durumu değişikliği sipariş sahibine bildirim oluşturur. Bildirim, ilgili başvuru veya ödeme işlemiyle aynı PostgreSQL transaction'ında yazılır. Okundu durumu kullanıcıya özeldir ve tümünü okundu işaretleme de desteklenir. Bu dilim uygulama içi merkezdir; harici push servisi seçilmemiştir.

Kayıt gövdesi fullName, email, password ve role alanlarını içerir; yaş onayı gönderilmez. Herkese açık kayıt role: player veya coach kabul eder; ikisi de footballType (amateur, professional, halisaha) ister, sporcu licenseStatus (licensed/unlicensed), antrenör licenseLevel (uefa_pro, uefa_a, uefa_b, uefa_c, grassroots, none) gönderir. Kulüp/organizasyon/yönetici rolü bu yoldan açılamaz. Mobil giriş gövdesi identifier ve password içerir; identifier sporcu/antrenör için e-posta, kulüp için kullanıcı adıdır. Yönetici bu uç noktadan oturum açamaz (403). Önceki email + password giriş gövdesi de desteklenir. Başarılı mobil kayıt/giriş token, expiresAt ve user döndürür. user alanında username, active ve verified de bulunur; şifre veya hash döndürülmez. Mobil özel isteklerde Authorization: Bearer <token> başlığı gerekir.

### Yönetici API'si

Bu yollar yalnızca admin rolü ve admin kullanım alanına sahip cookie oturumuyla çalışır. Mobil bearer token yönetici API'sinde kabul edilmez; yönetici cookie token'ı mobil API'de kabul edilmez. Cookie eksik, yanlış kullanım alanında veya süresi dolmuşsa 401 alınır. Yazma isteklerinde Origin başlığı ADMIN_ORIGIN ile eşleşmelidir; eşleşmiyorsa 403 alınır.

- POST /v1/admin/auth/login: identifier (yönetici kullanıcı adı), password. Yönetici dışındaki hesap doğru şifreyle bile 403 alır. Yanıtta user ve expiresAt bulunur; token JSON'a yazılmaz, yalnızca HttpOnly cookie ile gönderilir.
- GET /v1/admin/auth/me: cookie ile yönetici hesabını okur.
- POST /v1/admin/auth/logout: yönetici oturumunu iptal eder ve cookie'yi kaldırır; 204 döner.

- GET /v1/admin/users ve GET /v1/admin/clubs: liste. page varsayılan 1, pageSize varsayılan 20 (1–100), search en fazla 100 karakter. Yanıt items, page, pageSize, total ve totalPages içerir. Sıralama createdAt ve id azalan; arama ad/e-posta/kullanıcı adında çalışır.
- GET /v1/admin/users/{id} veya /v1/admin/clubs/{id}: tek kayıt.
- POST /v1/admin/users: fullName, email, password, role (player veya coach).
- POST /v1/admin/clubs: fullName (kulüp adı), username, password; isteğe bağlı email, district, description, venueName, venueAddress, trainingGroundName, trainingGroundAddress ve trainingSchedule. Sunucu rolü club olarak belirler. Kulüp ve hesabı tek transaction ile oluşturulur.
- PUT /v1/admin/users/{id} veya /v1/admin/clubs/{id}: fullName, email, username, district, active ve isteğe bağlı verified. Kulüp yolunda ayrıca description, venueName, venueAddress, trainingGroundName, trainingGroundAddress ve trainingSchedule düzenlenir. active zorunludur; rol değiştirilemez. verified yalnızca kulüp/antrenör hesabında true olabilir; verilmezse mevcut değer korunur. Doğrulama hesabın oluşturulmasından ayrı olarak bu düzenleme yolunda yapılır. Sporcu/antrenörde username kullanılmaz.
- PUT /v1/admin/users/{id}/password veya /v1/admin/clubs/{id}/password: password. Yeni şifre bütün oturumları iptal eder.
- DELETE /v1/admin/users/{id} veya /v1/admin/clubs/{id}: hesap ve bağlı oturum/profil/kulüp bilgileri kalıcı silinir; 204 döner.
- GET /v1/admin/leagues?page=1 ve GET /v1/admin/leagues/{id}: taslaklar dahil lig listesi ve ayrıntısı.
- GET /v1/admin/payments?status=all&page=1&search=...: özet ve sayfalı ödeme geçmişi. Status `all`, `pending`, `paid`, `failed` veya `refunded`; arama oyuncu adı/e-postası ya da işlem kimliğinde yapılır.
- GET /v1/admin/payments/packages ve PUT /v1/admin/payments/packages/{id}: 2, 5 ve 10 haklık paketlerin fiyatını (1–1.000.000 TL) ve satış durumunu yönetme.
- GET /v1/admin/payments/pro-plan ve PUT /v1/admin/payments/pro-plan/{id}: Pro planının fiyatını (`amountMinor`, 1–1.000.000 TL) ve satış durumunu (`active`) yönetme. Ödeme geçmişindeki her kayıt `product` alanını taşır.
- GET /v1/admin/users/{id}/pro ve POST /v1/admin/users/{id}/pro `{ "action": "grant" | "revoke" }`: test/destek için Pro durumu, Pro verme (+30 gün, sporcuya bu veriş için bir kez +3 hak) ve kaldırma (hemen biter, verilmiş haklar kalır). Sporcu, kulüp ve antrenör dışındaki hesap 422 `not_eligible` alır.
- POST /v1/admin/leagues ve PUT /v1/admin/leagues/{id}: name, season, description, status (draft/active/finished) ve winPoints/drawPoints/lossPoints puan kuralları.
- GET /v1/admin/leagues/clubs?search=...&page=1 ve POST /v1/admin/leagues/{id}/teams: etkin mevcut kulüp hesaplarını ara ve lige ekle. Takım çıkarma, maç fikstüründe kullanılıyorsa 409 döner.
- POST/PUT/DELETE /v1/admin/leagues/{id}/matches[/{matchId}]: round, homeTeamId, awayTeamId, isteğe bağlı kickoffAt ve iki skor alanı. Skorları boş bırakılan maç programlanmış kalır; sonuç kaydı puan durumunu ve istatistikleri yeniden hesaplar.

Puan durumu galibiyet/beraberlik/mağlubiyet puanlarıyla sunucuda hesaplanır; eşitlik sırası puan, averaj, atılan gol, galibiyet ve takım adıdır. İstatistikler takım/maç sayısı, oynanan/programlanan maçlar, toplam ve maç başı gol ile iç saha galibiyeti/beraberlik/deplasman galibiyetini kapsar. Oyuncu gol katkısı kaydedilmediği için gol krallığı gösterilmez. Yönetici silme işlemleri lig takımlarını ve fikstürünü de kaldırır.

Yönetici hesapları güncelleme, silme ve şifre yenileme yollarından korunur. Kulüp yolları başka rolün ID'sini kabul etmez. Erişimin durdurulması veya giriş kimliğinin değişmesi oturumları iptal eder. Oturum sürümü kontrolü eşzamanlı giriş/şifre yenileme sırasında eski girişle oluşabilecek oturumları da geçersiz kılar.

İçerik API'si aynı yönetici cookie/Origin denetimini kullanır:

- POST /v1/admin/content/images: multipart/form-data içinde image dosyası; imageId döndürür. JPEG/PNG ve boyut/piksel sınırları sunucuda doğrulanır.
- GET /v1/admin/content/images/{id}: yayında olmayan yüklemeleri de içeren yönetici görsel önizlemesi.
- GET /v1/admin/content/ads veya /news?page=1: yayın ve taslak kayıtları, 20 kayıtlık sayfalar.
- POST /v1/admin/content/ads ve PUT /v1/admin/content/ads/{id}: title, imageId, active, sortOrder.
- POST /v1/admin/content/news ve PUT /v1/admin/content/news/{id}: title, summary, body, isteğe bağlı imageId (boş metin kapak görselini kaldırır), published, showOnHome.
- DELETE /v1/admin/content/ads/{id} veya /news/{id}: yalnızca seçilen içerik kaydını kaldırır; 204 döner. Görseller başka içerikte kullanılabilir ve otomatik silinmez.

Oyuncu profilini kaydetme gövdesi position, dominantFoot, experienceYears, currentClub, availability ve discoverable alanlarını içerir. dominantFoot: right, left, both veya boş; availability: seeking_team, open_to_offers veya not_available olabilir. Mevcut kulüp oyuncu beyanıdır. Profil uç noktaları yalnızca oyuncu hesaplarına açıktır.

Şifre en az 10 karakter ve en fazla 72 UTF-8 bayt olabilir. Kimlik doğrulama denemeleri IP başına dakikada 20 istekle sınırlıdır. Proxy arkasına alınırsa istemci IP doğrulama/rate limit yapılandırması deployment katmanında tamamlanmalı. Oturum kapatma API'ye ulaşmayı gerektirir; bağlantı kesikken istemci oturumu silip sunucu iptal edildiğini varsaymaz.

### Keşif API'si

Mobil bearer oturumu gerekir; yönetici cookie veya bearer oturumu kabul edilmez. kind: players, clubs veya coaches. Oyuncu yalnızca clubs/coaches kullanabilir; club/coach yalnızca doğrulanmışsa players kullanabilir. İzinsiz rol veya doğrulanmamış hesap 403, geçersiz oturum 401 alır. Doğrulama istemci oturumundaki eski bilgiye göre değil, her istekte veritabanından okunur.

Liste parametreleri: page (varsayılan 1, üst sınır 1000000), pageSize (varsayılan 20, üst sınır 50), search (ad içinde büyük/küçük harf duyarsız düz metin, en fazla 100 karakter). players ayrıca position (mevki içinde düz metin, en fazla 40 karakter), dominantFoot (right/left/both) ve availability (seeking_team/open_to_offers/not_available) kabul eder. Boş filtre tüm değerleri kapsar. Sağlayıcı aramasında oyuncu filtreleri kabul edilmez. Geçersiz sorgu 422 döner. `%` ve `_` aramada joker karakter değildir.

Yanıt items, page, pageSize, total ve totalPages içerir. createdAt ve id azalan sıralama kullanılır; sayı ve sayfa aynı veritabanı snapshot'ından okunur. Profil alanları id, fullName, role, verified, district, playerProfile ve isFollowing'dir; oyuncuda kanonik futbol profili, kulüp/antrenörde playerProfile: null döner. isFollowing detayda oturum sahibinin gerçek takip tercihini gösterir; listede kullanılmaz. Varsayılan şehir mobilde gösterilmez. Tüm keşif yanıtları no-store kullanır. Gizli, silinmiş, erişimi kapalı, pilot dışı veya doğru türde olmayan profil detayda 404 döner.

## Kontroller

### Antrenör ve teknik ekip — 19 Ekim 2026

Go: `go vet ./...` ve TEST_DATABASE_URL ile `go test ./... -count=1` başarılı (Windows App Control'ün engellediği test ikilileri `golang:1.26` Docker kapsayıcısında çalıştırıldı). Yeni entegrasyon testleri antrenör kaydını (kulüp kaydının reddi, lisanssız antrenörün reddi, doğrulanmamış ve hemen açılan hesap, kayıttaki bilgilerin gizli başlaması, aynı e-postanın ikinci kaydının 409'u), görünürlük kurallarını, aday aramayı, davet ve yinelenen davette 409'u, kabulden önce geçişte 403'ü, kabul ve iki bildirimi, geçiş ve `/me` delegate alanını, geçişten ikinci geçişin reddini, bölüm denetimini, geçişli oturumda hesap silmenin 403'ünü, izin değişikliğinin hemen geçerli olmasını ve ekipten çıkarmada kulüp oturumunun 401 alıp kapanmasını (antrenörün kendi oturumu korunur) kapsar; migration sayısı 35. Mobil: TypeScript, ESLint ve Jest başarılı; yeni testler antrenör kaydını (hesap türü seçeneği, lisans düzeyi zorunluluğu ve isteğin gövdesi), geçiş/geri dönüşü, kulüp oturumunun ayrı depoda tutulmasını, geçişli Diğer menüsünün süzülmesini, sahip ve antrenör girişlerini, kapalı bilgilerin herkese açık profilde görünmemesini ve izin sayfasının seçimi göndermesini kapsar. Android emülatörde yerel API'ye karşı uçtan uca denendi: davet, bildirim, kabul, iki yoldan geçiş, şerit, süzülmüş menü ve ana sayfa, Kadrom, geri dönüş, antrenör bilgileri ve görünürlük.

### Pro üyelik ve ziyaretçiler — 15 Ekim 2026

Go: `gofmt -l .` boş, `go vet ./...` ve TEST_DATABASE_URL ile `go test ./... -count=1` başarılı (yoğun anda iki paketin test şeması kurulumu zaman aşımına uğradı, tek başına yeniden çalıştırınca geçti). Yeni kontroller: ziyaretçi sıralaması (doğrulanmış kulüp/antrenör, aynı futbol türü, tekrar, yenilik, eşitlikte kimlik; gizli satırın kimliğe göre yükselmemesi), ücretsiz/Pro yanıt projeksiyonu ve JSON'da kimlik sızmaması, bitiş uzatma kuralı, PostgreSQL üzerinde uçtan uca: varsayılan plan, imzalı webhook ile etkinleştirme, aynı/yeni event ile tekrarın ek süre veya hak vermemesi, yenilemenin mevcut bitişten uzaması, iadenin süre ve hakları düşürmesi, kotada ayrı `pro` kaynağı, gizli gezinmenin Pro dışına kapalı olması, Pro olmayan sahibe gizli ziyaretçinin anonim ve sayılarda "hidden" görünmesi, Pro sahibin gerçek kimliği görmesi, keşifte `isPro`, yönetici ver/kaldır, süresi dolan Pro'nun her istekte Pro sayılmaması, fiyat/satış yönetimi ve 26 migration'ın up/down/up döngüsü. Mobil: Jest (19 paket, 240 test), TypeScript ve ESLint başarılı; yeni testler doğrulayıcıları (kimlik taşıyan anonim satırın reddi), özet başlığı/göreli zamanı, ziyaretçi ekranının ücretsiz/Pro görünümünü, Pro ekranını ve satın alma akışını, gizli gezinme anahtarını, Takımlar hak rozetini ve yönetici Pro işlemlerini kapsar. Web: TypeScript ve ESLint başarılı (frontend'de test altyapısı yok). Native, mobil web veya yönetici web derlemesi yapılmadı; ekranlar görsel olarak doğrulanmadı.

### Demo verisi — 15 Ekim 2026

`gofmt -l .` boş, `go vet ./...` ve TEST_DATABASE_URL ile `go test ./... -count=1` başarılı. Yeni `internal/demo/data` testleri: beklenen sayılar ve hesap işaretleri, her sporcunun 1–4 gönderisi ve 3–8 takibi, ortak şifreyle demo sporcu/kulüp girişi ve bekleyen başvurunun girememesi, yönetici başvuru kuyruğunda 3 kulüp + 1 organizasyon bekleyen ve gerekçeli 1 ret, onay bekleyen kulüp haberi, lig puan durumunun maç skorlarından hesaplanması, ikinci kurulumun çoğaltmaması ve eski şifreyi geçersiz kılması, `--remove` sonrası sıfır demo kaydı ve gerçek kayıtların değişmemesi, `--follow-email` seçeneğinin yalnızca adı verilen hesabı etkilemesi. Yerel geliştirme veritabanına bir kez kuruldu ve bırakıldı.

### Avrupa kupaları ve TFF Ankara seçimleri — 14 Ekim 2026

Go: gofmt, go vet ve TEST_DATABASE_URL ile `go test ./... -count=1` başarılı. Yeni kontroller katalogda altı lig ve üç kupayı, kupa slug'larının bulunmasını, kupa notlarının değiştirilmeden iletilmesini, gerçek ESPN tur takvimi biçimindeki fixture ile aylık sonuç okumayı (önbellek dahil) ve takvim dışı aylara gidilmemesini, Kafa Kafaya'nın hiçbir zaman kupa seçmemesini kapsar. Canlı ESPN API'sine karşı geçici bir testle üç kupanın puan durumu, bugünün maçları, son sonuçları ve istatistikleri doğrulandı (test sonra silindi). Mobil: Jest, TypeScript ve ESLint başarılı; yeni testler kupalı/kupasız katalog doğrulamasını, Avrupa kupaları bölümünü, kupa notlarının Türkçe karşılıklarını ve lejantta tek "Play-off turu" girdisini, açılır alanların sırasını, kilit/temizleme davranışını ve lig ailesi başlıklarını kapsar. Native veya web derlemesi yapılmadı.

### Arma İzi büyük havuz — 14 Ekim 2026

Go: gofmt, go vet ve TEST_DATABASE_URL ile `go test ./... -count=1` başarılı. Yeni kontroller katalog doğrulamasını (tekil kimlik/ad/ipucu dizisi, geçerli zorluk, 3–5 kulüp, en az 2 arma, arma dosyası eşleşmesi, en küçük havuz; gömülü havuzun en az 150/200/250 olması), üretici kurallarını fixture ile (milli/altyapı/rezerv/kadın takımı eleme, kronoloji ve kiralıktan dönüş, ardışık tekrar birleştirme, ipucu seçimi, zorluk ve Süper Lig ağırlığı, başka kariyere uyan ipucunun reddi, ESPN ad eşleşmesi), şık seçimini, önce görülmemiş/sonra en eski görülmüş seçimini, ardışık altı oyunda tekrar olmamasını, devam eden oyunun geçmişi değiştirmemesini, başlangıç yanıtında cevap/katalog verisi sızmamasını ve 25 migration'ın up/down/up döngüsünü kapsar. Üretici aynı önbellekle iki kez çalıştırılıp çıktının aynı olduğu doğrulandı. Gömülü varlıklarla API binary'si 21,8 MB'tan 25,5 MB'a çıktı. Mobil: Jest (18 paket, 209 test), TypeScript ve ESLint başarılı; yeni testler hasCrest doğrulamasını, rozet baş harflerini ve armasız/yüklenemeyen arma için rozet çizimini kapsar. Native veya web derlemesi yapılmadı.

### Oyunlar ve Kafa Kafaya — 14 Ekim 2026

Go: gofmt, go vet ve yerel PostgreSQL üzerinde TEST_DATABASE_URL ile `go test ./... -count=1` başarılı. Kafa Kafaya kontrolleri eşit değerli çift üretmeme, seride çift tekrarlamama, her soru için (yenen gol ve sırada küçük olan dahil) doğru kazanan, tekrarlanan ve eşzamanlı aynı yanıtın tek tur eklemesi, değiştirilen yanıtın reddi, yanlışta serinin bitmesi, en iyi seri/oynama sayısı, kalp ve ödül üretilmemesi, tur ve başlatma yanıtında değer sızmaması ile 24 migration'ın up/down/up döngüsünü kapsar. Mobil: Jest, TypeScript ve ESLint başarılı; yeni testler API doğrulayıcılarını, yeni oyun adlarını, kural sayfasını, karşılaşma ekranını, doğru/yanlış akışını, oyun sonunu ve kaynak hatasında yeniden denemeyi kapsar. Native veya web derlemesi yapılmadı; ekranlar görsel olarak cihazda doğrulanmadı.

### Futbol oyunları — 12 Ekim 2026

Ayrı geçici PostgreSQL 16 sunucusunda TEST_DATABASE_URL ile tüm Go testleri geçti; Go build/vet de başarılı. Oyun kontrolleri 3 saatlik sıralı yenilenme/sınır, 4 kolay/3 orta/3 zor seçim, gelecekteki sorunun/cevabın gizli kalması, başka hesabın oyuna erişememesi, değiştirilemeyen yanıt, kaldığı yerden devam, 7 doğru ödülü, 6 doğruya ödül verilmemesi, kazanılan hakkın gerçek takım başvurusunda tüketilmesi, sekiz eşzamanlı başlatma/tamamlama isteğinde tek kalp/ödül ve sporcu dışındaki hesabın ödül alamamasını kapsar. On beş migration için up/down/yeniden up kontrolü başarılı. Önizlemede ortaya çıkan Keşfet sorgusunun tarih parametresi türü düzeltildi; boş akış, snapshot ve takip akışı PostgreSQL regresyon testiyle doğrulandı.

Mobilde beş test paketi / 16 test, TypeScript, ESLint ve web derlemesi başarılı. Yeni mobil kontroller hatalı API verisini reddetme, bağlantı hatasında seçimi koruma/aynı yanıtı yeniden gönderme, geri bildirimden sonra sonraki soruya geçme, kaydedilmiş ödülü yükleme, cihaz saatinden bağımsız sayaç ve kalp yenilenmesi isteğinin geçici hata sonrası yeniden denenmesini kapsar. 320/390 piksel tarayıcı önizlemesi gerçek Go API'ye ve izole PostgreSQL'e bağlandı; 7/10 oyunun ödülü ve 3'ten 4'e çıkan başvuru kotası doğrulandı. Oyun/sonuç görünümleri artifacts/games-qa/ altında saklandı. Android/iOS native cihaz derlemesi yapılmadı; web paketindeki mevcut use client ve paket boyutu uyarıları sürüyor. Kullanıcının mevcut veritabanına migration uygulanmadı.

### Ödeme ve başvuru hakları — 11 Ekim 2026

Go build/vet, web ve mobil TypeScript/ESLint kontrolleri, yönetici üretim paketi, mobil tarayıcı paketi ve `git diff --check` başarılı. Mobil web paketi mevcut `use client` ve 500 kB üzeri paket uyarılarını veriyor. Testler ve Android/iOS native derlemeleri bu dilimde çalıştırılmadı. `00010_team_request_payments.sql` kaynakta hazır; veritabanına uygulanmadı. Sağlayıcı kararı verilmediğinden checkout satın alma düğmesi HTTPS adapter ayarları yapılana kadar devre dışıdır.

### Bildirim merkezi — 11 Ekim 2026

Go build/vet, web ve mobil TypeScript/ESLint kontrolleri, mobil tarayıcı paketi ve `git diff --check` başarılı. Testler ve Android/iOS native derlemeleri çalıştırılmadı. `00011_notifications.sql` kaynakta hazır; veritabanına uygulanmadı. Bildirim üretimi takım başvurusu ve ödeme durum güncellemeleriyle aynı transaction içinde yapılır.

### Sosyal medya paylaşımı ve iki akış — 11 Ekim 2026

Go build/vet, mobil TypeScript/ESLint, mobil web paketi ve git diff kontrolü başarılı. 320/390 piksel izole tarayıcı önizlemesinde iki sekme, sağ alttaki +, taslak koruma, metin paylaşımından akışa dönüş ve görsel/MP4 seçme/önizleme/kaldırma kontrol edildi. Önizleme yalnızca bellekteki geçici örnek verileri kullanır; gerçek API yazması/ödeme veya ürün verisi oluşturulmadı. Görünümler artifacts/previews/social-feed-v2.jpg ve social-publish-v2.jpg altında saklandı. Testler/native derlemeler çalıştırılmadı; PostgreSQL sorguları canlı veritabanında doğrulanmadı. 00013_social_media.sql kaynakta hazır, veritabanına uygulanmadı. API başlamadan önce backend/ içinde DATABASE_URL ile `go run ./cmd/migrate up` gerekir.

react-native-image-picker 8.2.1 ve react-native-video 6.19.3 npm bağımlılıkları ve iOS galeri izin açıklaması eklendi. `pod install --no-repo-update` native modülleri buldu ancak diskte yer olmaması nedeniyle tamamlanamadı. Yer açıldıktan sonra mobile/ios içinde `pod install` ve cihaz derlemesi gerekir. Mevcut web paketinin use client/paket boyutu uyarıları sürüyor.

### Sosyal akış ve merkez tab — 11 Ekim 2026

Go build/vet, mobil TypeScript/ESLint, mobil web derlemesi ve `git diff --check` başarılı. Mevcut React Native paketlerinin `use client` ve paket büyüklüğü uyarıları derlemeyi engellemiyor. 320 ve 390 piksel genişlikte izole tarayıcı önizlemesinde beş sekme, merkez butonun üst dokunma alanı, gönderi paylaşma, beğeni ve yanıt akışı kontrol edildi; bu geçici önizlemenin örnek kayıtları ürün kaynağına eklenmedi. Boş akış görünümü artifacts/previews/social-tabbar.jpg içinde saklandı. Testler ve native derlemeler çalıştırılmadı; PostgreSQL sorguları canlı veritabanında denenmedi. `00012_social_feed.sql` kaynakta hazır; mevcut veritabanına uygulanmadı.

### Lig yönetimi — 11 Ekim 2026

Bu geliştirmede Go build/vet, web ve mobil TypeScript/ESLint kontrolleri ile web yönetici ve mobil tarayıcı üretim paketleri başarılı oldu. Mobil tarayıcı paketi mevcut `use client` ve paket boyutu uyarılarını veriyor. Testler çalıştırılmadı ve Android/iOS native cihaz derlemesi yapılmadı. Yeni migration kaynakta hazır; kullanıcının veritabanına uygulanmadı.

### Takım rehberi ve başvurular — 11 Ekim 2026

Go build/vet, yönetici ve mobil TypeScript/ESLint kontrolleri, yönetici üretim paketi, mobil tarayıcı paketi ve `git diff --check` başarılı. Test çalıştırılmadı ve Android/iOS native derlemesi yapılmadı. `00009_teams_and_join_requests.sql` kaynakta hazır; bu çalışma sırasında herhangi bir veritabanına migration uygulanmadı. Mobil tarayıcı üretim paketi mevcut bağımlılıklardan gelen `use client` ve paket boyutu uyarılarını sürdürüyor.

### Ana sayfa ve içerik yönetimi — 11 Ekim 2026

PostgreSQL 16.14 üzerinde TEST_DATABASE_URL ile tüm Go testleri ve go vet başarılı; hiçbir entegrasyon testi atlanmadı. Yeni kontroller yönetici cookie/Origin ve oturum ayrımını, görsel yükleme sınırlarını, taslak/yayın görsel erişimini, haberin yayın/ana sayfa tercihlerinin bağımsızlığını, içerik kalıcılığını, görüntüleme tekrarlarının tek sayılmasını, takip/bırakma ve yetkisiz erişimi kapsar. Yedi migration için up/down/yeniden up kontrolü geçti.

Mobil ve web TypeScript/ESLint kontrolleri, mobilde 12 Jest testi, yönetici üretim paketi ve mobil tarayıcı paketi başarılı. Yeni mobil testler taslak/ana sayfa dışındaki haberlerin, bozuk görsel kimliklerinin ve geçersiz kişisel sayaçların API sınırında reddini kapsar. Tarayıcıda yönetici formundan iki PNG reklam ve yayın/ana sayfa tercihleri farklı üç test haberi kaydedildi. Sporcu ve antrenör ana sayfasında ortak reklamlar, gerçek takip/görüntüleme sayaçları, otomatik ve elle kayan görseller, ana sayfadan Haberler listesine ve listeden detaya yönlendirme doğrulandı. Profil kısayolu Diğer içindeki profile açılıyor ve geri dönebiliyor. Beş tab etiketi ve ana sayfa 320/390 px genişlikte kontrol edildi; yatay taşma yok. Önizlemeler artifacts/mobile-home.png, artifacts/mobile-home-content.png ve artifacts/admin-news.png içinde yalnızca test verisi içerir. Android/iOS native derlemesi yapılmadı; mevcut mobil web paket boyutu ve üçüncü taraf use client uyarıları sürüyor.

### Önceki beş sekmeli gezinme — 11 Ekim 2026

Mobil TypeScript, ESLint, 10 mevcut Jest testi ve tarayıcı paketi başarılı. Gerçek Go API ve ayrı PostgreSQL test hesaplarıyla sporcu/antrenör gezinmesi kontrol edildi. Beş sekmenin sırası ve okunabilir etiketleri 320 ve 390 px ekranlarda doğrulandı. Diğer → Ayarlar/Keşfet/İstekler, listeden profil detayı ve geri dönüş, ana sayfa/Takımlar/İstekler keşif kısayolları, profil düzenleme ve profil ayarları bağlantıları çalışıyor. Diğer sekmesine tekrar basılması ve sekmeler arasında gidip geri dönülmesi menüyü açıyor. Android/iOS native cihaz derlemesi bu adımda yapılmadı; önceki mobil web paket uyarıları devam ediyor. Önizlemeler artifacts/mobile-more.png ve artifacts/player-profile.png içinde, ikincisi yalnızca test hesabı bilgilerini içerir.

### Sporcu profili görünümü — 10 Ekim 2026

Mobil TypeScript, ESLint, 10 mevcut Jest testi ve tarayıcı paketi başarılı. Ayrı PostgreSQL test verisiyle gerçek API üzerinde profil açma, video sekmesi, futbol bilgisini kaydetme ve geri dönünce başlığın yenilenmesi, hesap ayarları ve geri dönüş kontrol edildi. Yalnızca yerleşim testi için kullanılan yerel görsellerle 320 ve 390 px ekranlarda fotoğraf/video küçük resimlerinin kare olduğu ve satır başına üç öğe tuttuğu doğrulandı; bu içerikler uygulamaya eklenmedi. Android/iOS native cihaz derlemesi bu görünüm değişikliğinde yapılmadı. Önceki mobil web paket uyarıları devam ediyor.

### Keşif ve doğrulama — 10 Ekim 2026

İzole PostgreSQL 16.14 üzerinde bütün Go testleri ve go vet geçti; entegrasyon testleri atlanmadı. Yeni keşif HTTP testi yönetici cookie/Origin yetkisini, iki yönlü rol ayrımını, otomatik doğrulama yapılmamasını, doğrulama kaldırılmasını, aktiflik/görünürlük/pilot filtrelerini, doğrudan detay erişimini, düz metin ve birleşik futbol filtrelerini, sorgu doğrulamasını, özel alanların yokluğunu, sayfa sınırlarını ve kalıcılığı doğrular. Migration testi altı dosyanın up/down/yeniden up akışını ve API şema korumasını kapsar.

Mobil ve web TypeScript/ESLint kontrolleri ile iki tarayıcı paketi başarılı. Gerçek API ve ayrı test verileriyle 390 px mobil tarayıcı önizlemesinde oyuncu listesi, birleşik futbol filtreleri, profil detayı ve sporcu hesabından doğrulanmış kulüp keşfi kontrol edildi. Web panelinde doğrulama düzenleme/kaydetme ve listede güncellenmiş durum doğrulandı. Vite geliştirme ve önizlemede /securityadmin adresini /securityadmin/ adresine yönlendiren düzeltme eklendi; sondaki eğik çizgi olmadan giriş açılır. Mobilde 10 Jest testi geçti; yeni kontroller yanlış keşif yanıtlarının reddini, arama kodlamasını ve geç gelen yanıtların yeni sorguyu bozamamasını kapsar. Mobil web paketinde önceki üçüncü taraf use client ve paket boyutu uyarıları devam ediyor. Android/iOS native cihaz derlemesi bu dilimde yapılmadı.


### Mobil tasarım ve üyelik güncellemesi — 8 Ekim 2026

Mobil giriş/kayıt, ana sayfa, keşif, istekler, hesap ve oyuncu profili ekranları ortak görsel hiyerarşiyle düzenlendi. Şehir ve pilot etiketleri kaldırıldı; futbol profili, deneyim ve bağlantı kurma üzerine genel Türkçe metinler kullanılır. Hesap ekranında varsayılan şehir veya veriden okunmamış görünürlük rozeti gösterilmez. Keşif ve istek ekranları yakında kullanılacak alanlar olarak sunulur. Alt gezinmede dört sekmenin adı da görünür.

Üyelik yaş sınırı mobil, web yönetici ve Go hesap akışlarından kaldırıldı. Yeni 00005_remove_membership_age_requirement.sql migration'ı eski yaş onayı kısıtını ve NOT NULL gereğini kaldırır; mevcut beyanları korur, yeni hesaplar yaş beyanı yazmaz. Geri alma, yaş beyanı olmayan hesaplar varsa durur; hesaplara yetişkinlik beyanı uydurulmaz. Önceki migration dosyaları değişmedi. Güncel API'yi başlatmadan migration up uygulanmalıdır. Yeni migration çalışan PostgreSQL üzerinde henüz uygulanmadı.

Go kaynak derlemesi, mobil ve web TypeScript/ESLint kontrolleri başarılı. Web yönetici ve mobil tarayıcı paketleri üretildi; yeni mobil giriş ve kayıt tasarımları tarayıcıda görüntülendi. Mobil web paketinde üçüncü taraf use client yönergeleri ve paket boyutuyla ilgili mevcut uyarılar devam ediyor. Bu adımda testler çalıştırılmadı; cihaz üzerinde veya çalışan PostgreSQL ile yeni üyelik akışı doğrulanmadı. Mevcut test girdileri yaş onayı olmayan kayıt sözleşmesine ve beş migration'a uyarlandı.

### Ayrı web panelinin durumu — 8 Ekim 2026

Go kaynak derlemesi ile frontend ve mobile TypeScript/ESLint kontrolleri başarılı. Frontend üretim paketi frontend/dist altında başarıyla üretildi. Web paneli bağımsız React uygulamasıdır; mobil yönetici ekranları kaldırıldı. Bu geliştirme adımında testler çalıştırılmadı; cookie oturumu, iki giriş alanının ayrımı ve yeni yönetici/kulüp işlemleri çalışan PostgreSQL veya cihaz üzerinde henüz doğrulanmadı. Mevcut test girdileri dört migration ve mobil oturum kullanım alanına uyarlandı.

00003 ve 00004 migration dosyaları kaynakta hazır; çalışan bir veritabanına uygulanmadı ve gerçek yönetici hesabı oluşturulmadı. Kurulumda önce migration up, ardından kendi giriş bilgilerinle cmd/admin çalıştırılmalı. Sonra frontend ve API başlatılır.

Gerçek PostgreSQL entegrasyon kontrolleri için ayrı test veritabanını bir kez oluştur ve TEST_DATABASE_URL tanımla. Proje kökünden, Compose PostgreSQL servisi çalışırken:

    docker compose exec postgres createdb -U futcareer futcareer_test
    $env:TEST_DATABASE_URL = 'postgres://futcareer:futcareer_local@localhost:5432/futcareer_test?sslmode=disable'
    cd backend
    go test ./...
    go vet ./...
    cd ../mobile
    npx tsc --noEmit
    npm run lint
    npm test -- --runInBand

TEST_DATABASE_URL yoksa PostgreSQL entegrasyon testleri açık bir mesajla atlanır; bağımsız doğrulama testi yine çalışır. Tanımlıysa bağlantı hatası test hatasıdır. Her entegrasyon testi rastgele adlandırılmış ayrı bir şema oluşturur, migration'ları uygular ve sonunda kendi şemasını kaldırır. Test veritabanı kullanıcısının şema oluşturma yetkisi gerekir.

### PostgreSQL geçişinin kontrolleri — 8 Ekim 2026

Bu bölüm iki migration içeren önceki PostgreSQL geçişinin sonuçlarıdır; yeni web yönetici akışının kontrol sonucu değildir.

PostgreSQL 18.6 üzerinde beş Go kontrolü geçti: kalıcı hesap/oturum akışı, geçersiz kayıt doğrulaması, başarısız oturum kaydında hesap transaction'ının geri alınması, oyuncu profili kalıcılığı/yetkilendirmesi ve migration up/down/yeniden uygulama akışı. Auth HTTP test binary'sinin çalışması Windows Uygulama Denetimi tarafından engellendi; bu nedenle tam Go test komutu başarılı sayılmadı.

Derlenen gerçek API ile kayıt, giriş, hesap okuma, profil kaydetme/okuma ve çıkış sonrası 401 yanıtı doğrulandı. Migration komutu ilk up çağrısında iki, ikinci çağrıda sıfır dosya uyguladı; status iki dosyayı applied gösterdi. Migration uygulanmamış veritabanında API başlangıcı beklenen hatayla durdu. Go derlemesi ve go vet başarılı.

Mobil TypeScript ve ESLint kontrolleri, yedi mevcut Jest testi ve tarayıcı paketi üretimi başarılı. Tarayıcı paketi üçüncü taraf use client yönergeleri ve paket boyutu hakkında mevcut derleme uyarıları veriyor.

Compose yapılandırması geçerli. Bu bilgisayarda Docker Desktop kendi soket/dosya erişimi hatası nedeniyle başlatılamadığı için veritabanı kontrolleri artifacts/postgres-test altında taşınabilir PostgreSQL ile yapıldı. Test sunucusu kontrol sonrası kapatıldı.

Ürün planı PROJECT.md, çalışma kuralları AGENTS.md ve uygulama becerisi .agents/skills/fut-career-app/SKILL.md içindedir.

## Kod düzeni

    frontend/                     React + TypeScript web yönetici paneli
      src/app/                    /securityadmin yönlendirmesi ve uygulama girişi
      src/features/auth/          Cookie oturumu ve yönetici giriş ekranı
      src/features/admin/         Kullanıcı/kulüp CRUD, arama ve sayfalama
      src/features/content/       Reklam/haber CRUD, yayın tercihleri ve görsel yükleme
      src/shared/                 API adaptörü, hesap modeli, UI ve Türkçe metinler
      src/styles/                 Merkezi renk tokenları ve web stilleri
      dist/                       Üretilmiş web paketi (Git dışında)
    mobile/
      android/                    Android native proje
      ios/                        iOS native proje
      src/app/                    Navigasyon, tab bar ve uygulama kabuğu
      src/features/auth/
        ui/                       Giriş, kayıt ve hesap ekranları
        application/              Oturum akışları ve form doğrulama
        domain/                   Modeller ve repository/depolama arayüzleri
        data/                     HTTP ve güvenli cihaz depolama adaptörleri
      src/features/players/       Sporcu profil başlığı, medya galerisi, düzenleme ve API erişimi
      src/features/discovery/     Yetkili arama, filtreler, sayfalama ve profil detayı
      src/features/content/       Reklam kaydırıcısı, ana sayfa haberleri, haber listesi/detayı
      src/features/connections/   İstek ekranının ilk kabuğu
      src/features/leagues/       Lig listesi, puan durumu, fikstür ve lig istatistikleri
      src/features/teams/         Takım rehberi, ayrıntıları, başvuru kotası ve kulüp başvuru yönetimi
      src/shared/                 Ortak UI, metinler ve API istemcisi
      src/styles/                 Merkezi renk, boşluk ve köşe tokenları
    backend/
      cmd/api/                    HTTP servisinin başlangıç noktası
      cmd/migrate/                Migration komutu: up/status/down
      cmd/admin/                  İlk yöneticiyi oluşturma komutu
      cmd/gamecatalog/            Arma İzi kataloğunu Wikidata/ESPN'den üreten çevrimdışı komut
      migrations/                 Gömülü ve sürümlü SQL migration dosyaları
      internal/platform/postgres/ Ortak PostgreSQL bağlantı havuzu
      internal/platform/adminweb/ Web paketini /securityadmin altında sunma
      internal/platform/ratelimit/ Ortak giriş denemesi sınırı
      internal/auth/
        domain/                   İş modelleri ve repository arayüzü
        application/              Kayıt, giriş ve oturum kuralları
        data/                     PostgreSQL repository
        transport/                HTTP endpoint'leri
      internal/players/
        domain/                   Oyuncu profili modeli
        application/              Profil doğrulama ve kullanım akışı
        data/                     PostgreSQL profile repository
        transport/                Profil API endpoint'leri
      internal/admin/             Yetkili hesap/kulüp CRUD ve sayfalama
      internal/clubs/domain/      Kanonik kulüp bilgisi
      internal/discovery/         Yetkili ve özel iletişim bilgisi içermeyen profil sorguları
      internal/content/           Reklam/haber yayın kuralları, içerik görselleri ve API

AuthProvider veri adaptörlerini uygulamanın girişinden alır; application katmanı somut HTTP veya Keychain uygulamasına bağlanmaz. Ekranlar ağ çağrısı yapmaz. Yeni özelliklerde aynı modül düzeni korunur.

## Ortam ve bağımlılık notları — 5 Ekim 2026

Bu bilgisayarda Android SDK 34–36 kurulu. İlk 0.87.1 iskeletinin SDK 37 gereksinimi karşılanamadığı için resmi React Native 0.84.1 native şablonu ve paketleri seçildi; Android SDK/build tools 36 ve NDK 27.1 kullanılır. Windows'un Türkçe klasör yoluyla ilgili Java NIO ve native araç sorunları ASCII derleme klasörüyle giderildi.

| Kontrol | Sonuç |
|---|---|
| Go API derlemesi | Başarılı |
| Go auth/HTTP kontrolleri | 3 test geçti |
| Mobil form/güvenli depolama kontrolleri | 7 test geçti |
| TypeScript ve ESLint | Başarılı, lint uyarısı yok |
| Android/iOS JavaScript paketleri | İkisi de üretildi |
| Tarayıcı önizlemesi | Web paketi üretildi; giriş ekranı tarayıcıda görüntülendi |
| Android native debug APK | arm64-v8a ve x86_64 derlemesi başarılı; artifacts/android/app-debug.apk |
| iOS native derlemesi | macOS/Xcode üzerinde yapılmalı |
| Cihaz üzerindeki görsel kontrol | Bağlı cihaz/emülatör olmadığı için yapılmadı |

Yukarıdaki sonuçlar 5 Ekim'deki ilk geliştirme dilimine aittir; PostgreSQL geçişinin güncel kontrolleri ayrıca kaydedilir.

Bağımlılık taramasındaki mevcut yüksek önem dereceli sonuçlar braces paketinin [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) uyarısına ve araç zincirindeki türev bağımlılıklara dayanıyor. 3.0.3 için yayımlanmış düzeltme bulunmuyor. Otomatik olarak önerilen framework sürüm düşürme uygulanmadı; bu bulgu yayın öncesi kapatılmalı.
