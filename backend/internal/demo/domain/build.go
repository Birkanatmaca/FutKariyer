package domain

import (
	"strconv"
	"time"

	notify "futcareer/backend/internal/notifications/domain"
)

// Istanbul has no daylight saving time; a fixed zone keeps the dataset independent of tzdata.
var istanbul = time.FixedZone("TRT", 3*60*60)

type builder struct {
	now   time.Time
	data  Dataset
	names map[string]string
	types map[string]string
	seq   int
}

// Build returns the full demo dataset relative to now. Everything except the
// clock is fixed: the same now produces exactly the same rows.
func Build(now time.Time) Dataset {
	b := &builder{now: now.UTC().Truncate(time.Second), names: map[string]string{}, types: map[string]string{}}
	b.data.Now = b.now
	b.accounts()
	b.coach()
	b.social()
	b.teams()
	b.connections()
	b.news()
	b.league()
	b.tournament()
	b.pictures()
	return b.data
}

// at is a wall-clock time in Istanbul, daysAgo days before now, never in the future.
func (b *builder) at(daysAgo, hour, minute int) time.Time {
	local := b.now.In(istanbul)
	t := time.Date(local.Year(), local.Month(), local.Day()-daysAgo, hour, minute, 0, 0, istanbul).UTC()
	return b.past(t)
}

// past keeps derived timestamps strictly before now and distinct.
func (b *builder) past(t time.Time) time.Time {
	if t.Before(b.now) {
		return t
	}
	b.seq++
	return b.now.Add(-time.Duration(b.seq) * time.Minute)
}

func (b *builder) notify(n notify.NewNotification, at time.Time) {
	b.data.Notifications = append(b.data.Notifications, Notification{
		ID: ID("notification", n.RecipientID+"/"+n.SourceKey), RecipientID: n.RecipientID, Kind: n.Kind, Title: n.Title, Body: n.Body,
		ResourceID: n.ResourceID, SourceKey: n.SourceKey, CreatedAt: at, Read: b.now.Sub(at) > 5*24*time.Hour,
	})
}

func (b *builder) accounts() {
	for i, c := range clubFixtures {
		created := b.at(c.ageDays, 10+i%6, 15)
		b.names[c.key], b.types[c.key] = c.name, c.footballType
		b.data.Accounts = append(b.data.Accounts, Account{Key: c.key, ID: UserID(c.key), Role: "club", FullName: c.name, Email: c.username + EmailSuffix, Username: c.username, Active: true, Verified: true, ApprovalStatus: "approved", CreatedAt: created})
		b.data.Clubs = append(b.data.Clubs, Club{UserID: UserID(c.key), FootballType: c.footballType, District: c.district, Description: c.description, VenueName: c.venue, VenueAddress: c.venueAddress, TrainingGroundName: c.ground, TrainingGroundAddress: c.groundAddress, TrainingSchedule: c.schedule, TFF: tffLinks[c.key], UpdatedAt: created.Add(26 * time.Hour)})
	}
	// The verified organizer applied from the app and was approved.
	orgCreated := b.at(30, 11, 40)
	orgDecided := orgCreated.Add(20 * time.Hour)
	b.names["organizer"] = "Ankara Amatör Turnuva Organizasyonu"
	b.data.Accounts = append(b.data.Accounts, Account{Key: "organizer", ID: UserID("organizer"), Role: "organizer", FullName: b.names["organizer"], Email: "demo.ankara.turnuva" + EmailSuffix, Username: "demo.ankara.turnuva", Active: true, Verified: true, ApprovalStatus: "approved", CreatedAt: orgCreated})
	b.data.Applications = append(b.data.Applications, Application{UserID: UserID("organizer"), Role: "organizer", ContactName: "Deniz Arıkan", Phone: "+90 000 000 00 10", District: "Yenimahalle", Note: "Amatör kulüpler için sezon arası turnuvalar düzenliyoruz.", SubmittedAt: orgCreated, DecidedAt: &orgDecided})
	for i, a := range applicationFixtures {
		submitted := b.at(a.daysAgo, 9+i*2, 5)
		status := "pending"
		var decided *time.Time
		if a.rejection != "" {
			status = "rejected"
			at := submitted.Add(46 * time.Hour)
			decided = &at
		}
		b.data.Accounts = append(b.data.Accounts, Account{Key: a.key, ID: UserID(a.key), Role: a.role, FullName: a.name, Email: a.username + EmailSuffix, Username: a.username, ApprovalStatus: status, CreatedAt: submitted})
		if a.role == "club" {
			b.data.Clubs = append(b.data.Clubs, Club{UserID: UserID(a.key), FootballType: a.footballType, District: a.district, UpdatedAt: submitted})
		}
		b.data.Applications = append(b.data.Applications, Application{UserID: UserID(a.key), Role: a.role, ContactName: a.contact, Phone: a.phone, District: a.district, Note: a.note, SubmittedAt: submitted, DecidedAt: decided, RejectionReason: a.rejection})
	}
	for i, p := range playerFixtures {
		created := b.at(p.ageDays, 19+i%4, 10+i)
		b.names[p.key], b.types[p.key] = p.name, p.footballType
		b.data.Accounts = append(b.data.Accounts, Account{Key: p.key, ID: UserID(p.key), Role: "player", FullName: p.name, Email: p.emailLocal + EmailSuffix, ApprovalStatus: "approved", Active: true, CreatedAt: created})
		experience := 2026 - p.birthYear - 9
		b.data.Players = append(b.data.Players, Player{UserID: UserID(p.key), BirthYear: p.birthYear, Position: p.position, DominantFoot: p.foot, ExperienceYears: experience, Availability: p.availability, Discoverable: p.discoverable, FootballType: p.footballType, LicenseStatus: p.license, UpdatedAt: created.Add(40 * time.Minute)})
	}
}

