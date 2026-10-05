# Fut Career

Ankara pilotu için React Native 0.84.1 + TypeScript mobil istemci ve Go auth API'si.

## Bu sürüm

- Oyuncu, antrenör ve kulüp hesabı seçimi
- Kayıt, giriş, oturum geri yükleme, hesap bilgileri ve çıkış
- Koyu tema, özel dört sekmeli tab bar, safe area ve klavye uyumu
- Kalıcı SQLite kullanıcı/oturum verisi; bcrypt şifre hash'i, rastgele bearer token ve sunucuda yalnızca token hash'i
- Go repository/uygulama/HTTP katmanları; mobil özellik modülleri ve merkezi tasarım tokenları

Keşif ve istek ekranları bu dilimde boş durumlarıyla hazırlanmıştır. Profil yayınlama, medya yükleme, gerçek keşif ve tanışma işlemleri sonraki dilimdedir. E-posta doğrulama ve şifre kurtarma henüz eklenmemiştir. 18+ koşulu bu dilimde kullanıcı beyanıdır.

## Backend'i başlat

Go 1.26 veya üstü gerekir. Proje kökünden:

    cd backend
    go mod download
    go run ./cmd/api

API varsayılan olarak 8080 portunda çalışır. SQLite verisi backend/data/futcareer.db içinde tutulur ve uygulama yeniden başlatıldığında korunur. Örnek ayarlar backend/.env.example içinde; uygulama işletim sistemi ortam değişkenlerini okur, .env dosyasını otomatik yüklemez.

| Değişken | Varsayılan |
|---|---|
| LISTEN_ADDR | :8080 |
| DATABASE_PATH | ./data/futcareer.db |
| SESSION_TTL | 720h |

## Tarayıcıda aç

Tarayıcı önizlemesi için Node.js 22.12+ gerekir. Go API 8080 portunda çalışırken:

    cd mobile
    npm ci
    npm run web

Uygulama adresi: [http://localhost:5173/](http://localhost:5173/).

Giriş, kayıt ve tab bar aynı React Native ekranlarını kullanır. [React Native Web](https://necolas.github.io/react-native-web/docs/multi-platform/) tarayıcı görünümünü sağlar; Vite /api isteklerini yerel Go API'ye aktarır. Tarayıcı oturumu yalnızca bellektedir; yenileme sonrası yeniden giriş gerekir.

8081 adresi Metro mobil geliştirme sunucusudur. Tarayıcı önizlemesinin adresi 5173'tür. Backend'i bir terminalde bir kez çalıştır. 8080 için bind hatası portun zaten kullanıldığını gösterir; [API sağlık adresini](http://localhost:8080/health) kontrol et.

Yerel önizleme paketini üretmek ve açmak için:

    npm run build:web
    npm run preview:web

web ve preview:web aynı 5173 portunu kullanır; aynı anda çalıştırma. Bu paket yerel geliştirme içindir.

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

Kayıt gövdesi fullName, email, password, role ve adultConfirmed alanlarını içerir. role: player, coach veya club; adultConfirmed: true. Giriş gövdesi email ve password içerir. Başarılı kayıt/giriş token, expiresAt ve user döndürür. Özel isteklerde Authorization: Bearer <token> başlığı gerekir.

Şifre en az 10 karakter ve en fazla 72 UTF-8 bayt olabilir. Kimlik doğrulama denemeleri IP başına dakikada 20 istekle sınırlıdır. Proxy arkasına alınırsa istemci IP doğrulama/rate limit yapılandırması deployment katmanında tamamlanmalı. Oturum kapatma API'ye ulaşmayı gerektirir; bağlantı kesikken istemci oturumu silip sunucu iptal edildiğini varsaymaz.

## Kontroller

    cd backend
    go test ./...
    go vet ./...
    cd ../mobile
    npx tsc --noEmit
    npm run lint
    npm test -- --runInBand

Ürün planı PROJECT.md, çalışma kuralları AGENTS.md ve uygulama becerisi .agents/skills/fut-career-app/SKILL.md içindedir.

## Kod düzeni

    mobile/
      android/                    Android native proje
      ios/                        iOS native proje
      src/app/                    Navigasyon, tab bar ve uygulama kabuğu
      src/features/auth/
        ui/                       Giriş, kayıt ve hesap ekranları
        application/              Oturum akışları ve form doğrulama
        domain/                   Modeller ve repository/depolama arayüzleri
        data/                     HTTP ve güvenli cihaz depolama adaptörleri
      src/features/discovery/     Keşif ekranının ilk kabuğu
      src/features/connections/   İstek ekranının ilk kabuğu
      src/shared/                 Ortak UI, metinler ve API istemcisi
      src/styles/                 Merkezi renk, boşluk ve köşe tokenları
    backend/
      cmd/api/                    HTTP servisinin başlangıç noktası
      internal/auth/
        domain/                   İş modelleri ve repository arayüzü
        application/              Kayıt, giriş ve oturum kuralları
        data/                     SQLite repository ve şema
        transport/                HTTP endpoint'leri

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

Bağımlılık taramasındaki mevcut yüksek önem dereceli sonuçlar braces paketinin [GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) uyarısına ve araç zincirindeki türev bağımlılıklara dayanıyor. 3.0.3 için yayımlanmış düzeltme bulunmuyor. Otomatik olarak önerilen framework sürüm düşürme uygulanmadı; bu bulgu yayın öncesi kapatılmalı.
