// Package data installs and removes the demo dataset in PostgreSQL. Every
// statement of one install or removal runs in a single transaction.
package data

import (
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"strings"
	"time"

	"futcareer/backend/internal/demo/domain"
	notify "futcareer/backend/internal/notifications/domain"
)

// demoAdvisoryLock serialises concurrent seed runs.
const demoAdvisoryLock = 721485191

// demoUsers selects demo accounts: players and coaches by the reserved email
// domain, clubs and organizers by that domain and the demo. username prefix.
const demoUsers = `SELECT id FROM users WHERE right(lower(COALESCE(email,'')), length($1::text)) = $1::text
	AND (role IN ('player','coach') OR left(COALESCE(username,''), length($2::text)) = $2::text)`

type Postgres struct{ db *sql.DB }

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

// Install replaces any previous demo data with ds in one transaction.
func (r *Postgres) Install(ctx context.Context, ds domain.Dataset, passwordHash, followEmail string) (domain.FollowResult, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.FollowResult{}, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock($1)`, demoAdvisoryLock); err != nil {
		return domain.FollowResult{}, err
	}
	if _, err = remove(ctx, tx); err != nil {
		return domain.FollowResult{}, err
	}
	if err = insert(ctx, tx, ds, passwordHash); err != nil {
		return domain.FollowResult{}, err
	}
	var follow domain.FollowResult
	if followEmail != "" {
		if follow, err = followTarget(ctx, tx, ds, followEmail); err != nil {
			return domain.FollowResult{}, err
		}
	}
	return follow, tx.Commit()
}

// Remove deletes every demo account and everything owned by or pointing at them.
func (r *Postgres) Remove(ctx context.Context) (int, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, err
	}
	defer tx.Rollback()
	if _, err = tx.ExecContext(ctx, `SELECT pg_advisory_xact_lock($1)`, demoAdvisoryLock); err != nil {
		return 0, err
	}
	n, err := remove(ctx, tx)
	if err != nil {
		return 0, err
	}
	return n, tx.Commit()
}

func remove(ctx context.Context, tx *sql.Tx) (int, error) {
	if _, err := tx.ExecContext(ctx, `CREATE TEMP TABLE demo_users(id text PRIMARY KEY) ON COMMIT DROP`); err != nil {
		return 0, err
	}
	if _, err := tx.ExecContext(ctx, `INSERT INTO demo_users `+demoUsers, domain.EmailSuffix, domain.UsernamePrefix); err != nil {
		return 0, err
	}
	steps := []string{
		// Notifications point at resources by id without a foreign key; real
		// accounts may hold some (follow target, tournament or listing alerts).
		`DELETE FROM notifications WHERE resource_id IN (
			SELECT id FROM connection_requests WHERE sender_id IN (SELECT id FROM demo_users) OR recipient_id IN (SELECT id FROM demo_users)
			UNION SELECT id FROM team_join_requests WHERE player_id IN (SELECT id FROM demo_users) OR club_user_id IN (SELECT id FROM demo_users)
			UNION SELECT id FROM news_articles WHERE author_user_id IN (SELECT id FROM demo_users)
			UNION SELECT id FROM club_listings WHERE club_user_id IN (SELECT id FROM demo_users)
			UNION SELECT id FROM tournaments WHERE organizer_id IN (SELECT id FROM demo_users)
			UNION SELECT e.id FROM tournament_entries e JOIN tournaments t ON t.id=e.tournament_id
				WHERE e.club_user_id IN (SELECT id FROM demo_users) OR t.organizer_id IN (SELECT id FROM demo_users))`,
		// Reward rows reference runs/gifts with ON DELETE RESTRICT; clear them before the cascade.
		`DELETE FROM team_request_gift_rewards WHERE player_id IN (SELECT id FROM demo_users)
			OR user_gift_id IN (SELECT id FROM user_gifts WHERE user_id IN (SELECT id FROM demo_users))`,
		`DELETE FROM team_request_game_rewards WHERE player_id IN (SELECT id FROM demo_users)`,
		`DELETE FROM team_request_penalty_rewards WHERE player_id IN (SELECT id FROM demo_users)`,
		// Payments are kept with a NULL player for real accounts; demo orders go entirely.
		`DELETE FROM team_request_payments WHERE player_id IN (SELECT id FROM demo_users)`,
		// club_user_id has no foreign key; requests to demo clubs (also from real
		// players, whose spent right is thereby returned) are removed explicitly.
		`DELETE FROM team_join_requests WHERE player_id IN (SELECT id FROM demo_users) OR club_user_id IN (SELECT id FROM demo_users)`,
	}
	for _, step := range steps {
		if _, err := tx.ExecContext(ctx, step); err != nil {
			return 0, err
		}
	}
	// Leagues have no owner; the demo league is removed by its fixed id.
	if _, err := tx.ExecContext(ctx, `DELETE FROM leagues WHERE id=$1`, domain.LeagueID); err != nil {
		return 0, err
	}

	// Everything else cascades from users: sessions, profiles, clubs, applications,
	// posts (likes and replies on them), follows, views, squads, listings,
	// connections, news, tournaments and entries, games, gifts and notifications.
	result, err := tx.ExecContext(ctx, `DELETE FROM users WHERE id IN (SELECT id FROM demo_users)`)
	if err != nil {
		return 0, err
	}
	n, err := result.RowsAffected()
	if err != nil {
		return 0, err
	}
	if _, err = tx.ExecContext(ctx, `DELETE FROM content_images i WHERE i.id IN (SELECT json_array_elements_text($1::json))
		AND NOT EXISTS(SELECT 1 FROM news_articles WHERE image_id=i.id)
		AND NOT EXISTS(SELECT 1 FROM advertisements WHERE image_id=i.id)
		AND NOT EXISTS(SELECT 1 FROM popup_ads WHERE image_id=i.id)`, jsonList(domain.NewsImageIDs())); err != nil {
		return 0, err
	}
	_, err = tx.ExecContext(ctx, `DROP TABLE demo_users`)
	return int(n), err
}

type execer interface {
	ExecContext(context.Context, string, ...any) (sql.Result, error)
}

func insert(ctx context.Context, tx execer, ds domain.Dataset, hash string) error {
	var b batch
	b.ctx, b.tx = ctx, tx
	for _, a := range ds.Accounts {
		b.exec(`INSERT INTO users(id,full_name,email,username,password_hash,role,city,active,verified,approval_status,created_at)
			VALUES($1,$2,$3,NULLIF($4,''),$5,$6,'Ankara',$7,$8,$9,$10)`,
			a.ID, a.FullName, a.Email, a.Username, hash, a.Role, a.Active, a.Verified, a.ApprovalStatus, a.CreatedAt)
	}
	for _, c := range ds.Clubs {
		b.exec(`INSERT INTO clubs(user_id,football_type,district,description,venue_name,venue_address,training_ground_name,training_ground_address,training_schedule,updated_at,tff_season,tff_league,tff_group,tff_team,tff_label)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
			c.UserID, c.FootballType, c.District, c.Description, c.VenueName, c.VenueAddress, c.TrainingGroundName, c.TrainingGroundAddress, c.TrainingSchedule, c.UpdatedAt,
			c.TFF.Season, c.TFF.League, c.TFF.Group, c.TFF.Team, c.TFF.Label)
	}
	for _, a := range ds.Applications {
		b.exec(`INSERT INTO account_applications(user_id,role,contact_name,phone,district,note,submitted_at,decided_at,rejection_reason) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			a.UserID, a.Role, a.ContactName, a.Phone, a.District, a.Note, a.SubmittedAt, a.DecidedAt, a.RejectionReason)
	}
	for _, p := range ds.Players {
		b.exec(`INSERT INTO player_profiles(user_id,position,dominant_foot,experience_years,current_club,availability,discoverable,football_type,license_status,updated_at)
			VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			p.UserID, p.Position, p.DominantFoot, p.ExperienceYears, p.CurrentClub, p.Availability, p.Discoverable, p.FootballType, p.LicenseStatus, p.UpdatedAt)
	}
	for _, p := range ds.Posts {
		if p.Media == nil {
			b.exec(`INSERT INTO social_posts(id,author_id,body,created_at) VALUES($1,$2,$3,$4)`, p.ID, p.AuthorID, p.Body, p.CreatedAt)
			continue
		}
		m := p.Media
		b.exec(`INSERT INTO social_posts(id,author_id,body,created_at,media_kind,media_mime,media_size,media_width,media_height,media_data,show_on_profile)
			VALUES($1,$2,$3,$4,'image',$5,$6,$7,$8,$9,$10)`, p.ID, p.AuthorID, p.Body, p.CreatedAt, m.MIME, len(m.Data), m.Width, m.Height, m.Data, p.ShowOnProfile)
	}
	for _, l := range ds.Likes {
		b.exec(`INSERT INTO social_likes(post_id,user_id,created_at) VALUES($1,$2,$3)`, l.PostID, l.UserID, l.CreatedAt)
	}
	for _, r := range ds.Replies {
		b.exec(`INSERT INTO social_replies(id,post_id,author_id,body,created_at) VALUES($1,$2,$3,$4,$5)`, r.ID, r.PostID, r.AuthorID, r.Body, r.CreatedAt)
	}
	for _, f := range ds.Follows {
		b.exec(`INSERT INTO profile_follows(profile_id,follower_id,created_at) VALUES($1,$2,$3)`, f.ProfileID, f.FollowerID, f.CreatedAt)
	}
	for _, v := range ds.Views {
		b.exec(`INSERT INTO profile_views(profile_id,viewer_id,viewed_on,last_viewed_at) VALUES($1,$2,$3::date,$4)`, v.ProfileID, v.ViewerID, v.Day.Format("2006-01-02"), v.Day)
	}
	// A few Pro members so Pro badges and private browsing appear in the demo;
	// "can" browses privately. Memberships are deleted with their demo user.
	for _, pro := range []struct {
		key     string
		private bool
	}{{"can", true}, {"elif", false}, {"emre", false}} {
		b.exec(`INSERT INTO pro_memberships(user_id,expires_at,private_browsing) VALUES($1,$2,$3)`, domain.UserID(pro.key), ds.Now.Add(20*24*time.Hour), pro.private)
	}
	for _, l := range ds.Listings {
		b.exec(`INSERT INTO club_listings(id,club_user_id,title,position,description,created_at) VALUES($1,$2,$3,$4,$5,$6)`, l.ID, l.ClubID, l.Title, l.Position, l.Description, l.CreatedAt)
	}
	for _, q := range ds.JoinRequests {
		b.exec(`INSERT INTO team_join_requests(id,player_id,club_user_id,listing_id,status,created_at,updated_at) VALUES($1,$2,$3,NULLIF($4,''),$5,$6,$7)`,
			q.ID, q.PlayerID, q.ClubID, q.ListingID, q.Status, q.CreatedAt, q.UpdatedAt)
		if q.Status == "accepted" {
			// Acceptance is what makes a player part of the club's squad.
			b.exec(`INSERT INTO club_squad_members(club_user_id,player_id,request_id,joined_at) VALUES($1,$2,$3,$4)`, q.ClubID, q.PlayerID, q.ID, q.UpdatedAt)
		}
	}
	for _, c := range ds.Connections {
		b.exec(`INSERT INTO connection_requests(id,sender_id,recipient_id,player_id,partner_id,message,status,created_at,responded_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
			c.ID, c.SenderID, c.RecipientID, c.PlayerID, c.PartnerID, c.Message, c.Status, c.CreatedAt, c.RespondedAt)
	}
	for _, img := range ds.Images {
		b.exec(`INSERT INTO content_images(id,mime,data,created_at) VALUES($1,$2,$3,$4)`, img.ID, img.Photo.MIME, img.Photo.Data, ds.Now)
	}
	for _, n := range ds.News {
		b.exec(`INSERT INTO news_articles(id,title,summary,body,image_id,published,show_on_home,author_user_id,review_status,created_at,updated_at) VALUES($1,$2,$3,$4,NULLIF($5,''),$6,$7,$8,$9,$10,$11)`,
			n.ID, n.Title, n.Summary, n.Body, n.ImageID, n.Published, n.ShowOnHome, n.AuthorID, n.ReviewStatus, n.CreatedAt, n.UpdatedAt)
	}
	for _, a := range ds.Avatars {
		b.exec(`INSERT INTO user_avatars(user_id,mime,size,data,updated_at) VALUES($1,$2,$3,$4,$5)`, a.UserID, a.Photo.MIME, len(a.Photo.Data), a.Photo.Data, ds.Now)
		b.exec(`UPDATE users SET avatar_version=1 WHERE id=$1`, a.UserID)
	}
	for _, g := range ds.Gallery {
		b.exec(`INSERT INTO player_media(id,owner_id,kind,mime,size,width,height,data,created_at) VALUES($1,$2,'image',$3,$4,$5,$6,$7,$8)`,
			g.ID, g.OwnerID, g.Photo.MIME, len(g.Photo.Data), g.Photo.Width, g.Photo.Height, g.Photo.Data, g.CreatedAt)
	}
	for _, c := range ds.Coaches {
		b.exec(`INSERT INTO coach_profiles(user_id,license_level,specialties,experience_years,football_type,availability,past_clubs,show_license,show_experience,show_football,show_clubs,updated_at)
			VALUES($1,$2,ARRAY(SELECT json_array_elements_text($3::json)),$4,$5,$6,ARRAY(SELECT json_array_elements_text($7::json)),$8,$9,$10,$11,$12)`,
			c.UserID, c.LicenseLevel, jsonList(c.Specialties), c.ExperienceYears, c.FootballType, c.Availability, jsonList(c.PastClubs), c.ShowLicense, c.ShowExperience, c.ShowFootball, c.ShowClubs, c.UpdatedAt)
	}
	for _, s := range ds.Staff {
		b.exec(`INSERT INTO club_staff(club_user_id,coach_user_id,status,role,permissions,invited_at,joined_at) VALUES($1,$2,'active',$3,ARRAY(SELECT json_array_elements_text($4::json)),$5,$6)`,
			s.ClubID, s.CoachID, s.Role, jsonList(s.Permissions), s.InvitedAt, s.JoinedAt)
	}
	l := ds.League
	b.exec(`INSERT INTO leagues(id,name,season,description,status,created_at,updated_at) VALUES($1,$2,$3,$4,'active',$5,$5)`, l.ID, l.Name, l.Season, l.Description, l.CreatedAt)
	for _, t := range l.Teams {
		b.exec(`INSERT INTO league_teams(id,league_id,club_user_id,created_at) VALUES($1,$2,$3,$4)`, t.ID, l.ID, t.ClubID, l.CreatedAt)
	}
	for _, m := range l.Matches {
		updated := l.CreatedAt
		if m.HomeGoals != nil {
			updated = m.Kickoff.Add(2 * time.Hour)
		}
		b.exec(`INSERT INTO league_matches(id,league_id,round,home_team_id,away_team_id,kickoff_at,home_goals,away_goals,created_at,updated_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
			m.ID, l.ID, m.Round, m.HomeTeamID, m.AwayTeamID, m.Kickoff, m.HomeGoals, m.AwayGoals, l.CreatedAt, updated)
	}
	t := ds.Tournament
	b.exec(`INSERT INTO tournaments(id,organizer_id,name,format,eligible_types,district,venue,description,starts_on,ends_on,application_deadline,team_capacity,created_at)
		VALUES($1,$2,$3,$4,string_to_array($5,','),$6,$7,$8,$9::date,$10::date,$11::date,$12,$13)`,
		t.ID, t.OrganizerID, t.Name, t.Format, strings.Join(t.EligibleTypes, ","), t.District, t.Venue, t.Description, t.StartsOn, t.EndsOn, t.ApplicationDeadline, t.TeamCapacity, t.CreatedAt)
	for _, e := range t.Entries {
		b.exec(`INSERT INTO tournament_entries(id,tournament_id,club_user_id,message,status,created_at,decided_at) VALUES($1,$2,$3,$4,$5,$6,$7)`, e.ID, t.ID, e.ClubID, e.Message, e.Status, e.CreatedAt, e.DecidedAt)
		for _, p := range e.PlayerIDs {
			b.exec(`INSERT INTO tournament_entry_players(entry_id,player_id) VALUES($1,$2)`, e.ID, p)
		}
	}
	for _, n := range ds.Notifications {
		b.notification(n)
	}
	return b.err
}

