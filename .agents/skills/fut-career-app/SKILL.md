---
name: fut-career-app
description: Build or change the Fut Career product while following its football network scope, dark visual identity, and consistent architecture and coding conventions.
---

# Fut Career uygulama rehberi

Bu beceri, Fut Career ürün tasarımı ve uygulama geliştirme işlerinde kullanılır.

## Önce ürün kararlarını oku

- Her görevde depo kökündeki PROJECT.md ve AGENTS.md dosyalarını oku.
- Kullanıcının güncel isteği önceki proje kararlarını değiştirebilir. Değişikliği uygula ve ilgili dokümanları aynı görevde güncelle.
- Ürün amatör futbolcular, kulüpler ve antrenörler içindir. Üyelik yaş sınırı kullanıcı kararıyla kaldırılmıştır; mobil kayıt, yönetici hesabı oluşturma ve ilk yönetici kurulumunda yetişkinlik onayı isteme. Ankara iç planlamadaki ilk pilot bölgesidir; mobil ekranda şehir, pilot ve yaş tanıtım etiketlerini gösterme. Her iki taraf da arama yapabilir; özel iletişim ancak istek kabul edilince açılır.
- Herkese açık kayıt yalnızca sporcu içindir. Kulüp hesaplarını kullanıcı adı ve şifreyle yönetici oluşturur. Yönetici API işlemlerinde rolü her istekte sunucuda kontrol et; istemci ekranı yetkilendirme yerine geçmez. Listeleri sunucuda sayfala. Kulüp hesabı ve kulüp bilgilerini tek işlemde yaz; şifreyi hash dışında saklama veya döndürme. Şifre yenileme ve erişimi durdurmada oturumları iptal et. Yönetici hesaplarını panel CRUD işlemlerinden koru; ilk yönetici ayrı kurulum komutuyla oluşturulur.
- Go, React Native + TypeScript ve PostgreSQL zorunlu teknoloji üçlüsüdür. mobile/android ve mobile/ios native projelerini birlikte koru. Mobil kodda platform farklarını dar adaptörlerde tut; aynı ekranı iki platform için çoğaltma.
- Yönetici yalnızca frontend/ altındaki React + TypeScript + Vite web panelinden /securityadmin adresiyle giriş yapar; sporcu, kulüp ve antrenör mobil istemciyi kullanır. Mobilde yönetici UI veya yönetici oturumu bulundurma. Web cookie oturumunu HttpOnly/SameSite=Strict ve HTTPS için Secure ile koru; token'ı tarayıcı depolarına veya JSON yanıtına yazma. API oturum kullanım alanını doğrulasın; yönetici yazma isteklerinde yapılandırılmış Origin kontrolü yap. frontend ile mobile birbirinin kaynaklarına bağımlı değildir.
- Yerel tarayıcı önizlemesi React Native Web + Vite kullanır ve aynı ekranları çalıştırır. Web bağlantısı/depolaması gibi farkları .web.ts adaptörlerinde tut; tarayıcı önizlemesinin oturumunu yalnızca bellekte sakla. Metro mobil geliştirme sunucusu, Vite tarayıcı sunucusudur.

## Ürün deneyimi

- İlk sürümün merkezinde oyuncu profili, video/fotoğraf sunumu, görünürlük kontrolü, kulüp/antrenör keşfi ve karşılıklı tanışma isteği bulunur.
- Genç sporcu gelişim takibi, futbol okulu haritası ve fikstürler ilk MVP kapsamı dışındadır; kullanıcı kapsamı değiştirmedikçe ekleme.
- Oyuncu, kulüp ve antrenör beyanlarını doğrulanmış bilgi gibi sunma. Doğrulama durumu açık ve tutarlı olmalı.
- Profilin aranabilir olması oyuncunun kontrolündedir. Tanışma talebi kabul edilmeden kişisel iletişim bilgisini açma.
- Arayüz dili Türkçe; kod içi adlandırmalar İngilizce olsun. Kullanıcıya gösterilen metinleri kod içine dağınık biçimde gömmek yerine mevcut metin/i18n düzenini izle.
- Mobil metinlerde futbol profili, deneyim, kulüp keşfi ve bağlantı kurma amacını anlatan genel ifadeler kullan. Teknik geliştirme planlarını ürün akışına yazma. Gerçek veri olmadan profil görünürlüğü, doğrulama veya başarı sayısı sunma.

## Görsel kimlik

