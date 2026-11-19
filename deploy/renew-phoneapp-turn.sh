#!/bin/sh
set -eu
# Certbot deploy hook. Other certificate renewals do not touch this service.
if [ "${RENEWED_LINEAGE:-}" != /etc/letsencrypt/live/phoneapp.bawebtech.com ]; then
    exit 0
fi
install -d -o root -g turnserver -m 750 /etc/phoneapp/tls
install -o root -g turnserver -m 640 "$RENEWED_LINEAGE/fullchain.pem" /etc/phoneapp/tls/fullchain.pem
install -o root -g turnserver -m 640 "$RENEWED_LINEAGE/privkey.pem" /etc/phoneapp/tls/privkey.pem
nginx -t
systemctl reload nginx
if [ -f /etc/systemd/system/phoneapp-turn.service ]; then
    systemctl try-restart phoneapp-turn.service
fi
