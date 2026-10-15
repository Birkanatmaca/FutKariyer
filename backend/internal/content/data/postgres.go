package data

import (
	"context"
	"database/sql"
	"errors"
	auth "futcareer/backend/internal/auth/domain"
	"futcareer/backend/internal/content/domain"
	notificationsdata "futcareer/backend/internal/notifications/data"
	notificationsdomain "futcareer/backend/internal/notifications/domain"
)

type Postgres struct{ db *sql.DB }

func New(db *sql.DB) *Postgres { return &Postgres{db: db} }

var _ domain.Repository = (*Postgres)(nil)

func found(err error) error {
	if errors.Is(err, sql.ErrNoRows) {
		return auth.ErrNotFound
	}
	return err
}
func (r *Postgres) SaveImage(ctx context.Context, in domain.Image) error {
	_, err := r.db.ExecContext(ctx, `INSERT INTO content_images(id,mime,data) VALUES($1,$2,$3)`, in.ID, in.MIME, in.Data)
	return err
}
func (r *Postgres) Image(ctx context.Context, id string, admin bool) (domain.Image, error) {
	var out domain.Image
	err := r.db.QueryRowContext(ctx, `SELECT id,mime,data FROM content_images i WHERE id=$1 AND ($2 OR EXISTS(SELECT 1 FROM advertisements WHERE image_id=i.id AND active) OR EXISTS(SELECT 1 FROM news_articles WHERE image_id=i.id AND published))`, id, admin).Scan(&out.ID, &out.MIME, &out.Data)
	return out, found(err)
}

type scanner interface{ Scan(...any) error }

const adColumns = `id,title,image_id,active,sort_order,created_at,updated_at`
const newsColumns = `id,title,summary,body,COALESCE(image_id,''),published,show_on_home,created_at,updated_at,review_status,COALESCE((SELECT full_name FROM users u WHERE u.id=news_articles.author_user_id),'')`

func ad(row scanner) (domain.Advertisement, error) {
	var out domain.Advertisement
	err := row.Scan(&out.ID, &out.Title, &out.ImageID, &out.Active, &out.SortOrder, &out.CreatedAt, &out.UpdatedAt)
	return out, found(err)
}
func article(row scanner) (domain.Article, error) {
	var out domain.Article
	err := row.Scan(&out.ID, &out.Title, &out.Summary, &out.Body, &out.ImageID, &out.Published, &out.ShowOnHome, &out.CreatedAt, &out.UpdatedAt, &out.ReviewStatus, &out.AuthorName)
	return out, found(err)
}
func (r *Postgres) Ads(ctx context.Context, admin bool, page int) (domain.Page[domain.Advertisement], error) {
	out := domain.Page[domain.Advertisement]{Items: []domain.Advertisement{}, Page: page, PageSize: 20}
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM advertisements WHERE $1 OR active`, admin).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT `+adColumns+` FROM advertisements WHERE $1 OR active ORDER BY sort_order,created_at DESC,id DESC LIMIT 20 OFFSET $2`, admin, (page-1)*20)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		value, e := ad(rows)
		if e != nil {
			return out, e
		}
		out.Items = append(out.Items, value)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if err = rows.Close(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + 19) / 20
	return out, tx.Commit()
}
func (r *Postgres) SaveAd(ctx context.Context, in domain.Advertisement, create bool) (domain.Advertisement, error) {
	if create {
		return ad(r.db.QueryRowContext(ctx, `INSERT INTO advertisements(id,title,image_id,active,sort_order) VALUES($1,$2,$3,$4,$5) RETURNING `+adColumns, in.ID, in.Title, in.ImageID, in.Active, in.SortOrder))
	}
	return ad(r.db.QueryRowContext(ctx, `UPDATE advertisements SET title=$2,image_id=$3,active=$4,sort_order=$5,updated_at=now() WHERE id=$1 RETURNING `+adColumns, in.ID, in.Title, in.ImageID, in.Active, in.SortOrder))
}
func (r *Postgres) News(ctx context.Context, admin, home bool, page int) (domain.Page[domain.Article], error) {
	size := 20
	if home {
		size = 3
	}
	out := domain.Page[domain.Article]{Items: []domain.Article{}, Page: page, PageSize: size}
	tx, err := r.db.BeginTx(ctx, &sql.TxOptions{ReadOnly: true, Isolation: sql.LevelRepeatableRead})
	if err != nil {
		return out, err
	}
	defer tx.Rollback()
	where := ` WHERE ($1 OR published) AND (NOT $2 OR show_on_home)`
	if err = tx.QueryRowContext(ctx, `SELECT count(*) FROM news_articles`+where, admin, home).Scan(&out.Total); err != nil {
		return out, err
	}
	rows, err := tx.QueryContext(ctx, `SELECT `+newsColumns+` FROM news_articles`+where+` ORDER BY created_at DESC,id DESC LIMIT $3 OFFSET $4`, admin, home, size, (page-1)*size)
	if err != nil {
		return out, err
	}
	defer rows.Close()
	for rows.Next() {
		value, e := article(rows)
		if e != nil {
			return out, e
		}
		out.Items = append(out.Items, value)
	}
	if err = rows.Err(); err != nil {
		return out, err
	}
	if err = rows.Close(); err != nil {
		return out, err
	}
	out.TotalPages = (out.Total + size - 1) / size
	return out, tx.Commit()
}
func (r *Postgres) Article(ctx context.Context, id string, admin bool) (domain.Article, error) {
	return article(r.db.QueryRowContext(ctx, `SELECT `+newsColumns+` FROM news_articles WHERE id=$1 AND ($2 OR published)`, id, admin))
}
func (r *Postgres) SaveArticle(ctx context.Context, in domain.Article, create bool) (domain.Article, error) {
	if create {
		return article(r.db.QueryRowContext(ctx, `INSERT INTO news_articles(id,title,summary,body,image_id,published,show_on_home) VALUES($1,$2,$3,$4,NULLIF($5,''),$6,$7) RETURNING `+newsColumns, in.ID, in.Title, in.Summary, in.Body, in.ImageID, in.Published, in.ShowOnHome))
	}
	return article(r.db.QueryRowContext(ctx, `UPDATE news_articles SET title=$2,summary=$3,body=$4,image_id=NULLIF($5,''),published=CASE WHEN author_user_id IS NULL OR review_status='approved' THEN $6 ELSE false END,show_on_home=$7,updated_at=now() WHERE id=$1 RETURNING `+newsColumns, in.ID, in.Title, in.Summary, in.Body, in.ImageID, in.Published, in.ShowOnHome))
}
func (r *Postgres) delete(ctx context.Context, table, id string) error {
	result, err := r.db.ExecContext(ctx, `DELETE FROM `+table+` WHERE id=$1`, id)
	if err != nil {
		return err
	}
	n, err := result.RowsAffected()
	if err == nil && n == 0 {
		return auth.ErrNotFound
	}
	return err
}
func (r *Postgres) DeleteAd(ctx context.Context, id string) error {
	return r.delete(ctx, "advertisements", id)
}
func (r *Postgres) DeleteArticle(ctx context.Context, id string) error {
	return r.delete(ctx, "news_articles", id)
}

