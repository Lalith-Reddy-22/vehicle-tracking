// Package utils provides lightweight HTTP response helpers.
// All handlers write JSON through these helpers to ensure consistent structure.
package utils

import (
	"encoding/json"
	"net/http"
)

// ErrorResponse is the standard error envelope.
// time_ns is added by the timing middleware after the handler returns.
type ErrorResponse struct {
	Error   string `json:"error"`
	Message string `json:"message,omitempty"`
}

// JSON writes v as a JSON response with the given status code.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(v); err != nil {
		// If encoding fails there is nothing sensible we can do — the
		// response headers are already sent.
		http.Error(w, `{"error":"internal encoding error"}`, http.StatusInternalServerError)
	}
}

// Error writes a JSON error response.
func Error(w http.ResponseWriter, status int, err string, msg ...string) {
	resp := ErrorResponse{Error: err}
	if len(msg) > 0 {
		resp.Message = msg[0]
	}
	JSON(w, status, resp)
}

// InternalError writes a generic 500 without leaking internal details.
func InternalError(w http.ResponseWriter) {
	Error(w, http.StatusInternalServerError, "internal_server_error", "An unexpected error occurred")
}
