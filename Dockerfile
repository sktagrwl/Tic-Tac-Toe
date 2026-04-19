# Stage 1 — compile the Go plugin
FROM heroiclabs/nakama-pluginbuilder:3.25.0 AS builder
WORKDIR /backend
COPY server/ .
RUN go build --trimpath --mod=vendor -buildmode=plugin -o backend.so .

# Stage 2 — Nakama runtime
FROM heroiclabs/nakama:3.25.0
COPY --from=builder /backend/backend.so /nakama/data/modules/backend.so
COPY nakama-config.yml /nakama/data/nakama-config.yml

EXPOSE 7349 7350 7351
