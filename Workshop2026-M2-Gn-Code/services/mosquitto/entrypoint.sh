#!/bin/sh
# Genere les comptes MQTT depuis les variables d'environnement, puis demarre mosquitto.
# Deux comptes : publication (auth-service) et lecture seule (ESP8266), chacun limite
# a l'unique sujet swap/backoffice/led par l'ACL.
set -e
CONF=/mosquitto/config
TOPIC=swap/backoffice/led

mosquitto_passwd -b -c "$CONF/passwd" "$MQTT_PUB_USER" "$MQTT_PUB_PASS"
mosquitto_passwd -b    "$CONF/passwd" "$MQTT_ESP_USER" "$MQTT_ESP_PASS"

cat > "$CONF/acl" <<EOF
user $MQTT_PUB_USER
topic readwrite $TOPIC

user $MQTT_ESP_USER
topic read $TOPIC
EOF

chmod 0700 "$CONF/passwd" "$CONF/acl" 2>/dev/null || true

cat > "$CONF/mosquitto.conf" <<EOF
listener 1883
allow_anonymous false
password_file $CONF/passwd
acl_file $CONF/acl
persistence false
log_dest stdout
EOF

exec mosquitto -c "$CONF/mosquitto.conf"
