package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	"google.golang.org/genai"
)

type Gemini struct {
	client *genai.Client
	model  string
}

func NewGemini(ctx context.Context, apiKey, model string) (*Gemini, error) {
	client, err := genai.NewClient(ctx, &genai.ClientConfig{APIKey: apiKey, Backend: genai.BackendGeminiAPI})
	if err != nil {
		return nil, fmt.Errorf("create gemini client: %w", err)
	}
	return &Gemini{client: client, model: model}, nil
}

func (g *Gemini) AnalyzeMeal(ctx context.Context, text string) (*Analysis, error) {
	var out Analysis
	contents := []*genai.Content{genai.NewContentFromText("発話:「"+text+"」", genai.RoleUser)}
	if err := g.structured(ctx, analyzeSystemPrompt, contents, analysisSchema, &out); err != nil {
		return nil, err
	}
	return finishAnalysis(&out)
}

func (g *Gemini) SearchFoods(ctx context.Context, query string) ([]Item, error) {
	var out searchResult
	contents := []*genai.Content{genai.NewContentFromText("検索語:「"+query+"」", genai.RoleUser)}
	if err := g.structured(ctx, searchSystemPrompt, contents, searchSchema, &out); err != nil {
		return nil, err
	}
	return finishSearch(out), nil
}

func (g *Gemini) Chat(ctx context.Context, req ChatRequest) (*ChatReply, error) {
	history := NormalizeHistory(req.Messages)
	if len(history) == 0 || history[len(history)-1].Role != RoleUser {
		return nil, errHistoryNotUser
	}
	contents := make([]*genai.Content, 0, len(history))
	for _, m := range history {
		role := genai.Role(genai.RoleUser)
		if m.Role == RoleAssistant {
			role = genai.RoleModel
		}
		contents = append(contents, genai.NewContentFromText(m.Text, role))
	}

	var out ChatReply
	if err := g.structured(ctx, chatSystemPrompt(req.Day), contents, chatSchema, &out); err != nil {
		return nil, err
	}
	normalizeReply(&out)
	return &out, nil
}

// Free-tier models regularly answer 503 "high demand" for a few seconds; waiting briefly usually succeeds.
var geminiRetryDelays = []time.Duration{1 * time.Second, 3 * time.Second}

func (g *Gemini) structured(ctx context.Context, system string, contents []*genai.Content, schema map[string]any, out any) error {
	config := &genai.GenerateContentConfig{
		SystemInstruction:  genai.NewContentFromText(system, genai.RoleUser),
		ResponseMIMEType:   "application/json",
		ResponseJsonSchema: schema,
		MaxOutputTokens:    4096,
	}

	var resp *genai.GenerateContentResponse
	var err error
	for attempt := 0; ; attempt++ {
		resp, err = g.client.Models.GenerateContent(ctx, g.model, contents, config)
		if err == nil || !isTransient(geminiStatus(err)) || attempt >= len(geminiRetryDelays) {
			break
		}
		slog.Warn("gemini temporarily unavailable; retrying", "attempt", attempt+1, "error", err)
		select {
		case <-ctx.Done():
			return fmt.Errorf("gemini request: %w", ctx.Err())
		case <-time.After(geminiRetryDelays[attempt]):
		}
	}
	if err != nil {
		switch status := geminiStatus(err); {
		case status == http.StatusTooManyRequests:
			return fmt.Errorf("gemini: %w (%w)", ErrRateLimited, err)
		case isTransient(status):
			return fmt.Errorf("gemini: %w (%w)", ErrUnavailable, err)
		}
		return fmt.Errorf("gemini request: %w", err)
	}
	if resp.PromptFeedback != nil && resp.PromptFeedback.BlockReason != "" {
		return fmt.Errorf("gemini blocked the prompt: %s", resp.PromptFeedback.BlockReason)
	}
	if len(resp.Candidates) == 0 {
		return errors.New("gemini returned no candidates")
	}
	switch resp.Candidates[0].FinishReason {
	case genai.FinishReasonMaxTokens:
		return errors.New("gemini response hit max output tokens")
	case genai.FinishReasonSafety:
		return errors.New("gemini stopped the response for safety")
	}

	if err := json.Unmarshal([]byte(resp.Text()), out); err != nil {
		return fmt.Errorf("parse gemini response: %w", err)
	}
	return nil
}

// geminiStatus returns the HTTP status of a genai API error, or 0 for other errors.
func geminiStatus(err error) int {
	var apiErr genai.APIError
	if errors.As(err, &apiErr) {
		return apiErr.Code
	}
	var apiErrPtr *genai.APIError
	if errors.As(err, &apiErrPtr) {
		return apiErrPtr.Code
	}
	return 0
}

func isTransient(status int) bool {
	switch status {
	case http.StatusInternalServerError, http.StatusBadGateway, http.StatusServiceUnavailable, http.StatusGatewayTimeout:
		return true
	}
	return false
}
