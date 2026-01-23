package handlers

import (
	"encoding/base64"
	"encoding/json"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"passkeys/internal/middleware"
)

type AccountHandler struct {
	DB *pgxpool.Pool
}

type accountRequest struct {
	URL            string `json:"url"`
	Label          string `json:"label"`
	UsernameCipher string `json:"usernameCipher"`
	UsernameNonce  string `json:"usernameNonce"`
	PasswordCipher string `json:"passwordCipher"`
	PasswordNonce  string `json:"passwordNonce"`
}

type accountResponse struct {
	ID             string    `json:"id"`
	URL            string    `json:"url"`
	Label          string    `json:"label"`
	UsernameCipher string    `json:"usernameCipher"`
	UsernameNonce  string    `json:"usernameNonce"`
	PasswordCipher string    `json:"passwordCipher"`
	PasswordNonce  string    `json:"passwordNonce"`
	CreatedAt      time.Time `json:"createdAt"`
	UpdatedAt      time.Time `json:"updatedAt"`
}

func (h *AccountHandler) List(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUser(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		select id, url, label, username_cipher, username_nonce, password_cipher, password_nonce, created_at, updated_at
		from accounts where user_id=$1 order by updated_at desc`, user.ID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	accounts := make([]accountResponse, 0)
	for rows.Next() {
		var item accountResponse
		var usernameCipher []byte
		var usernameNonce []byte
		var passwordCipher []byte
		var passwordNonce []byte
		if err := rows.Scan(
			&item.ID,
			&item.URL,
			&item.Label,
			&usernameCipher,
			&usernameNonce,
			&passwordCipher,
			&passwordNonce,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}

		item.UsernameCipher = base64.StdEncoding.EncodeToString(usernameCipher)
		item.UsernameNonce = base64.StdEncoding.EncodeToString(usernameNonce)
		item.PasswordCipher = base64.StdEncoding.EncodeToString(passwordCipher)
		item.PasswordNonce = base64.StdEncoding.EncodeToString(passwordNonce)
		accounts = append(accounts, item)
	}

	respondJSON(w, accounts)
}

func (h *AccountHandler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUser(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req accountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.URL == "" || req.UsernameCipher == "" || req.PasswordCipher == "" {
		http.Error(w, "missing fields", http.StatusBadRequest)
		return
	}

	usernameCipher, usernameNonce, passwordCipher, passwordNonce, err := decodeAccount(req)
	if err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	var response accountResponse
	err = h.DB.QueryRow(r.Context(), `
		insert into accounts (user_id, url, label, username_cipher, username_nonce, password_cipher, password_nonce)
		values ($1, $2, $3, $4, $5, $6, $7)
		returning id, url, label, username_cipher, username_nonce, password_cipher, password_nonce, created_at, updated_at`,
		user.ID, req.URL, req.Label, usernameCipher, usernameNonce, passwordCipher, passwordNonce,
	).Scan(
		&response.ID,
		&response.URL,
		&response.Label,
		&usernameCipher,
		&usernameNonce,
		&passwordCipher,
		&passwordNonce,
		&response.CreatedAt,
		&response.UpdatedAt,
	)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	response.UsernameCipher = base64.StdEncoding.EncodeToString(usernameCipher)
	response.UsernameNonce = base64.StdEncoding.EncodeToString(usernameNonce)
	response.PasswordCipher = base64.StdEncoding.EncodeToString(passwordCipher)
	response.PasswordNonce = base64.StdEncoding.EncodeToString(passwordNonce)
	respondJSON(w, response)
}

func (h *AccountHandler) Update(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUser(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	accountID := chi.URLParam(r, "id")
	if accountID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	var req accountRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	usernameCipher, usernameNonce, passwordCipher, passwordNonce, err := decodeAccount(req)
	if err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	var response accountResponse
	err = h.DB.QueryRow(r.Context(), `
		update accounts
		set url=$1, label=$2, username_cipher=$3, username_nonce=$4, password_cipher=$5, password_nonce=$6, updated_at=now()
		where id=$7 and user_id=$8
		returning id, url, label, username_cipher, username_nonce, password_cipher, password_nonce, created_at, updated_at`,
		req.URL, req.Label, usernameCipher, usernameNonce, passwordCipher, passwordNonce, accountID, user.ID,
	).Scan(
		&response.ID,
		&response.URL,
		&response.Label,
		&usernameCipher,
		&usernameNonce,
		&passwordCipher,
		&passwordNonce,
		&response.CreatedAt,
		&response.UpdatedAt,
	)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	response.UsernameCipher = base64.StdEncoding.EncodeToString(usernameCipher)
	response.UsernameNonce = base64.StdEncoding.EncodeToString(usernameNonce)
	response.PasswordCipher = base64.StdEncoding.EncodeToString(passwordCipher)
	response.PasswordNonce = base64.StdEncoding.EncodeToString(passwordNonce)
	respondJSON(w, response)
}

func (h *AccountHandler) Delete(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUser(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	accountID := chi.URLParam(r, "id")
	if accountID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	commandTag, err := h.DB.Exec(r.Context(), "delete from accounts where id=$1 and user_id=$2", accountID, user.ID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	if commandTag.RowsAffected() == 0 {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func decodeAccount(req accountRequest) ([]byte, []byte, []byte, []byte, error) {
	usernameCipher, err := base64.StdEncoding.DecodeString(req.UsernameCipher)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	usernameNonce, err := base64.StdEncoding.DecodeString(req.UsernameNonce)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	passwordCipher, err := base64.StdEncoding.DecodeString(req.PasswordCipher)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	passwordNonce, err := base64.StdEncoding.DecodeString(req.PasswordNonce)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	return usernameCipher, usernameNonce, passwordCipher, passwordNonce, nil
}