// coach adds the demo coach: a verified account with a filled-in coach profile
// on Barışspor's technical staff, so "Geçiş yap" can be tried.
func (b *builder) coach() {
	c := demoCoach
	created := b.at(c.ageDays, 20, 5)
	b.names[c.key], b.types[c.key] = c.name, c.footballType
	b.data.Accounts = append(b.data.Accounts, Account{Key: c.key, ID: UserID(c.key), Role: "coach", FullName: c.name, Email: c.emailLocal + EmailSuffix, Active: true, Verified: true, ApprovalStatus: "approved", CreatedAt: created})
	b.data.Coaches = append(b.data.Coaches, CoachProfile{
		UserID: UserID(c.key), LicenseLevel: c.license, Specialties: c.specialties, ExperienceYears: c.experienceYears,
		FootballType: c.footballType, Availability: c.availability, PastClubs: c.pastClubs,
		ShowLicense: true, ShowExperience: true, ShowFootball: true, ShowClubs: true,
		UpdatedAt: created.Add(30 * time.Minute),
	})
	invited := b.at(20, 14, 0)
	b.data.Staff = append(b.data.Staff, StaffLink{ClubID: UserID(c.club), CoachID: UserID(c.key), Role: c.role, Permissions: c.permissions, InvitedAt: invited, JoinedAt: b.past(invited.Add(26 * time.Hour))})
}

// pictures gives every active account a profile photo or crest, and a few
// players gallery photos.
func (b *builder) pictures() {
	for _, a := range b.data.Accounts {
		if !a.Active {
			continue
		}
		name := "crest-" + a.Key + ".png"
		switch a.Role {
		case "player":
			name = "player-" + a.Key + ".jpg"
		case "coach":
			name = "coach.jpg"
		}
		b.data.Avatars = append(b.data.Avatars, Avatar{UserID: a.ID, Photo: photo(name)})
	}
	for i, g := range galleryPhotos {
		b.data.Gallery = append(b.data.Gallery, GalleryItem{ID: ID("gallery", g.player+"/"+g.photo), OwnerID: UserID(g.player), Photo: photo(g.photo + ".jpg"), CreatedAt: b.at(10-i, 18, 30)})
	}
}

