# ── Build stage ──────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install build tools
RUN apk add --no-cache git ca-certificates tzdata

# Cache dependencies first (layer cache optimization)
COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux \
    go build -ldflags="-s -w" -o /app/server ./cmd/api

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM alpine:3.20

WORKDIR /app

RUN apk add --no-cache ca-certificates tzdata

COPY --from=builder /app/server .
COPY --from=builder /app/migrations ./migrations

EXPOSE 8080

ENTRYPOINT ["/app/server"]
