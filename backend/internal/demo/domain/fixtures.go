package domain

// Fictional people and texts. Club names are TFF Ankara amateur club names at
// the user's request; contact people, venues, addresses and phone numbers are
// invented. Phone numbers use the unassigned 000 block.

type clubFixture struct {
	key, name, username, footballType, district, description string
	venue, venueAddress, ground, groundAddress, schedule     string
	ageDays                                                  int
}

var clubFixtures = []clubFixture{
	{"barisspor", "Barışspor", "demo.barisspor", "amateur", "Altındağ",
		"Altındağ'ın köklü amatör kulüplerinden biriyiz. Gençlere süre veren, tempolu ve top tutan bir oyun anlayışımız var.",
		"Aktaş Futbol Sahası", "Aktaş Mah. Stadyum Sok. No:4, Altındağ/Ankara",
		"Yıldıztepe Antrenman Sahası", "Yıldıztepe Mah. Spor Cad. No:18, Altındağ/Ankara",
		"Salı ve Perşembe 19:30–21:00, Cumartesi 10:00 taktik çalışma", 62},
	{"mamakbld", "Mamak Belediyespor", "demo.mamakbld", "amateur", "Mamak",
		"Mamak'ın gençlerine futbol kapısı. Altyapıdan A takıma uzanan düzenli bir antrenman programı uyguluyoruz.",
		"Kutludüğün Futbol Sahası", "Kutludüğün Mah. Saha Sok. No:2, Mamak/Ankara",
		"Abidinpaşa Antrenman Sahası", "Abidinpaşa Mah. Gençlik Cad. No:41, Mamak/Ankara",
		"Pazartesi, Çarşamba ve Cuma 19:00–20:30", 60},
	{"ankaradsi", "Ankara DSİ Spor", "demo.ankaradsi", "amateur", "Yenimahalle",
		"Disiplinli, savunması sağlam ve kontra atakta etkili bir takımız. Sezon boyunca düzenli antrenman yapacak oyunculara açığız.",
		"Demetevler Futbol Sahası", "Demetevler Mah. 402. Cad. No:7, Yenimahalle/Ankara",
		"Batıkent Antrenman Sahası", "Batıkent Bulvarı Spor Alanı, Yenimahalle/Ankara",
		"Salı, Çarşamba ve Cuma 20:00–21:30", 58},
	{"pursaklarbld", "Pursaklar Bld. Spor", "demo.pursaklarbld", "amateur", "Pursaklar",
		"Pursaklar'ın kulübü. Yerel oyunculara öncelik veriyor, her mevkide rekabetçi bir kadro kurmaya çalışıyoruz.",
		"Pursaklar Şehir Sahası", "Merkez Mah. Fatih Cad. No:15, Pursaklar/Ankara",
		"Saray Antrenman Sahası", "Saray Mah. Okul Sok. No:3, Pursaklar/Ankara",
		"Pazartesi ve Perşembe 19:00–20:30, Pazar sabah toparlanma", 55},
	{"tuncaltindag", "Tunç Altındağ", "demo.tuncaltindag", "amateur", "Altındağ",
		"Mahalle takımı ruhunu kaybetmeden ligde iddialı olmayı hedefliyoruz. Hücum oyununu seven oyuncuları bekliyoruz.",
		"Hıdırlıktepe Futbol Sahası", "Hıdırlıktepe Mah. Spor Sok. No:9, Altındağ/Ankara",
		"Karapürçek Antrenman Sahası", "Karapürçek Mah. Yıldız Cad. No:22, Altındağ/Ankara",
		"Salı, Perşembe ve Cumartesi 18:30–20:00", 53},
	{"keciorensportif", "Keçiören Sportif A.Ş.", "demo.kecioren.sportif", "professional", "Keçiören",
		"Profesyonel yapılanmasıyla Keçiören'in futbol kulübü. Teknik ekibimiz oyuncu gelişimini veriyle takip eder.",
		"Aktepe Futbol Sahası", "Aktepe Mah. Stadyum Cad. No:1, Keçiören/Ankara",
		"Etlik Antrenman Tesisleri", "Etlik Mah. Spor Sok. No:6, Keçiören/Ankara",
		"Pazartesi–Cuma 10:00–12:00, Cumartesi maç günü hazırlığı", 64},
	{"ulubeyspor", "Ulubeyspor", "demo.ulubeyspor", "amateur", "Altındağ",
		"Ulubey'in takımı. Küçük ama birbirine bağlı bir kadromuz var; antrenmanlara düzenli gelen herkese forma şansı veriyoruz.",
		"Ulubey Futbol Sahası", "Ulubey Mah. Okul Cad. No:12, Altındağ/Ankara",
		"Ulubey Futbol Sahası", "Ulubey Mah. Okul Cad. No:12, Altındağ/Ankara",
		"Çarşamba ve Cuma 19:30–21:00", 50},
	{"ankara1910", "Ankara 1910 Spor", "demo.ankara1910", "professional", "Çankaya",
		"Başkentin köklü futbol geleneğini sürdüren kulübüz. Profesyonel kadromuz için deneyimli oyuncularla görüşüyoruz.",
		"Dikmen Futbol Sahası", "Dikmen Mah. Vadi Cad. No:30, Çankaya/Ankara",
		"Ümitköy Antrenman Sahası", "Ümitköy Mah. 2432. Cad. No:5, Çankaya/Ankara",
		"Pazartesi–Cuma 09:30–11:30", 63},
	{"golbasiyildiz", "Gölbaşı Yıldız Halı Saha", "demo.golbasiyildiz", "halisaha", "Gölbaşı",
		"Halı saha liglerinde ve turnuvalarda yarışan, haftada iki gün düzenli oynayan bir takımız.",
		"Yıldız Halı Saha Tesisleri", "Bahçelievler Mah. Göl Cad. No:48, Gölbaşı/Ankara",
		"Yıldız Halı Saha Tesisleri", "Bahçelievler Mah. Göl Cad. No:48, Gölbaşı/Ankara",
		"Salı ve Perşembe 21:00–22:00 maç antrenmanı", 45},
	{"etimesgutgenclik", "Etimesgut Gençlik Halı Saha", "demo.etimesgutgenclik", "halisaha", "Etimesgut",
		"Etimesgut'ta gençlerden oluşan halı saha takımı. Hızlı, kısa paslı oyunu seviyoruz.",
		"Elvankent Gençlik Halı Saha", "Elvankent Mah. Spor Cad. No:17, Etimesgut/Ankara",
		"Elvankent Gençlik Halı Saha", "Elvankent Mah. Spor Cad. No:17, Etimesgut/Ankara",
		"Pazartesi ve Çarşamba 21:00–22:30", 44},
}

