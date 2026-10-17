# Fut Career — Proje Tanımı

**Sürüm:** 0.22 · **Durum:** Mağaza içi satın alma, bildirme/engelleme, profil galerisi ve push bildirim · **Tarih:** 15 Ekim 2026

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
- **Yönetici platformu:** frontend/ altında bağımsız React + TypeScript + Vite web uygulaması. Yönetici girişi /securityadmin adresindedir. Kullanıcının 14 Ekim 2026 kararıyla yönetici özellikleri mobil uygulamada da bulunur (bkz. Mobil yönetici). Mevcut React ve Vite araçları kullanılır.
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
- Ana Sayfa, Ligler, Sosyal, Takımlar ve Diğer sekmeleri; ortada büyük, dairesel futbol topu ile Sosyal, Diğer içinde profil, ayarlar, haberler, keşif, istekler ve bildirimler
- Aktif sporcu, kulüp ve antrenörlerin ortak sosyal akışı; Keşfet/takip sekmeleri, metin/görsel/video gönderisi, beğeni, yanıt ve kendi içeriğini silme
- Sosyal içinde Oyunlar sekmesi; kalp bakiyesiyle Arma İzi ve Beyaz Nokta (başarılı sporcuya bir başvuru hakkı) ve ücretsiz Kafa Kafaya
- Kişisel profil istatistikleri; yönetici tarafından yüklenen reklam görselleri ve haberler
- Uygulama içi bildirim merkezi; takım başvurusu ve ödeme durumları, okunmamış sayısı ve okundu durumu
- Yönetici lig oluşturma ve yayını; mevcut kulüpleri ekleme, maç fikstürü/sonucu, otomatik puan durumu ve lig istatistikleri
- Tüm etkin kulüp hesaplarından takım rehberi; halka açık tanıtım, maç sahası ve antrenman bilgileri
- Oyuncu başına üç ücretsiz takım katılma başvurusu; ek hak paketleri ve oyuncu geçmişi/kota takibi
- Yeni sporcuya üç ücretsiz takım başvurusu hakkı; ek hakların ödeme sonrası satın alınması ve yönetici ödeme alanı
- Pro üyelik (30 gün, dönem başına +3 başvuru hakkı), profil ziyaretçileri, gizli gezinme ve Pro rozeti
- Kayıtta futbol türü/lisans tercihi; kişiselleştirilmiş ve futbol türleri arasında dengeli oyuncu, takım ve gönderi keşfi
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
- Otomatik fikstür oluşturma ve sezon geçişleri

## Başarı ölçümü

**Ana ölçüt:** Haftalık karşılıklı tanışma sayısı. Bir bağlantı, tanışma isteğinin kabul edilmesi ve iki tarafın en az bir kez yanıt vermesiyle anlamlı sayılır.

Yardımcı ölçütler: tamamlanmış oyuncu profilleri, doğrulanmış kulüp/antrenör sayısı, profil görüntülenmesinden isteğe dönüşüm ve isteklerin yanıtlanma süresi. Sayısal hedefler pilot ortakları ve kullanıcı görüşmeleri belirlendikten sonra kararlaştırılır.

## Tamamlanan ilk geliştirme dilimi

Kayıt/giriş, güvenli cihaz oturumu, oturum geri yükleme ve çıkış uygulandı. Kullanıcının 15 Ekim 2026 kararıyla giriş/kayıt öncesinde dört sayfalık bir **tanıtım** akışı bulunur (futbol profili, keşif, tanışma isteğiyle bağlantı, ligler/sosyal/oyunlar). Kullanıcının 17 Ekim 2026 kararıyla her sayfa amacını anlatan kendi ışıklı illüstrasyonunu taşır: projektör altında limon forma ve etrafında profil parçaları (mevki, fotoğraf, video, takım arıyor), perspektif sahada kulübün dizilişinde boş kalan mevkiye (ör. sol kanat) o mevkideki oyuncu kartının yerleştiği "Eşleşme", parlayan bir pas yayıyla bağlanan oyuncu ve kulüp kartları ile kabul işareti, projektörler ve tribün altında podyumda kupa ile lig tablosu ve sosyal gönderi kartları. İkinci sayfanın başlığı mevki eşleşmesini anlatır ("Takımın aradığı mevki sensin."). Sayfa numarası (01/04 gibi) gösterilmez; kısa başlık etiketi ve ilerleme noktaları kullanılır. İllüstrasyonlar tokenlardan çizilir, projektör ışığı ve parlama için gradient kullanır (gece stadyumu ışık efekti istisnası), top olarak marka topu (BallMark) yer alır, uydurma sayı veya kişi içermez ve ekran okuyucudan gizlidir. Kullanıcı "İleri" ile ilerler, önceki sayfaya dönebilir veya "Geç" ile girişe atlar; son sayfada "Kayıt ol" hesap türü seçimini, "Giriş yap" giriş ekranını açar. Tanıtım uygulama kurulduktan sonraki ilk açılışta otomatik gösterilir; tamamlandığında veya geçildiğinde görüldü bilgisi cihazın güvenli deposunda (Keychain/Keystore, ayrı servis adı) saklanır ve tekrar otomatik açılmaz. iOS Keychain kaydı uygulama silinse de kalabileceğinden yeniden kurulumda tanıtım gösterilmeyebilir. Tarayıcı önizlemesinde bu bilgi oturum gibi yalnızca bellekte tutulur. Kayıt adımlarında (hesap türü ve sporcu formu) sağ üstteki "i" düğmesi aynı tanıtımı tam ekran açar; kapatınca kayıt ekranına dönülür. Tanıtım metinleri şehir, pilot, yaş etiketi veya sayı içermez. Kullanıcının 13 Ekim 2026 kararıyla uygulamadaki kayıt ilk adımda hesap türünü sorar: sporcu, kulüp veya organizasyon. Sporcu hemen kullanmaya başlar; kulüp ve organizasyon başvurusu yönetici onayına düşer. Antrenör hesaplarını yönetici açar. React Native kabuğu ilk dilimde Ana Sayfa, Keşfet, İstekler ve Profil sekmelerini kullanıyordu; güncel gezinme aşağıdaki kullanıcı kararını izler. Yönetici ayrı web panelinden giriş yapar. Go servisi PostgreSQL üzerinde hesapları ve oturum hash'lerini saklar.

İlk dilimde keşif ve istek ekranları boş durumlarıyla hazırlanmıştı. Oyuncu profili ve gerçek keşif artık bağlıdır; tanışma istekleri ve profil galerisine medya yükleme uygulandı. Çalıştırma ve doğrulama durumu README.md içinde tutulur.

## Mobil gezinme

Kullanıcının 11 Ekim 2026 tarihli son kararıyla alt menü beş sekmeli kalır ve Sosyal tam ortaya eklenir. Varsayılan düzen **Ana Sayfa, Ligler, Sosyal, Takımlar, Diğer** şeklindedir; Haberler, Diğer menüsüne taşınır. Beş sekmenin de etiketi sürekli görünür; seçili sekme ikon, metin ve zemin ile belirtilir. Diğer ekranında Profil, Ayarlar, Haberler, Keşfet, İstekler ve Bildirimler bağlantıları bulunur. Bildirimler bağlantısı okunmamış bildirim sayısını gösterir; bildirimler tek tek veya topluca okundu işaretlenebilir. Bildirim merkezi uygulama içindedir ve takım başvurusu/ödeme durumlarını kapsar; harici push servisi kararı içermez. Profil alt menüden bu menüye taşınmıştır. Oyuncular aynı menüden Takım başvurularım ekranını açarak kalan haklarını ve tüm başvurularının durumunu izler; ek hak satın alma bağlantısı da bu menüde bulunur. Kulüpler kendi takımlarına gelen Takım başvuruları ekranını kullanır. Ayarlar mevcut özel hesap bilgileri ve çıkış ekranına açılır; sporcu profilindeki ayarlar kısayolu da aynı ekrana gider. Keşif yetkilendirmesi ve profil düzenleme akışı korunur.

Ligler sekmesi yönetici tarafından oluşturulan lig kayıtlarına bağlanır. Yönetici mevcut kulüp hesaplarını lige ekler, sezon/puan kurallarını belirler, maç fikstürünü ve skorları günceller; yeni veri sağlayıcısı veya takım hesabı türü seçilmez. Takımlar sekmesi etkin kulüp hesaplarının tamamını arama ve sayfalama ile listeler. Takım ayrıntısında kulübün girdiği tanıtım, ilçe, maç/kulüp sahası ve adresi, antrenman sahası ve adresi ile antrenman programı gösterilir. Bu herkese açık bilgiler hesap e-postası, kullanıcı adı veya özel iletişim verisi içermez.

Oyuncu, takım ayrıntısından katılma başvurusu gönderir. Sunucu yeni sporcuya üç ücretsiz başvuru hakkı verir; oyuncu başvuru geçmişini, kalan haklarını ve satın alınmış haklarını Diğer menüsünden takip eder. Satın alınan haklar yalnızca ödeme sağlayıcısı tarafından başarılı olarak doğrulanan siparişten sonra hesaba eklenir. Oyunla kazanılan haklar ayrıca sunucuda doğrulanan tamamlanmış oyundan gelir. Gönderilmiş, reddedilmiş ve kabul edilmiş başvurular hak tüketir; aynı oyuncu aynı takıma ikinci kez başvuramaz. Oyuncu Diğer menüsünden takım adını/ilçesini, gönderim tarihini ve kulübün yanıtını görür. Takım silinse veya hesabı kapatılsa da geçmiş kayıt kotayı iade etmez. Kulüp hesabı Diğer menüsündeki Takım başvuruları ekranından yalnızca kendi takımına gelen istekleri inceler ve bekleyenleri kabul veya reddeder. Bu başvuru mevcut tanışma isteklerinden ayrı tutulur.

