package ai

import (
	"context"
	"strings"

	"nutrition/backend/internal/model"
)

// Stub returns deterministic placeholder data so the UI works without an API key.
type Stub struct{}

func stubItem(name, detail string) Item {
	return Item{
		Name: name, Detail: detail,
		Kcal: 250, Protein: 10, Fat: 8, Carbs: 30, Salt: 1.0, Sugar: 25,
		Confidence: model.ConfidenceLow,
	}
}

func splitFoods(text string) []Item {
	parts := strings.FieldsFunc(text, func(r rune) bool {
		return r == '、' || r == ',' || r == '，' || r == '。' || r == '\n' || r == ' ' || r == '　'
	})
	items := make([]Item, 0, len(parts))
	for _, p := range parts {
		if p = strings.TrimSpace(p); p != "" {
			items = append(items, stubItem(p, "1人前（目安）"))
		}
	}
	if len(items) == 0 {
		items = append(items, stubItem(text, "1人前（目安）"))
	}
	return items
}

func (Stub) AnalyzeMeal(_ context.Context, text string) (*Analysis, error) {
	return &Analysis{
		Items:  splitFoods(text),
		Advice: "スタブ応答です。AI_API_KEY を設定すると実際に解析します。",
	}, nil
}

func (Stub) SearchFoods(_ context.Context, query string) ([]Item, error) {
	return []Item{
		stubItem(query, "1人前"),
		stubItem(query+"（大盛り）", "1.5人前"),
		stubItem(query+"（小盛り）", "0.7人前"),
		stubItem(query+" セット", "セット"),
	}, nil
}

// Chat treats a question as a consultation and anything else as a meal report.
func (Stub) Chat(_ context.Context, req ChatRequest) (*ChatReply, error) {
	history := NormalizeHistory(req.Messages)
	if len(history) == 0 || history[len(history)-1].Role != RoleUser {
		return nil, errHistoryNotUser
	}
	last := history[len(history)-1].Text
	if strings.ContainsAny(last, "?？") {
		return &ChatReply{Reply: "（スタブ応答）いい質問だ！AI_API_KEY を設定すると、今日の残りカロリーを踏まえて本気で答えるぞ。"}, nil
	}
	reply := &ChatReply{
		Reply:  "（スタブ応答）ナイス報告！この内容で記録カードを出すぞ。",
		Record: &RecordProposal{Name: last, Slot: model.SlotDinner, Items: splitFoods(last)},
	}
	normalizeReply(reply)
	return reply, nil
}
