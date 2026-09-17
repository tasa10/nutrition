// Package auth resolves the current user for a request.
//
// Dev signs every request in as a fixed user row (local development). Firebase verifies the
// ID token from the Authorization header and maps it to a user row by firebase_uid.
// Handlers only ever call CurrentUser / UserID and don't know which one is active.
package auth

import (
	"errors"
	"net/http"

	"github.com/labstack/echo/v5"
	"gorm.io/gorm"

	"nutrition/backend/internal/model"
)

const contextKey = "auth.user"

// ErrUnauthorized means the request carried no usable credentials.
var ErrUnauthorized = errors.New("unauthorized")

type Authenticator interface {
	Authenticate(c *echo.Context) (*model.User, error)
}

// Dev signs every request in as UserID without checking credentials.
type Dev struct {
	DB     *gorm.DB
	UserID uint
}

func (d Dev) Authenticate(c *echo.Context) (*model.User, error) {
	var u model.User
	if err := d.DB.WithContext(c.Request().Context()).First(&u, d.UserID).Error; err != nil {
		return nil, err
	}
	return &u, nil
}

func Middleware(a Authenticator) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c *echo.Context) error {
			u, err := a.Authenticate(c)
			if err != nil {
				if errors.Is(err, ErrUnauthorized) || errors.Is(err, gorm.ErrRecordNotFound) {
					return echo.NewHTTPError(http.StatusUnauthorized, "unauthorized")
				}
				return echo.NewHTTPError(http.StatusInternalServerError, "authentication failed")
			}
			c.Set(contextKey, u)
			return next(c)
		}
	}
}

// CurrentUser returns the user set by Middleware. Panics if called on an unprotected route.
func CurrentUser(c *echo.Context) *model.User {
	u, ok := c.Get(contextKey).(*model.User)
	if !ok {
		panic("auth.CurrentUser called without auth.Middleware")
	}
	return u
}

func UserID(c *echo.Context) uint {
	return CurrentUser(c).ID
}