Ödemeler yönetici alanında paket ve ödeme geçmişi üzerinden izlenir. Yeni sporcuya üç ücretsiz takım başvurusu verilir; ek paketler 2 hak/100 TL, 5 hak/200 TL ve 10 hak/300 TL olarak başlar. Yönetici bu sabit paketlerin raporlama tutarını, satış durumunu ve mağaza ürün kimliklerini yönetir (bkz. Mağaza içi satın alma); ödeme kayıtları kullanıcı, paket, tutar, para birimi, sağlayıcı ve durum bilgilerini gösterir. Kart bilgileri Fut Career sisteminde saklanmaz. Belirli bir ödeme sağlayıcısı seçilmemiştir; tahsilat, yapılandırılmış güvenilir HTTPS adapter'ı üzerinden başlatılır. Haklar yalnızca HMAC imzalı, yinelenmeye dayanıklı sunucu bildirimiyle ödeme başarılı olduğunda eklenir; iade bildirimi kullanılmamış hakları düşürür.

Yönetici yeni lig oluştururken ad, sezon, açıklama, galibiyet/beraberlik/mağlubiyet puanlarını ve yayın durumunu belirler. Lige etkin kulüp hesaplarını ekler ve maçlarda hafta, başlama zamanı, rakipler ve isteğe bağlı skoru yönetir. Skor girilmemiş maç oynanmamış kabul edilir; her iki takımın skorları birlikte kaydedilir. Yayındaki ligler mobilde görünür; taslaklar yalnızca yönetici panelinde kalır.

Lig puan durumu elle düzenlenmez: yayınlanmış lig maç sonuçlarından oynama, galibiyet/beraberlik/mağlubiyet, atılan/yenen gol, averaj ve yönetici puan kuralına göre puan hesaplanır. Eşitlik sırası puan, averaj, atılan gol, galibiyet ve takım adıdır. Lig istatistiklerinde takım/maç sayıları, oynanmış maç, toplam ve maç başı gol, iç saha galibiyeti/beraberliği/deplasman galibiyeti gösterilir. Fikstür hem tamamlanan hem oynanmamış maçları gösterir. Gerçek oyuncu gol katkısı verisi olmadığından gol krallığı gibi oyuncu istatistiği oluşturulmaz.

## Sosyal akış

Kullanıcının 11 Ekim 2026 kararıyla Sosyal, beşli alt menünün tam ortasında bulunur. Ehekim uygulamasındaki merkez butonun geometrisi esas alınır: diğer ikonlardan büyük, 66 piksel çapında yuvarlak buton barın üstüne taşar; futbol topu simgesi kullanır. Sosyal etiketi ve seçili durumu görünür kalır. Safe area ve klavye davranışı mevcut mobil kabukla uyumludur.

Sosyal ekranın üstünde başlık veya tanıtım metni yerine **Keşfet**, **Takip ettiklerin** ve **Oyunlar** sekmeleri bulunur. Keşfet tüm aktif sporcu, kulüp ve antrenörlerin gönderilerini kullanıcının futbol türü, lisans durumu, takipleri ve güncellik sinyalleriyle sıralar; farklı sporcu ve takım türlerini turlar halinde dengeler, bir türün akışı tek başına doldurmasına izin vermez. Bu tercihler sert filtre değildir; içerik çeşitliliği korunur. Takip ettiklerin yalnızca oturum sahibinin takip ettiği hesapların gönderilerini en yeni üstte olacak şekilde gösterir. Takip mevcut profile_follows kayıtlarını kullanır. Sosyal kartlardan aktif mobil hesaplar takip edilebilir; kendini takip etmek engellenir. Bu sosyal takip keşifte profil açma yetkisi veya özel iletişim erişimi sağlamaz. Ana sayfadaki gerçek takip sayaçları aynı kayıtları kullanır.

Sağ altta, tabbarın üzerinde dairesel + butonu paylaşım ekranını açar. Ekran 500 karaktere kadar metin, tek görsel veya tek video ve isteğe bağlı açıklama destekler; boş gönderi yayınlanamaz. Kullanıcı seçilen medyayı önizler, kaldırabilir veya değiştirebilir. Yüklemede form ve gezinme kilitlenir; hata halinde taslak korunur. Görseller JPEG/PNG, en fazla 4 MiB ve 16 milyon piksel; videolar MP4, en fazla 30 MiB olabilir. Sunucu görselleri çözerek yeniden kodlar ve metadata'yı çıkarır; videonun MP4 kutu yapısını, video izi ve medya verisinin varlığını doğrular. Video yeniden kodlama/transcoding veya otomatik oynatma bu dilimde yoktur; oynatıcı desteklenmeyen codec için açık hata gösterir.

Sosyal medya mevcut PostgreSQL içinde gönderiyle aynı transaction'da saklanır; harici depolama/hosting sağlayıcısı seçilmez. Aynı karar ve doğrulama sporcu profil galerisi için de geçerlidir (bkz. Oyuncu profili dilimi). Medya yalnızca aktif mobil oturumla, aktif yazarın mevcut gönderisine bağlıyken sunulur; silme medyayı da kaldırır. Native oynatıcı Bearer başlığını ve HTTP Range erişimini kullanır; tarayıcı önizlemesi yetkili blob'u yalnızca bellekte tutar ve bırakıldığında URL'yi iptal eder. React Native galeri seçimi react-native-image-picker, video oynatma react-native-video v6 ile dar platform adaptörlerinde yapılır; tarayıcı karşılıkları aynı ekranın .web adaptörleridir.

Beğeni ekleme/kaldırma, 500 karaktere kadar metin yanıt ve kendi gönderisini/yanıtını silme desteklenir. Gerçek sayaçlar, cursor sayfalama, yenileme, boş/yükleme/hata durumları ve sunucuda yazma hız sınırı bulunur. Paylaşım yapmak içeriğin tüm mobil hesaplara görünmesini sağlar; oyuncunun keşif görünürlüğü ve keşif rol kuralları ayrı kalır. Yazar için yalnızca ad, hesap türü, mevcut doğrulama, Pro durumu, futbol türü, lisans beyanı, kimlik ve izleyenin takip durumu döndürülür; özel hesap bilgileri sosyal yanıta dahil edilmez. Sosyal kartlar yetkisiz profil erişimi açmaz. Silinmiş veya erişimi kapalı hesapların içerikleri akıştan çıkar. Beğeniler kullanıcı/gönderi bazında tekildir; içerik silme yalnızca sahibine açıktır.

## Futbol oyunları

Kullanıcının 12 Ekim 2026 kararıyla Sosyal ekranındaki Keşfet ve Takip ettiklerin sekmelerine Oyunlar eklenir. İlk oyun Arma İzi (önceki adıyla Futbolcuyu Bul): kariyerinden seçilmiş takımların gerçek armaları kronolojik sırada gösterilir ve her soruda dört futbolcu seçeneği bulunur. Bir oyun 4 kolay, 3 orta ve 3 zor sorudan oluşur; toplam 10 sorunun en az 7'sini doğru yanıtlamak başarıdır. Sorular kullanıcının görmediği futbolculardan rastgele, şıklar ve şık sırası her oyun için ayrıca seçilir. Kulüp geçmişlerinin kaynakları ve armaların kaynağı depoda tutulur; örnek arma veya uydurma kariyer gerçek veri gibi gösterilmez.

Aktif mobil hesaplar oynayabilir. Sporcu hesabı başarılı tamamladığı her oyun için 1 takım başvurusu hakkı kazanır; kulüp/antrenörlerin oyunları başarı istatistiğine yazılır, sporcu başvuru bakiyesi oluşturmaz. Kazanılan hak başlangıçtaki üç ücretsiz hak ve satın alınan haklardan ayrı görünür, toplam kullanılabilir bakiyeye katılır. Aynı oyunun ödülü yalnızca bir kez eklenir; başvuru gönderimiyle aynı kullanıcı kilidi üzerinden atomik yürür.

Oyun bakiyesi en fazla 3 kalptir ve ilk açılışta doludur. Yeni bir oyun başlatmak 1 kalp tüketir; her eksik kalp 6 saatte sırayla yenilenir, üst sınır 3'tür. Yarım oyuna devam etmek kalp tüketmez. Oturum kapanması, ekran değişimi veya bağlantı hatası oyunu ve yanıtları sıfırlamaz. Yanlış cevap kalp tüketmez; oyun 10 sorunun tamamına kadar sürer. Tam dolu bakiyede fazladan süre biriktirilmez.

Kullanıcının 14 Ekim 2026 kararıyla Arma İzi soru havuzu büyük tutulur ("baya bi havuz") ve aynı futbolcular döngü halinde tekrar gösterilmez. Havuz, geliştiricinin çevrimdışı çalıştırdığı katalog üreticisiyle Wikidata'dan (CC0) kurulur: 1965 ve sonrası doğumlu, yeterince bilinen futbolcuların başlangıç tarihli kulüp kariyerleri; milli, olimpik, altyapı, rezerv/B/II ve kadın takımları elenir; her soruda kronolojik 3–5 kulüp ve en az 2 arma bulunur. Zorluk bilinirlikten (Wikipedia bağlantı sayısı) türetilir; Süper Lig geçmişi olan futbolculara ek ağırlık verilir ki Türk kullanıcılar orta/zor sorularda tanıdık adlar görsün. Gösterilen kulüp dizisi başka bir futbolcunun kariyerine de uyuyorsa soru alınmaz. Şıklar katalogda saklanmaz; oyun başlarken aynı zorluktan, benzer yaşta (±5) ve aynı mevkide olanlar öncelikli üç futbolcu seçilir, aynı ipucu dizisine veya aynı ada sahip futbolcu şık olmaz. Her kullanıcının gördüğü futbolcular ve görülme zamanı saklanır; yeni oyun her zorlukta önce hiç görülmemiş futbolculardan, bunlar bitince en uzun süredir görülmeyenlerden seçer. Arması bulunmayan kulüp, gece stadyumu görünümünde baş harfli kalkan rozetiyle ve adıyla gösterilir.

