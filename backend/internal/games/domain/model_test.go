package domain_test

import (
	"errors"
	"fmt"
	"futcareer/backend/internal/games/domain"
	"testing"
)

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
