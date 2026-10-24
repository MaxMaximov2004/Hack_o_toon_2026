# ====== BUILD ======
FROM golang:1.22-alpine AS builder

RUN apk --no-cache add git ca-certificates

WORKDIR /app

COPY go.mod go.sum ./
RUN go mod download

COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-w -s" -o /auth-service ./cmd/server

# ====== RUN ======
FROM alpine:3.20

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

COPY --from=builder /auth-service /app/auth-service

RUN mkdir -p /keys

EXPOSE 8081

ENTRYPOINT ["/app/auth-service"]
