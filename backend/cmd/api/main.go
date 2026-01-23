package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"

	"passkeys/internal/db"
	"passkeys/internal/handlers"
	"passkeys/internal/middleware"
)

func main() {
	ctx := context.Background()
	pool, err := db.NewPool(ctx)
	if err != nil {
		log.Fatalf("db init failed: %v", err)
	}
	defer pool.Close()

	secret := os.Getenv("JWT_SECRET")
	if secret == "" {
		log.Fatal("JWT_SECRET is required")
	}

	authHandler := &handlers.AuthHandler{DB: pool, Secret: []byte(secret)}
	accountHandler := &handlers.AccountHandler{DB: pool}
	noteHandler := &handlers.NoteHandler{DB: pool}

	router := chi.NewRouter()
	router.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{"*"},
		AllowedMethods:   []string{"GET", "POST", "PUT", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type"},
		AllowCredentials: false,
		MaxAge:           300,
	}))

	router.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusOK)
	})

	router.Route("/auth", func(r chi.Router) {
		r.Post("/register", authHandler.Register)
		r.Post("/login", authHandler.Login)
		r.With(middleware.AuthMiddleware([]byte(secret))).Post("/password", authHandler.ChangePassword)
	})

	router.Route("/accounts", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware([]byte(secret)))
		r.Get("/", accountHandler.List)
		r.Post("/", accountHandler.Create)
		r.Put("/{id}", accountHandler.Update)
		r.Delete("/{id}", accountHandler.Delete)
	})

	router.Route("/notes", func(r chi.Router) {
		r.Use(middleware.AuthMiddleware([]byte(secret)))
		r.Get("/", noteHandler.List)
		r.Post("/", noteHandler.Create)
		r.Put("/{id}", noteHandler.Update)
		r.Delete("/{id}", noteHandler.Delete)
	})

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	server := &http.Server{
		Addr:              ":" + port,
		Handler:           router,
		ReadHeaderTimeout: 5 * time.Second,
	}

	log.Printf("API listening on :%s", port)
	if err := server.ListenAndServe(); err != nil {
		log.Fatal(err)
	}
}
