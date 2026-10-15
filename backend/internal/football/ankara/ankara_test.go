package ankara_test

import (
	"strings"
	"testing"

	"futcareer/backend/internal/football/ankara"
)

const bulletinPage = `<html><body><table class="table table-hover table-sm"><tbody>
<tr><th colspan="5" class="bg-light font-bold">17 Ekim 2026 Cumartesi</th></tr>
<tr class="bg-light"><td class="bg-light" colspan="5"><h5>ALTINDAĞ &#214;RNEK SAHA</h5></td></tr>
<tr><td class="text-center align-middle">
      09:30
    </td><td class="text-right align-middle">ANKARA DSİ SPOR</td><td class="align-middle">PURSAKLAR BLD.SPOR</td><td class="align-middle">U14 Ligi  </td></tr>
<tr><td>11:00</td><td>TUN&#199; ALTINDAĞ</td><td>ALTINDAĞ  SPOR</td><td>Süper Amatör lig</td></tr>
<tr class="bg-light"><td colspan="5"><h5>MAMAK STADI</h5></td></tr>
<tr><td>13:00</td><td>A</td><td>B</td><td>U14 Ligi</td></tr>
<tr><th colspan="5">18 Ekim 2026 Pazar</th></tr>
<tr><td colspan="5"><h5>ETİMESGUT SAHA</h5></td></tr>
<tr><td>10:00</td><td>C</td><td>D</td><td>U-19 Ligi</td></tr>
<tr><td>Saat yok</td><td>E</td><td>F</td><td>U-19 Ligi</td></tr>
</tbody></table></body></html>`

func TestParseBulletinGroupsByDayAndVenue(t *testing.T) {
	b, err := ankara.ParseBulletin(strings.NewReader(bulletinPage))
	if err != nil {
		t.Fatal(err)
	}
	if len(b.Days) != 2 || b.Days[0].Date != "17 Ekim 2026 Cumartesi" || len(b.Days[0].Venues) != 2 {
		t.Fatalf("days: %+v", b.Days)
	}
	first := b.Days[0].Venues[0]
	if first.Name != "ALTINDAĞ ÖRNEK SAHA" || len(first.Matches) != 2 || first.Matches[0].Time != "09:30" || first.Matches[1].Home != "TUNÇ ALTINDAĞ" || first.Matches[0].League != "U14 Ligi" {
		t.Fatalf("venue: %+v", first)
	}
	if got := b.Days[1].Venues[0].Matches; len(got) != 1 {
		t.Fatalf("a row without a kickoff time must be skipped: %+v", got)
	}
	if strings.Join(b.Leagues, "|") != "U14 Ligi|Süper Amatör lig|U-19 Ligi" {
		t.Fatalf("leagues: %v", b.Leagues)
	}
}

const postsJSON = `[
 {"id":3,"date":"2026-10-08T15:58:30","link":"https://tffankara.org/3-hafta-disiplin/","title":{"rendered":"2026-2027 SEZONU 3. HAFTA D&#304;S&#304;PL&#304;N KARARLARI"},
  "content":{"rendered":"<p>Kararlar <a href=\"https://tffankara.org/wp-content/uploads/2026/10/DISIPLIN.xls\">2026-2027-DİSİPLİN</a> <a href=\"https://github.com/receive-sms-online\">sms</a> <a href=\"https://evil.example/wp-content/uploads/x.pdf\">x</a></p>"}},
 {"id":2,"date":"2026-10-08T13:09:09","link":"https://tffankara.org/4-hakemli-bulten/","title":{"rendered":"2026-2027 SEZONU 4. HAKEMLİ BÜLTEN"},
  "content":{"rendered":"<a href=\"http://www.tffankara.org/wp-content/uploads/2026/10/4.HAFTA.xls\"></a><a href=\"https://tffankara.org/wp-content/uploads/2026/10/script.php\">php</a>"}},
 {"id":1,"date":"2026-10-06T15:08:42","link":"https://tffankara.org/sezon-planlamasi/","title":{"rendered":"Sezon &amp; planlaması <script>alert(1)</script>hakkında"},"content":{"rendered":"<p>metin</p>"}},
 {"id":9,"date":"2026-10-05T10:00:00","link":"https://spam.example/post","title":{"rendered":"Kazandınız"},"content":{"rendered":""}}
]`

func TestParsePostsKeepsOnlyPlainTextAndOwnUploads(t *testing.T) {
	p, err := ankara.ParsePosts(strings.NewReader(postsJSON), "https://tffankara.org", 1)
	if err != nil {
		t.Fatal(err)
	}
	if len(p.Items) != 3 || p.HasMore {
		t.Fatalf("posts from other hosts must be dropped: %+v", p.Items)
	}
	d, b, n := p.Items[0], p.Items[1], p.Items[2]
	if d.Kind != "discipline" || b.Kind != "bulletin" || n.Kind != "news" {
		t.Fatalf("kinds: %s %s %s", d.Kind, b.Kind, n.Kind)
	}
	if len(d.Attachments) != 1 || d.Attachments[0].Type != "excel" || d.Attachments[0].Name != "2026-2027-DİSİPLİN" {
		t.Fatalf("discipline attachments: %+v", d.Attachments)
	}
	if len(b.Attachments) != 1 || b.Attachments[0].URL != "https://www.tffankara.org/wp-content/uploads/2026/10/4.HAFTA.xls" || b.Attachments[0].Name != "4.HAFTA.xls" {
		t.Fatalf("bulletin attachments (https, file name fallback, no .php): %+v", b.Attachments)
	}
	if n.Title != "Sezon & planlaması hakkında" {
		t.Fatalf("title must be plain text: %q", n.Title)
	}
}
