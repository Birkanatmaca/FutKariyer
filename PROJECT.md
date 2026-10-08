# Fut Career — Proje Tanımı

**Sürüm:** 0.8 · **Durum:** Profesyonel mobil arayüz ve yaş sınırı olmadan üyelik · **Tarih:** 8 Ekim 2026

## Ürün özeti

Fut Career, futbolcuların yeteneklerini ve deneyimlerini kulüp ve antrenörlere tanıtmasını; kulüp ve antrenörlerin de uygun oyuncuları keşfetmesini sağlayan iki yönlü bir futbol ağıdır.

Ürünün ilk başarısı profil sayısı değil, oyuncu ile kulüp/antrenör arasında kurulan karşılıklı ve anlamlı bağlantıdır.

## İlk pilot

- **Şehir:** Ankara
- **Öncelikli kullanıcılar:** Amatör futbolcular, kulüpler ve antrenörler. Kullanıcının 8 Ekim 2026 kararıyla üyelik yaş sınırı kaldırıldı; kayıt veya hesap oluşturma sırasında yaş onayı alınmaz.
- **Mobil sunum:** Şehir, pilot ve yaş etiketleri gösterilmez. Metinler futbol profili, deneyim, kulüp keşfi ve bağlantı kurma amacını genel ifadelerle anlatır. Ankara iç planlamadaki ilk pilot bölgesidir; mobil marka mesajı değildir. Yeni hesapların mevcut şehir varsayılanı kullanıcı konumu olarak arayüzde gösterilmez.
- **Eşleşme modeli:** Her iki taraf da keşif yapabilir ve tanışma isteği gönderebilir.
- **İletişim kuralı:** İstek kabul edilmeden tarafların özel iletişim bilgileri açılmaz.
- **Platform:** React Native 0.84.1 + TypeScript; Android ve iOS native projeleri depoda tutulur. Android SDK 36 ile uyumlu resmi başlangıç şablonu kullanılır.
- **Yönetici platformu:** frontend/ altında bağımsız React + TypeScript + Vite web uygulaması. Yönetici girişi /securityadmin adresindedir; kullanıcı ve kulüp yönetimi yalnızca bu paneldedir. Mevcut React ve Vite araçları kullanılır.
- **Tarayıcı önizlemesi:** Aynı React Native ekranları React Native Web ve Vite ile yerelde görüntülenir. Kayıt/giriş gerçek Go API'ye bağlanır. Tarayıcı oturumu yalnızca bellekte tutulur; sayfa yenilendiğinde yeniden giriş gerekir. Bu önizleme bir web yayınlama kararı değildir.
- **Temel teknoloji kararı:** Go, React Native ve PostgreSQL ürünün zorunlu teknoloji üçlüsüdür.
- **Backend:** Go HTTP API ve PostgreSQL. pgx sürücüsü üzerinden ortak bağlantı havuzu kullanılır. Şema, Goose ile sürümlü SQL migration dosyalarından yönetilir; uygulama başlangıcı migration çalıştırmaz ve şema sürümünü kontrol eder.
- **Depo düzeni:** frontend/ web yönetici paneli, mobile/ sporcu/kulüp/antrenör mobil istemcisi, backend/ ortak Go API ve PostgreSQL erişimi.

## Kullanıcılar ve ana ihtiyaçlar

| Kullanıcı | İhtiyaç |
|---|---|
| Oyuncu | Yeteneklerini, deneyimini ve uygunluk durumunu görünür kılmak; takım/antrenör fırsatı bulmak |
| Kulüp | İhtiyaç duyduğu mevkilerde oyuncu keşfetmek ve tanışma talebi göndermek |
| Antrenör | Oyuncuları incelemek ve çalışma/fırsat için iletişim kurmak |
| Yönetici | Hesapları ve kulüp/antrenör doğrulamasını, bildirimleri ve uygunsuz içerikleri yönetmek |

## Temel kullanıcı akışları

1. Oyuncu profilini oluşturur; mevki, baskın ayak, futbol deneyimi, mevcut kulüp ve uygunluk bilgisini ekler.
2. Oyuncu fotoğraf veya video yükler ve profil görünürlüğünü seçer.
3. Doğrulanmış kulüp/antrenör profilleri Ankara'da filtrelerle oyuncu arar.
4. Oyuncu veya kulüp/antrenör tanışma isteği gönderir.
5. Alıcı isteği kabul veya reddeder. Kabul sonrası iletişim başlar.

## MVP kapsamı

- Oyuncu profili ve medya galerisi
- Oyuncunun profil görünürlüğünü açıp kapatması
- Oyuncu uygunluk durumu: takım arıyor, görüşmelere açık, şu an görüşmüyor
- Kulüp ve antrenör profilleri ile yönetici doğrulaması
- Ankara pilotu için oyuncu arama ve temel filtreler
- Tanışma isteği gönderme, kabul/ret ve bildirim
- Profil/medya bildirimi, engelleme ve yönetici incelemesi

