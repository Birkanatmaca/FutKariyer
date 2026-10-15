# Runtime image for the Go API. Binaries and the admin web build are produced
# before `docker compose build` by deploy/build.sh (static, linux/amd64).
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -H -u 10001 futcareer
WORKDIR /app
COPY bin/api bin/migrate bin/admin bin/seed /app/
COPY admin /app/admin-web
COPY entrypoint.sh /app/entrypoint.sh
USER futcareer
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