// showsOnProfile: players and the coach also list their post photos on their
// profile; clubs only post them.
func showsOnProfile(author string) bool {
	if author == demoCoach.key {
		return true
	}
	for _, p := range playerFixtures {
		if p.key == author {
			return true
		}
	}
	return false
}

func (b *builder) social() {
	players := make([]string, len(playerFixtures))
	for i, p := range playerFixtures {
		players[i] = p.key
	}
	clubKeys := make([]string, len(clubFixtures))
	for i, c := range clubFixtures {
		clubKeys[i] = c.key
	}
	followed := map[string][]string{}
	seen := map[[2]string]bool{}
	follow := func(profile, follower string, at time.Time) {
		key := [2]string{profile, follower}
		if profile == follower || seen[key] {
			return
		}
		seen[key] = true
		followed[profile] = append(followed[profile], follower)
		b.data.Follows = append(b.data.Follows, Follow{ProfileID: UserID(profile), FollowerID: UserID(follower), CreatedAt: at})
	}
	// Each player follows 3–8 accounts, a mix of clubs and other players.
	for i, p := range players {
		n := 3 + (i*5)%6
		candidates := []string{clubKeys[i%10], players[(i+1)%18], clubKeys[(i+4)%10], players[(i+3)%18], clubKeys[(i+7)%10], players[(i+7)%18], players[(i+11)%18], clubKeys[(i+2)%10]}
		for j := 0; j < n; j++ {
			follow(candidates[j], p, b.at(20-(i+j)%18, 20+j%3, 5*j))
		}
	}
	// Clubs follow a few players they are watching.
	for j, c := range clubKeys {
		targets := []string{players[(j*2)%18], players[(j*2+5)%18], players[(j*3+1)%18], players[(j*5+7)%18]}
		for k := 0; k < 2+j%3; k++ {
			follow(targets[k], c, b.at(14-(j+k)%10, 11+k, 30))
		}
	}
	// Teammates and his club follow the demo coach.
	for i, follower := range []string{"emre", "mert", "enes", "alperen", "barisspor"} {
		follow(demoCoach.key, follower, b.at(18-i*2, 21, 10))
	}
	for i, f := range postFixtures {
		post := Post{ID: ID("post", f.author+"/"+strconv.Itoa(i)), AuthorID: UserID(f.author), Body: f.body, CreatedAt: b.at(f.day, f.hour, (i*7)%60)}
		if name, ok := postPhotos[f.author+"/"+strconv.Itoa(f.day)]; ok {
			picture := photo(name + ".jpg")
			post.Media = &picture
			post.ShowOnProfile = showsOnProfile(f.author)
		}
		b.data.Posts = append(b.data.Posts, post)
		likers := followed[f.author]
		for k := 0; k < len(likers) && k < 1+(i*7)%6; k++ {
			b.data.Likes = append(b.data.Likes, Like{PostID: post.ID, UserID: UserID(likers[k]), CreatedAt: b.past(post.CreatedAt.Add(time.Duration(25+k*47) * time.Minute))})
		}
		for k, r := range f.replies {
			b.data.Replies = append(b.data.Replies, Reply{ID: ID("reply", post.ID+"/"+strconv.Itoa(k)), PostID: post.ID, AuthorID: UserID(r.author), Body: r.body, CreatedAt: b.past(post.CreatedAt.Add(time.Duration(40+k*95) * time.Minute))})
		}
	}
	// Profile views from clubs and players over the last two weeks.
	for i, p := range players {
		for k := 0; k < 2+i%4; k++ {
			viewer := clubKeys[(i+k*3)%10]
			if k%2 == 1 {
				viewer = players[(i+k*5)%18]
			}
			day := b.at((i+k*4)%14, 12, 0)
			b.data.Views = append(b.data.Views, View{ProfileID: UserID(p), ViewerID: UserID(viewer), Day: time.Date(day.Year(), day.Month(), day.Day(), 0, 0, 0, 0, time.UTC)})
		}
	}
}