Kalp, soru sırası, doğru yanıt, puan ve ödül sunucunun kontrolündedir. İstemciye yalnızca mevcut soru ve dört şık gönderilir; doğru yanıt ancak bu sorunun seçimi kaydedildikten sonra açıklanır. Yanıt değiştirilemez; yinelenen aynı yanıt ve başlatma istekleri ek kalp/ödül üretmez. Sonuç ekranında puan, başarı eşiği, ödül ve yeniden oyun için kalp durumu gösterilir. Yükleme, bağlantı hatası, yanıt bekleme, doğru/yanlış geri bildirimi, sonucun yeniden alınması ve kalp geri sayımı tasarımın parçasıdır.

## Ana sayfa, içerik ve istatistikler

Kullanıcının 11 Ekim 2026 kararıyla ana sayfa üstten aşağı tek bir kişisel kart, reklam alanı ve haberler alanından oluşur. Kullanıcının 17 Ekim 2026 kararıyla üst başlıkta solda marka, sağda üç kısayol bulunur: başvuru hakları (kalan hak sayısını gösteren limon hap, Takımlar başlığındaki rozetle aynı; sayı yüklenemezse yalnızca bilet ikonu; Hak al ekranını açar), hediyeler (kullanılabilir hediye sayısı rozetiyle) ve bildirimler (okunmamış sayı rozetiyle). Kart üstte halkalı avatar ve "Merhaba / ad" satırını (dokununca profil açılır; sağda ok düğmesi), altında Görüntülenme, Takipçi ve Takip sayaçlarını yan yana üç ayrı kutuda taşır; her kutuda kendi tonunda yuvarlak ikon ve büyük sayı bulunur (görüntülenme turkuaz, takipçi limon, takip mavi), görüntülenme kutusu ziyaretçi ekranını açar; kartın sağ üst köşesinde hafif limon bir ışık geçişi vardır. Kartta tanıtım cümlesi veya ayrı başlık yoktur. Kullanıcının 15 Ekim 2026 kararıyla reklam alanı yalnızca sabit ölçülü, dikdörtgen bir reklam görselidir: sunucudan mobil ekrana yalnızca görsel gelir; reklam başlığı veya metni gösterilmez (yönetici başlığı panelde iç etiket olarak kalır). Alanın ölçüsü 1200×600 piksel (2:1) olarak tek yerde (mobile/src/features/content/domain/models.ts) tanımlanır; görsel bu orana kırpılır ve yönetici yükleme ipucunda bu ölçü gösterilir. Birden fazla reklam aynı alanda sırayla döner; köşede küçük "REKLAM" etiketi ve sayfa noktaları bulunur. Görsel yüklenirken bekleme, yüklenemezse veya boşsa ikonlu boş durum gösterilir. Kullanıcının 17 Ekim 2026 kararıyla haberler alanı otomatik ilerleyen tek kartlık bir akıştır ve yalnızca görsel içerir: karta başlık, tarih veya özet yazılmaz (başlık erişilebilirlik etiketinde kalır). Kartta haberin kapak görseli, yoksa uygulamanın paletiyle çizilmiş üç gece sahnesinden biri (projektörlü saha, kupa, kale ağı ve gol topu; haber kimliğine göre seçilir) gösterilir. Akış yalnızca öne çıkan değil tüm yayındaki haberleri (ilk sayfa) dolaşır. Her haber kartının en alt kenarında, kartın yuvarlak köşelerine oturan tek bir ince çubuk bulunur (kartla birlikte kayar) ve geçerli haberin çubuğu 6 saniyede soldan sağa dolar, dolunca sonraki habere geçilir; son haberden sonra akış geriye sarmadan ileri doğru kayarak ilk habere döner ve sonsuz bir döngüde devam eder. Kaydırma, başka sekmeye geçme, uygulamanın arka plana alınması süreyi duraklatır; hareketi azalt ayarı açıkken otomatik geçiş yapılmaz. Tek haber varsa çubuk gösterilmez. Karta veya başlığa basılması Haberler sayfasını açar; tam haber metni bu sayfadaki listeden açılır. Haberlerin altında "Hızlı işlemler" başlığıyla yan yana üç kısayol kutusu bulunur: Takım bul (Takımlar sekmesi), Lig ara (Ligler sekmesi) ve Keşfet (profil keşfi); ikonları profil kartı sayaçlarının tonlarını kullanır. Ana sayfada rastgele veya tüm takımlar listelenmez: takım vitrini ileride yönetici panelinden seçilen, açıkça "Öne çıkan" olarak etiketlenen bir alan olarak ele alınır (takımların reklam/öne çıkma talebi nedeniyle). İçerik ve istatistikler sunucudan gelir; yükleme, hata ve gerçek boş durumlar ayrı gösterilir.

Yönetici panelinde Reklamlar ve Haberler bölümleri bulunur. Reklamın başlığı, görseli, sırası ve yayın durumu yönetilir. Haber başlığı, kısa özeti, düz metin içeriği, isteğe bağlı kapak görseli, yayın durumu ve “Ana sayfada göster” seçeneği yönetilir. Yalnızca yayındaki haberler mobil listede görünür; ana sayfa yayındaki ve bu seçeneği açık olan en güncel üç haberi gösterir. Reklamlar sıra önceliğine göre ilk 20 aktif kayıttan oluşur; tüm mobil hesap türlerinde ortak, açıkça reklam olarak etiketlenen bir kaydırıcıda gösterilir. Yönetici yazma işlemleri mevcut cookie/Origin ve rol kontrollerinden geçer.

Yönetici içerik görselleri mevcut PostgreSQL içinde saklanır; yeni bir hosting/depolama sağlayıcısı eklenmez. JPEG/PNG yükleme sınırı 4 MiB ve 16 milyon pikseldir; sunucu görseli doğrular ve yeniden kodlayarak metadata'yı çıkarır. Yayındaki içeriklere bağlı görseller herkese açık içerik varlıklarıdır; taslak görseller yalnızca yönetici oturumuyla görüntülenir. Bu karar sporcu fotoğraf/video depolama sağlayıcısını belirlemez; sporcu medya yüklemesi henüz bağlı değildir.

Profil görüntüleme, yetkili keşif detayının başarılı açılmasıyla kaydedilir; aynı görüntüleyenin aynı profile UTC günü içindeki tekrarları tek sayılır. Keşif ekranından takip mevcut keşif yetkisiyle görülebilen profillere yapılır; sosyal kartlardan takip ise aktif mobil hesaplara açıktır. Her iki akışta kendini takip engellenir ve keşif profil erişim kuralları korunur. Takip etmek özel iletişim bilgisini açmaz ve tanışma isteği sayılmaz. Kişisel sayaçlar yalnızca oturum sahibine döndürülür; sahte başlangıç sayısı kullanılmaz.

Oyunlar ekranına ikinci oyun olarak **Beyaz Nokta** (önceki adıyla Penaltı Atışı) eklenir. Oyuncu önce vurur: sol, orta veya sağ seçip topu oraya atar. Sonra kaleci olur ve atlayacağı tarafı seçer. Bilgisayar her turda bir taraf seçer; kaleci olduğunda oyuncunun geçmiş vuruşlarına yönelebilir, böylece aynı köşeye sürekli atmak karşılık bulur. Oyun 5 atış ve eşitlikte ani ölüm kuralını kullanır, sonuç skorla gösterilir.

Beyaz Nokta sunucu tarafından yönetilir. Her maç Arma İzi ile aynı kalp cüzdanını kullanır: maç başlatmak 1 kalp harcar, yarım maça devam kalp harcamaz. Her vuruş ve kaleci hamlesi sunucuda çözülür; bilgisayarın hamlesi kullanıcı hamlesi kaydedilmeden istemciye gitmez. Maçı kazanan aktif sporcu hesabına 1 takım başvuru hakkı eklenir; aynı maç ödülü yalnızca bir kez verilir ve kazanılan haklar Arma İzi haklarıyla birlikte toplanır. Kurallar: 5 atış, eşitlikte ani ölüm. Bilgisayar kaleci olduğunda oyuncunun en sık seçtiği köşeye, vuruşçu olduğunda oyuncunun en az kullandığı köşeye yönelir; rastgele oynayan bir oyuncu maçların yaklaşık yarısını kazanır, kalıp kullanan oyuncu nadiren kazanır. Kaleci figürü depoda çizilmiş vektör görseldir; gerçek kişi veya kulüp görseli kullanılmaz.

Kullanıcının 14 Ekim 2026 kararıyla oyunların görünen adları **Arma İzi** ve **Beyaz Nokta** olur; iç tanımlar ve API yolları (football-guess, penalty) değişmez. Oyunlar ekranı üç oyun kartı gösterir: her kartta oyuna özgü çizilmiş küçük sahne/ikon, ad ve en fazla tek satırlık slogan bulunur; kalp maliyeti, devam durumu veya en iyi skor küçük rozetlerle gösterilir. Kurallar kart üzerinde yazılmaz; ekran okuyucu ipucunda ve kartın "?" düğmesiyle açılan kısa kural sayfasında yer alır.

