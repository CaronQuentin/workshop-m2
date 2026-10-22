// Copiez ce fichier en config.h et renseignez vos valeurs.
// config.h N'EST PAS versionné (voir .gitignore) — il contient les identifiants.
#pragma once

// --- Wi-Fi du groupe (point d'accès Windows) ---
#define WIFI_SSID      "RESILIENCE-Gn"
#define WIFI_PASSWORD  "mot-de-passe-wifi"

// --- Broker MQTT = PC Hôte ---
// IP du PC Hôte sur le point d'accès (par défaut 192.168.137.1).
#define MQTT_HOST      "192.168.137.1"
#define MQTT_PORT      1883
#define MQTT_USER      "esp-led"
#define MQTT_PASS      "dev_mqtt_esp_pass"     // = MQTT_ESP_PASS du .env du PC Hôte
#define MQTT_TOPIC     "swap/backoffice/led"

// --- Câblage LED bicolore (cathode commune -> GND, anodes via 220 Ohm) ---
#define PIN_GREEN      D1    // GPIO5
#define PIN_RED        D2    // GPIO4