// jsonList passes a text array as JSON, so values with commas stay whole.
func jsonList(values []string) string {
	data, _ := json.Marshal(values)
	return string(data)
}

type batch struct {
	ctx context.Context
	tx  execer
	err error
}

func (b *batch) exec(query string, args ...any) {
	if b.err != nil {
		return
	}
	_, b.err = b.tx.ExecContext(b.ctx, query, args...)
}

func (b *batch) notification(n domain.Notification) {
	var readAt *time.Time
	if n.Read {
		at := n.CreatedAt.Add(3 * time.Hour)
		readAt = &at
	}
	b.exec(`INSERT INTO notifications(id,recipient_id,kind,title,body,resource_id,source_key,created_at,read_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
		n.ID, n.RecipientID, n.Kind, n.Title, n.Body, n.ResourceID, n.SourceKey, n.CreatedAt, readAt)
}

// followTarget makes demo players follow an existing account, like its latest
// posts and send it pending connection requests where the roles allow one.
func followTarget(ctx context.Context, tx *sql.Tx, ds domain.Dataset, email string) (domain.FollowResult, error) {
	email = strings.ToLower(strings.TrimSpace(email))
	if domain.IsDemoEmail(email) {
		return domain.FollowResult{}, domain.ErrFollowTarget
	}
	var id string
	var out domain.FollowResult
	err := tx.QueryRowContext(ctx, `SELECT id,full_name,role FROM users WHERE lower(email)=$1 AND active AND role IN ('player','club','coach')`, email).Scan(&id, &out.Name, &out.Role)
	if errors.Is(err, sql.ErrNoRows) {
		return out, domain.ErrFollowTarget
	}
	if err != nil {
		return out, err
	}
	now := ds.Now
	b := batch{ctx: ctx, tx: tx}
	followers := []string{"emre", "burak", "mert", "can", "berkay", "elif"}
	for i, key := range followers {
		b.exec(`INSERT INTO profile_follows(profile_id,follower_id,created_at) VALUES($1,$2,$3)`, id, domain.UserID(key), now.Add(-time.Duration(70-i*9)*time.Hour))
	}
	out.Follows = len(followers)
	// Profile visits over the last month so the visitors screen is populated:
	// clubs first, one club coming back on several days, and "can" browsing
	// privately as a Pro member (seen as "Gizli Pro üye" by non-Pro owners).
	visits := []struct {
		key     string
		daysAgo []int
		private bool
	}{
		{"barisspor", []int{0, 3, 9}, false},
		{"ankara1910", []int{1}, false},
		{"gerede", []int{5}, false},
		{"fatihulus", []int{12}, false},
		{"emre", []int{2, 6}, false},
		{"mert", []int{4}, false},
		{"elif", []int{8}, false},
		{"enes", []int{15}, false},
		{"can", []int{1}, true},
	}
	for i, v := range visits {
		for _, ago := range v.daysAgo {
			at := now.Add(-time.Duration(ago*24+i*2+1) * time.Hour)
			b.exec(`INSERT INTO profile_views(profile_id,viewer_id,viewed_on,last_viewed_at,private) VALUES($1,$2,$3::date,$4,$5) ON CONFLICT DO NOTHING`,
				id, domain.UserID(v.key), at.UTC().Format("2006-01-02"), at, v.private)
		}
		out.Visits++
	}
	if b.err != nil {
		return out, b.err
	}
	rows, err := tx.QueryContext(ctx, `SELECT id,created_at FROM social_posts WHERE author_id=$1 ORDER BY created_at DESC,id DESC LIMIT 3`, id)
	if err != nil {
		return out, err
	}
	type post struct {
		id string
		at time.Time
	}
	var posts []post
	for rows.Next() {
		var p post
		if err = rows.Scan(&p.id, &p.at); err != nil {
			rows.Close()
			return out, err
		}
		posts = append(posts, p)
	}
	if err = rows.Close(); err != nil {
		return out, err
	}
	for i, p := range posts {
		for _, key := range followers[:3-i] {
			at := p.at.Add(time.Hour)
			if at.After(now) {
				at = now
			}
			b.exec(`INSERT INTO social_likes(post_id,user_id,created_at) VALUES($1,$2,$3) ON CONFLICT DO NOTHING`, p.id, domain.UserID(key), at)
			out.Likes++
		}
	}
	type request struct{ sender, message string }
	var requests []request
	switch out.Role {
	case "player":
		requests = []request{
			{"ankara1910", "Merhaba, profilini inceledik. Uygun olduğunda tanışmak isteriz."},
			{"barisspor", "Antrenmanlarımıza konuk olarak katılmak ister misin?"},
		}
	default:
		requests = []request{
			{"can", "Merhaba, sol kanat oyuncusuyum. Takımınızla tanışmak isterim."},
			{"enes", "Merhaba, sol bek oyuncusuyum. Deneme antrenmanına katılabilir miyim?"},
		}
	}
	for i, r := range requests {
		sender, _ := ds.Account(r.sender)
		connectionID := domain.ID("connection", r.sender+"/follow/"+id)
		playerID, partnerID := id, sender.ID
		if sender.Role == "player" {
			playerID, partnerID = sender.ID, id
		}
		at := now.Add(-time.Duration(2+i*3) * time.Hour)
		b.exec(`INSERT INTO connection_requests(id,sender_id,recipient_id,player_id,partner_id,message,created_at) VALUES($1,$2,$3,$4,$5,$6,$7)`,
			connectionID, sender.ID, id, playerID, partnerID, r.message, at)
		n := notify.NewConnectionRequest(id, connectionID, sender.FullName)
		b.notification(domain.Notification{ID: domain.ID("notification", id+"/"+n.SourceKey), RecipientID: id, Kind: n.Kind, Title: n.Title, Body: n.Body, ResourceID: n.ResourceID, SourceKey: n.SourceKey, CreatedAt: at})
		out.Connections++
	}
	return out, b.err
}

// Counts reads the demo rows currently in the database.
func (r *Postgres) Counts(ctx context.Context) (domain.Counts, error) {
	var c domain.Counts
	err := r.db.QueryRowContext(ctx, `WITH d AS (SELECT u.id,u.role,u.active,u.approval_status FROM users u WHERE u.id IN (`+demoUsers+`))
	SELECT
	 (SELECT count(*) FROM d WHERE role='player'),
	 (SELECT count(*) FROM d WHERE role='club' AND active),
	 (SELECT count(*) FROM d WHERE role='organizer' AND active),
	 (SELECT count(*) FROM d WHERE approval_status='pending'),
	 (SELECT count(*) FROM d WHERE approval_status='rejected'),
	 (SELECT count(*) FROM social_posts WHERE author_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM social_likes WHERE user_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM social_replies WHERE author_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM profile_follows WHERE follower_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM profile_views WHERE viewer_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM club_listings WHERE club_user_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM team_join_requests WHERE player_id IN (SELECT id FROM d) AND status='pending'),
	 (SELECT count(*) FROM team_join_requests WHERE player_id IN (SELECT id FROM d) AND status='accepted'),
	 (SELECT count(*) FROM team_join_requests WHERE player_id IN (SELECT id FROM d) AND status='rejected'),
	 (SELECT count(*) FROM club_squad_members WHERE club_user_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM connection_requests WHERE sender_id IN (SELECT id FROM d) OR recipient_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM news_articles WHERE author_user_id IN (SELECT id FROM d) AND published),
	 (SELECT count(*) FROM news_articles WHERE author_user_id IN (SELECT id FROM d) AND review_status='pending'),
	 (SELECT count(*) FROM league_teams WHERE league_id=$3),
	 (SELECT count(*) FROM league_matches WHERE league_id=$3 AND home_goals IS NOT NULL),
	 (SELECT count(*) FROM league_matches WHERE league_id=$3 AND home_goals IS NULL),
	 (SELECT count(*) FROM tournaments WHERE organizer_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM tournament_entries e JOIN tournaments t ON t.id=e.tournament_id WHERE t.organizer_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM notifications WHERE recipient_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM d WHERE role='coach'),
	 (SELECT count(*) FROM user_avatars WHERE user_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM social_posts WHERE author_id IN (SELECT id FROM d) AND media_kind<>''),
	 (SELECT count(*) FROM player_media WHERE owner_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM club_staff WHERE coach_user_id IN (SELECT id FROM d)),
	 (SELECT count(*) FROM content_images WHERE id IN (SELECT json_array_elements_text($4::json)))`,
		domain.EmailSuffix, domain.UsernamePrefix, domain.LeagueID, jsonList(domain.NewsImageIDs())).Scan(
		&c.Players, &c.ActiveClubs, &c.Organizers, &c.PendingApplications, &c.RejectedApplications,
		&c.Posts, &c.Likes, &c.Replies, &c.Follows, &c.ProfileViews, &c.Listings,
		&c.JoinPending, &c.JoinAccepted, &c.JoinRejected, &c.SquadMembers, &c.Connections,
		&c.NewsPublished, &c.NewsPending, &c.LeagueTeams, &c.MatchesPlayed, &c.MatchesScheduled,
		&c.Tournaments, &c.TournamentEntries, &c.Notifications,
		&c.Coaches, &c.Avatars, &c.PostMedia, &c.GalleryItems, &c.StaffLinks, &c.NewsImages)
	return c, err
}
