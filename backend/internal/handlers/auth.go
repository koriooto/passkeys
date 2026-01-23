package handlers

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"net/http"

	"golang.org/x/crypto/bcrypt"

	"github.com/jackc/pgx/v5/pgxpool"

	"passkeys/internal/auth"
	"passkeys/internal/middleware"
)

type AuthHandler struct {
	DB     *pgxpool.Pool
	Secret []byte
}

type authRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

type authResponse struct {
	Token   string `json:"token"`
	Email   string `json:"email"`
	KdfSalt string `json:"kdfSalt"`
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
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	token, err := auth.CreateToken(h.Secret, userID, req.Email)
	if err != nil {
		http.Error(w, "token error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, authResponse{
		Token:   token,
		Email:   req.Email,
		KdfSalt: base64.StdEncoding.EncodeToString(salt),
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

	token, err := auth.CreateToken(h.Secret, userID, req.Email)
	if err != nil {
		http.Error(w, "token error", http.StatusInternalServerError)
		return
	}

	respondJSON(w, authResponse{
		Token:   token,
		Email:   req.Email,
		KdfSalt: base64.StdEncoding.EncodeToString(salt),
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

	respondJSON(w, changePasswordResponse{
		KdfSalt: base64.StdEncoding.EncodeToString(salt),
	})
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
