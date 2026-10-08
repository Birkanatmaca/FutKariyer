# Fut Career

Futbolcuları, kulüpleri ve antrenörleri bir araya getiren futbol ağı. React web yönetici paneli, React Native 0.84.1 + TypeScript mobil istemci, Go API ve PostgreSQL kullanır. Go, React Native ve PostgreSQL ürünün zorunlu teknoloji üçlüsüdür. Yönetici web paneli frontend/, diğer kullanıcıların uygulaması mobile/, ortak servis backend/ altındadır.

## Bu sürüm

- Yaş sınırı olmadan herkese açık sporcu kaydı; yönetici tarafından açılan kulüp/antrenör hesapları
- Kayıt, giriş, oturum geri yükleme, hesap bilgileri ve çıkış
- Profesyonel koyu mobil tema, sürekli etiketli dört sekme, tutarlı başlıklar, safe area ve klavye uyumu; şehir, pilot veya yaş tanıtım etiketleri yok
- Kalıcı PostgreSQL kullanıcı/oturum verisi; bcrypt şifre hash'i, rastgele bearer token ve sunucuda yalnızca token hash'i
- Go repository/uygulama/HTTP katmanları; mobil özellik modülleri ve merkezi tasarım tokenları
- Oyuncu profili temel alanları, uygunluk ve keşif tercihi; PostgreSQL kalıcılığı ve hesap türü yetkilendirmesi
- pgx üzerinden ortak bağlantı havuzu ve Goose ile sürümlü SQL migration yapısı
- /securityadmin adresinde ayrı web yönetici girişi ve kullanıcı/kulüp paneli; arama ve sunucuda 20 kayıtlık sayfalama
- Yönetici için HttpOnly cookie, diğer hesaplar için mobil bearer oturumu; sunucuda ayrılmış oturum kullanım alanları
- Kullanıcı ve kulüp oluşturma, okuma, düzenleme, silme; erişimi durdurma ve şifre yenileme

Oyuncu profili temel alanları Go API üzerinden kaydedilir. Keşifte görünme tercihi saklanır; gerçek keşif akışı henüz bağlı değildir. Medya yükleme ve tanışma istekleri sonraki dilimdedir. E-posta doğrulama ve şifre kurtarma henüz eklenmemiştir. Kullanıcı kararıyla üyelik yaş sınırı ve yaş onayı kaldırılmıştır.

## Güncel geliştirme durumu — 8 Ekim 2026

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

### Migration düzeni

backend/migrations altında sıralı SQL dosyaları bulunur: 00001_create_auth.sql hesap ve oturumları, 00002_create_player_profiles.sql oyuncu profillerini, 00003_create_admin_and_clubs.sql yönetici/kulüp bilgilerini, 00004_separate_admin_sessions.sql web ve mobil oturum kullanım alanlarını oluşturur. 00004 eski yönetici bearer oturumlarını iptal eder; mevcut mobil kullanıcı oturumları korunur. Her dosyada Goose Up ve Down bölümleri vardır. SQL dosyaları binary'ye gömülür; çalışma dizinine bağlı değildir.

Backend klasöründen:

    go run ./cmd/migrate status
    go run ./cmd/migrate up

up bekleyen migration'ları uygular ve yeniden çalıştırıldığında uygulanmış dosyaları atlar. PostgreSQL advisory lock aynı anda iki migration işleminin çakışmasını önler. API açılışında yalnızca şema sürümü kontrol edilir; tablo oluşturma repository'lerin sorumluluğu değildir.

    go run ./cmd/migrate down

down en son migration'ı geri alır. Başlangıç migration'larının Down bölümleri ilgili tabloları ve içlerindeki veriyi kaldırır. 00003 geri alımı; yönetici hesabı, kullanıcı adı kullanan hesap, e-postası olmayan hesap veya erişimi kapalı kullanıcı varsa reddedilir. Bu koruma giriş bilgilerini kaybetmeyi ve kapalı hesapları yanlışlıkla açmayı önler; önce bu hesapların verisi için uygun bir geçiş planlanmalıdır.

00004 geri alımı da web yönetici oturumlarını iptal eder; onları mobil bearer oturumlarına dönüştürmez.

Yeni şema değişikliğini bir sonraki sıralı dosyaya ekle (örneğin 00005_...). Uygulanmış migration dosyasını düzenleme. Geçiş PostgreSQL şemasını kurar; eski SQLite dosyalarından otomatik veri aktarımı yapmaz. Bu görev sırasında depoda aktarılacak SQLite veri dosyası bulunmadı.

