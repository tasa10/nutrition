package ai

import (
	"fmt"
	"strings"
)

// Prompts and JSON schemas shared by every provider, so Claude and Gemini return the same shapes.

const analyzeSystemPrompt = `あなたは日本の食事内容を栄養解析するアシスタントです。
ユーザーの発話を料理・食材ごとに分解し、日本の一般的な外食・家庭料理の分量を前提にカロリーと栄養素を推定します。
kcal はキロカロリー、protein / fat / carbs / salt / sugar はグラムです。detail には分量の目安を書きます。
advice はゲーム的で楽しく前向きな一言アドバイスを60字以内で。絵文字は使いません。`

const searchSystemPrompt = `あなたは日本の食品カロリーデータベースです。
検索語に該当する食品・料理の候補を4件返します。コンビニ・外食・家庭料理でよくある1人前または1個の分量を前提にします。
kcal はキロカロリー、protein / fat / carbs / salt / sugar はグラムです。detail には分量（例: 1袋 110g）を書きます。`

func chatSystemPrompt(d DayContext) string {
	meals := "まだ記録なし"
	if len(d.Meals) > 0 {
		meals = strings.Join(d.Meals, " / ")
	}
	remaining := float64(d.TargetKcal) - d.Kcal
	return fmt.Sprintf(`あなたは日本語のカロリー管理コーチです。トーンはゲーム実況のように明るく楽しく、絵文字は使いません。
reply は120字以内で、ユーザーの直前の発言に答えます。

今日のユーザーの状況:
- 1日の目標: %d kcal
- 摂取: %.0f kcal（残り %.0f kcal）
- たんぱく質 %.0fg / 脂質 %.0fg / 炭水化物 %.0fg / 塩分 %.1fg
- 記録済みの食事: %s

record: ユーザーが食べたものを報告した、または食べると決めた場合だけ、記録カードとして提案する内容を入れます。
それ以外（相談・質問・雑談）は null にします。
record.slot は breakfast（朝食）/ lunch（昼食）/ dinner（夕食）/ snack（間食）のいずれかで、発言から判断します。
record.items は料理・食材ごとの内訳で、kcal はキロカロリー、protein / fat / carbs / salt / sugar はグラムです。`,
		d.TargetKcal, d.Kcal, remaining, d.Protein, d.Fat, d.Carbs, d.Salt, meals)
}

const maxSearchResults = 4

var itemSchema = map[string]any{
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
}

var analysisSchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"items", "advice"},
	"properties": map[string]any{
		"items":  map[string]any{"type": "array", "items": itemSchema},
		"advice": map[string]any{"type": "string"},
	},
}

var searchSchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"items"},
	"properties": map[string]any{
		"items": map[string]any{"type": "array", "items": itemSchema},
	},
}

var chatSchema = map[string]any{
	"type":                 "object",
	"additionalProperties": false,
	"required":             []string{"reply", "record"},
	"properties": map[string]any{
		"reply": map[string]any{"type": "string"},
		"record": map[string]any{
			"anyOf": []any{
				map[string]any{"type": "null"},
				map[string]any{
					"type":                 "object",
					"additionalProperties": false,
					"required":             []string{"name", "kcal", "slot", "items"},
					"properties": map[string]any{
						"name":  map[string]any{"type": "string"},
						"kcal":  map[string]any{"type": "number"},
						"slot":  map[string]any{"type": "string", "enum": []string{"breakfast", "lunch", "dinner", "snack"}},
						"items": map[string]any{"type": "array", "items": itemSchema},
					},
				},
			},
		},
	},
}

type searchResult struct {
	Items []Item `json:"items"`
}

func finishAnalysis(a *Analysis) (*Analysis, error) {
	a.Items = normalizeItems(a.Items)
	if len(a.Items) == 0 {
		return nil, errEmptyAnalysis
	}
	return a, nil
}

func finishSearch(r searchResult) []Item {
	items := normalizeItems(r.Items)
	if len(items) > maxSearchResults {
		items = items[:maxSearchResults]
	}
	return items
}
