package auth

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"strings"

	firebase "firebase.google.com/go/v4"
	fbauth "firebase.google.com/go/v4/auth"
	"github.com/labstack/echo/v5"
	"google.golang.org/api/option"
	"gorm.io/gorm"

	"nutrition/backend/internal/model"
)

const bearerPrefix = "Bearer "

// Firebase authenticates requests with a Firebase Auth ID token and creates the user row on first sign-in.
type Firebase struct {
	DB     *gorm.DB
	client *fbauth.Client
}

// NewFirebase needs only the project ID: verifying ID tokens uses Google's public keys,
// so no service-account credentials are required.
func NewFirebase(ctx context.Context, db *gorm.DB, projectID string) (*Firebase, error) {
	app, err := firebase.NewApp(ctx, &firebase.Config{ProjectID: projectID}, option.WithoutAuthentication())
	if err != nil {
		return nil, fmt.Errorf("init firebase app: %w", err)
	}
	client, err := app.Auth(ctx)
	if err != nil {
		return nil, fmt.Errorf("init firebase auth: %w", err)
	}
	return &Firebase{DB: db, client: client}, nil
}

func (f *Firebase) Authenticate(c *echo.Context) (*model.User, error) {
	header := c.Request().Header.Get(echo.HeaderAuthorization)
	if !strings.HasPrefix(header, bearerPrefix) {
		return nil, ErrUnauthorized
	}
	idToken := strings.TrimSpace(strings.TrimPrefix(header, bearerPrefix))
	if idToken == "" {
		return nil, ErrUnauthorized
	}

	ctx := c.Request().Context()
	token, err := f.client.VerifyIDToken(ctx, idToken)
	if err != nil {
		slog.Debug("firebase id token rejected", "error", err)
		return nil, fmt.Errorf("%w: %w", ErrUnauthorized, err)
	}
	return f.findOrCreate(ctx, token)
}

func (f *Firebase) findOrCreate(ctx context.Context, token *fbauth.Token) (*model.User, error) {
	var u model.User
	err := f.DB.WithContext(ctx).Where("firebase_uid = ?", token.UID).First(&u).Error
	if err == nil {
		return &u, nil
	}
	if !errors.Is(err, gorm.ErrRecordNotFound) {
		return nil, err
	}

	u = model.User{FirebaseUID: token.UID, DisplayName: displayName(token)}
	if err := f.DB.WithContext(ctx).Create(&u).Error; err != nil {
		// Two first requests can race to create the same user; the unique index lets one win.
		var again model.User
		if findErr := f.DB.WithContext(ctx).Where("firebase_uid = ?", token.UID).First(&again).Error; findErr == nil {
			return &again, nil
		}
		return nil, err
	}
	slog.Info("created user from firebase sign-in", "user_id", u.ID, "provider", token.Firebase.SignInProvider)
	return &u, nil
}

func displayName(token *fbauth.Token) string {
	for _, key := range []string{"name", "email"} {
		if v, ok := token.Claims[key].(string); ok && strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