Aynı kararla üçüncü oyun **Kafa Kafaya** eklenir. Her turda altı büyük ligden (Trendyol Süper Lig, Premier League, La Liga, Serie A, Bundesliga, Ligue 1) biri rastgele seçilir; aynı ligden iki gerçek kulüp armaları ve adlarıyla, üstte tek soruyla gösterilir. Lig adı ve logosu küçük olarak görünür. Sorular turda rastgele seçilir: "Daha çok puanı olan?" (puan), "Daha çok gol atan?" (atılan gol), "Daha az gol yiyen?" (yenen gol, küçük olan kazanır), "Ligde daha üstte olan?" (sıra, küçük olan kazanır), "Daha çok galibiyeti olan?" (galibiyet), "Averajı daha iyi olan?" (averaj). Değerleri eşit olan çift/soru sorulmaz ve bir seride aynı çift tekrarlanmaz. Kullanıcı karşılaştırmayı kazanan kulübe dokunur: doğruysa seri bir artar ve yeni tur gelir; yanlışsa oyun biter ve iki kulübün gerçek değerleri gösterilir. Oyun ücretsizdir: kalp harcamaz, ödül veya başvuru hakkı vermez. Kullanıcı başına en iyi seri ve oynama sayısı saklanır.

Kafa Kafaya sunucu yönetimlidir. Turlar Ligler sekmesindeki ESPN puan durumundan (sunucuda 10 dakika önbellek) üretilir; kaynak alınamazsa mevcut "lig verileri alınamıyor" hatası döner ve uygulama yeniden deneme durumu gösterir. Seri ve turlar PostgreSQL'de saklanır; istemci bir turun değerlerini veya kazananını yanıtı kaydedilmeden almaz. Yanıtlar diğer oyunlarla aynı hesap kilidi ve transaction içinde işlenir; aynı yanıtın tekrarı aynı sonucu döndürür, kaydedilmiş seçim değiştirilemez, biten seri yeni yanıt almaz. Yalnızca oturum açmış aktif mobil hesaplar oynar. Karşılaşma ekranında aydınlatılmış rozetteki armalar, kalın hap biçimli soru, alev simgeli seri sayacı ve en iyi skor, başarı/hata tokenlarıyla renk geri bildirimi (azaltılmış harekette yalnızca durağan renk) ve iki değeri gösteren oyun sonu kartı ile "Tekrar oyna" bulunur. Arma yüklenemezse kulüp adının baş harfi gösterilir.

## Pro üyelik ve profil ziyaretçileri

Kullanıcının 15 Ekim 2026 kararıyla LinkedIn benzeri **"Profilini kim görüntüledi"** ve **Pro üyelik** eklenir.

**Takımlar başlığı:** Sporcu hesabında Takımlar ekranı başlığının sağ üstünde kullanılabilir toplam takım başvuru hakkı küçük bir rozetle (bilet simgesi + sayı, marka renkleri) gösterilir; dokununca mevcut hak satın alma ekranı açılır. Rozet sporcu dışındaki hesaplarda gizlidir ve ekran her odaklandığında yenilenir.

**Ziyaretçiler:** Ana sayfadaki "Profil görüntüleme" sayacı ve Diğer menüsündeki "Ziyaretçiler" karosu ziyaretçi ekranını açar. Pencere son 30 UTC günüdür; görüntüleme kaydı mevcut kuraldır (yetkili keşif detayı, kişi başına günde bir). Üstte özet bulunur: bu haftanın (son 7 gün) en önemli rolü ("Bu hafta 3 kulüp profiline baktı"; öncelik kulüp → antrenör → organizasyon → sporcu) ile 30 günlük ziyaretçi/görüntüleme sayısı ve rol dağılımı (kulüp, antrenör, sporcu, organizasyon). Liste ziyaretçi başına tek satırdır (son ziyaret zamanı, ziyaret günü sayısı) ve sunucuda şu sırayla dizilir: (1) doğrulanmış kulüp ve antrenörler, (2) profil sahibiyle aynı futbol türü (bilinmeyen tür eşleşmez), (3) tekrar gelenler (daha çok farklı gün), (4) en yeni ziyaret; eşitlikte hesap kimliği. Sıralama backend/internal/discovery/domain içinde birim testlidir.

**Ücretsiz ve Pro görünüm:** Pro olmayan sahip sayıları ve rol dağılımını görür; satırlar gizlidir (ad ve fotoğraf yok; yalnızca rol simgesi, göreli zaman ve kulübün herkese açık ilçesi). Gizli gezinmeyen en son ziyaretçi tek açık satırdır. Ekranda sade bir "Pro'ya geç" çağrısı bulunur. Pro sahip tüm listeyi (ad, rol, kulüp beyanı/ilçe, doğrulama ve Pro rozeti, son ziyaret, ziyaret sayısı) görür; keşif kuralları izin veriyorsa satıra dokununca ziyaretçinin profili açılır. Sunucu Pro olmayan istemciye gizli satırlarda hiçbir kimlik/ad/kimlik numarası göndermez; mobil doğrulayıcı kimlik taşıyan anonim satırı reddeder.

**Gizli gezinme:** Ayarlar'da yalnızca Pro üyelere açık, varsayılanı kapalı bir anahtardır. Pro üye gizli gezinirken görüntülemesi yine kaydedilir; Pro olmayan profil sahibi onu "Gizli Pro üye" satırı olarak görür (sayılara dahildir, rolü "gizli" sayılır, sıralamada kimlik bilgisi kullanılmaz, hiçbir zaman açık "en son ziyaretçi" olmaz). Pro profil sahibi gerçek kimliği "Gizli gezindi" notuyla görür (Pro, Pro'yu görür). Bir gün gizli görüntülendiyse o gün gizli kalır; 30 gün içinde gizli görüntülemesi olan ziyaretçi Pro olmayan sahibe anonim gösterilir. Gizlilik görüntüleme anındaki Pro durumu ve ayara göre belirlenir.

**Pro üyelik:** Sporcu, kulüp ve antrenör hesapları alabilir. Her satın alma 30 gün, fiyatı 49 TL'dir; yönetici raporlama tutarını, satış durumunu ve mağaza ürün kimliklerini hak paketleriyle aynı düzende web ve mobil yönetici panelinden yönetir. Mobilde satın alma App Store / Google Play üzerinden yapılır (bkz. Mağaza içi satın alma); Pro otomatik yenilenmez. Etkinleştirme/yenilemede bitiş tarihi max(şimdi, mevcut bitiş) + 30 gündür. Sporcu her Pro dönemi için ayrı görünen "Pro hakkı" kaynağından +3 takım başvuru hakkı alır; haklar toplam bakiyeye katılır ve ödenmiş dönem başına tek kez eklenir (webhook tekrarına dayanıklı). İade o dönemin süresini ve Pro haklarını düşürür. Yönetici test/destek için hesap düzenleyicisinden (web ve mobil) Pro verebilir (her veriş +30 gün ve sporcuya bir kez +3 hak) veya kaldırabilir (Pro hemen biter, eklenmiş haklar kalır). Pro durumu ve bitişi her istekte sunucuda değerlendirilir; süresi dolan Pro değildir.

**Pro rozeti:** Profilde, keşif kartlarında, sosyal gönderilerde ve ziyaretçi listesinde adın yanında küçük limon "PRO" hapı (marka tokenları) gösterilir. **Pro'ya geç** ekranı avantajları ikon ve kısa etiketle (Ziyaretçileri gör, Pro rozeti, Ayda +3 başvuru hakkı, Gizli gezinme), fiyatı, mevcut durumu/bitişi ve hak satın almadaki gibi kullanılamaz/beklemede durumlarıyla satın alma düğmesini gösterir. Haftalık ziyaretçi bildirimi bu dilimde yoktur.

## Hediyeler

Yönetici paneli **Hediyeler** bölümünden hediye gönderir. Her hediyenin türü, başlığı, mesajı, alıcısı ve geçerlilik süresi (1-365 gün) vardır. Türler: 1 kalp, kalp fulleme (3 kalp) ve 1 takım başvuru hakkı. Alıcı ya tüm aktif hesaplardır ya da tek bir hesap e-postasıdır. Başvuru hakkı yalnızca oyuncu hesaplarına verilir.

Gönderim anında her alıcı için ayrı bir hediye kaydı oluşur; geçerlilik süresi gönderim anından başlar. Oyuncu hediyeyi sağ taraftaki hediye simgesinden görür ve **Hediyeyi al** ile hesabına ekler. Alınan hediye bir kez işlenir; süresi dolmuş hediye alınamaz. Diğer menüsündeki **Hediyelerim** ekranı her hediyenin durumunu (kullanılabilir, alındı, süresi doldu) ve geçerlilik tarihini gösterir. Gönderilmiş kampanyalar düzenlenmez veya silinmez.

Kalp dolum süresi 6 saattir: her eksik kalp 6 saatte bir yenilenir, en fazla 3 kalp birikir.

## Bildirim merkezi