Oyuncunun kendi eklediği kulüp/anlaşma bilgisi doğrulanmamışsa açık biçimde oyuncu beyanı olarak gösterilir. Doğrulanmış durum izlenimi verilmez.

## Sonraki aşamalara bırakılanlar

- Genç sporcular için gelişim takibi
- Futbol okulu keşfi ve harita
- Fikstür ve sezon ekranları
- Otomatik öneri/eşleştirme algoritması
- Herkese açık sosyal akış

## Başarı ölçümü

**Ana ölçüt:** Haftalık karşılıklı tanışma sayısı. Bir bağlantı, tanışma isteğinin kabul edilmesi ve iki tarafın en az bir kez yanıt vermesiyle anlamlı sayılır.

Yardımcı ölçütler: tamamlanmış oyuncu profilleri, doğrulanmış kulüp/antrenör sayısı, profil görüntülenmesinden isteğe dönüşüm ve isteklerin yanıtlanma süresi. Sayısal hedefler pilot ortakları ve kullanıcı görüşmeleri belirlendikten sonra kararlaştırılır.

## Tamamlanan ilk geliştirme dilimi

Kayıt/giriş, güvenli cihaz oturumu, oturum geri yükleme ve çıkış uygulandı. Herkese açık kayıt sporcu içindir; kulüp/antrenör hesaplarını yönetici açar. React Native kabuğu Ana Sayfa, Keşfet, İstekler ve Profil sekmeleri ile özel bir tab bar içerir. Yönetici ayrı web panelinden giriş yapar. Go servisi PostgreSQL üzerinde hesapları ve oturum hash'lerini saklar.

Bu dilimde keşif ve istek ekranları boş durumlarıyla hazırlanmıştır. Oyuncu profili yayınlama, medya yükleme ve gerçek eşleşme işlemleri henüz uygulanmadı. Çalıştırma ve doğrulama durumu README.md içinde tutulur.

## Oyuncu profili dilimi

Oyuncu hesabı için mevki, baskın ayak, futbol deneyimi, mevcut kulüp beyanı ve uygunluk durumu kaydedilir. Profilin keşifte görünme tercihi sunucu tarafında saklanır. Bu tercih keşif akışı tamamlanana kadar görünürlüğü fiilen değiştirmez. Medya yükleme, gerçek profil keşfi ve tanışma istekleri sonraki geliştirme adımlarıdır. Teknik çalıştırma ve doğrulama durumu README.md içinde tutulur.

## Hesap ve yönetici akışı

- Herkese açık kayıt yalnızca sporcu hesabı oluşturur; yaş sınırı veya yetişkinlik onayı yoktur. Yönetici tarafından hesap oluşturma ve ilk yönetici kurulumu da yaş onayı istemez. Kulüp hesabı ve giriş bilgileri yönetici tarafından hazırlanır; kulüp kendi kendine kayıt olamaz.
- Sporcu e-posta ve şifreyle, kulüp yönetici tarafından verilen kullanıcı adı ve şifreyle mobil giriş ekranından giriş yapar. Mevcut antrenör hesapları korunur; yönetici antrenör hesabı da açabilir. Yönetici /securityadmin web girişini kullanır.
- Yönetici kullanıcıları ve kulüpleri sunucu tarafında sayfalama ile listeler; hesap oluşturma, düzenleme, silme, erişimi durdurma ve şifre yenileme işlemlerini yapar. Hesap türü düzenleme yoluyla yöneticiye yükseltilemez.
- Kulüp bilgisi, kulüp hesabına bağlı olarak tek yerde saklanır. Kulüp kaydı ve giriş hesabı birlikte oluşturulur ve birlikte silinir. Yönetici tarafından eklenmiş olmak doğrulama rozeti anlamına gelmez.
- İlk yönetici varsayılan şifre olmadan ayrı bir kurulum komutuyla oluşturulur. Yönetici hesapları panelde silinemez veya durdurulamaz. Şifre değişikliği ve hesap erişiminin durdurulması mevcut oturumları iptal eder.
- Kullanıcı adı 3–32 karakterdir; küçük Latin harfleri, rakam, nokta, alt çizgi ve kısa çizgi kabul edilir. Şifreler yalnızca bcrypt hash olarak saklanır ve panel API'si tarafından geri döndürülmez.
- Yönetici paneli frontend/ altında bağımsız web uygulamasıdır. Mobil kaynaklarda yönetici ekranları bulunmaz. Mobil tarayıcı önizlemesi geliştirme aracıdır; son kullanıcı web uygulaması değildir.
- Yönetici oturumu HttpOnly ve SameSite=Strict cookie ile tutulur; HTTPS yayında Secure kullanılır. Tarayıcı depolarına token yazılmaz. Yönetici ve mobil oturumların kullanım alanı veritabanında ayrıdır. Web yazma isteklerinin Origin değeri yapılandırılmış yönetici adresiyle eşleşmelidir.
- Web paneli ve /api aynı origin üzerinde çalışır. Vite geliştirme sunucusu /api yollarını Go servisine aktarır; üretilmiş web dosyaları yapılandırıldığında Go tarafından /securityadmin altında sunulur. Yayın sağlayıcısı henüz seçilmedi.

