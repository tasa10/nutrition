package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

type Claude struct {
	client anthropic.Client
	model  string
}

func NewClaude(apiKey, model string) *Claude {
	return &Claude{
		client: anthropic.NewClient(option.WithAPIKey(apiKey)),
		model:  model,
	}
}

func (c *Claude) AnalyzeMeal(ctx context.Context, text string) (*Analysis, error) {
	var out Analysis
	msgs := []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("発話:「" + text + "」"))}
	if err := c.structured(ctx, analyzeSystemPrompt, msgs, analysisSchema, &out); err != nil {
		return nil, err
	}
	return finishAnalysis(&out)
}

func (c *Claude) SearchFoods(ctx context.Context, query string) ([]Item, error) {
	var out searchResult
	msgs := []anthropic.MessageParam{anthropic.NewUserMessage(anthropic.NewTextBlock("検索語:「" + query + "」"))}
	if err := c.structured(ctx, searchSystemPrompt, msgs, searchSchema, &out); err != nil {
		return nil, err
	}
	return finishSearch(out), nil
}

func (c *Claude) Chat(ctx context.Context, req ChatRequest) (*ChatReply, error) {
	history := NormalizeHistory(req.Messages)
	if len(history) == 0 || history[len(history)-1].Role != RoleUser {
		return nil, errHistoryNotUser
	}
	msgs := make([]anthropic.MessageParam, 0, len(history))
	for _, m := range history {
		block := anthropic.NewTextBlock(m.Text)
		if m.Role == RoleUser {
			msgs = append(msgs, anthropic.NewUserMessage(block))
		} else {
			msgs = append(msgs, anthropic.NewAssistantMessage(block))
		}
	}

	var out ChatReply
	if err := c.structured(ctx, chatSystemPrompt(req.Day), msgs, chatSchema, &out); err != nil {
		return nil, err
	}
	normalizeReply(&out)
	return &out, nil
}

func (c *Claude) structured(ctx context.Context, system string, msgs []anthropic.MessageParam, schema map[string]any, out any) error {
	resp, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     c.model,
		MaxTokens: 4096,
		System:    []anthropic.TextBlockParam{{Text: system}},
		Messages:  msgs,
		OutputConfig: anthropic.OutputConfigParam{
			Format: anthropic.JSONOutputFormatParam{Schema: schema},
		},
	})
	if err != nil {
		// The SDK already retries 429 / 5xx / 529 (overloaded) twice before returning.
		var apiErr *anthropic.Error
		if errors.As(err, &apiErr) {
			switch {
			case apiErr.StatusCode == http.StatusTooManyRequests:
				return fmt.Errorf("claude: %w (%w)", ErrRateLimited, err)
			case apiErr.StatusCode == 529 || isTransient(apiErr.StatusCode):
				return fmt.Errorf("claude: %w (%w)", ErrUnavailable, err)
			}
		}
		return fmt.Errorf("claude request: %w", err)
	}
	switch resp.StopReason {
	case anthropic.StopReasonRefusal:
		return errors.New("claude refused the request")
	case anthropic.StopReasonMaxTokens:
		return errors.New("claude response hit max_tokens")
	}

	var text strings.Builder
	for _, block := range resp.Content {
		if tb, ok := block.AsAny().(anthropic.TextBlock); ok {
			text.WriteString(tb.Text)
		}
	}
	if err := json.Unmarshal([]byte(text.String()), out); err != nil {
		return fmt.Errorf("parse claude response: %w", err)
	}
	return nil
}
