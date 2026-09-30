package usecase

import (
	"errors"
	"fmt"
)

// ErrAI wraps any AI provider failure, so callers can tell it apart from storage errors.
// The provider's own error (ai.ErrRateLimited etc.) stays reachable through errors.Is.
var ErrAI = errors.New("AI request failed")

func aiFailed(err error) error { return fmt.Errorf("%w: %w", ErrAI, err) }

// ValidationError is a rejected input; its message is safe to show to the client as-is.
type ValidationError struct {
	Msg string
}

func (e *ValidationError) Error() string { return e.Msg }

func invalid(msg string) error { return &ValidationError{Msg: msg} }
