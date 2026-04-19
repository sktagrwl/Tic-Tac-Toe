FROM heroiclabs/nakama:3.25.0
COPY server/backend.so /nakama/data/modules/backend.so
COPY nakama-config.yml /nakama/data/nakama-config.yml

EXPOSE 7349 7350 7351