## Tasarım sistemi

Fut Career'ın görsel yönü **karanlık, sportif, rafine ve içerik odaklı** olmalı. Futbol sahasının gece atmosferi ve saha ışıklarının enerjisi hissedilmeli; arayüz neon efektlere veya genel amaçlı yönetim paneli görünümüne dönüşmemeli.

### Renk paleti

| Token | HEX | Kullanım |
|---|---|---|
| color-bg | #0B0F14 | Uygulama ana zemini |
| color-surface | #121922 | Kart ve ana yüzeyler |
| color-surface-raised | #1B2733 | Öne çıkan ve yükseltilmiş yüzeyler |
| color-surface-overlay | #222F3C | Seçili/üst katman yüzeyler |
| color-border | #2D3947 | Ayırıcı ve kenarlıklar |
| color-text-primary | #F4F7FA | Ana metin |
| color-text-secondary | #A7B3BF | Yardımcı metin |
| color-text-muted | #7F8C99 | İkincil, düşük öncelikli metin |
| color-brand | #B6F36A | Ana marka vurgusu ve birincil aksiyon |
| color-brand-hover | #A2E34B | Marka aksiyonunun etkileşim durumu |
| color-brand-ink | #121922 | Marka zeminindeki metin/ikon |
| color-accent | #55D7C4 | İkincil vurgu, sınırlı kullanım |
| color-success | #53D68A | Başarılı işlem/durum |
| color-warning | #F5BB52 | Dikkat gerektiren durum |
| color-danger | #FF6B72 | Hata, kaldırma veya risk durumu |
| color-info | #74AFFF | Bilgilendirme |

Marka rengi çim yeşilinden esinlenen canlı limon yeşilidir. Yeşil tüm ekranı kaplamaz; öncelikli aksiyonları ve önemli durumları vurgular. Durumlar yalnızca renkle anlatılmaz; metin veya ikonla da belirtilir. Tam siyah zemin, rastgele renk değerleri ve sürekli gradient kullanımı tercih edilmez.

### Görsel ilkeler

- Karanlık tema ilk ve varsayılan temadır.
- Derinlik; katmanlı yüzeyler, boşluk, tipografi ve kontrollü kenarlıklarla kurulur.
- Oyuncu profili ve medya gerçek ürünün merkezinde olmalı; dekoratif kart yığınları içeriğin önüne geçmemeli.
- Futbol verisi hızlı taranabilir olmalı: mevki, uygunluk ve doğrulama durumu kolay seçilmeli.
- Hareket kısa ve işlevsel olmalı; hareketsiz kullanım da aynı derecede anlaşılır kalmalı.
- Türkçe kullanıcı arayüzü metni sade ve doğrudan olmalı.
- Mobil girişte marka, kısa ürün mesajı ve form net bir sırayla sunulur. Ana sayfa profil yönetimi ve keşif aksiyonlarına odaklanır; şehir, pilot, yaş rozetleri veya uydurma başarı sayıları kullanılmaz.
- Ekran başlıkları ve form alanları tutarlı bir hiyerarşi izler. Alt gezinmede dört sekmenin de adı sürekli görünür; seçili sekme metin ve ikonla belirtilir.
- Henüz bağlanmamış keşif ve istek özellikleri genel, dürüst boş durumlarla anlatılır. Teknik geliştirme ayrıntıları ürün metinlerine taşınmaz; henüz çalışmayan işlemler varmış gibi sunulmaz.

## Ürün kararları ve açık konular

- React Native ile iOS ve Android, Go ile backend ve PostgreSQL ile kalıcı veri katmanı zorunlu olarak seçildi. İlk geliştirme dilimi kayıt, giriş, oturum ve özel tab bar içeren uygulama kabuğudur.
- Veritabanı şeması backend/migrations altında sıralı SQL migration dosyalarıyla yönetilir. Uygulanmış migration değiştirilmez; yeni değişiklik yeni dosyaya eklenir.
- Hosting, medya depolama ve PostgreSQL barındırma sağlayıcısı henüz seçilmedi.
- İlk kulüp/antrenör ortakları ve pilot hedef sayıları henüz belirlenmedi.
- Ücretlendirme, pilotta eşleşme değeri görüldükten sonra ele alınacak.

Bu kararlar netleşmeden teknoloji veya gelir modeli varsayımını ürün gereksinimi gibi kabul etme.
