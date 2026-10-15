# Arma İzi (eski adıyla Futbolcuyu Bul) — içerik kaynakları

Son üretim: 14 Ekim 2026. Kullanıcının 14 Ekim 2026 kararıyla soru havuzu büyütüldü ("baya bi havuz") ve aynı futbolcuların döngü halinde tekrar gösterilmemesi istendi. 12 Ekim 2026'daki 20 soruluk elle derlenmiş havuz bu üretimle değiştirildi.

Güncel havuz: 819 futbolcu (185 kolay, 242 orta, 392 zor), 778 kulüp, 427 arma (390 `espn-standings`, 27 `legacy`, 10 `wikidata`).

## Kariyer verisi — Wikidata (CC0)

questions.json ve clubs.json, `backend/cmd/gamecatalog` komutuyla [Wikidata](https://www.wikidata.org/) SPARQL uç noktasından (https://query.wikidata.org/sparql) üretilir. Wikidata içeriği [CC0](https://creativecommons.org/publicdomain/zero/1.0/) lisanslıdır. Her sorunun `sourceUrl` alanı futbolcunun Wikidata sayfasıdır (`https://www.wikidata.org/wiki/Q…`); `id` alanı aynı Wikidata kimliğidir. Komut API tarafından çalışma anında çalıştırılmaz; geliştirici tarafından elle çalıştırılır ve çıktısı depoya eklenir.

Seçim kuralları:

- Meslek futbolcu (P106 = Q937857), doğum yılı 1965 veya sonrası, en az 40 Wikipedia/Wikimedia bağlantısı (sitelinks). Süper Lig (Q485568) kulübünde oynamış futbolcularda eşik 25'tir.
- Kariyer, P54 (üyesi olduğu spor takımı) ifadelerinden ve P580/P582 başlangıç/bitiş niteleyicilerinden kurulur; kiralık dönemler dahildir. Başlangıç tarihi olmayan dönemler sıralanamadığı için atılır. Arka arkaya aynı kulüp tek durak sayılır.
- Yalnızca kulüpler: milli takımlar (P31 alt sınıfı Q6979593, olimpik ve yaş grubu milli takımları dahil), rezerv/B/II takımları, altyapı/akademi ve U-xx takımları hem tür hem ad kalıbıyla, kadın takımları da türle elenir. Aynı ESPN kimliğine sahip Wikidata kayıtları (ör. çok branşlı kulüp ve futbol şubesi) tek kulüp sayılır.
- Bir soru en az 3 farklı kulüp ister ve 3–5 durak gösterir. Daha uzun kariyerlerde ilk ve son kulüp kalır; aradakiler armalı, henüz gösterilmemiş, Süper Lig ve daha bilinen (sitelinks) kulüplerden seçilir. En az 2 durağın arması olmalıdır.
- Zorluk puanı sitelinks sayısıdır; Süper Lig geçmişi olan futbolculara +12 eklenir. Kolay ≥ 70, orta ≥ 60, zor ≥ 53.
- Bir kulüpteki uzun dönemin içine düşen kiralık dönemden sonra ana kulübe dönüş ayrı durak sayılır (ör. New York Red Bulls → Arsenal → New York Red Bulls).
- Örnek incelemesinde Wikidata kaydı hatalı bulunan futbolcular üreticideki `reviewedExclusions` listesinde nedeniyle tutulur (Ekim 2026: Edwin van der Sar, Ajax yerine FC Barcelona 1990–1999 kayıtlı). Wikidata düzeltilince listeden çıkarılır.
- Gösterilen durakları başka bir futbolcunun kariyerinde aynı sırayla bulunan sorular (iki doğru cevap olurdu) ve aynı görünen ada sahip ikinci futbolcu (daha az bilinen) elenir.
- Ad: Türkçe etiket, yoksa İngilizce. Mevki (kaleci/defans/orta saha/forvet) P413'ten, uyruk P1532 (spor için ülke), yoksa P27'den gelir.

Şıklar katalogda saklanmaz: oyun başlarken aynı zorluktaki havuzdan, doğum yılı ±5 ve aynı mevki öncelikli, aynı ipucu dizisini paylaşmayan üç futbolcu seçilir.

## Kulüp armaları — ESPN

Armalar ESPN'in takım logosu CDN'inden 128×128 PNG olarak indirilir (`https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/{espnId}.png&w=128&h=128`); her dosyanın PNG olduğu doğrulanır. Armalar ilgili kulüplerin markalarıdır; oyunda kulübü tanıtan ipucu olarak kullanılır. Dosyalar API binary'sine gömülür; çalışma anında dış CDN kullanılmaz. clubs.json her kulüp için `logoSource` (tam boy ESPN arma adresi), `wikidataUrl` ve `espnMatch` alanlarını kaydeder:

- `wikidata`: ESPN kimliği Wikidata P13590 (espn.com soccer team ID) özelliğinden geldi.
- `espn-standings`: Wikidata'da P13590 çok az kulüpte bulunduğundan (Ekim 2026'da tüm Wikidata'da 41 kayıt) ESPN'in geçmiş lig puan durumlarındaki (`site.api.espn.com/apis/v2/sports/soccer/{lig}/standings?season=…`, 2002'den bugüne) takım adlarıyla aynı ülkede ve tek eşleşmeyle bulundu. Birden çok ESPN takımına uyan adlar eşleştirilmez.
- `legacy`: 12 Ekim 2026'da ESPN takım API'sinde doğrulanmış ilk 27 arma; kimlikleri (barcelona, galatasaray …) kayıtlı oyunlar için korunur.

Arması olmayan kulüpler (`hasCrest: false`) oyunda gece stadyumu tarzı, baş harfli ad rozetiyle gösterilir.

## Yeniden üretme

Bkz. README.md → "Arma İzi kataloğunu yeniden üret".
