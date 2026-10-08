package application

import (
	"crypto/rand"
	"encoding/hex"
	"regexp"
	"strings"
	"time"
	"unicode/utf8"

	"futcareer/backend/internal/auth/domain"
	"golang.org/x/crypto/bcrypt"
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9._-]{3,32}$`)

// AccountInput is used by trusted account provisioning, never public registration.
type AccountInput struct {
	FullName string `json:"fullName"`
	Email    string `json:"email"`
	Username string `json:"username"`
	Password string `json:"password"`
	Role     string `json:"role"`
}

func ValidateAccount(in AccountInput) (AccountInput, ValidationError) {
	in.FullName = strings.TrimSpace(in.FullName)
	in.Email = canonicalEmail(in.Email)
	in.Username = strings.ToLower(strings.TrimSpace(in.Username))
	fields := ValidationError{}
	if n := utf8.RuneCountInString(in.FullName); n < 2 || n > 80 {
		fields["fullName"] = "Ad 2–80 karakter arasında olmalı."
	}
	if (in.Role == "player" || in.Role == "coach" || in.Email != "") && !validEmail(in.Email) {
		fields["email"] = "Geçerli bir e-posta adresi gir."
	}
	if (in.Role == "club" || in.Role == "admin") && !usernamePattern.MatchString(in.Username) {
		fields["username"] = "3–32 karakter; küçük Latin harfi, rakam, nokta, alt çizgi veya kısa çizgi kullan."
	}
	if in.Role != "player" && in.Role != "coach" && in.Role != "club" && in.Role != "admin" {
		fields["role"] = "Geçerli bir hesap türü seç."
	}
	if in.Role == "player" || in.Role == "coach" {
		in.Username = ""
	}
	return in, fields
}

func PasswordHash(password string) (string, error) {
	if utf8.RuneCountInString(password) < 10 || len(password) > 72 {
		return "", ValidationError{"password": "Şifre en az 10 karakter olmalı ve 72 bayttan uzun olmamalı."}
	}
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	return string(hash), err
}

func PrepareAccount(in AccountInput) (domain.User, error) {
	in, fields := ValidateAccount(in)
	hash, err := PasswordHash(in.Password)
	if validation, ok := err.(ValidationError); ok {
		for key, value := range validation {
			fields[key] = value
		}
	} else if err != nil {
		return domain.User{}, err
	}
	if len(fields) > 0 {
		return domain.User{}, fields
	}
	bytes := make([]byte, 16)
	if _, err := rand.Read(bytes); err != nil {
		return domain.User{}, err
	}
	return domain.User{ID: hex.EncodeToString(bytes), FullName: in.FullName, Email: in.Email, Username: in.Username, PasswordHash: hash, Role: in.Role, City: "Ankara", Active: true, CreatedAt: time.Now().UTC()}, nil
}
