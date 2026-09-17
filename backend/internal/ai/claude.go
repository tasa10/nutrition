package ai

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"

	"github.com/anthropics/anthropic-sdk-go"
	"github.com/anthropics/anthropic-sdk-go/option"
)

const analyzeSystemPrompt = `あなたは日本の食事内容を栄養解析するアシスタントです。
ユーザーの発話を料理・食材ごとに分解し、日本の一般的な外食・家庭料理の分量を前提にカロリーと栄養素を推定します。
出力は次のJSONのみ。前後に説明文やコードフェンスを付けないこと。絵文字は使わないこと。
{"items":[{"name":"料理名","detail":"分量の目安","kcal":数値,"protein":数値,"fat":数値,"carbs":数値,"salt":数値,"sugar":数値,"confidence":"high|mid|low"}],"advice":"ゲーム的で楽しく前向きな一言アドバイス(60字以内)"}
単位: kcalはkcal、protein/fat/carbs/salt/sugarはグラム。`

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

var analysisSchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"items", "advice"},
	"properties": map[string]any{
		"advice": map[string]any{"type": "string"},
		"items": map[string]any{
			"type": "array",
			"items": map[string]any{
				"type":                 "object",
				"additionalProperties": false,
				"required":             []string{"name", "detail", "kcal", "protein", "fat", "carbs", "salt", "sugar", "confidence"},
				"properties": map[string]any{
					"name":       map[string]any{"type": "string"},
					"detail":     map[string]any{"type": "string"},
					"kcal":       map[string]any{"type": "number"},
					"protein":    map[string]any{"type": "number"},
					"fat":        map[string]any{"type": "number"},
					"carbs":      map[string]any{"type": "number"},
					"salt":       map[string]any{"type": "number"},
					"sugar":      map[string]any{"type": "number"},
					"confidence": map[string]any{"type": "string", "enum": []string{"high", "mid", "low"}},
				},
			},
		},
	},
}

func (c *Claude) AnalyzeMeal(ctx context.Context, text string) (*Analysis, error) {
	resp, err := c.client.Messages.New(ctx, anthropic.MessageNewParams{
		Model:     c.model,
		MaxTokens: 2048,
		System:    []anthropic.TextBlockParam{{Text: analyzeSystemPrompt}},
		Messages: []anthropic.MessageParam{
			anthropic.NewUserMessage(anthropic.NewTextBlock("発話:「" + text + "」")),
		},
		OutputConfig: anthropic.OutputConfigParam{
			Format: anthropic.JSONOutputFormatParam{Schema: analysisSchema},
		},
	})
	if err != nil {
		return nil, fmt.Errorf("claude request: %w", err)
	}
	if resp.StopReason == anthropic.StopReasonRefusal {
		return nil, errors.New("claude refused the request")
	}

	var out strings.Builder
	for _, block := range resp.Content {
		if tb, ok := block.AsAny().(anthropic.TextBlock); ok {
			out.WriteString(tb.Text)
		}
	}
	return parseAnalysis(out.String())
}

func parseAnalysis(raw string) (*Analysis, error) {
	start := strings.Index(raw, "{")
	end := strings.LastIndex(raw, "}")
	if start < 0 || end <= start {
		return nil, errors.New("no JSON object in response")
	}
	var a Analysis
	if err := json.Unmarshal([]byte(raw[start:end+1]), &a); err != nil {
		return nil, fmt.Errorf("parse analysis: %w", err)
	}
	if len(a.Items) == 0 {
		return nil, errors.New("analysis returned no items")
	}
	for i := range a.Items {
		switch a.Items[i].Confidence {
		case "high", "mid", "low":
		default:
			a.Items[i].Confidence = "mid"
		}
	}
	return &a, nil
}
