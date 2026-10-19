# Runtime image for the Go API. Binaries and the admin web build are produced
# before `docker compose build` by deploy/build.sh (static, linux/amd64).
FROM alpine:3.20
RUN apk add --no-cache ca-certificates tzdata && adduser -D -H -u 10001 futcareer
WORKDIR /app
# Builds made on Windows carry no execute bit through tar, so set it here.
COPY --chmod=0755 bin/api bin/migrate bin/admin bin/seed /app/
COPY admin /app/admin-web
COPY --chmod=0755 entrypoint.sh /app/entrypoint.sh
USER futcareer
EXPOSE 8080
ENTRYPOINT ["/app/entrypoint.sh"]
