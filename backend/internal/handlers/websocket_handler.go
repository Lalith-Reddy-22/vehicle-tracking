package handlers

import (
	"net/http"

	"github.com/gorilla/websocket"
	ws "github.com/mapup/vehicle-tracking/internal/websocket"
	"github.com/rs/zerolog/log"
)

// WSHandler handles the /ws/alerts WebSocket upgrade.
type WSHandler struct {
	hub      *ws.Hub
	upgrader websocket.Upgrader
}

// NewWSHandler creates a new WSHandler.
func NewWSHandler(hub *ws.Hub, allowedOrigins []string) *WSHandler {
	originSet := make(map[string]struct{}, len(allowedOrigins))
	for _, o := range allowedOrigins {
		originSet[o] = struct{}{}
	}

	return &WSHandler{
		hub: hub,
		upgrader: websocket.Upgrader{
			ReadBufferSize:  1024,
			WriteBufferSize: 1024,
			// CheckOrigin controls CORS for WebSocket upgrades.
			// We use the same allowed-origins list as HTTP.
			CheckOrigin: func(r *http.Request) bool {
				origin := r.Header.Get("Origin")
				if origin == "" {
					return true // allow same-origin requests
				}
				_, ok := originSet[origin]
				return ok
			},
		},
	}
}

// ServeWS handles GET /ws/alerts.
func (h *WSHandler) ServeWS(w http.ResponseWriter, r *http.Request) {
	conn, err := h.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Error().Err(err).Msg("ws upgrade failed")
		return
	}

	client := h.hub.NewClient(conn)

	// Each client needs two goroutines:
	//   writePump — delivers messages from the hub to the WebSocket
	//   readPump  — drains incoming frames and handles pong/close
	go client.WritePump()
	go client.ReadPump()
}
