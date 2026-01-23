FROM golang:1.22-alpine AS builder

WORKDIR /app

COPY backend/go.mod backend/go.sum ./
RUN go mod download

COPY backend/ ./

ENV CGO_ENABLED=0
RUN go build -o /app/server ./cmd/api

FROM alpine:3.20
WORKDIR /app
RUN apk add --no-cache ca-certificates

COPY --from=builder /app/server /app/server

EXPOSE 8080
CMD ["/app/server"]