type applicationFixture struct {
	key, role, name, username, footballType, district, contact, phone, note string
	daysAgo                                                                 int
	rejection                                                               string
}

var applicationFixtures = []applicationFixture{
	{"gerede", "club", "Gerede Önderspor", "demo.gerede.onderspor", "amateur", "Etimesgut", "Hüseyin Tan", "+90 000 000 00 11",
		"TFF Ankara amatör liginde oynuyoruz. Sezon öncesi oyuncu keşfi için uygulamayı kullanmak istiyoruz.", 4, ""},
	{"fatihulus", "club", "Fatih Ulusspor", "demo.fatih.ulusspor", "amateur", "Altındağ", "Recep Yalçın", "+90 000 000 00 12",
		"Ulus'ta 15 yıllık amatör kulübüz. Takım sayfamızı ve antrenman programımızı paylaşmak istiyoruz.", 2, ""},
	{"altindagspor", "club", "Altındağ Spor", "demo.altindagspor", "amateur", "Altındağ", "Cengiz Ateş", "+90 000 000 00 13",
		"Gençlerden oluşan kadromuz için kaleci ve stoper arıyoruz.", 1, ""},
	{"baskentorganizasyon", "organizer", "Başkent Halı Saha Organizasyon", "demo.baskent.organizasyon", "", "Çankaya", "Selin Ural", "+90 000 000 00 14",
		"Her ay Çankaya'da 16 takımlı halı saha turnuvası düzenliyoruz.", 3, ""},
	{"sincankartallar", "club", "Sincan Kartallar FK", "demo.sincan.kartallar", "halisaha", "Sincan", "Murat Erdem", "+90 000 000 00 15",
		"Halı saha takımıyız, turnuvalara katılmak istiyoruz.", 9,
		"Kulüp yetkilisine verilen telefondan ulaşılamadı ve takım bilgileri doğrulanamadı. Bilgileri güncelleyip yeniden başvurabilirsiniz."},
}