func (b *builder) teams() {
	listings := []struct {
		club, title, position, description string
		day                                int
	}{
		{"barisspor", "Sol bek arıyoruz", "Sol bek", "Salı ve perşembe akşamları antrenmana gelebilecek, hücuma katılmayı seven bir sol bek arıyoruz.", 6},
		{"ankara1910", "Deneyimli ön libero", "Ön libero", "Profesyonel kadromuz için en az beş yıllık deneyime sahip, top dağıtımı iyi bir ön libero arıyoruz.", 9},
		{"golbasiyildiz", "Perşembe akşamları için kaleci", "Kaleci", "Halı saha takımımız için perşembe 21:00 maçlarına düzenli gelebilecek bir kaleci arıyoruz.", 2},
	}
	listingID := map[string]string{}
	for _, l := range listings {
		item := Listing{ID: ID("listing", l.club), ClubID: UserID(l.club), Title: l.title, Position: l.position, Description: l.description, CreatedAt: b.at(l.day, 11, 20)}
		listingID[l.club] = item.ID
		b.data.Listings = append(b.data.Listings, item)
		body := b.names[l.club] + " " + l.position + " arıyor. İlanı inceleyip başvurabilirsin."
		for _, p := range playerFixtures {
			if p.footballType == b.types[l.club] {
				b.notify(notify.NewNotification{RecipientID: UserID(p.key), Kind: notify.KindOpportunity, Title: l.title, Body: body, ResourceID: item.ID, SourceKey: "listing:" + item.ID}, item.CreatedAt.Add(time.Minute))
			}
		}
	}
	requests := []struct {
		player, club, status string
		day, decidedAfter    int
		viaListing           bool
	}{
		{"emre", "barisspor", "accepted", 18, 2, false},
		{"burak", "barisspor", "accepted", 17, 1, false},
		{"mert", "mamakbld", "accepted", 14, 2, false},
		{"tolga", "golbasiyildiz", "accepted", 20, 1, false},
		{"can", "ankaradsi", "pending", 2, 0, false},
		{"berkay", "tuncaltindag", "pending", 5, 0, false},
		{"enes", "barisspor", "pending", 4, 0, true},
		{"alperen", "ulubeyspor", "pending", 1, 0, false},
		{"zeynep", "pursaklarbld", "pending", 8, 0, false},
		{"furkan", "ankara1910", "pending", 3, 0, true},
		{"furkan", "keciorensportif", "rejected", 12, 3, false},
		{"kaan", "etimesgutgenclik", "rejected", 9, 2, false},
		{"batuhan", "mamakbld", "rejected", 15, 2, false},
	}
	current := map[string]string{}
	for i, r := range requests {
		created := b.at(r.day, 18+i%4, 12)
		updated := created
		if r.status != "pending" {
			updated = b.past(created.Add(time.Duration(r.decidedAfter)*24*time.Hour + 2*time.Hour))
		}
		item := JoinRequest{ID: ID("team-request", r.player+"/"+r.club), PlayerID: UserID(r.player), ClubID: UserID(r.club), Status: r.status, CreatedAt: created, UpdatedAt: updated}
		if r.viaListing {
			item.ListingID = listingID[r.club]
		}
		b.data.JoinRequests = append(b.data.JoinRequests, item)
		b.notify(notify.NewTeamApplicationReceived(item.ClubID, item.ID), created)
		if r.status != "pending" {
			b.notify(notify.NewTeamApplicationDecision(item.PlayerID, item.ID, r.status), updated)
		}
		if r.status == "accepted" {
			current[r.player] = b.names[r.club]
		}
	}
	for i := range b.data.Players {
		b.data.Players[i].CurrentClub = current[playerFixtures[i].key]
	}
}

