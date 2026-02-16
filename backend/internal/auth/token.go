package auth

import (
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Claims struct {
	UserID string `json:"uid"`
	Email  string `json:"email"`
	jwt.RegisteredClaims
}

// DefaultAccessTokenLifetime — 1 час.
const DefaultAccessTokenLifetime = 1 * time.Hour

// DefaultRefreshTokenLifetime — 30 дней.
const DefaultRefreshTokenLifetime = 30 * 24 * time.Hour

func CreateToken(secret []byte, userID, email string) (string, error) {
	return CreateTokenWithLifetime(secret, userID, email, DefaultAccessTokenLifetime)
}

func CreateTokenWithLifetime(secret []byte, userID, email string, lifetime time.Duration) (string, error) {
	now := time.Now()
	claims := &Claims{
		UserID: userID,
		Email:  email,
		RegisteredClaims: jwt.RegisteredClaims{
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(lifetime)),
		},
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(secret)
}

func ParseToken(secret []byte, tokenString string) (*Claims, error) {
	parsed, err := jwt.ParseWithClaims(tokenString, &Claims{}, func(token *jwt.Token) (interface{}, error) {
		return secret, nil
	})
	if err != nil {
		return nil, err
	}
	if claims, ok := parsed.Claims.(*Claims); ok && parsed.Valid {
		return claims, nil
	}
	return nil, jwt.ErrTokenInvalidClaims
}