type playerFixture struct {
	key, name, emailLocal                      string
	birthYear                                  int
	position, foot, availability, footballType string
	license                                    string
	discoverable                               bool
	ageDays                                    int
}

var playerFixtures = []playerFixture{
	{"emre", "Emre Kaya", "emre.kaya", 2000, "Santrfor", "right", "open_to_offers", "amateur", "licensed", true, 40},
	{"burak", "Burak Yıldız", "burak.yildiz", 1997, "Stoper", "right", "open_to_offers", "amateur", "licensed", true, 39},
	{"mert", "Mert Aydın", "mert.aydin", 2002, "Merkez orta saha", "both", "open_to_offers", "amateur", "licensed", true, 38},
	{"oguzhan", "Oğuzhan Demir", "oguzhan.demir", 1995, "Kaleci", "right", "not_available", "amateur", "licensed", true, 37},
	{"can", "Can Arslan", "can.arslan", 2004, "Sol kanat", "left", "seeking_team", "amateur", "unlicensed", true, 36},
	{"yusuf", "Yusuf Çelik", "yusuf.celik", 2001, "Sağ bek", "right", "open_to_offers", "professional", "licensed", true, 35},
	{"berkay", "Berkay Şahin", "berkay.sahin", 2003, "On numara", "left", "seeking_team", "amateur", "licensed", true, 34},
	{"furkan", "Furkan Koç", "furkan.koc", 1999, "Ön libero", "right", "seeking_team", "professional", "licensed", true, 33},
	{"enes", "Enes Kurt", "enes.kurt", 2006, "Sol bek", "left", "seeking_team", "amateur", "unlicensed", true, 32},
	{"kaan", "Kaan Öztürk", "kaan.ozturk", 2005, "Sağ kanat", "right", "seeking_team", "halisaha", "unlicensed", true, 31},
	{"serkan", "Serkan Polat", "serkan.polat", 1996, "Stoper", "right", "not_available", "amateur", "licensed", false, 30},
	{"alperen", "Alperen Doğan", "alperen.dogan", 2007, "Santrfor", "right", "seeking_team", "amateur", "unlicensed", true, 29},
	{"elif", "Elif Aksu", "elif.aksu", 2002, "Merkez orta saha", "right", "open_to_offers", "halisaha", "unlicensed", true, 28},
	{"batuhan", "Batuhan Aksoy", "batuhan.aksoy", 2000, "Merkez orta saha", "right", "open_to_offers", "amateur", "licensed", true, 27},
	{"onur", "Onur Güneş", "onur.gunes", 1998, "Sağ bek", "right", "not_available", "halisaha", "unlicensed", false, 26},
	{"tolga", "Tolga Karaca", "tolga.karaca", 1997, "Pivot", "left", "open_to_offers", "halisaha", "unlicensed", true, 26},
	{"zeynep", "Zeynep Tekin", "zeynep.tekin", 2004, "Kaleci", "right", "seeking_team", "amateur", "licensed", true, 25},
	{"umut", "Umut Kılıç", "umut.kilic", 2008, "Sol kanat", "left", "seeking_team", "amateur", "unlicensed", false, 24},
}

type replyFixture struct{ author, body string }

type postFixture struct {
	author    string
	day, hour int
	body      string
	replies   []replyFixture
}