Kullanıcının 15 Ekim 2026 kararıyla bildirimler uygulama içi merkezde kalır ve ayrıca Firebase Cloud Messaging ile push olarak gönderilir (iOS'ta APNs Firebase üzerinden). Cihaz token'ı oturuma bağlıdır; çıkış, oturum süresinin dolması veya hesap silme cihaz kaydını kaldırır. Yeni bildirim bir kez push edilir; bir günden eski bildirim push edilmez. Push'a dokunmak bildirim merkezini açar. İzin verilmezse veya Firebase yapılandırılmamışsa uygulama yalnızca bildirim merkezini kullanır. Bildirim türleri: takım başvurusu, ödeme, **fırsat** (yönetici duyurusu), **hediye** (yeni hediye geldi) ve **oyun ödülü** (maç kazanınca başvuru hakkı). Hediye ve oyun ödülü bildirimleri ilgili işlemle aynı transaction içinde oluşur; bir alıcı aynı olay için yalnızca bir bildirim alır.

Yönetici paneli **Duyurular** bölümünden fırsat duyurusu gönderir: başlık (2-120 karakter), metin (en fazla 500 karakter) ve alıcı seçilir (tüm aktif hesaplar, yalnızca oyuncular, yalnızca kulüpler, yalnızca antrenörler veya tek hesap). Duyurular düzenlenmez veya silinmez. Bildirim merkezinde türe göre simge ve etiket gösterilir; Tümü ve Okunmamış filtreleri vardır.

## Kulüp profili ve ana sayfası

Kulüp hesabı aynı beş sekmeyi kullanır; Ana Sayfa kulübe özeldir. Ana sayfada kulüp profil özeti, ligler, haberler ve sporcular bölümleri bulunur. Ligler sekmesi oyuncularla aynıdır.

Kulüp kendi profilini düzenler: tanıtım, ilçe, maç sahası ve adresi, antrenman sahası ve adresi ile antrenman programı. Kulüp türü ve hesap adı yalnızca yönetici tarafından değiştirilir.

Kulüp haber yazabilir. Yazılan haber yönetici onayına düşer; onaylanana kadar herkese açık görünmez. Onaylanan veya reddedilen haberin yazarına bildirim gider. Yayındaki tüm haberler kulüp ve sporcu hesaplarında aynı şekilde görünür.

Ana sayfanın başında **kulüp merkezi** bulunur: profil tamamlanma yüzdesi ve eksik alanlar, bekleyen takım başvurusu ve onay bekleyen haber sayıları, kulübün yer aldığı liglerdeki sıralama, son sonuçlar ve sonraki maç. Lig bilgisi herkese açık lig detayından gelir; kulüp sıralamayı değiştiremez. Yönetici onay kuyruğu yalnızca onay bekleyen kulüp haberlerini listeler.

Sporcular bölümü iki parçadır: üstte kulübe gelen takım başvuruları, altta sporcu keşfi.

## Etkileşim yol haritası ve organizasyonlar

Kullanıcının 13 Ekim 2026 kararıyla geliştirme sırası şöyledir: (1) iki yönlü tanışma isteği ve kabulde iletişim bilgisinin açılması, (2) kabul edilen başvurulardan kulüp kadrosu ve kulüp ilanları, (3) organizasyon hesabı ve turnuvalar, (4) moderasyon ve yönetici ölçüt panosu, (5) mesajlaşma ve push bildirim.

**Tanışma isteği:** Sporcu doğrulanmış kulüp veya antrenöre, doğrulanmış kulüp veya antrenör de görünürlüğünü açmış sporcuya istek gönderebilir; sporcudan sporcuya istek yoktur ve keşif kuralları aynen uygulanır. Bir çift arasında aynı anda tek açık istek veya bağlantı olur. Alıcı kabul veya reddeder, gönderen bekleyen isteği geri çekebilir. Kabul edilince iki taraf birbirinin e-posta adresini görür; kabulden önce özel iletişim bilgisi açılmaz. İstek ve kabul uygulama içi bildirim üretir. Gönderen günlük istek sınırına tabidir.

**Kadro:** Kulübün kabul ettiği takım başvurusu oyuncuyu kulübün kadrosuna ekler. Kulüp kadrosunu görür ve oyuncuyu kadrodan çıkarabilir; oyuncu üyeliklerini görür ve kulüpten ayrılabilir. Kadro listesi yalnızca kulübe açıktır.

**Kulüp ilanları:** Kulüp başlık, mevki ve açıklamayla ilan yayınlar; aynı anda en fazla 10 açık ilanı olabilir. İlan yayınlanınca kulüple aynı futbol türündeki aktif sporculara fırsat bildirimi gider; tür belirtilmemiş kulüplerde bildirim gönderilmez. İlana başvuru normal bir takım başvurusudur, bir başvuru hakkı harcar ve aynı kulübe ikinci başvuru yapılamaz; kabul edilince oyuncu kadroya girer. Kapatılan ilan herkese açık listeden kalkar.

**Organizasyonlar:** Turnuva düzenleyen şirket ve organizasyonlar için ayrı hesap türü vardır; organizasyon uygulamadan başvurur veya yönetici hesabı açar, her iki durumda da yönetici doğrulaması gerekir. Organizasyon turnuva türünü ve başvurabilecek takım türlerini (amatör, profesyonel, halı saha) seçer. Takımlar mevcut kulüp hesaplarıdır ve kulübün türü turnuvaya uygun olmalıdır. Katılım ücreti alınmaz; uygulama organizasyon ile takımı eşleştirir. Organizasyon hesabı kullanıcı adıyla giriş yapar ve turnuva açmak için yönetici doğrulaması gerekir. Turnuvada tür (halı saha, 7'li, 11'li), uygun takım türleri, tarih aralığı, son başvuru günü, saha/ilçe ve takım kapasitesi (2-128) bulunur. Turnuva açılınca uygun türdeki aktif kulüplere bildirim gider. Kulüp, kadrosundaki oyunculardan en fazla 30 kişilik turnuva kadrosu seçerek başvurur; her başvuru organizasyona bildirim olarak düşer. Organizasyon kapasiteyi aşmadan kabul veya reddeder; karar kulübe bildirilir. Kulüp bekleyen veya kabul edilmiş başvurusunu geri çekebilir ve sonra yeniden başvurabilir; reddedilen kulüp aynı turnuvaya tekrar başvuramaz. Turnuva durumları: açık → başvurular kapandı → tamamlandı; açık veya kapalıyken iptal edilebilir ve iptal tüm aktif başvurulara bildirilir. Fikstür ve sonuç girişi sonraki adımdır.

## Kulüp ve organizasyon başvurusu

Kayıt ekranının ilk adımında hesap türü seçilir. Kulüp ve organizasyon başvurusunda kurum adı, yetkili kişi adı, kullanıcı adı, e-posta, şifre, isteğe bağlı telefon, ilçe ve isteğe bağlı not istenir; kulüpten ayrıca takım türü (amatör, profesyonel, halı saha) alınır. Başvuran hesap pasif ve onay bekliyor durumunda oluşur, oturum açılmaz ve keşifte görünmez. Doğru şifreyle giriş denendiğinde uygulama başvurunun beklediğini veya onaylanmadığını söyler; yanlış şifrede hesabın varlığı açığa çıkmaz.

Yönetici paneli **Başvurular** kuyruğunda başvuruları en eskiden başlayarak görür; onaylanan hesap aktif ve doğrulanmış olur (kulüp keşifte görünür, organizasyon turnuva açabilir), reddedilen başvuruya isteğe bağlı gerekçe yazılır. Sonuçlanan başvuru yeniden karara bağlanmaz. Telefon ve not yalnızca yöneticiye görünür.

## Lig verileri

Kullanıcının 13 Ekim 2026 kararıyla Ligler sekmesi dış veri kaynaklarıyla genişletildi; bu karar Ligler için önceki "yeni veri sağlayıcısı seçilmez" kuralının yerine geçer. Ligler ekranının başında lig logolu kartlar bulunur: önce Trendyol Süper Lig, ardından Premier League, La Liga, Serie A, Bundesliga ve Ligue 1. Kullanıcının 14 Ekim 2026 kararıyla bunların altında **Avrupa kupaları** bölümü (Şampiyonlar Ligi, Avrupa Ligi, Konferans Ligi) yer alır. Altında TFF Ankara Amatör Ligleri kartı, onun altında yöneticinin oluşturduğu Fut Career ligleri yer alır. Kullanıcının 17 Ekim 2026 kararıyla Ligler ekranında "FUTBOL DÜNYASI / Ligler" başlığı yoktur; yalnızca solda marka, sağda arama butonu bulunur. Kartlar daha sade ve kompakttır (yuvarlak logo/ikon, ad, ülke veya sezon) ve her bölüm (Büyük ligler, Avrupa kupaları, Fut Career ligleri) yatay kaydırılan tek satırdır. Arama butonu genel aramayı açar: yazılan metin liglerde (büyük ligler, kupalar, TFF Ankara, Fut Career ligleri), takımlarda ve oyuncularda aranır (en az 2 harf, her grupta en çok 5 sonuç); sonuca basılınca lig kendi sayfasını, takım takım sayfasını, oyuncu profilini doğrudan açar.

Kullanıcının 13 Ekim 2026 kararıyla büyük ligler **ESPN'in herkese açık site API'sinden** anahtarsız alınır. Bu, resmî ve belgelenmiş bir API değildir; lisans sözleşmesi yoktur, ESPN kullanım koşulları ticari kullanımı kısıtlayabilir ve servis haber vermeden değişebilir veya erişimi kesebilir. Kullanıcı bu riski bilerek kabul etmiştir; değişiklik olursa ilgili ekran kaynağın alınamadığını söyler. Takım adları kaynakta olduğu gibi (Türkçe karaktersiz olabilir) gösterilir.

Her büyük ligin Puan durumu, Canlı skor ve İstatistik sekmeleri vardır: puan durumu (O, G, B, M, A, Y, AV, P ve Avrupa kupası/küme düşme notu), canlı skor (bugünün maçları canlı dakika ve skorla; altında son oynanmış maçların sonuçları) ve istatistik (gol ve asist krallığı, maç sayısıyla). Sunucu yanıtları önbelleğe alır: puan durumu 10 dakika, bugünün maçları 30 saniye, geçmiş maç günleri 10 dakika, sezon takvimi 6 saat, istatistik 1 saat. Uygulama canlı skor sekmesi açıkken 30 saniyede bir yeniler. Uç noktalar yalnızca oturum açmış uygulama kullanıcılarına açıktır.

Kullanıcının 14 Ekim 2026 kararıyla UEFA Şampiyonlar Ligi, Avrupa Ligi ve Konferans Ligi de aynı ESPN kaynağından eklendi. Kupalar ayrı bir grup olarak sunulur: katalog yanıtında yurt içi ligler `competitions`, kupalar `cups` alanındadır; Kafa Kafaya yalnızca altı yurt içi ligi kullanır. Kupa sayfası lig sayfasıyla aynı üç sekmeyi kullanır. Puan durumu 36 takımlı lig aşamasıdır; notlar "Son 16'ya kalır", "Play-off turu" ve "Elendi" olarak Türkçeleştirilir, bilinmeyen not olduğu gibi gösterilir. Kupa takviminde maç günü yerine tarihli turlar bulunduğundan son sonuçlar bu ayın ve önceki ayın maçlarından (takvim turlarıyla örtüşen aylar) alınır. Kaynak istatistik vermezse (ör. Konferans Ligi) boş durum gösterilir. Lig, takım logoları ve oyuncu fotoğrafları kaynağın kendi görsel adresinden yüklenir; yüklenemezse ismin baş harfi gösterilir.

**TFF Ankara** verisi herkese açık puantaj ve fikstür sayfasından (sistem.tffankara.org) okunur ve 15 dakika önbelleğe alınır. Kullanıcı önce sezon, sonra lig, sonra grup seçer; ardından puan tablosu ve hafta seçilebilen maç programı (tarih, saat, saha, skor) gösterilir. Veri kaynağı ekranda "TFF Ankara İl Temsilciliği" olarak belirtilir. Sayfa yapısı değişirse sunucu kaynağın şu anda alınamadığını bildirir.

Kullanıcının 14 Ekim 2026 kararıyla TFF Ankara bölümü genişletildi. Üç sekmesi vardır: **Puan durumu** (sezon, lig ve grup seçimi; puan tablosu ve haftalık fikstür), **Bu hafta** (sistem.tffankara.org/home/onaylibulten haftalık bülteni: tüm liglerin maçları gün ve sahaya göre; lig ve takım adıyla filtrelenir) ve **Duyurular** (tffankara.org WordPress API'sinden son duyurular; başlığa göre disiplin kararı, bülten veya duyuru olarak sınıflanır). Duyurulardan yalnızca düz metin başlık, tarih, yazının adresi ve sitenin kendi yüklemelerindeki belge bağlantıları (PDF, Excel, Word, görsel) alınır; yazı HTML'i uygulamaya taşınmaz, çünkü sitede dışarıdan eklenmiş spam bağlantıları bulunmuştur. Hakemli bülten ve disiplin kararları sitede Excel dosyasıdır; uygulama bunları ayrıştırmaz, belge olarak açar. Bülten 15 dakika, duyurular 30 dakika önbelleğe alınır. Yeni sezon başında sitede az sayıda lig açık olabilir; önceki sezonlar sezon seçimiyle görülür. Kullanıcının 14 Ekim 2026 tarihli son kararıyla seçimler çipler yerine sırayla seçilen üç açılır alanla yapılır: 1 Sezon, 2 Lig, 3 Grup. Her alan adım numarası, etiket, güncel değer ve ok simgesi taşır; liste alanın altında kısa bir animasyonla açılır (azaltılmış harekette animasyonsuz), uzun listeler sınırlı yükseklikte kaydırılır ve seçili öğe onay simgesi ve marka rengiyle işaretlenir. Önceki adımı seçilmemiş alan soluk ve kilit simgeli olarak kapalıdır; sezon değişince lig ve grup, lig değişince grup temizlenir; yalnızca "Grup yok" varsa grup alanı gösterilmez. Sezonlar en yeniden eskiye sıralanır; lig listesi addan türetilen ailelere (Amatör, Altyapı, Kız, Play-off, Diğer) göre ikonlu başlıklarla gruplanır. Seçili sezonda beşten az lig varsa sezon alanının yanında önceki sezona geçiş için küçük bir düğme bulunur. Bu hafta sekmesi gün çipleri, büyük maç sayısı ve saha kartlarıyla; Duyurular tür çipleri ve belge düğmeleriyle sunulur. Uygulama yalnızca https://tffankara.org (veya www) adreslerini açar; diğer bağlantılar doğrulamada atılır. Ligler ekranındaki TFF Ankara kartı bu haftanın maç sayısını rozet olarak gösterir.

## Oyuncu profili dilimi

Sporcu kaydında futbol türü (amatör, profesyonel veya halı saha) ve futbol lisansı durumu (var/yok) zorunlu seçilir. Bu tercihler sunucuda sporcu profiliyle aynı kayıt işleminde saklanır ve profil düzenleme ekranında değiştirilebilir; eski hesaplarda bilinmeyen değer korunur, tahmin edilmez. Takım hesaplarının türünü yönetici kulüp düzenleme/oluşturma formundan amatör, profesyonel veya halı saha olarak belirler. Oyuncu hesabı için mevki, baskın ayak, futbol deneyimi, mevcut kulüp beyanı ve uygunluk durumu da kaydedilir. Profilin keşifte görünme tercihi sunucu tarafında saklanır ve liste/detay erişiminde uygulanır. Profil galerisine medya yükleme sonraki geliştirme adımıdır; tanışma istekleri uygulanmıştır. Teknik çalıştırma ve doğrulama durumu README.md içinde tutulur.

### Sporcu profilinin görünümü

Kullanıcının 10 Ekim 2026 kararıyla sporcu profili, Instagram benzeri bir profil başlığı ve galeri düzeni kullanır. Üstte dairesel profil fotoğrafı alanı, ad ve futbol bilgileri; kendi profilinde “Profili düzenle” butonu bulunur. Fotoğraf olmayan hesaplarda baş harfler gösterilir. Mevcut kulüp oyuncu beyanı olarak belirtilir. Özel hesap bilgileri ve çıkış Diğer menüsündeki hesap ayarları ekranından açılır.

Altta önce Fotoğraflar, sonra Videolar sekmesi bulunur. Medya küçük resimleri her satırda üç kare olacak şekilde dizilir. Bu düzen sporcuya ait kişisel profil ve keşifte açılan sporcu profili için ortaktır; uydurma sosyal başarı sayıları eklenmez. Ana sayfadaki takipçi/takip edilen sayıları gerçek takip kayıtlarından hesaplanır. Kullanıcının 15 Ekim 2026 kararıyla sporcu kendi profilinden fotoğraf (JPEG/PNG, 4 MiB, 16 milyon piksel) ve video (MP4, 30 MiB) ekler ve siler; sınır 30 fotoğraf ve 10 videodur. Medya sosyal medyayla aynı sunucu doğrulamasından geçer ve PostgreSQL'de saklanır. Galeriyi profil sahibi ile keşif kurallarına göre profili görebilen hesaplar (görünürlüğü açık sporcu; sporcu veya doğrulanmış kulüp/antrenör izleyici) görür; engel her iki yönde erişimi kapatır. Küçük resme dokununca tam ekran görüntüleyici açılır; sahibi buradan silebilir. Galeri boşsa boş durum gösterilir, örnek medya kullanılmaz.

## Keşif ve doğrulama dilimi

- Sporcular doğrulanmış kulüp/antrenörleri ve görünürlüğünü açmış diğer sporcuları keşfeder. Kulüp/antrenör hesapları yalnızca yönetici doğrulamasından sonra görünürlüğünü açmış oyuncuları keşfeder. Oyuncuların birbirini görmesi yalnızca sınırlı futbol profili bilgilerini açar; özel iletişim veya gizli hesap bilgisi açılmaz.
- İlk pilot sorguları Ankara ile sınırlıdır; yeni hesapların varsayılan şehri mobil ekranda konum olarak sunulmaz. Mobil keşifte şehir veya pilot tanıtım etiketi gösterilmez.
- İsim araması; oyuncularda serbest metin mevki, baskın ayak, uygunluk, futbol türü ve lisans filtreleri; sunucuda sayfalama ve profil detayı uygulanır. Varsayılan öneri sıralaması tür/lisans benzerliğini ve güncelliği kullanır, farklı oyuncu ve takım türlerini dengeli gruplar halinde gösterir; tek bir amatör/profesyonel/halı saha kümesi keşfi doldurmaz. Aynı dengeleme takım rehberi ve sosyal Keşfet gönderi akışında da uygulanır; takip edilenlerin akışı kronolojik kalır. Uygunluk ile görünürlük ayrı tercihlerdir: görüşmüyor olan bir oyuncu, görünürlüğünü açtıysa kendi seçimiyle keşifte yer alır.
- Hesap açılması otomatik doğrulama sağlamaz. Yönetici kulüp/antrenör kimliğini kontrol ettikten sonra mevcut hesabın düzenleme ekranından doğrulamayı açar veya kaldırır. Eski ve yeni hesaplar doğrulanmamış başlar.
- Doğrulama her keşif isteğinde güncel hesap verisinden kontrol edilir. Doğrulaması kaldırılmış kulüp/antrenör oyuncu arayamaz ve sporcu keşfinden çıkar. Gizlenmiş, silinmiş veya erişimi kapalı profiller liste ve doğrudan detay yollarından elenir.
- Keşif yanıtı yalnızca profil kimliği, ad, hesap türü, doğrulama, Pro durumu, kulüp ilçesi ve futbol bilgilerini içerir. E-posta, giriş kullanıcı adı, şifre, oturum ve diğer özel hesap alanları döndürülmez. Mevcut kulüp bilgisi oyuncu beyanı olarak gösterilir.

## Mobil yönetici

Kullanıcının 14 Ekim 2026 kararıyla yönetici web panelindeki tüm işlemleri mobil uygulamadan da yapabilir: hesaplar ve kulüpler (oluşturma, düzenleme, doğrulama, erişimi durdurma, şifre yenileme, silme, kulüp genel bakışı), kulüp/organizasyon başvuruları, Fut Career ligleri (lig, takımlar, maç ve skor), reklamlar, haberler ve kulüp haberi onayı, hediyeler, duyurular, ödeme paketleri ve ödeme geçmişi. Yönetici mobilde normal giriş ekranından e-posta (veya kullanıcı adı) ve şifreyle girer; uygulama hesabın yönetici olduğunu sunucudan öğrenir ve yönetici moduna geçer. Yönetici modunda sporcu/kulüp sekmeleri yerine yönetici menüsü gösterilir. Şimdilik ek doğrulama katmanı yoktur; iki adımlı doğrulama gibi bir güvenlik katmanı sonraki adımdır.

Mobil yönetici oturumu, web paneliyle aynı "admin" kullanım alanındadır ve en fazla 8 saat geçerlidir. Token yalnızca POST /v1/admin/auth/token yanıtında döner ve cihazın güvenli deposunda tutulur; istekler "Authorization: Bearer" başlığıyla yapılır. Bearer isteklerinde tarayıcı cookie'si kullanılmadığından Origin kontrolü yapılmaz; cookie oturumları Origin kontrolünü korur. Rol kontrolü her istekte sunucudadır; mobil (sporcu/kulüp) oturumları yönetici alanını açamaz, yönetici oturumu da mobil kullanıcı uç noktalarını açamaz.

## Hesap ve yönetici akışı

- Herkese açık kayıtta sporcu hesabı hemen oluşur; kulüp ve organizasyon başvurusu yönetici onayına kadar pasif kalır (bkz. Kulüp ve organizasyon başvurusu). Yaş sınırı veya yetişkinlik onayı yoktur. Yönetici tarafından hesap oluşturma ve ilk yönetici kurulumu da yaş onayı istemez. Yönetici kulüp, antrenör ve organizasyon hesaplarını doğrudan da oluşturabilir.
- Sporcu e-posta ve şifreyle, kulüp yönetici tarafından verilen kullanıcı adı ve şifreyle mobil giriş ekranından giriş yapar. Mevcut antrenör hesapları korunur; yönetici antrenör hesabı da açabilir. Yönetici /securityadmin web girişini veya mobil uygulamadaki aynı giriş ekranını (e-posta ya da kullanıcı adı ve şifre) kullanır.
- Yönetici kullanıcıları ve kulüpleri sunucu tarafında sayfalama ile listeler; hesap oluşturma, düzenleme, silme, erişimi durdurma ve şifre yenileme işlemlerini yapar. Hesap türü düzenleme yoluyla yöneticiye yükseltilemez. Kulüp satırındaki “Genel bakış” işlemi /securityadmin/clubs/{id} ekranını açar; kulübün profili, haberleri, sporcu başvuruları ve lig kayıtları bu ekranda salt okunur gösterilir.
- Kulüp bilgisi, kulüp hesabına bağlı olarak tek yerde saklanır. Kulüp kaydı ve giriş hesabı birlikte oluşturulur ve birlikte silinir. Yönetici tarafından eklenmiş olmak doğrulama rozeti anlamına gelmez.
- İlk yönetici varsayılan şifre olmadan ayrı bir kurulum komutuyla oluşturulur. Yönetici hesapları panelde silinemez veya durdurulamaz. Şifre değişikliği ve hesap erişiminin durdurulması mevcut oturumları iptal eder.
- Kullanıcı adı 3–32 karakterdir; küçük Latin harfleri, rakam, nokta, alt çizgi ve kısa çizgi kabul edilir. Şifreler yalnızca bcrypt hash olarak saklanır ve panel API'si tarafından geri döndürülmez.
- Yönetici paneli frontend/ altında bağımsız web uygulamasıdır. Mobil uygulama da yönetici modunu içerir (bkz. Mobil yönetici); iki istemci birbirinin kaynaklarına bağımlı değildir. Mobil tarayıcı önizlemesi geliştirme aracıdır; son kullanıcı web uygulaması değildir.
- Yönetici oturumu HttpOnly ve SameSite=Strict cookie ile tutulur; HTTPS yayında Secure kullanılır. Tarayıcı depolarına token yazılmaz. Yönetici ve mobil oturumların kullanım alanı veritabanında ayrıdır. Web yazma isteklerinin Origin değeri yapılandırılmış yönetici adresiyle eşleşmelidir.
- Web paneli ve /api aynı origin üzerinde çalışır. Vite geliştirme sunucusu /api yollarını Go servisine aktarır; üretilmiş web dosyaları yapılandırıldığında Go tarafından /securityadmin altında sunulur. Yayın sağlayıcısı henüz seçilmedi.

## Mağaza içi satın alma

Kullanıcının 15 Ekim 2026 kararıyla takım başvuru hakkı paketleri ve Pro üyelik mobilde App Store (StoreKit 2) ve Google Play (Play Billing) üzerinden satılır; react-native-iap kullanılır. Pro yenilenmeyen 30 günlük üründür (iOS'ta Non-Renewing Subscription, Android'de tek seferlik ürün); her satın alma mevcut kurala göre +30 gün ve sporcuya +3 hak verir. Tahsil edilen ve uygulamada gösterilen fiyat mağazanın fiyatıdır; yönetici panelindeki TL tutarı raporlama içindir. Yönetici her pakete ve Pro plana App Store ve Google Play ürün kimliği atar; kimliği boş olan ürün o mağazada satılmaz.

Uygulama önce sunucuda sipariş açar; sipariş kimliği Apple'da appAccountToken (UUID), Google'da obfuscatedAccountId olarak satın almaya bağlanır. Satın almadan sonra sunucu mağazanın kendi kaydını doğrular (App Store imzalı işlemi Apple kök sertifikasıyla yerelde, Google Play satın almasını Developer API ile), ürün ve siparişi eşleştirir ve hakları/Pro'yu mevcut tek seferlik ödeme olayı akışından verir. Uygulama mağaza işlemini ancak sunucu doğruladıktan sonra bitirir; yarım kalan işlemler her açılışta yeniden gönderilir. Bekleyen ödeme (ör. aile onayı) tamamlanınca işlenir. App Store iadeleri App Store Server Notifications V2 ile, Google Play iadeleri saatte bir iptal edilen satın alma listesinden alınır ve kullanılmamış hakları/Pro dönemini düşürür. Sandbox işlemleri App Review için kabul edilir. Tarayıcı önizlemesinde satın alma kapalıdır.

## Bildirme, engelleme ve hesap silme

Kullanıcının 15 Ekim 2026 kararıyla (mağaza kullanıcı içeriği kuralları) sosyal gönderi, yanıt ve profil "…" menüsünden bildirilebilir ve hesap engellenebilir. Bildirim sebepleri: spam/yanıltıcı, taciz/zorbalık, uygunsuz içerik, başkasını taklit, diğer; isteğe bağlı 500 karakter not. Aynı içerik aynı kişi tarafından bir kez bildirilir; günlük 20 bildirim sınırı vardır; kendi içeriği bildirilemez. Yönetici web ve mobil panelde İçerik bildirimleri kuyruğunu (Açık/Sonuçlanan) görür ve Yoksay, İçeriği kaldır (gönderi/yanıt) veya Hesabı durdur kararı verir; karar aynı içerikle ilgili tüm açık bildirimleri kapatır.

Engel her iki yönde etkilidir: taraflar birbirinin gönderilerini, yanıtlarını, keşif profilini ve galerisini görmez, tanışma isteği gönderemez; engelleme aradaki takipleri kaldırır ve bekleyen/kabul edilmiş tanışmayı iptal eder. Engellenen hesaplar Ayarlar'daki listeden kaldırılabilir. Hesap Ayarlar'dan şifre onayıyla kalıcı olarak silinir; profil, gönderiler, takipler, istekler, galeri, cihaz kayıtları ve oturumlar silinir, ödeme kayıtları hesap bağı kaldırılarak muhasebe için kalır. Kullanım koşulları/topluluk kuralları metni kullanıcı tarafından sağlanacaktır.

## Tasarım sistemi

Fut Career'ın görsel yönü **karanlık, sportif, rafine ve içerik odaklı** olmalı. Futbol sahasının gece atmosferi ve saha ışıklarının enerjisi hissedilmeli; arayüz neon efektlere veya genel amaçlı yönetim paneli görünümüne dönüşmemeli.

### Renk paleti

| Token | HEX | Kullanım |
|---|---|---|
| color-bg | #070A0F | Uygulama ana zemini (gece sahası) |
| color-surface | #0F151D | Kart ve ana yüzeyler |
| color-surface-raised | #162029 | Öne çıkan ve yükseltilmiş yüzeyler |
| color-surface-overlay | #1D2935 | Seçili/üst katman yüzeyler |
| color-border | #233040 | Ayırıcı ve kenarlıklar |
| color-hairline | #FFFFFF12 | Kartlarda ince ışık kenarı |
| color-text-primary | #F4F7FA | Ana metin; lig logoları için aydınlatılmış rozet zemini |
| color-text-secondary | #A7B3BF | Yardımcı metin |
| color-text-muted | #7F8C99 | İkincil, düşük öncelikli metin |
| color-brand | #B6F36A | Ana marka vurgusu ve birincil aksiyon |
| color-brand-hover | #A2E34B | Marka aksiyonunun etkileşim durumu |
| color-brand-ink | #0B1206 | Marka zeminindeki metin/ikon |
| color-brand-wash | #B6F36A14 | Seçili/lider satır ve iç projektör ışığı |
| color-brand-soft | #B6F36A29 | Rozet ve ikon halkaları |
| color-accent-wash | #55D7C41F | Turkuaz ikon zemini (ana sayfa sayaçları) |
| color-info-wash | #74AFFF1F | Mavi ikon zemini (ana sayfa sayaçları) |
| color-floodlight | #E9FFD2 | Ekran başındaki projektör ışığı (çok düşük opaklık) |
| color-accent | #55D7C4 | İkincil vurgu, sınırlı kullanım |
| color-success | #53D68A | Başarılı işlem/durum |
| color-warning | #F5BB52 | Dikkat gerektiren durum |
| color-danger | #FF6B72 | Hata, kaldırma veya risk durumu |
| color-info | #74AFFF | Bilgilendirme |

Marka rengi çim yeşilinden esinlenen canlı limon yeşilidir. Yeşil tüm ekranı kaplamaz; öncelikli aksiyonları ve önemli durumları vurgular. Durumlar yalnızca renkle anlatılmaz; metin veya ikonla da belirtilir. Tam siyah zemin, rastgele renk değerleri ve sürekli gradient kullanımı tercih edilmez.

### Görsel ilkeler

Kullanıcının 13 Ekim 2026 kararıyla görsel yön **Gece stadyumu**dur: derin gece zemini, kat kat yüzeyler ve her ekranın başında tek bir yumuşak projektör ışığı. Işık dekoratiftir; hareketsizdir, erişilebilirlikten gizlenir ve dokunmayı engellemez. Birincil aksiyon hap biçimindedir ve hafif limon ışıması taşır; ikincil aksiyonlarda ışıma yoktur. Skor, puan ve sayaçlar büyük ve eşit genişlikli rakamlarla gösterilir. Lig logoları açık renkli aydınlatılmış bir rozetin üzerinde durur. Puan durumunda lider satır hafif limon zeminle ve limon sıra rozetiyle öne çıkar. Bu ışık efektleri dışında gradient kullanılmaz. Kullanıcının 16 Ekim 2026 kararıyla logo, limon kare üzerindeki ışıklandırılmış, gerçek geometrili (12 beşgen ve 20 altıgen) futbol topu ile yanındaki **FUTCAREER** yazısıdır; işarette harf veya monogram kullanılmaz. Yazı Barlow Condensed ExtraBold Italic harflerinin vektör yola çevrilmiş halidir (SIL OFL 1.1; uygulamaya font dosyası eklenmez); koyu zeminde beyaz FUT ve limon CAREER, açık zeminde tamamen siyahtır. Uygulama açılırken iOS ve Android açılış ekranında (Android 12+ sistem açılışında yalnızca top ikonu) gece zemini üzerinde logo ortada görünür; uygulamanın kendi başlangıç ekranı aynı boyutta devam eder. Ana Sayfa, Ligler, Sosyal, Takımlar ve Diğer sekmelerinin en üstünde logo bulunur. Top çizimi mobile/scripts/app-icon-svg.py ile (uygulama ikonu ve shared/ui/BallMark.tsx), yazı ve logo dosyaları mobile/scripts/brand-svg.py ile (mobile/assets/brand, shared/ui/brand-paths.ts, frontend/src/shared/ui/brand-paths.ts ve brand-mark.svg), ikon PNG'leri ve açılış logosu mobile/scripts/app-icon.sh ile üretilir. Sosyal sekmesinin ortadaki butonu aynı topu kullanır. Kullanıcının 14 Ekim 2026 kararıyla arayüz metni en aza indirilir: sayfa başlıklarının altında genel tanıtım cümlesi gösterilmez (yalnızca ekran okuyucu ipucu olarak kalır; lig açıklaması veya haber özeti gibi gerçek içerik görünür), menüler tek kelimelik etiketli ikon karolarıdır, boş durumlar ikon ve kısa başlıkla gösterilir, içeriği olmayan ana sayfa bölümleri gizlenir. Şifre kuralı, gizlilik notu ve hata mesajları gibi gerekli bilgiler görünür kalır.

- Karanlık tema ilk ve varsayılan temadır.
- Derinlik; katmanlı yüzeyler, boşluk, tipografi ve kontrollü kenarlıklarla kurulur.
- Oyuncu profili ve medya gerçek ürünün merkezinde olmalı; dekoratif kart yığınları içeriğin önüne geçmemeli.
- Futbol verisi hızlı taranabilir olmalı: mevki, uygunluk ve doğrulama durumu kolay seçilmeli.
- Hareket kısa ve işlevsel olmalı; hareketsiz kullanım da aynı derecede anlaşılır kalmalı.
- Türkçe kullanıcı arayüzü metni sade ve doğrudan olmalı.
- Mobil giriş ve kayıt ekranları minimaldir: pazarlama sloganı veya üst etiket yoktur. Giriş ekranında hafif projektör ışığı altında ortalanmış FUTCAREER logosu, kısa sade başlık ("Tekrar hoş geldin") ve kart olmadan doğrudan arka plan üzerinde form bulunur; hesap oluşturma ikincil hap düğmedir. Kayıt adımları logo yerine üst çubukta iki parçalı ince bir ilerleme çubuğu gösterir (erişilebilirlik etiketi "Adım x / 2"); başlıklar kısa ve işlevseldir ("Hesap türünü seç", "Hesap oluştur", "Kulüp başvurusu"). Ana sayfa kişisel karşılama, gerçek profil istatistikleri, reklamlar ve haberleri sunar; şehir, pilot, yaş rozetleri veya uydurma başarı sayıları kullanılmaz.
- Ekran başlıkları ve form alanları tutarlı bir hiyerarşi izler. Alt gezinmede Ana Sayfa, Ligler, Sosyal, Takımlar ve Diğer adları sürekli görünür; seçili sekme metin ve ikonla belirtilir.
- Keşifte gerçek sonuç, boş arama, yükleme, hata ve doğrulama bekleme durumları gösterilir. Henüz bağlanmamış istek özellikleri genel, dürüst boş durumlarla anlatılır. Teknik geliştirme ayrıntıları ürün metinlerine taşınmaz; henüz çalışmayan işlemler varmış gibi sunulmaz.

## Ürün kararları ve açık konular

- React Native ile iOS ve Android, Go ile backend ve PostgreSQL ile kalıcı veri katmanı zorunlu olarak seçildi. İlk geliştirme dilimi kayıt, giriş, oturum ve özel tab bar içeren uygulama kabuğudur.
- Veritabanı şeması backend/migrations altında sıralı SQL migration dosyalarıyla yönetilir. Uygulanmış migration değiştirilmez; yeni değişiklik yeni dosyaya eklenir.
- Kullanıcının 13 Ekim 2026 kararıyla API ve PostgreSQL kullanıcının kendi sunucusunda Docker Compose ile çalışır (bkz. deploy/README.md); medya da bu PostgreSQL içinde kalır. Alan adı ve TLS henüz yoktur: API şimdilik düz HTTP ile yalnızca geliştirme sürümlerine açıktır, yönetici paneline SSH tüneliyle erişilir. Yayın sürümleri için HTTPS gereklidir.
- İlk kulüp/antrenör ortakları ve pilot hedef sayıları henüz belirlenmedi.
- Kullanıcının 11 Ekim 2026 kararıyla yeni sporcular üç ücretsiz takım başvurusu hakkı alır; paketler 2 hak/100 TL, 5 hak/200 TL ve 10 hak/300 TL'dir. Kullanıcının 15 Ekim 2026 kararıyla mobil satın almalar App Store ve Google Play uygulama içi satın almasıyla yapılır (bkz. Mağaza içi satın alma); sağlayıcıdan bağımsız HTTPS adapter'ı ve webhook mobil dışı kullanım için sunucuda korunur.
- Kullanıcının 15 Ekim 2026 kararıyla Pro üyelik (30 gün/49 TL, dönem başına +3 başvuru hakkı, profil ziyaretçileri, gizli gezinme, Pro rozeti) aynı checkout/webhook altyapısıyla eklendi ve Takımlar başlığına başvuru hakkı rozeti kondu (bkz. Pro üyelik ve profil ziyaretçileri).
- Kullanıcının 15 Ekim 2026 kararıyla sunucuda gerçekçi bir demo/test ortamı kurulabilir. Demo verisi migration değildir (her ortama kalıcı giderdi); ayrı ve idempotent `cmd/seed demo` komutuyla kurulur, `--remove` ile kaldırılır. Demo hesapları `@demo.futcareer.test` e-postası ve kulüp/organizasyonlarda `demo.` kullanıcı adı ön ekiyle tanınır; şifre her çalıştırmada rastgele üretilir ve yalnızca stdout'a yazılır. Kişiler kurgusaldır; kulüp adları kullanıcı isteğiyle TFF Ankara amatör kulüp adlarıdır. Ayrıntı: README.md ve deploy/README.md.

Bu kararlar netleşmeden teknoloji veya gelir modeli varsayımını ürün gereksinimi gibi kabul etme.
