package usecase

import (
	"context"
	"time"

	"nutrition/backend/internal/domain/model"
	"nutrition/backend/internal/domain/repository"
)

const (
	xpPerRecord       = 20
	xpPerManualRecord = 10
	xpPerLevel        = 100
	saltGoalGrams     = 7.5
	maxHistoryDays    = 31
)

// StatsUsecase derives progress (XP, streaks, badges, history) from the stored meals.
type StatsUsecase interface {
	// Stats derives XP, level, streak and badges from the stored meals, so they never drift from the records.
	// today is the client's local date.
	Stats(ctx context.Context, userID uint, today string) (*Stats, error)
	// History returns one entry per calendar day for the n days ending at to, filling unrecorded days with zeros.
	History(ctx context.Context, userID uint, to string, n int) (*History, error)
}

type statsUsecase struct {
	meals    repository.MealRepository
	profiles repository.ProfileRepository
}

func NewStatsUsecase(meals repository.MealRepository, profiles repository.ProfileRepository) StatsUsecase {
	return &statsUsecase{meals: meals, profiles: profiles}
}

type Badge struct {
	Key    string
	Label  string
	Earned bool
}

type Stats struct {
	XP         int
	Level      int
	XPInLevel  int
	Streak     int
	TodayMeals int
	Badges     []Badge
}

func (u *statsUsecase) Stats(ctx context.Context, userID uint, today string) (*Stats, error) {
	summaries, err := u.meals.DaySummaries(ctx, userID, "0000-01-01", "9999-12-31")
	if err != nil {
		return nil, err
	}
	sources, err := u.meals.CountBySource(ctx, userID)
	if err != nil {
		return nil, err
	}

	xp := 0
	for source, n := range sources {
		if source == model.SourceManual {
			xp += xpPerManualRecord * n
		} else {
			xp += xpPerRecord * n
		}
	}
	voiceMeals := sources["voice"]
	level := xp/xpPerLevel + 1

	byDate := make(map[string]model.DaySummary, len(summaries))
	for _, s := range summaries {
		byDate[s.Date] = s
	}
	streak := computeStreak(byDate, today)
	target := targetKcal(ctx, u.profiles, userID)

	return &Stats{
		XP: xp, Level: level, XPInLevel: xp % xpPerLevel,
		Streak: streak, TodayMeals: byDate[today].Meals,
		Badges: []Badge{
			{Key: "streak3", Label: "3日連続記録", Earned: streak >= 3},
			{Key: "voice10", Label: "音声で10食", Earned: voiceMeals >= 10},
			{Key: "pfc", Label: "PFC完璧な日", Earned: hasPFCPerfectDay(summaries, target)},
			{Key: "salt", Label: "塩分セーブ", Earned: hasSaltSaveDay(summaries)},
			{Key: "week", Label: "週間目標達成", Earned: hasGoalWeek(summaries, target)},
			{Key: "lv5", Label: "Lv.5到達", Earned: level >= 5},
		},
	}, nil
}

// computeStreak counts consecutive recorded days ending today, or yesterday if today has no record yet.
func computeStreak(byDate map[string]model.DaySummary, today string) int {
	t, err := time.Parse(DateLayout, today)
	if err != nil {
		return 0
	}
	if byDate[today].Meals == 0 {
		t = t.AddDate(0, 0, -1)
	}
	n := 0
	for byDate[t.Format(DateLayout)].Meals > 0 {
		n++
		t = t.AddDate(0, 0, -1)
	}
	return n
}

func within(v, goal float64) bool {
	return goal > 0 && v >= goal*0.8 && v <= goal*1.2
}

// hasPFCPerfectDay: protein, fat and carbs all within ±20% of the 25/25/50 energy split of the target.
func hasPFCPerfectDay(days []model.DaySummary, target int) bool {
	t := float64(target)
	for _, d := range days {
		if within(d.Protein, t*0.25/4) && within(d.Fat, t*0.25/9) && within(d.Carbs, t*0.5/4) {
			return true
		}
	}
	return false
}

// hasSaltSaveDay: a reasonably complete day (2+ meals) under the salt goal.
func hasSaltSaveDay(days []model.DaySummary) bool {
	for _, d := range days {
		if d.Meals >= 2 && d.Salt <= saltGoalGrams {
			return true
		}
	}
	return false
}

// hasGoalWeek: seven consecutive recorded days, each at or under the calorie target.
func hasGoalWeek(days []model.DaySummary, target int) bool {
	if target <= 0 {
		return false
	}
	run := 0
	var prev time.Time
	for _, d := range days {
		t, err := time.Parse(DateLayout, d.Date)
		if err != nil {
			run = 0
			continue
		}
		if d.Kcal <= 0 || d.Kcal > float64(target) {
			run = 0
			continue
		}
		if run > 0 && t.Equal(prev.AddDate(0, 0, 1)) {
			run++
		} else {
			run = 1
		}
		prev = t
		if run >= 7 {
			return true
		}
	}
	return false
}

type HistoryDay struct {
	Date  string
	Kcal  float64
	Cost  int
	Meals int
}

type History struct {
	TargetKcal int
	Days       []HistoryDay
}

func (u *statsUsecase) History(ctx context.Context, userID uint, to string, n int) (*History, error) {
	if n < 1 || n > maxHistoryDays {
		return nil, invalid("days must be between 1 and 31")
	}
	end, err := time.Parse(DateLayout, to)
	if err != nil {
		return nil, invalid("to must be YYYY-MM-DD")
	}
	from := end.AddDate(0, 0, -(n - 1)).Format(DateLayout)

	summaries, err := u.meals.DaySummaries(ctx, userID, from, to)
	if err != nil {
		return nil, err
	}
	byDate := make(map[string]model.DaySummary, len(summaries))
	for _, s := range summaries {
		byDate[s.Date] = s
	}

	days := make([]HistoryDay, 0, n)
	for i := n - 1; i >= 0; i-- {
		d := end.AddDate(0, 0, -i).Format(DateLayout)
		s := byDate[d]
		days = append(days, HistoryDay{Date: d, Kcal: s.Kcal, Cost: s.Cost, Meals: s.Meals})
	}
	return &History{TargetKcal: targetKcal(ctx, u.profiles, userID), Days: days}, nil
}
