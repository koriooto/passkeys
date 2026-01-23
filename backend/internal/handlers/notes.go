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

type NoteHandler struct {
	DB *pgxpool.Pool
}

type noteRequest struct {
	TitleCipher string `json:"titleCipher"`
	TitleNonce  string `json:"titleNonce"`
	TextCipher  string `json:"textCipher"`
	TextNonce   string `json:"textNonce"`
}

type noteResponse struct {
	ID          string    `json:"id"`
	TitleCipher string    `json:"titleCipher"`
	TitleNonce  string    `json:"titleNonce"`
	TextCipher  string    `json:"textCipher"`
	TextNonce   string    `json:"textNonce"`
	CreatedAt   time.Time `json:"createdAt"`
	UpdatedAt   time.Time `json:"updatedAt"`
}

func (h *NoteHandler) List(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUser(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	rows, err := h.DB.Query(r.Context(), `
		select id, title_cipher, title_nonce, text_cipher, text_nonce, created_at, updated_at
		from notes where user_id=$1 order by updated_at desc`, user.ID)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	notes := make([]noteResponse, 0)
	for rows.Next() {
		var item noteResponse
		var titleCipher []byte
		var titleNonce []byte
		var textCipher []byte
		var textNonce []byte
		if err := rows.Scan(
			&item.ID,
			&titleCipher,
			&titleNonce,
			&textCipher,
			&textNonce,
			&item.CreatedAt,
			&item.UpdatedAt,
		); err != nil {
			http.Error(w, "db error", http.StatusInternalServerError)
			return
		}

		item.TitleCipher = base64.StdEncoding.EncodeToString(titleCipher)
		item.TitleNonce = base64.StdEncoding.EncodeToString(titleNonce)
		item.TextCipher = base64.StdEncoding.EncodeToString(textCipher)
		item.TextNonce = base64.StdEncoding.EncodeToString(textNonce)
		notes = append(notes, item)
	}

	respondJSON(w, notes)
}

func (h *NoteHandler) Create(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUser(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	var req noteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}
	if req.TitleCipher == "" || req.TextCipher == "" {
		http.Error(w, "missing fields", http.StatusBadRequest)
		return
	}

	titleCipher, titleNonce, textCipher, textNonce, err := decodeNote(req)
	if err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	var response noteResponse
	err = h.DB.QueryRow(r.Context(), `
		insert into notes (user_id, title_cipher, title_nonce, text_cipher, text_nonce)
		values ($1, $2, $3, $4, $5)
		returning id, title_cipher, title_nonce, text_cipher, text_nonce, created_at, updated_at`,
		user.ID, titleCipher, titleNonce, textCipher, textNonce,
	).Scan(
		&response.ID,
		&titleCipher,
		&titleNonce,
		&textCipher,
		&textNonce,
		&response.CreatedAt,
		&response.UpdatedAt,
	)
	if err != nil {
		http.Error(w, "db error", http.StatusInternalServerError)
		return
	}

	response.TitleCipher = base64.StdEncoding.EncodeToString(titleCipher)
	response.TitleNonce = base64.StdEncoding.EncodeToString(titleNonce)
	response.TextCipher = base64.StdEncoding.EncodeToString(textCipher)
	response.TextNonce = base64.StdEncoding.EncodeToString(textNonce)
	respondJSON(w, response)
}

func (h *NoteHandler) Update(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUser(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	noteID := chi.URLParam(r, "id")
	if noteID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	var req noteRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "invalid request", http.StatusBadRequest)
		return
	}

	titleCipher, titleNonce, textCipher, textNonce, err := decodeNote(req)
	if err != nil {
		http.Error(w, "invalid payload", http.StatusBadRequest)
		return
	}

	var response noteResponse
	err = h.DB.QueryRow(r.Context(), `
		update notes
		set title_cipher=$1, title_nonce=$2, text_cipher=$3, text_nonce=$4, updated_at=now()
		where id=$5 and user_id=$6
		returning id, title_cipher, title_nonce, text_cipher, text_nonce, created_at, updated_at`,
		titleCipher, titleNonce, textCipher, textNonce, noteID, user.ID,
	).Scan(
		&response.ID,
		&titleCipher,
		&titleNonce,
		&textCipher,
		&textNonce,
		&response.CreatedAt,
		&response.UpdatedAt,
	)
	if err != nil {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}

	response.TitleCipher = base64.StdEncoding.EncodeToString(titleCipher)
	response.TitleNonce = base64.StdEncoding.EncodeToString(titleNonce)
	response.TextCipher = base64.StdEncoding.EncodeToString(textCipher)
	response.TextNonce = base64.StdEncoding.EncodeToString(textNonce)
	respondJSON(w, response)
}

func (h *NoteHandler) Delete(w http.ResponseWriter, r *http.Request) {
	user, ok := middleware.GetUser(r)
	if !ok {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	noteID := chi.URLParam(r, "id")
	if noteID == "" {
		http.Error(w, "missing id", http.StatusBadRequest)
		return
	}

	commandTag, err := h.DB.Exec(r.Context(), "delete from notes where id=$1 and user_id=$2", noteID, user.ID)
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

func decodeNote(req noteRequest) ([]byte, []byte, []byte, []byte, error) {
	titleCipher, err := base64.StdEncoding.DecodeString(req.TitleCipher)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	titleNonce, err := base64.StdEncoding.DecodeString(req.TitleNonce)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	textCipher, err := base64.StdEncoding.DecodeString(req.TextCipher)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	textNonce, err := base64.StdEncoding.DecodeString(req.TextNonce)
	if err != nil {
		return nil, nil, nil, nil, err
	}
	return titleCipher, titleNonce, textCipher, textNonce, nil
}
