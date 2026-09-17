package ai

import (
	"context"
	"strings"
)

// Stub returns deterministic placeholder estimates so the UI works without an API key.
type Stub struct{}

func (Stub) AnalyzeMeal(_ context.Context, text string) (*Analysis, error) {
	parts := strings.FieldsFunc(text, func(r rune) bool {
		return r == '、' || r == ',' || r == '，' || r == '。' || r == '\n' || r == ' ' || r == '　'
	})
	if len(parts) == 0 {
		parts = []string{text}
	}
	items := make([]Item, 0, len(parts))
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if p == "" {
			continue
		}
		items = append(items, Item{
			Name: p, Detail: "1人前（目安）",
			Kcal: 250, Protein: 10, Fat: 8, Carbs: 30, Salt: 1.0, Sugar: 25,
			Confidence: "low",
		})
	}
	return &Analysis{
		Items:  items,
		Advice: "スタブ応答です。AI_API_KEY を設定すると実際に解析します。",
	}, nil
}
