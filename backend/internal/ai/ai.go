package ai

import "context"

type Item struct {
	Name       string  `json:"name"`
	Detail     string  `json:"detail"`
	Kcal       float64 `json:"kcal"`
	Protein    float64 `json:"protein"`
	Fat        float64 `json:"fat"`
	Carbs      float64 `json:"carbs"`
	Salt       float64 `json:"salt"`
	Sugar      float64 `json:"sugar"`
	Confidence string  `json:"confidence"`
}

type Analysis struct {
	Items  []Item `json:"items"`
	Advice string `json:"advice"`
}

// Analyzer turns a free-text description of a meal into per-dish nutrient estimates.
// Implementations: Claude (internal/ai/claude.go), Stub (internal/ai/stub.go).
type Analyzer interface {
	AnalyzeMeal(ctx context.Context, text string) (*Analysis, error)
}
