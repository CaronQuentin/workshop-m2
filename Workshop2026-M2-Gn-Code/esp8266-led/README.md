# Module ESP8266 — LED d'état du back-office

Reflète en temps réel l'état du parcours d'authentification 2FA (publié par `auth-service`
sur MQTT). Consigne additionnelle 1.

## Matériel

- Une carte **ESP8266** (NodeMCU v2, ou Wemos/LOLIN D1 mini).
- Une **LED bicolore à cathode commune** (3 pattes : vert, rouge, cathode commune).
- **2 résistances de 220 Ω**.

### Câblage

| LED | Via | Vers |
|---|---|---|
| Anode VERTE | résistance 220 Ω | **D1** (GPIO5) |
| Anode ROUGE | résistance 220 Ω | **D2** (GPIO4) |
| Cathode commune | — | **GND** |

(Broches modifiables dans `config.h`. Pour une LED à **anode** commune, inversez la
logique : commune au 3V3 et niveaux inversés dans le code.)

## Flasher le firmware

1. Installez **PlatformIO** (extension VS Code, ou plugin CLion).
2. Copiez `include/config.example.h` en **`include/config.h`** et renseignez :
   - `WIFI_SSID` / `WIFI_PASSWORD` : le point d'accès du groupe (ex. `RESILIENCE-Gn`).
   - `MQTT_HOST` : l'IP du PC Hôte sur ce réseau (par défaut `192.168.137.1`).
   - `MQTT_USER` / `MQTT_PASS` : `esp-led` et la valeur `MQTT_ESP_PASS` du `.env` du PC Hôte.
3. Branchez l'ESP en USB, puis **Upload** (PlatformIO : « Upload »).
4. Ouvrez le **moniteur série** (115200 bauds) pour voir la connexion Wi-Fi/MQTT.

## États affichés

| Message MQTT | LED |
|---|---|
| `OFF` | éteinte |
| `GREEN_BLINK` | vert clignotant (visage reconnu, attente du mot de passe) |
| `GREEN_30S` | vert fixe 30 s (accès accordé) |
| `RED_BLINK_10` | rouge, 10 clignotements (échec) |
| `RED_30S` | rouge fixe 30 s (back-office bloqué) |

## Sécurité

- Le compte MQTT `esp-led` est **en lecture seule** sur l'unique sujet `swap/backoffice/led`
  (ACL du broker). Il ne peut rien publier.
- Les identifiants sont dans `config.h`, **non versionné**.
- Si le Wi-Fi tombe, la LED s'éteint et l'ESP se reconnecte automatiquement.

## Tester sans la carte

Depuis le PC Hôte, on peut simuler les états en publiant sur le sujet :
```bash
docker compose exec mosquitto mosquitto_pub -h localhost -u auth-pub -P <MQTT_PUB_PASS> \
  -t swap/backoffice/led -m GREEN_30S
```