var postFixtures = []postFixture{
	{"emre", 19, 21, "Barışspor'un antrenmanına misafir olarak katıldım. Tempo yüksekti, hocanın beklentisi net. Umarım devamı gelir.", nil},
	{"emre", 15, 18, "Resmen Barışspor'dayım! Başvurumu kabul eden teknik ekibe teşekkürler. Yeni sezon için hazırım.", []replyFixture{{"barisspor", "Aramıza hoş geldin Emre!"}, {"burak", "Hoş geldin kardeşim, arkada ben, önde sen."}}},
	{"emre", 4, 20, "Pazar maçında 2 gol attım. Takım arkadaşlarımın eline sağlık, puan hepimizin.", nil},
	{"emre", 1, 22, "Salı antrenmanında bitiricilik çalıştık. 40 şutun 31'i çerçevede, gelişiyoruz.", nil},
	{"burak", 17, 20, "Stoperde konuşmak her şeydir. Bu hafta savunma hattıyla iletişim üzerine çalıştık, farkı sahada göreceğiz.", nil},
	{"burak", 3, 22, "Hava topu çalışmasından sonra bacaklar kopuyor ama değer. Pazar maçına hazırız.", nil},
	{"mert", 20, 19, "Orta sahada top kaybetmemek kadar oyunu hızlandırmak da önemli. Bu sezon hedefim asist sayımı artırmak.", nil},
	{"mert", 12, 21, "Mamak Belediyespor ailesine katıldım. İlk antrenmanda herkes çok sıcak karşıladı, teşekkürler!", nil},
	{"mert", 3, 23, "Maç sonu saat 12,4 km koştuğumu söylüyor. Saat bozuk olabilir ama yorgunluk gerçek.", nil},
	{"oguzhan", 14, 18, "Sakatlık sonrası ilk kez eldivenleri giydim. Yavaş ama emin adımlarla dönüyorum.", []replyFixture{{"burak", "Geçmiş olsun abi, kaleyi özledik."}, {"zeynep", "Hızlı iyileşmeler!"}}},
	{"oguzhan", 2, 12, "Kalecilere tavsiye: ısınmayı asla atlamayın. Parmak sakatlığıyla altı hafta kenarda kalmak hiç keyifli değil.", nil},
	{"can", 18, 20, "2004 doğumlu, sol ayaklı bir sol kanadım. Ankara'da hafta içi antrenman yapan amatör bir takım arıyorum. Önerilere açığım.", []replyFixture{{"mert", "Bizim takımın kanat ihtiyacı olabilir, kulüp sayfasına bir bak derim."}}},
	{"can", 9, 17, "Bugün sahada tek başıma birebir ve orta çalışması yaptım. Takım bulana kadar formu korumak şart.", nil},
	{"can", 2, 19, "Ankara DSİ Spor'a başvurumu yaptım ve tanışma isteği gönderdim. Heyecanla bekliyorum.", nil},
	{"yusuf", 16, 19, "Sağ bekte bindirme yapmak kolay, geri dönmek zor. Bugün tamamen dönüş koşuları çalıştık.", nil},
	{"yusuf", 7, 20, "Yeni sezon öncesi profesyonel ya da üst düzey amatör bir takımla görüşmeye açığım. Profilimde detaylar var.", nil},
	{"berkay", 13, 18, "Serbest vuruş çalışması: 20 denemede 6 gol. Hedef 10.", []replyFixture{{"furkan", "Bu hızla gidersen 10 da olur."}}},
	{"berkay", 5, 21, "Tunç Altındağ'a başvurdum. On numarada oynamayı seviyorum ama kanatta da görev alabilirim.", nil},
	{"berkay", 0, 9, "Dün akşam halı sahada arkadaşlarla iki saat top oynadık. Bazen en iyi antrenman eğlenmektir.", nil},
	{"furkan", 19, 20, "Ön liberoda pozisyon almak her şey. Maç izlerken artık sadece topsuz oyuna bakıyorum.", nil},
	{"furkan", 8, 22, "Keçiören Sportif ile görüşmemiz olumsuz sonuçlandı ama yoluma devam ediyorum. Teşekkürler hocam.", nil},
	{"furkan", 3, 18, "Ankara 1910 Spor'un ön libero ilanına başvurdum. Kısmetse yakında sahada görüşürüz.", nil},
	{"enes", 11, 20, "20 yaşındayım, sol bekim. Lisansım yok ama her hafta düzenli antrenman yapıyorum. Şans verecek bir takım arıyorum.", []replyFixture{{"burak", "Düzenli çalışan kazanır, bol şans Enes."}}},
	{"enes", 4, 18, "Barışspor'un sol bek ilanını görünce hemen başvurdum. Umarım deneme antrenmanına çağırırlar.", nil},
	{"kaan", 15, 23, "Halı sahada hız her şey. Bu akşam Elvankent'te 3 gol 2 asist, fena değil.", []replyFixture{{"tolga", "Bir gün Gölbaşı'nda bizimle de oyna."}}},
	{"kaan", 6, 20, "Etimesgut Gençlik başvurumu kabul etmedi ama sorun yok, yeni takımlara bakmaya devam.", nil},
	{"serkan", 10, 21, "İş temposu yüzünden bu sezon ara veriyorum. Yine de hafta sonları topu bırakmak yok.", nil},
	{"alperen", 14, 19, "2007 doğumlu bir santrforum, kafa vuruşlarım güçlü. Amatör ligde oynayacak takım arıyorum.", []replyFixture{{"emre", "Kafa vuruşu çalışmasına ben de varım, hafta içi buluşalım."}}},
	{"alperen", 9, 22, "Bugün ilk kez çift antrenman yaptım. Sabah kondisyon, akşam şut.", nil},
	{"alperen", 1, 20, "Ulubeyspor'a başvuru yaptım, deneme antrenmanı için hazırım.", nil},
	{"elif", 17, 21, "Kadın halı saha ligi için orta saha oynayan arkadaşlar arıyoruz. Çarşamba akşamları Çankaya'dayız.", []replyFixture{{"zeynep", "Kaleci lazım olursa ben buradayım!"}}},
	{"elif", 7, 19, "Bu hafta pas oyunu çalıştık: tek dokunuş, üçgen kurmak, boşa çıkmak. Çok keyifliydi.", nil},
	{"batuhan", 20, 9, "Pazar sabahı koşusu: 10 km, kilometre başına 5:05. Sezon öncesi kondisyon tamam sayılır.", nil},
	{"batuhan", 12, 20, "Mamak Belediyespor başvurum olumsuz döndü. Ulubeyspor'la tanışma isteğimiz kabul edildi, bakalım neler olacak.", []replyFixture{{"mert", "Geçen sezon birlikte oynamıştık, başarılar Batuhan."}}},
	{"batuhan", 5, 18, "Merkez orta sahada iki yönlü oynayabilirim. Pres ve top taşıma en güçlü yanlarım.", nil},
	{"onur", 11, 22, "Halı saha maçında bileğimi burktum. Bu hafta buz ve dinlenme.", nil},
	{"tolga", 18, 22, "Gölbaşı Yıldız'a katıldım! Salı ve perşembe akşamları sahadayız, izlemek isteyen herkese açık.", []replyFixture{{"golbasiyildiz", "Hoş geldin Tolga, salı görüşürüz."}}},
	{"tolga", 10, 20, "Pivotta sırtı dönük oyun ve duvar pası. Halı sahada en çok işe yarayan iki şey.", nil},
	{"tolga", 4, 21, "Kış Kupası kadrosuna girdik. Heyecanlıyız!", nil},
	{"zeynep", 16, 18, "Kaleci olarak refleks çalışmalarına ağırlık verdim. Tenis topuyla duvar çalışması gerçekten işe yarıyor.", nil},
	{"zeynep", 8, 20, "Pursaklar Bld. Spor'a başvurdum. Kalede oynamaya hazırım.", nil},
	{"zeynep", 2, 21, "Bugün penaltı çalışması: 12 penaltının 4'ünü kurtardım. Az değil!", []replyFixture{{"oguzhan", "Helal olsun, 4/12 çok iyi oran."}}},
	{"umut", 13, 17, "18 yaşına girdim, bu sezon ilk kez amatör ligde oynamak istiyorum. Antrenmanlara devam.", nil},
	{"umut", 3, 17, "Okul çıkışı sahaya, sahadan eve. Hafta böyle geçiyor.", nil},
	{"barisspor", 4, 19, "Ligde dört hafta geride kaldı. Hedefimiz ilk yarıyı üst sıralarda bitirmek. Sol bek ilanımız açık.", nil},
	{"ankara1910", 9, 12, "Hazırlık dönemi tamamlandı. Ön libero ilanımız açık, profillerinizi bekliyoruz.", nil},
	{"golbasiyildiz", 5, 13, "Kış Kupası'na başvurduk. Perşembe 21:00 antrenmanına herkes davetli.", []replyFixture{{"tolga", "Hazırız hocam!"}}},
	{"tuncaltindag", 3, 11, "Cumartesi antrenmanı 18:30'da Karapürçek'te. Yeni oyuncu adaylarını da bekliyoruz.", nil},
	{"keciorensportif", 11, 10, "Teknik ekibimiz yeni sezon için oyuncu takibine başladı. Profilini güncel tutan oyuncuları inceliyoruz.", nil},
}