Sürücü [pgx](https://pkg.go.dev/github.com/jackc/pgx/v5/stdlib), migration sağlayıcısı [Goose](https://pkg.go.dev/github.com/pressly/goose/v3) kullanılır. Goose'un kendi test bağımlılığı nedeniyle go.mod içinde SQLite dolaylı bağımlılığı görünebilir; uygulama ve proje testleri PostgreSQL kullanır.

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

Kullanıcı listesi /securityadmin/users, kulüp listesi /securityadmin/clubs adresindedir. Doğrudan açma ve sayfa yenileme desteklenir. Web oturumu sunucunun HttpOnly ve SameSite=Strict cookie'sindedir; localStorage/sessionStorage kullanılmaz. Cookie sayesinde sayfa yenilendiğinde oturum geri yüklenir. Web oturumu en fazla 8 saattir (SESSION_TTL daha kısaysa o süre geçerlidir).

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

Kayıt gövdesi fullName, email, password ve role alanlarını içerir; yaş onayı gönderilmez. Herkese açık kayıt yalnızca role: player kabul eder. Kulüp/antrenör/yönetici rolü bu yoldan açılamaz. Mobil giriş gövdesi identifier ve password içerir; identifier sporcu/antrenör için e-posta, kulüp için kullanıcı adıdır. Yönetici bu uç noktadan oturum açamaz (403). Önceki email + password giriş gövdesi de desteklenir. Başarılı mobil kayıt/giriş token, expiresAt ve user döndürür. user alanında username ve active de bulunur; şifre veya hash döndürülmez. Mobil özel isteklerde Authorization: Bearer <token> başlığı gerekir.

### Yönetici API'si

Bu yollar yalnızca admin rolü ve admin kullanım alanına sahip cookie oturumuyla çalışır. Mobil bearer token yönetici API'sinde kabul edilmez; yönetici cookie token'ı mobil API'de kabul edilmez. Cookie eksik, yanlış kullanım alanında veya süresi dolmuşsa 401 alınır. Yazma isteklerinde Origin başlığı ADMIN_ORIGIN ile eşleşmelidir; eşleşmiyorsa 403 alınır.

- POST /v1/admin/auth/login: identifier (yönetici kullanıcı adı), password. Yönetici dışındaki hesap doğru şifreyle bile 403 alır. Yanıtta user ve expiresAt bulunur; token JSON'a yazılmaz, yalnızca HttpOnly cookie ile gönderilir.
- GET /v1/admin/auth/me: cookie ile yönetici hesabını okur.
- POST /v1/admin/auth/logout: yönetici oturumunu iptal eder ve cookie'yi kaldırır; 204 döner.

- GET /v1/admin/users ve GET /v1/admin/clubs: liste. page varsayılan 1, pageSize varsayılan 20 (1–100), search en fazla 100 karakter. Yanıt items, page, pageSize, total ve totalPages içerir. Sıralama createdAt ve id azalan; arama ad/e-posta/kullanıcı adında çalışır.
- GET /v1/admin/users/{id} veya /v1/admin/clubs/{id}: tek kayıt.
- POST /v1/admin/users: fullName, email, password, role (player veya coach).
- POST /v1/admin/clubs: fullName (kulüp adı), username, password; isteğe bağlı email ve district. Sunucu rolü club olarak belirler. Kulüp ve hesabı tek transaction ile oluşturulur.
- PUT /v1/admin/users/{id} veya /v1/admin/clubs/{id}: fullName, email, username, district, active. active zorunludur; rol değiştirilemez. Sporcu/antrenörde username kullanılmaz.
- PUT /v1/admin/users/{id}/password veya /v1/admin/clubs/{id}/password: password. Yeni şifre bütün oturumları iptal eder.
- DELETE /v1/admin/users/{id} veya /v1/admin/clubs/{id}: hesap ve bağlı oturum/profil/kulüp bilgileri kalıcı silinir; 204 döner.

Yönetici hesapları güncelleme, silme ve şifre yenileme yollarından korunur. Kulüp yolları başka rolün ID'sini kabul etmez. Erişimin durdurulması veya giriş kimliğinin değişmesi oturumları iptal eder. Oturum sürümü kontrolü eşzamanlı giriş/şifre yenileme sırasında eski girişle oluşabilecek oturumları da geçersiz kılar.

Oyuncu profilini kaydetme gövdesi position, dominantFoot, experienceYears, currentClub, availability ve discoverable alanlarını içerir. dominantFoot: right, left, both veya boş; availability: seeking_team, open_to_offers veya not_available olabilir. Mevcut kulüp oyuncu beyanıdır. Profil uç noktaları yalnızca oyuncu hesaplarına açıktır.

Şifre en az 10 karakter ve en fazla 72 UTF-8 bayt olabilir. Kimlik doğrulama denemeleri IP başına dakikada 20 istekle sınırlıdır. Proxy arkasına alınırsa istemci IP doğrulama/rate limit yapılandırması deployment katmanında tamamlanmalı. Oturum kapatma API'ye ulaşmayı gerektirir; bağlantı kesikken istemci oturumu silip sunucu iptal edildiğini varsaymaz.

## Kontroller

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
      src/features/players/       Oyuncu profil düzenleme ve API erişimi
      src/features/discovery/     Keşif ekranının ilk kabuğu
      src/features/connections/   İstek ekranının ilk kabuğu
      src/shared/                 Ortak UI, metinler ve API istemcisi
      src/styles/                 Merkezi renk, boşluk ve köşe tokenları
    backend/
      cmd/api/                    HTTP servisinin başlangıç noktası
      cmd/migrate/                Migration komutu: up/status/down
      cmd/admin/                  İlk yöneticiyi oluşturma komutu
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