- PROJECT.md içindeki renk tokenları tek kaynaktır. Renkleri bileşenlere doğrudan HEX olarak yazma; merkezi tokenlardan kullan.
- Koyu tema varsayılandır: kömür/lacivert taban, katmanlı yüzeyler, açık metin ve ölçülü limon yeşili marka vurgusu.
- Marka yeşilini her bileşene yayma. Ana aksiyon, seçili durum ve önemli futbol sinyallerini belirginleştirmek için kullan.
- Kalıcı okunabilirlik, net hiyerarşi ve rahat tarama; dekoratif efektlerden önemlidir. Durumları yalnızca renkle ifade etme.
- Oyuncu ve medya içeriğine alan aç. Genel amaçlı dashboard şablonlarını, yoğun cam efekti kullanımını, rastgele gradientleri ve sırf süs için animasyonları kullanma.
- Yükleniyor, boş, hata, seçili ve klavye odağı durumlarını arayüz tasarımının parçası olarak ele al.
- Mobil girişte kısa ürün mesajı ve formu öne çıkar; ana sayfada profil ve keşif aksiyonlarını açık tut. Başlıklarda ortak hiyerarşi, alt gezinmede sürekli görünen dört sekme etiketi kullan.
- Tasarım değişikliği marka paletini etkiliyorsa önce PROJECT.md içindeki tokenları güncelle, sonra tüm tüketicileri aynı değere bağla.

## Kod ve mimari kuralları

- Web yönetici uygulaması frontend/, mobil uygulama mobile/, Go servisi backend/ altında bulunur. İki istemcinin src/ şeması aşağıdaki katmanları izler; Go internal/<feature>/domain, application, data, transport paketlerini ve cmd/api girişini kullanır. Web bileşenleri HTML/CSS ve merkezi proje tokenlarını, mobil bileşenler React Native tokenlarını kullanır.
- PostgreSQL bağlantısını pgx üzerinden internal/platform/postgres altında tek havuzda yönet; özellik repository'lerine bağlantıyı uygulamanın girişinden ver. Repository açılışında şema oluşturma. backend/migrations altındaki gömülü Goose SQL migration dosyalarını cmd/migrate üzerinden up/status/down komutlarıyla yönet. API başlangıcında şemanın güncel olduğunu kontrol et. Uygulanmış migration dosyasını değiştirme; her şema değişikliğine yeni sıralı migration ekle. PostgreSQL entegrasyon kontrolleri TEST_DATABASE_URL ile ayrı test veritabanında ve her test için ayrı şemada çalışır.
- Özellik odaklı modüller kullan: auth, players, clubs, coaches, discovery, connections, media, admin.
- Kaynak kodu katmanlarını tutarlı tut: src/app uygulama kabuğu ve yönlendirme; src/features/<feature>/ui kullanıcı arayüzü; application kullanım akışları; domain iş modelleri ve kuralları; data repository/API uygulamaları; src/shared/ui, src/shared/lib ve src/shared/api ortak kod; src/styles tasarım tokenları. Kullanılmayan katmanlar için boş klasör açma.
- Bağımlılık yönü UI → application → domain olmalıdır. Repository arayüzlerini domain/application sınırında tanımla; data katmanı bu arayüzleri uygular ve dış API/depolamayla konuşur. Framework zorunlu kıldığı dosyaları kendi konumunda tutabilir; iş kurallarını framework'e veya UI katmanına taşıma.
- Her özellik kendi görünümünü, iş mantığını, veri erişim arayüzünü ve doğrulama kurallarını sahiplenir. Bir özelliğin iç dosyalarına başka özelliklerden doğrudan bağlanma; gereken dar arayüzü dışa aç.
- Ortak UI ve yardımcı modüller yalnızca gerçekten birden fazla özellik tarafından kullanıldığında shared alanına taşınır. shared içinden özellik modüllerine bağımlılık kurma.
- Görünüm bileşenleri doğrudan ağ, veritabanı veya dosya depolama çağrısı yapmaz. Veri erişimi servis/repository sınırından geçer.
- Oyuncu, kulüp, antrenör, tanışma isteği ve medya alanlarının kanonik modelini tek yerde tut. Aynı iş kavramı için farklı modüllerde çelişen tip veya doğrulama kuralı üretme.
- Dışarıdan gelen form, API ve kalıcı veri girişlerini ilgili sınırda doğrula. UI bileşenine domain kuralı veya veri kaynağı ayrıntısı yükleme.
- Klasör ve genel dosya adlarında kebab-case, UI bileşen adlarında PascalCase, hook adlarında useCamelCase, değişken ve fonksiyonlarda camelCase kullan. Seçilecek framework'ün zorunlu dosya adlandırma kuralı varsa onunla çelişme.
- Projede mevcut biçimlendirici, linter ve bağımlılık düzenini izle. Küçük bir iş için yeni kütüphane veya ikinci bir stil sistemi ekleme.
- Yeni ekranı eklerken dar ve anlaşılır bir bileşen yapısı kur; gereksiz soyutlama veya tek dev bileşen oluşturma.

## Tutarlılık kuralı

Ürün kapsamı, tokenlar veya modül sınırları değişecekse değişikliği önce PROJECT.md ve/veya bu beceride tanımla; ardından kodu yeni karara göre düzenle. Eski standardı sessizce delerek paralel bir desen oluşturma. Kullanıcı yeni karar vermedikçe bu kuralları koru.
