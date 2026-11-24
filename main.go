package main

import (
	"embed"
	"encoding/json"
	"errors"
	"io"
	"io/fs"
	"log"
	"net/http"
	"os"
	"time"
)

//go:embed web/*.html web/assets/*
var webFiles embed.FS

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}
	server := &http.Server{
		Addr:              ":" + port,
		Handler:           routes(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      20 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
	log.Printf("Рандомайзер доступен на http://localhost:%s", port)
	log.Fatal(server.ListenAndServe())
}

func routes() http.Handler {
	assets, err := fs.Sub(webFiles, "web/assets")
	if err != nil {
		panic(err)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /{$}", page("web/index.html"))
	mux.HandleFunc("GET /settings", page("web/settings.html"))
	mux.Handle("GET /assets/", http.StripPrefix("/assets/", http.FileServerFS(assets)))
	mux.HandleFunc("POST /api/settings", numbersHandler(false))
	mux.HandleFunc("POST /api/draw", numbersHandler(true))
	return mux
}

func page(name string) http.HandlerFunc {
	contents, err := webFiles.ReadFile(name)
	if err != nil {
		panic(err)
	}
	return func(w http.ResponseWriter, _ *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		_, _ = w.Write(contents)
	}
}

type numberRequest struct {
	PoolText  string `json:"poolText"`
	QueueText string `json:"queueText"`
	QueueID   string `json:"queueID"`
	Position  int    `json:"position"`
}

type numberResponse struct {
	QueueID     string            `json:"queueID"`
	QueueLength int               `json:"queueLength"`
	Position    int               `json:"position"`
	Number      string            `json:"number,omitempty"`
	Frames      []string          `json:"frames,omitempty"`
	Error       string            `json:"error,omitempty"`
	Fields      map[string]string `json:"fields,omitempty"`
}

func numbersHandler(draw bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json; charset=utf-8")
		w.Header().Set("Cache-Control", "no-store")

		var request numberRequest
		body := http.MaxBytesReader(w, r.Body, 8<<20)
		data, err := io.ReadAll(body)
		var sizeError *http.MaxBytesError
		if errors.As(err, &sizeError) {
			writeResponse(w, http.StatusRequestEntityTooLarge, numberResponse{Error: "Список слишком большой. Сократи количество чисел."})
			return
		}
		if err != nil || json.Unmarshal(data, &request) != nil {
			writeResponse(w, http.StatusBadRequest, numberResponse{Error: "Не удалось прочитать настройки."})
			return
		}

		pool, poolError := parseNumbers(request.PoolText)
		queue, queueError := parseNumbers(request.QueueText)
		if poolError != nil || queueError != nil {
			response := numberResponse{Error: "Проверь числа в настройках."}
			if !draw {
				response.Fields = make(map[string]string)
				if poolError != nil {
					response.Fields["pool"] = poolError.Error()
				}
				if queueError != nil {
					response.Fields["queue"] = queueError.Error()
				}
			}
			writeResponse(w, http.StatusUnprocessableEntity, response)
			return
		}

		response := numberResponse{QueueID: queueID(queue), QueueLength: len(queue)}
		if request.QueueID == response.QueueID {
			response.Position = min(max(request.Position, 0), len(queue))
		}
		if draw {
			if response.Position == len(queue) && len(pool) == 0 {
				writeResponse(w, http.StatusUnprocessableEntity, numberResponse{Error: "Добавь числа в настройках."})
				return
			}
			if err := drawNumber(pool, queue, &response); err != nil {
				writeResponse(w, http.StatusInternalServerError, numberResponse{Error: "Не удалось выбрать число. Попробуй ещё раз."})
				return
			}
		}
		writeResponse(w, http.StatusOK, response)
	}
}

func writeResponse(w http.ResponseWriter, status int, response numberResponse) {
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(response)
}
