# Stage 1: Compile the Go plugin for Linux AMD64
FROM heroiclabs/nakama-pluginbuilder:3.25.0 AS builder
ENV GOTOOLCHAIN=local
WORKDIR /backend
COPY server/ .
RUN go build --trimpath --mod=vendor -buildmode=plugin -o ./backend.so .

# Stage 2: Production Nakama image
FROM heroiclabs/nakama:3.25.0
COPY --from=builder /backend/backend.so /nakama/data/modules/backend.so
COPY nakama-config.yml /nakama/data/nakama-config.yml
EXPOSE 7349 7350 7351