func (b *builder) connections() {
	list := []struct {
		sender, recipient, message, status string
		day                                int
	}{
		{"keciorensportif", "berkay", "Merhaba Berkay, on numara profilin dikkatimizi çekti. Hafta içi bir antrenmanımıza gelmek ister misin?", "pending", 1},
		{"ankara1910", "yusuf", "Sağ bek için oyuncu takibimizdesin. Uygun olduğunda tanışmak isteriz.", "pending", 3},
		{"can", "ankaradsi", "Merhaba, sol kanat oyuncusuyum. Deneme antrenmanına katılmak isterim.", "pending", 2},
		{"batuhan", "ulubeyspor", "Merhaba hocam, orta saha için görüşmek isterim.", "accepted", 13},
		{"mamakbld", "alperen", "Genç santrfor arayışımız var, tanışalım mı?", "declined", 10},
	}
	for _, c := range list {
		item := Connection{ID: ID("connection", c.sender+"/"+c.recipient), SenderID: UserID(c.sender), RecipientID: UserID(c.recipient), Message: c.message, Status: c.status, CreatedAt: b.at(c.day, 14, 25)}
		item.PlayerID, item.PartnerID = item.SenderID, item.RecipientID
		if _, isClub := b.clubKey(c.sender); isClub {
			item.PlayerID, item.PartnerID = item.RecipientID, item.SenderID
		}
		b.notify(notify.NewConnectionRequest(item.RecipientID, item.ID, b.names[c.sender]), item.CreatedAt)
		if c.status != "pending" {
			at := b.past(item.CreatedAt.Add(30 * time.Hour))
			item.RespondedAt = &at
			if c.status == "accepted" {
				b.notify(notify.NewConnectionAccepted(item.SenderID, item.ID, b.names[c.recipient]), at)
			}
		}
		b.data.Connections = append(b.data.Connections, item)
	}
}

func (b *builder) clubKey(key string) (clubFixture, bool) {
	for _, c := range clubFixtures {
		if c.key == key {
			return c, true
		}
	}
	return clubFixture{}, false
}

func (b *builder) news() {
	for _, n := range newsFixtures {
		created := b.at(n.day, 10, 45)
		item := News{ID: ID("news", n.key), AuthorID: UserID(n.author), Title: n.title, Summary: n.summary, Body: n.body, ReviewStatus: n.status, CreatedAt: created, UpdatedAt: created}
		if name, ok := newsPhotos[n.key]; ok {
			item.ImageID = newsImageID(n.key)
			b.data.Images = append(b.data.Images, ContentImage{ID: item.ImageID, Photo: photo(name + ".jpg")})
		}
		if n.status == "approved" {
			item.Published, item.ShowOnHome = true, n.home
			item.UpdatedAt = b.past(created.Add(5 * time.Hour))
			b.notify(notify.NewNewsReview(item.AuthorID, item.ID, item.Title, true), item.UpdatedAt)
		}
		b.data.News = append(b.data.News, item)
	}
}

// leagueClubs play a double round robin; the weeks before now have scores.
var leagueClubs = []string{"barisspor", "mamakbld", "ankaradsi", "pursaklarbld", "tuncaltindag", "ulubeyspor"}

var leagueScores = [][2]int{{2, 1}, {0, 0}, {3, 2}, {1, 1}, {2, 0}, {1, 3}, {4, 1}, {0, 2}, {2, 2}, {1, 0}, {3, 1}, {0, 1}}

