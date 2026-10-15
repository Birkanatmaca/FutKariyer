#!/bin/sh
# Apply pending migrations, then start the API. The API refuses to start on an outdated schema.
set -e
/app/migrate up
exec /app/api
