/*
 * ESP8266 — LED bicolore d'état du parcours d'authentification back-office.
 *
 * S'abonne au sujet MQTT publié par auth-service et reflète l'état :
 *   OFF           éteinte
 *   GREEN_BLINK   vert clignotant   (visage reconnu, en attente du mot de passe)
 *   GREEN_30S     vert fixe 30 s    (accès accordé)
 *   RED_BLINK_10  rouge 10 clign.   (échec)
 *   RED_30S       rouge fixe 30 s   (back-office bloqué)
 *
 * Les durées et animations sont gérées ici, sans bloquer la boucle (millis()).
 * Si le Wi-Fi tombe, la LED revient à l'état éteint et l'ESP se reconnecte.
 */
#include <ESP8266WiFi.h>
#include <PubSubClient.h>
#include "config.h"

WiFiClient net;
PubSubClient mqtt(net);

enum LedState { OFF, GREEN_BLINK, GREEN_30S, RED_BLINK_10, RED_30S };
LedState state = OFF;
unsigned long stateStart = 0, lastBlink = 0, lastReconnect = 0;
bool blinkOn = false;
int blinkCount = 0;

void setLeds(bool green, bool red) {
  digitalWrite(PIN_GREEN, green ? HIGH : LOW);
  digitalWrite(PIN_RED, red ? HIGH : LOW);
}

void setState(LedState s) {
  state = s;
  stateStart = lastBlink = millis();
  blinkOn = false;
  blinkCount = 0;
  if (s == OFF)            setLeds(false, false);
  else if (s == GREEN_30S) setLeds(true, false);
  else if (s == RED_30S)   setLeds(false, true);
  // les états clignotants sont animés dans loop()
}

void onMessage(char *topic, byte *payload, unsigned int len) {
  String m;
  for (unsigned i = 0; i < len; i++) m += (char)payload[i];
  Serial.print("MQTT <- "); Serial.println(m);
  if (m == "OFF")               setState(OFF);
  else if (m == "GREEN_BLINK")  setState(GREEN_BLINK);
  else if (m == "GREEN_30S")    setState(GREEN_30S);
  else if (m == "RED_BLINK_10") setState(RED_BLINK_10);
  else if (m == "RED_30S")      setState(RED_30S);
}

void connectMqtt() {
  Serial.print("MQTT connexion… ");
  if (mqtt.connect("esp8266-led", MQTT_USER, MQTT_PASS)) {
    mqtt.subscribe(MQTT_TOPIC);   // l'état retenu (retain) est reçu aussitôt
    Serial.println("OK");
  } else {
    Serial.print("échec rc="); Serial.println(mqtt.state());
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(PIN_GREEN, OUTPUT);
  pinMode(PIN_RED, OUTPUT);

  // Auto-test de câblage au démarrage : vert ~0,6 s, puis rouge ~0,6 s.
  Serial.println("\nAuto-test LED : vert puis rouge...");
  setLeds(true, false); delay(600);
  setLeds(false, true); delay(600);
  setLeds(false, false);

  setState(OFF);
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setCallback(onMessage);
}

void loop() {
  // Wi-Fi perdu -> LED éteinte, on laisse la pile se reconnecter.
  if (WiFi.status() != WL_CONNECTED) {
    if (state != OFF) setState(OFF);
    delay(200);
    return;
  }
  // MQTT : reconnexion non bloquante.
  if (!mqtt.connected()) {
    if (millis() - lastReconnect > 2000) { lastReconnect = millis(); connectMqtt(); }
  } else {
    mqtt.loop();
  }

  // Animations (non bloquantes).
  unsigned long now = millis();
  switch (state) {
    case GREEN_BLINK:
      if (now - lastBlink > 400) { lastBlink = now; blinkOn = !blinkOn; setLeds(blinkOn, false); }
      break;
    case RED_BLINK_10:
      if (now - lastBlink > 250) {
        lastBlink = now; blinkOn = !blinkOn; setLeds(false, blinkOn);
        if (blinkOn && ++blinkCount >= 10) setState(OFF);
      }
      break;
    case GREEN_30S:
    case RED_30S:
      if (now - stateStart > 30000) setState(OFF);
      break;
    default:
      break;
  }
}
