package handlers

import (
	"encoding/json"
	"net/http"
)

type ApiResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
	Meta    interface{} `json:"meta,omitempty"`
}

func JSON(w http.ResponseWriter, status int, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ApiResponse{Success: status < 400, Data: data}) //nolint:errcheck
}

func Err(w http.ResponseWriter, status int, msg string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(ApiResponse{Success: false, Error: msg}) //nolint:errcheck
}

func Decode(r *http.Request, dst interface{}) error {
	return json.NewDecoder(r.Body).Decode(dst)
}
