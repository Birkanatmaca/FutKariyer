package domain_test

import (
	"errors"
	"fmt"
	"futcareer/backend/internal/games/domain"
	"testing"
	"time"
)

func TestHeartsPreservePartialIntervalAndStopAtCapacity(t *testing.T) {
	h := domain.HeartInterval
	now := time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC)
	w, err := (domain.Wallet{Hearts: 3}).Spend(now)
	if err != nil {
		t.Fatal(err)
	}
	w, err = w.Spend(now.Add(time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	w, err = w.Spend(now.Add(2 * time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if w.Hearts != 0 {
		t.Fatal("three games should spend three hearts")
	}
	if _, err = w.Spend(now.Add(h - time.Second)); !errors.Is(err, domain.ErrNoHearts) {
		t.Fatal("heart refilled too early")
	}
	w = w.Refill(now.Add(h))
	if w.Hearts != 1 || !w.RefillAnchor.Equal(now.Add(h)) {
		t.Fatal("first heart not refilled at boundary")
	}
	w, err = w.Spend(now.Add(h + time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if !w.RefillAnchor.Equal(now.Add(h)) {
		t.Fatal("spending reset partial refill time")
	}
	w = w.Refill(now.Add(5*h + time.Hour))
	if w.Hearts != 3 || w.RefillAnchor != nil {
		t.Fatal("capacity must discard saved time")
	}
	w, err = w.Spend(now.Add(5*h + 2*time.Hour))
	if err != nil {
		t.Fatal(err)
	}
	if w.Hearts != 2 || !w.RefillAnchor.Equal(now.Add(5*h+2*time.Hour)) {
		t.Fatal("full wallet banked extra refill time")
	}
}

func TestGiftHeartsCapAndKeepRefillClock(t *testing.T) {
	now := time.Date(2026, 10, 12, 9, 0, 0, 0, time.UTC)
	w := (domain.Wallet{Hearts: 0}).Grant(1, now)
	if w.Hearts != 1 || w.RefillAnchor == nil || !w.RefillAnchor.Equal(now) {
		t.Fatal("one heart gift should start the refill clock when empty")
	}
	full := (domain.Wallet{Hearts: 2, RefillAnchor: &now}).Grant(3, now)
	if full.Hearts != 3 || full.RefillAnchor != nil {
		t.Fatal("heart gift must cap at three hearts")
	}
	fill := (domain.Wallet{Hearts: 0, RefillAnchor: &now}).Grant(domain.MaxHearts, now)
	if fill.Hearts != 3 || fill.RefillAnchor != nil {
		t.Fatal("full-heart gift must fill the wallet")
	}
}
func TestAnswersAreSequentialImmutableAndIdempotent(t *testing.T) {
	r := domain.Run{Status: "active"}
	for i := 0; i < 10; i++ {
		r.Questions = append(r.Questions, domain.Question{ID: fmt.Sprint(i), CorrectOptionID: "yes", Options: []domain.Option{{ID: "yes"}, {ID: "no"}}})
	}
	if _, err := r.Answer("1", "yes"); !errors.Is(err, domain.ErrQuestionOrder) {
		t.Fatal("future question accepted")
	}
	if _, err := r.Answer("0", "forged"); !errors.Is(err, domain.ErrQuestionOrder) {
		t.Fatal("unissued option accepted")
	}
	if _, err := r.Answer("0", "yes"); err != nil {
		t.Fatal(err)
	}
	if changed, err := r.Answer("0", "yes"); err != nil || changed || r.Score != 1 {
		t.Fatal("answer retry changed score")
	}
	if _, err := r.Answer("0", "no"); !errors.Is(err, domain.ErrAnswerLocked) {
		t.Fatal("answer changed after reveal")
	}
	for i := 1; i < 10; i++ {
		choice := "yes"
		if i >= 7 {
			choice = "no"
		}
		if _, err := r.Answer(fmt.Sprint(i), choice); err != nil {
			t.Fatal(err)
		}
	}
	if r.Status != "finished" || r.Score != 7 || len(r.Answers) != 10 {
		t.Fatal("completion score incorrect")
	}
}