type newsFixture struct {
	key, author, title, summary, body string
	day                               int
	status                            string
	home                              bool
}

var newsFixtures = []newsFixture{
	{"barisspor-sezon", "barisspor", "Barışspor yeni sezona hazır",
		"Barışspor, hazırlık dönemini Yıldıztepe'de yaptığı çalışmalarla tamamladı.",
		"Barışspor, yeni sezon hazırlıklarını Yıldıztepe Antrenman Sahası'nda yaptığı üç haftalık çalışmayla tamamladı. Teknik ekip, kadroya katılan yeni oyuncuların takıma hızlı uyum sağladığını belirtti.\n\nKulüp, sol bek mevkisi için açtığı ilanla kadro planlamasını sürdürüyor. Antrenmanlar salı ve perşembe akşamları devam ediyor.",
		16, "approved", true},
	{"ankara1910-kamp", "ankara1910", "Ankara 1910 Spor hazırlık kampını tamamladı",
		"Profesyonel kadro, Ümitköy'deki yoğun hazırlık programını bitirdi.",
		"Ankara 1910 Spor, Ümitköy Antrenman Sahası'nda yürüttüğü hazırlık programını tamamladı. Kampta kondisyon ve taktik çalışmalarının yanı sıra iki hazırlık maçı oynandı.\n\nKulüp, orta sahaya deneyim katacak bir ön libero arayışında olduğunu açıkladı.",
		11, "approved", false},
	{"yildiz-kupa", "golbasiyildiz", "Gölbaşı Yıldız Kış Kupası'na başvurdu",
		"Takım, Ankara Demo Kış Kupası için başvurusunu tamamladı.",
		"Gölbaşı Yıldız Halı Saha takımı, Ankara Demo Kış Kupası'na kadrosunu bildirerek başvurdu. Takım, turnuva öncesinde haftada iki gün maç antrenmanı yapacak.",
		5, "approved", false},
	{"tunc-deplasman", "tuncaltindag", "Tunç Altındağ'da antrenman saatleri güncellendi",
		"Cumartesi antrenmanları artık 18:30'da Karapürçek'te yapılacak.",
		"Tunç Altındağ, hava koşulları nedeniyle cumartesi antrenmanlarını 18:30'a aldı. Antrenmanlar Karapürçek Antrenman Sahası'nda devam edecek. Deneme antrenmanına katılmak isteyen oyuncular kulüple uygulama üzerinden iletişime geçebilir.",
		3, "approved", false},
	{"ulubey-kadro", "ulubeyspor", "Ulubeyspor'da yeni sezon kadro planlaması",
		"Ulubeyspor, ikinci yarı için orta saha ve forvet hattını güçlendirmek istiyor.",
		"Ulubeyspor teknik ekibi, ikinci yarı öncesinde orta saha ve forvet hattına takviye yapmayı planlıyor. Kulüp, deneme antrenmanlarını çarşamba ve cuma akşamları Ulubey Futbol Sahası'nda yapacak.",
		1, "pending", false},
}