func (b *builder) league() {
	l := League{ID: LeagueID, Name: "Ankara Demo Ligi 2026-27", Season: "2026-27", Description: "Ankara amatör kulüpleri arasında oynanan, çift devreli demo ligi. Maçlar pazar günleri oynanır.", CreatedAt: b.at(35, 12, 0)}
	for _, c := range leagueClubs {
		l.Teams = append(l.Teams, LeagueTeam{ID: ID("league-team", c), ClubID: UserID(c)})
	}
	// Round 1 is the fourth Sunday back (counting the latest Sunday before today), so four weeks have results.
	local := b.now.In(istanbul)
	back := int(local.Weekday())
	if back == 0 {
		back = 7
	}
	firstSunday := time.Date(local.Year(), local.Month(), local.Day()-back-21, 0, 0, 0, 0, istanbul)
	order := []int{0, 1, 2, 3, 4, 5}
	slots := [][2]int{{11, 0}, {13, 30}, {16, 0}}
	scored := 0
	for round := 1; round <= 10; round++ {
		day := firstSunday.AddDate(0, 0, 7*(round-1))
		r := (round - 1) % 5
		if round == 6 {
			order = []int{0, 1, 2, 3, 4, 5}
		}
		for i := 0; i < 3; i++ {
			home, away := order[i], order[5-i]
			if (r+i)%2 == 1 {
				home, away = away, home
			}
			if round > 5 {
				home, away = away, home
			}
			kickoff := time.Date(day.Year(), day.Month(), day.Day(), slots[i][0], slots[i][1], 0, 0, istanbul).UTC()
			m := Match{ID: ID("league-match", strconv.Itoa(round)+"/"+strconv.Itoa(i)), Round: round, HomeTeamID: ID("league-team", leagueClubs[home]), AwayTeamID: ID("league-team", leagueClubs[away]), Kickoff: kickoff}
			if kickoff.Before(b.now) && scored < len(leagueScores) {
				h, a := leagueScores[scored][0], leagueScores[scored][1]
				m.HomeGoals, m.AwayGoals = &h, &a
				scored++
			}
			l.Matches = append(l.Matches, m)
		}
		// Circle method: keep the first team fixed, rotate the rest.
		order = append([]int{order[0], order[5]}, order[1:5]...)
	}
	b.data.League = l
}

func (b *builder) tournament() {
	local := b.now.In(istanbul)
	date := func(days int) string {
		return time.Date(local.Year(), local.Month(), local.Day()+days, 0, 0, 0, 0, istanbul).Format("2006-01-02")
	}
	t := Tournament{ID: ID("tournament", "kis-kupasi"), OrganizerID: UserID("organizer"), Name: "Ankara Demo Kış Kupası", Format: "seven_a_side", EligibleTypes: []string{"amateur", "halisaha"},
		District: "Yenimahalle", Venue: "Batıkent Kapalı Halı Saha Tesisleri",
		Description: "Sekiz takımlı, yedi kişilik kış turnuvası. Gruplar iki hafta sürer, final maçı cumartesi akşamı oynanır. Katılım ücretsizdir.",
		StartsOn:    date(30), EndsOn: date(44), ApplicationDeadline: date(16), TeamCapacity: 8, CreatedAt: b.at(6, 15, 0)}
	open := "Ankara Amatör Turnuva Organizasyonu yeni bir turnuva açtı. Son başvuru günü: " + t.ApplicationDeadline + "."
	for _, c := range clubFixtures {
		if c.footballType == "amateur" || c.footballType == "halisaha" {
			b.notify(notify.NewNotification{RecipientID: UserID(c.key), Kind: notify.KindTournament, Title: t.Name, Body: open, ResourceID: t.ID, SourceKey: "tournament:" + t.ID + ":open"}, t.CreatedAt.Add(time.Minute))
		}
	}
	accepted := b.at(4, 12, 0)
	entries := []Entry{
		{ID: ID("tournament-entry", "golbasiyildiz"), ClubID: UserID("golbasiyildiz"), Message: "Yedi kişilik kadromuzla hazırız.", Status: "accepted", CreatedAt: b.at(5, 13, 30), DecidedAt: &accepted, PlayerIDs: []string{UserID("tolga")}},
		{ID: ID("tournament-entry", "barisspor"), ClubID: UserID("barisspor"), Message: "Kupada genç oyuncularımıza süre vermek istiyoruz.", Status: "pending", CreatedAt: b.at(3, 16, 10), PlayerIDs: []string{UserID("emre"), UserID("burak")}},
	}
	for _, e := range entries {
		club := ""
		for _, a := range b.data.Accounts {
			if a.ID == e.ClubID {
				club = a.FullName
			}
		}
		b.notify(notify.NewTournamentEntry(t.OrganizerID, e.ID, club, t.Name), e.CreatedAt)
		if e.DecidedAt != nil {
			b.notify(notify.NewTournamentDecision(e.ClubID, e.ID, t.Name, e.Status == "accepted"), *e.DecidedAt)
		}
	}
	t.Entries = entries
	b.data.Tournament = t
}
