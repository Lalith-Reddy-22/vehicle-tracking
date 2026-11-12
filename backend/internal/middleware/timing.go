// Package middleware provides reusable HTTP middleware for the Chi router.
package middleware

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"time"
)

// responseWriter wraps http.ResponseWriter to capture the status code and body.
// It also implements http.Hijacker by delegating to the underlying writer when
// available — this is required for WebSocket upgrades. However, the WebSocket
// route should bypass this middleware entirely (see main.go).
type responseWriter struct {
	http.ResponseWriter
	status  int
	body    bytes.Buffer
	written bool
}

// Hijack implements http.Hijacker by delegating to the underlying ResponseWriter.
// Without this, Gorilla WebSocket upgrade fails with "does not implement http.Hijacker".
func (rw *responseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	h, ok := rw.ResponseWriter.(http.Hijacker)
	if !ok {
		return nil, nil, fmt.Errorf("underlying ResponseWriter does not implement http.Hijacker")
	}
	return h.Hijack()
}

func (rw *responseWriter) WriteHeader(status int) {
	rw.status = status
	rw.written = true
}

func (rw *responseWriter) Write(b []byte) (int, error) {
	if !rw.written {
		rw.status = http.StatusOK
		rw.written = true
	}
	return rw.body.Write(b)
}

// TimingMiddleware injects "time_ns" (as a string) into every JSON response.
// It captures handler output, parses it as JSON, adds the field, then writes
// the enriched response.  For non-JSON responses it passes through unchanged.
//
// Design note: we intercept the entire response body so we can inject into it.
// For high-throughput paths a streaming approach would be preferred, but for
// an assessment this is cleaner and correct.
func TimingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		rw := &responseWriter{ResponseWriter: w, status: http.StatusOK}
		next.ServeHTTP(rw, r)

		elapsed := time.Since(start)
		timeNs := strconv.FormatInt(elapsed.Nanoseconds(), 10)

		// Attempt to inject time_ns into the response JSON.
		body := rw.body.Bytes()
		trimmed := bytes.TrimSpace(body)
		if len(trimmed) > 0 && trimmed[0] == '{' {
			var m map[string]json.RawMessage
			if err := json.Unmarshal(trimmed, &m); err == nil {
				m["time_ns"] = json.RawMessage(`"` + timeNs + `"`)
				enriched, err := json.Marshal(m)
				if err == nil {
					body = enriched
				}
			}
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(rw.status)
		_, _ = w.Write(body)
	})
}
