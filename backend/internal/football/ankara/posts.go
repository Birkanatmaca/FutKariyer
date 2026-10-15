package ankara

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/url"
	"path"
	"strconv"
	"strings"
	"unicode"

	"futcareer/backend/internal/football/domain"
	"golang.org/x/net/html"
)

const postsPerPage = 20

// Documents the app may link to: only files uploaded to the federation site.
var attachmentTypes = map[string]string{".pdf": "pdf", ".xls": "excel", ".xlsx": "excel", ".doc": "word", ".docx": "word", ".jpg": "image", ".jpeg": "image", ".png": "image"}

// Posts loads one page of announcements from the WordPress REST API.
func (c *Client) Posts(ctx context.Context, page int) (domain.AnkaraPosts, error) {
	if page < 1 || page > 50 {
		return domain.AnkaraPosts{}, domain.ErrInvalidSelection
	}
	q := url.Values{"per_page": {strconv.Itoa(postsPerPage)}, "page": {strconv.Itoa(page)}, "_fields": {"id,date,link,title,content"}}
	body, err := c.get(ctx, c.news+"/wp-json/wp/v2/posts?"+q.Encode(), "application/json")
	if err != nil {
		return domain.AnkaraPosts{}, err
	}
	defer body.Close()
	return ParsePosts(io.LimitReader(body, 8<<20), c.news, page)
}

// ParsePosts keeps plain titles and the site's own attachment links only. The
// federation site has carried injected spam links, so nothing else is trusted.
func ParsePosts(r io.Reader, site string, page int) (domain.AnkaraPosts, error) {
	var raw []struct {
		ID    int    `json:"id"`
		Date  string `json:"date"`
		Link  string `json:"link"`
		Title struct {
			Rendered string `json:"rendered"`
		} `json:"title"`
		Content struct {
			Rendered string `json:"rendered"`
		} `json:"content"`
	}
	if err := json.NewDecoder(r).Decode(&raw); err != nil {
		return domain.AnkaraPosts{}, fmt.Errorf("%w: decode posts: %v", domain.ErrUpstream, err)
	}
	host := hostOf(site)
	out := domain.AnkaraPosts{Items: []domain.AnkaraPost{}, Page: page, HasMore: len(raw) == postsPerPage, Source: SourceLabel}
	for _, p := range raw {
		title := plain(p.Title.Rendered)
		if title == "" || !sameSite(p.Link, host) {
			continue
		}
		out.Items = append(out.Items, domain.AnkaraPost{ID: p.ID, Kind: kind(title), Title: title, Date: p.Date, URL: p.Link, Attachments: attachments(p.Content.Rendered, host)})
	}
	return out, nil
}

func kind(title string) string {
	upper := strings.ToUpperSpecial(unicode.TurkishCase, title)
	switch {
	case strings.Contains(upper, "DİSİPLİN"):
		return "discipline"
	case strings.Contains(upper, "BÜLTEN"):
		return "bulletin"
	default:
		return "news"
	}
}

func plain(fragment string) string {
	doc, err := html.Parse(strings.NewReader("<div>" + fragment + "</div>"))
	if err != nil {
		return ""
	}
	var b strings.Builder
	walk(doc, func(n *html.Node) bool {
		if n.Type == html.ElementNode && (n.Data == "script" || n.Data == "style") {
			return false
		}
		if n.Type == html.TextNode {
			b.WriteString(n.Data)
			b.WriteByte(' ')
		}
		return true
	})
	return strings.Join(strings.Fields(b.String()), " ")
}

func hostOf(site string) string {
	u, err := url.Parse(site)
	if err != nil {
		return ""
	}
	return strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.")
}

func sameSite(link, host string) bool {
	u, err := url.Parse(link)
	return err == nil && host != "" && (u.Scheme == "https" || u.Scheme == "http") && strings.TrimPrefix(strings.ToLower(u.Hostname()), "www.") == host
}

func attachments(content, host string) []domain.Attachment {
	out := []domain.Attachment{}
	doc, err := html.Parse(strings.NewReader("<div>" + content + "</div>"))
	if err != nil {
		return out
	}
	seen := map[string]bool{}
	for _, a := range find(doc, func(n *html.Node) bool { return n.Data == "a" }) {
		href := attr(a, "href")
		u, err := url.Parse(href)
		if err != nil || !sameSite(href, host) || !strings.HasPrefix(u.Path, "/wp-content/uploads/") || seen[href] {
			continue
		}
		kind, ok := attachmentTypes[strings.ToLower(path.Ext(u.Path))]
		if !ok {
			continue
		}
		seen[href] = true
		name := text(a)
		if name == "" {
			name = path.Base(u.Path)
		}
		u.Scheme = "https"
		out = append(out, domain.Attachment{Name: name, URL: u.String(), Type: kind})
	}
	return out
}