// SubmitClubArticle stores a club article as pending. It stays hidden until an
// administrator approves it.
func (r *Postgres) SubmitClubArticle(ctx context.Context, authorID string, in domain.Article) (domain.Article, error) {
	return article(r.db.QueryRowContext(ctx, `INSERT INTO news_articles(id,title,summary,body,published,show_on_home,author_user_id,review_status) VALUES($1,$2,$3,$4,false,false,$5,'pending') RETURNING `+newsColumns, in.ID, in.Title, in.Summary, in.Body, authorID))
}

func (r *Postgres) ClubArticles(ctx context.Context, authorID string) ([]domain.Article, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+newsColumns+` FROM news_articles WHERE author_user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`, authorID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Article{}
	for rows.Next() {
		value, err := article(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, value)
	}
	return out, rows.Err()
}

// ReviewClubArticle approves or rejects a pending club article and notifies its
// author in the same transaction.
func (r *Postgres) ReviewClubArticle(ctx context.Context, id string, approved bool) (domain.Article, error) {
	tx, err := r.db.BeginTx(ctx, nil)
	if err != nil {
		return domain.Article{}, err
	}
	defer tx.Rollback()
	var authorID sql.NullString
	var title string
	err = tx.QueryRowContext(ctx, `SELECT author_user_id,title FROM news_articles WHERE id=$1 AND author_user_id IS NOT NULL AND review_status='pending' FOR UPDATE`, id).Scan(&authorID, &title)
	if err != nil {
		return domain.Article{}, found(err)
	}
	status := "rejected"
	if approved {
		status = "approved"
	}
	out, err := article(tx.QueryRowContext(ctx, `UPDATE news_articles SET review_status=$2,published=$3,updated_at=now() WHERE id=$1 RETURNING `+newsColumns, id, status, approved))
	if err != nil {
		return out, err
	}
	if err = notificationsdata.CreateInTx(ctx, tx, notificationsdomain.NewNewsReview(authorID.String, id, title, approved)); err != nil {
		return out, err
	}
	return out, tx.Commit()
}

// PendingClubArticles lists club articles waiting for review, oldest first so the queue is worked in order.
func (r *Postgres) PendingClubArticles(ctx context.Context) ([]domain.Article, error) {
	rows, err := r.db.QueryContext(ctx, `SELECT `+newsColumns+` FROM news_articles WHERE author_user_id IS NOT NULL AND review_status='pending' ORDER BY created_at ASC,id ASC LIMIT 100`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []domain.Article{}
	for rows.Next() {
		value, err := article(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, value)
	}
	return out, rows.Err()
}
