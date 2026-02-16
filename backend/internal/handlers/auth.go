package handlers

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"log"
	"net/http"
	"time"

	"golang.org/x/crypto/bcrypt"

	"github.com/jackc/pgx/v5/pgxpool"

	"passkeys/internal/auth"
	"passkeys/internal/middleware"
)

type AuthHandler struct {
	DB                  *pgxpool.Pool
	Secret              []byte
	AccessTokenLifetime  time.Duration
	RefreshTokenLifetime time.Duration
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
	Email        string `json:"email"`
	KdfSalt      string `json:"kdfSalt"`
}

type refreshRequest struct {
	RefreshToken string `json:"refreshToken"`
}

type refreshResponse struct {
	Token        string `json:"token"`
	RefreshToken string `json:"refreshToken"`
}

type changePasswordRequest struct {
	CurrentPassword string `json:"currentPassword"`
	NewPassword     string `json:"newPassword"`
}

type changePasswordResponse struct {
	KdfSalt string `json:"kdfSalt"`
}

func (h *AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Email == "" || len(req.Password) < 6 {
		http.Error(w, "invalid credentials", http.StatusBadRequest)
		return
	}

	var exists bool
	if err := h.DB.QueryRow(r.Context(), "select exists(select 1 from users where email=$1)", req.Email).Scan(&exists); err != nil {
		log.Printf("[Register] db error (exists check): %v", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if exists {
		http.Error(w, "email already exists", http.StatusConflict)
		return
	}

	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		http.Error(w, "salt generation failed", http.StatusInternalServerError)
		return
	}

	hash, err := bcrypt.GenerateFromPassword([]byte(req.Password), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "hashing failed", http.StatusInternalServerError)
		return
	}

	var userID string
	if err := h.DB.QueryRow(r.Context(),
		"insert into users (email, password_hash, kdf_salt) values ($1, $2, $3) returning id",
		req.Email, string(hash), salt,
	).Scan(&userID); err != nil {
		log.Printf("[Register] db error (insert user): %v", err)
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	accessToken, refreshToken, err := h.createTokenPair(r.Context(), userID, req.Email)
	if err != nil {
		log.Printf("[Register] token error (createTokenPair): %v", err)
		http.Error(w, "token error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, authResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
		Email:        req.Email,
		KdfSalt:      base64.StdEncoding.EncodeToString(salt),
	})
}

func (h *AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var req authRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.Email == "" || req.Password == "" {
		http.Error(w, "invalid credentials", http.StatusBadRequest)
		return
	}

	ctx := r.Context()
	userID, hash, salt, err := h.findUser(ctx, req.Email)
	if err != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.Password)) != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	accessToken, refreshToken, err := h.createTokenPair(r.Context(), userID, req.Email)
	if err != nil {
		http.Error(w, "token error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, authResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
		Email:        req.Email,
		KdfSalt:      base64.StdEncoding.EncodeToString(salt),
	})
}

func (h *AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	var req refreshRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.RefreshToken == "" {
		http.Error(w, "refresh token required", http.StatusBadRequest)
		return
	}

	userID, email, err := h.validateAndRevokeRefreshToken(r.Context(), req.RefreshToken)
	if err != nil {
		http.Error(w, "invalid refresh token", http.StatusUnauthorized)
		return
	}

	accessToken, refreshToken, err := h.createTokenPair(r.Context(), userID, email)
	if err != nil {
		http.Error(w, "token error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, refreshResponse{
		Token:        accessToken,
		RefreshToken: refreshToken,
	})
}

func (h *AuthHandler) ChangePassword(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUser(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req changePasswordRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if len(req.NewPassword) < 6 || req.CurrentPassword == "" {
		http.Error(w, "invalid credentials", http.StatusBadRequest)
		return
	}

	var hash string
	if err := h.DB.QueryRow(r.Context(), "select password_hash from users where id=$1", user.ID).Scan(&hash); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	if bcrypt.CompareHashAndPassword([]byte(hash), []byte(req.CurrentPassword)) != nil {
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}

	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		http.Error(w, "salt generation failed", http.StatusInternalServerError)
		return
	}

	newHash, err := bcrypt.GenerateFromPassword([]byte(req.NewPassword), bcrypt.DefaultCost)
	if err != nil {
		http.Error(w, "hashing failed", http.StatusInternalServerError)
		return
	}

	if _, err := h.DB.Exec(r.Context(),
		"update users set password_hash=$1, kdf_salt=$2 where id=$3",
		string(newHash), salt, user.ID,
	); err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	// Инвалидируем все refresh-токены при смене пароля
	_, _ = h.DB.Exec(r.Context(), "delete from refresh_tokens where user_id=$1", user.ID)

	respondJSON(w, changePasswordResponse{
		KdfSalt: base64.StdEncoding.EncodeToString(salt),
	})
}

func (h *AuthHandler) createTokenPair(ctx context.Context, userID, email string) (accessToken, refreshToken string, err error) {
	accessToken, err = auth.CreateTokenWithLifetime(h.Secret, userID, email, h.AccessTokenLifetime)
	if err != nil {
		return "", "", err
	}

	refreshBytes := make([]byte, 32)
	if _, err := rand.Read(refreshBytes); err != nil {
		return "", "", err
	}
	refreshToken = base64.URLEncoding.EncodeToString(refreshBytes)
	tokenHash := sha256.Sum256([]byte(refreshToken))
	hashHex := hex.EncodeToString(tokenHash[:])
	expiresAt := time.Now().Add(h.RefreshTokenLifetime)

	if _, err := h.DB.Exec(ctx,
		"insert into refresh_tokens (user_id, token_hash, expires_at) values ($1, $2, $3)",
		userID, hashHex, expiresAt,
	); err != nil {
		return "", "", err
	}

	return accessToken, refreshToken, nil
}

func (h *AuthHandler) validateAndRevokeRefreshToken(ctx context.Context, token string) (userID, email string, err error) {
	tokenHash := sha256.Sum256([]byte(token))
	hashHex := hex.EncodeToString(tokenHash[:])

	err = h.DB.QueryRow(ctx,
		"delete from refresh_tokens where token_hash=$1 and expires_at>now() returning user_id",
		hashHex,
	).Scan(&userID)
	if err != nil {
		return "", "", err
	}

	if err := h.DB.QueryRow(ctx, "select email from users where id=$1", userID).Scan(&email); err != nil {
		return "", "", err
	}
	return userID, email, nil
}

func (h *AuthHandler) findUser(ctx context.Context, email string) (string, string, []byte, error) {
	var userID string
	var hash string
	var salt []byte
	err := h.DB.QueryRow(ctx, "select id, password_hash, kdf_salt from users where email=$1", email).Scan(&userID, &hash, &salt)
	return userID, hash, salt, err
}

func respondJSON(w http.ResponseWriter, payload any) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(payload)
}
