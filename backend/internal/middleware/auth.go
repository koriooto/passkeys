package middleware

import (
	"context"
	"net/http"
	"strings"

	"passkeys/internal/auth"
)

type contextKey string

const userKey contextKey = "user"

type UserContext struct {
	ID    string
	Email string
}

func AuthMiddleware(secret []byte) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "missing auth header", http.StatusUnauthorized)
				return
			}

			parts := strings.SplitN(authHeader, " ", 2)
			if len(parts) != 2 || strings.ToLower(parts[0]) != "bearer" {
				http.Error(w, "invalid auth header", http.StatusUnauthorized)
				return
			}

			claims, err := auth.ParseToken(secret, parts[1])
			if err != nil {
				http.Error(w, "invalid token", http.StatusUnauthorized)
				return
			}

			ctx := context.WithValue(r.Context(), userKey, UserContext{
				ID:    claims.UserID,
				Email: claims.Email,
			})
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

func GetUser(r *http.Request) (UserContext, bool) {
	value := r.Context().Value(userKey)
	user, ok := value.(UserContext)
	return user, ok
}
