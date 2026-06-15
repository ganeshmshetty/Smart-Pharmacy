    /*
     * ================================================================
     *  Smart Pharmacy Shelf System — ESP32 Firmware
     *  pharmacy_shelf_local_broker.ino
     * ================================================================
     *
     *  HARDWARE:
     *    - ESP32 Dev Module
     *    - RC522 RFID Reader (SPI)      ← temporarily disabled below
     *    - 2× Traffic LED Modules (Red / Yellow / Green per module)
     *    - 2× Servo Motors (SG90 or similar)
     *
     *  COMPARTMENT LOGIC:
     *    ┌──────────────┬────────────────────────────────────────────────────────┐
     *    │ Compartment  │ RFID_ENABLED 1 (normal)    RFID_ENABLED 0 (temporary) │
     *    ├──────────────┼────────────────────────────────────────────────────────┤
     *    │ 1  NORMAL    │ LED Green → Servo opens (5 s)  — unchanged             │
     *    │ 2  SENSITIVE │ Orange → RFID → Green → Open  │ Orange → Green → Open  │
     *    └──────────────┴────────────────────────────────────────────────────────┘
     *
     *  MQTT TOPICS:
     *    Subscribe → pharmacy/dispense
     *      Payload: {"compartment": 1}       activate normal
     *               {"compartment": 2}       activate sensitive
     *               {"reset": true}          lock everything
     *
     *    Publish  → pharmacy/status
     *      Payload: {"compartment":N, "status":"<event>"}
     *      Events:  online | open | closed | rfid_required |
     *               rfid_denied | rfid_timeout | rfid_disabled
     *
     *  WIRING SUMMARY:
     *    ── RC522 RFID (SPI) ────────────────────────────────────
     *      VCC  → 3.3 V        GND  → GND
     *      SCK  → GPIO 18      MISO → GPIO 19
     *      MOSI → GPIO 23      SDA/SS → GPIO 5
     *      RST  → GPIO 4
     *
     *    ── Traffic LED Module 1 (Normal compartment) ───────────
     *      Red pin    → GPIO 32  (220 Ω in series)
     *      Yellow pin → GPIO 33  (220 Ω in series)
     *      Green pin  → GPIO 25  (220 Ω in series)
     *      GND        → GND  (common cathode module)
     *
     *    ── Traffic LED Module 2 (Sensitive compartment) ────────
     *      Red pin    → GPIO 14  (220 Ω in series)
     *      Yellow pin → GPIO 26  (220 Ω in series)
     *      Green pin  → GPIO 27  (220 Ω in series)
     *      GND        → GND
     *
     *    ── Servo 1 (Normal compartment latch) ──────────────────
     *      Signal → GPIO 13    VCC → 5 V (ext.)    GND → GND
     *
     *    ── Servo 2 (Sensitive compartment latch) ───────────────
     *      Signal → GPIO 12    VCC → 5 V (ext.)    GND → GND
     *
     *  REQUIRED LIBRARIES (Arduino Library Manager):
     *    • PubSubClient     by Nick O'Leary
     *    • MFRC522          by GithubCommunity
     *    • ESP32Servo       by Kevin Harrington
     *    • ArduinoJson      by Benoit Blanchon
     * ================================================================
     */

    // ════════════════════════════════════════════════════════════
    //  FEATURE FLAG
    //  Set to 1 once the RFID sensor is ready and wired up.
    //  Set to 0 to disable RFID entirely — everything else works
    //  normally; the sensitive compartment skips the badge step
    //  and opens directly after the orange indicator.
    // ════════════════════════════════════════════════════════════
    #define RFID_ENABLED 0   // change to 1 when RFID sensor is ready

    // ════════════════════════════════════════════════════════════
    //  INCLUDES
    // ════════════════════════════════════════════════════════════

    #include <WiFi.h>
    #include <PubSubClient.h>
    #include <ESP32Servo.h>
    #include <ArduinoJson.h>

    #if RFID_ENABLED
      #include <SPI.h>
      #include <MFRC522.h>
    #endif

    // ════════════════════════════════════════════════════════════
    //  USER CONFIGURATION
    // ════════════════════════════════════════════════════════════

    // WiFi
    const char* WIFI_SSID     = "No Internet";
    const char* WIFI_PASSWORD = "GM123456";

    // Local Mosquitto Broker
    const char* MQTT_BROKER    = "10.94.96.217";
    const int   MQTT_PORT      = 1883;
    const char* MQTT_CLIENT_ID = "pharmacy-esp32-shelf-01";

    // MQTT topics
    const char* TOPIC_DISPENSE = "pharmacy/dispense";
    const char* TOPIC_STATUS   = "pharmacy/status";

    // Authorized RFID UID for the pharmacist's staff badge.
    // Flash scan_uid_helper.ino first, scan your tag, then paste
    // the 4 bytes here. Example: { 0xA1, 0xB2, 0xC3, 0xD4 }
    const byte AUTHORIZED_UID[]   = { 0xDE, 0xAD, 0xBE, 0xEF };
    const byte AUTHORIZED_UID_LEN = 4;

    // Servo angles
    const int SERVO_LOCKED   = 0;    // Compartment closed
    const int SERVO_UNLOCKED = 90;   // Compartment open

    // Timing
    const unsigned long RFID_WAIT_TIMEOUT_MS = 30000UL;  // 30 s to scan badge
    const unsigned long COMPARTMENT_OPEN_MS   = 5000UL;   // 5 s servo stays open
    const unsigned long RFID_DENY_FLASH_MS    = 1000UL;   // Red flash on bad badge

    // ════════════════════════════════════════════════════════════
    //  PIN DEFINITIONS
    // ════════════════════════════════════════════════════════════

    // RFID RC522 (SPI — SCK=18, MISO=19, MOSI=23 are fixed by hardware)
    #define RFID_SS_PIN   5
    #define RFID_RST_PIN  4

    // Traffic LED Module 1 — Normal compartment
    #define LED1_RED    32
    #define LED1_YELLOW 33   // amber/orange channel
    #define LED1_GREEN  25

    // Traffic LED Module 2 — Sensitive compartment
    #define LED2_RED    14
    #define LED2_YELLOW 26   // amber/orange channel
    #define LED2_GREEN  27

    // Servo motors
    #define SERVO1_PIN  13   // Normal compartment latch
    #define SERVO2_PIN  12   // Sensitive compartment latch

    // ════════════════════════════════════════════════════════════
    //  STATE MACHINE
    // ════════════════════════════════════════════════════════════

    enum CompartmentState : uint8_t {
      IDLE,              // Shelf closed, waiting for prescription
      NORMAL_ACTIVE,     // LED green + servo open (auto-closes after timeout)
      SENSITIVE_PENDING, // LED orange + waiting for RFID (or auto-open if disabled)
      SENSITIVE_OPEN     // LED green + servo open (auto-closes after timeout)
    };

    CompartmentState comp1State = IDLE;
    CompartmentState comp2State = IDLE;
    unsigned long    comp1Timer = 0;
    unsigned long    comp2Timer = 0;

    #if RFID_ENABLED
    unsigned long denyTimer = 0;
    bool          denyFlash = false;  // true while red-flash is active
    #endif

    // ════════════════════════════════════════════════════════════
    //  OBJECTS
    // ════════════════════════════════════════════════════════════

    #if RFID_ENABLED
      MFRC522 rfid(RFID_SS_PIN, RFID_RST_PIN);
    #endif

    Servo              servo1, servo2;
    WiFiClient         wifiClient;
    PubSubClient       mqtt(wifiClient);

    // ════════════════════════════════════════════════════════════
    //  LED HELPERS
    // ════════════════════════════════════════════════════════════

    void setLED1(bool r, bool y, bool g) {
      digitalWrite(LED1_RED,    r ? HIGH : LOW);
      digitalWrite(LED1_YELLOW, y ? HIGH : LOW);
      digitalWrite(LED1_GREEN,  g ? HIGH : LOW);
    }

    void setLED2(bool r, bool y, bool g) {
      digitalWrite(LED2_RED,    r ? HIGH : LOW);
      digitalWrite(LED2_YELLOW, y ? HIGH : LOW);
      digitalWrite(LED2_GREEN,  g ? HIGH : LOW);
    }

    inline void led1Off()    { setLED1(false, false, false); }
    inline void led1Green()  { setLED1(false, false, true);  }
    inline void led1Orange() { setLED1(false, true,  false); }
    inline void led1Red()    { setLED1(true,  false, false); }

    inline void led2Off()    { setLED2(false, false, false); }
    inline void led2Green()  { setLED2(false, false, true);  }
    inline void led2Orange() { setLED2(false, true,  false); }
    inline void led2Red()    { setLED2(true,  false, false); }

    // ════════════════════════════════════════════════════════════
    //  MQTT STATUS PUBLISHER
    // ════════════════════════════════════════════════════════════

    void publishStatus(int compartment, const char* status) {
      StaticJsonDocument<128> doc;
      doc["compartment"] = compartment;
      doc["status"]      = status;

      char buf[128];
      size_t n = serializeJson(doc, buf, sizeof(buf));
      if (n > 0) {
        mqtt.publish(TOPIC_STATUS, buf, true);  // retained = true
        Serial.printf("[MQTT ↑] %s\n", buf);
      }
    }

    // ════════════════════════════════════════════════════════════
    //  RFID HELPERS  (compiled only when RFID_ENABLED = 1)
    // ════════════════════════════════════════════════════════════

    #if RFID_ENABLED

    bool isAuthorizedTag() {
      if (rfid.uid.size != AUTHORIZED_UID_LEN) return false;
      for (byte i = 0; i < AUTHORIZED_UID_LEN; i++) {
        if (rfid.uid.uidByte[i] != AUTHORIZED_UID[i]) return false;
      }
      return true;
    }

    void printScannedUID() {
      Serial.print("[RFID] UID: ");
      for (byte i = 0; i < rfid.uid.size; i++) {
        Serial.printf("%02X ", rfid.uid.uidByte[i]);
      }
      Serial.println();
    }

    #endif  // RFID_ENABLED

    // ════════════════════════════════════════════════════════════
    //  COMPARTMENT 1 — Normal
    // ════════════════════════════════════════════════════════════

    void activateNormal() {
      Serial.println("[C1] Prescription received → opening normal compartment.");
      comp1State = NORMAL_ACTIVE;
      comp1Timer = millis();
      led1Green();
      servo1.write(SERVO_UNLOCKED);
      publishStatus(1, "open");
    }

    void closeNormal() {
      Serial.println("[C1] Auto-closing normal compartment.");
      comp1State = IDLE;
      led1Off();
      servo1.write(SERVO_LOCKED);
      publishStatus(1, "closed");
    }

    // ════════════════════════════════════════════════════════════
    //  COMPARTMENT 2 — Sensitive
    // ════════════════════════════════════════════════════════════

    void activateSensitive() {
    #if RFID_ENABLED
      Serial.println("[C2] Prescription received → orange, awaiting RFID.");
      publishStatus(2, "rfid_required");
    #else
      Serial.println("[C2] Prescription received → RFID disabled, opening directly.");
      publishStatus(2, "rfid_disabled");
    #endif

      comp2State = SENSITIVE_PENDING;
      comp2Timer = millis();
      led2Orange();
      servo2.write(SERVO_LOCKED);  // Ensure locked while showing orange
    }

    void openSensitive() {
      Serial.println("[C2] Opening sensitive compartment.");
      comp2State = SENSITIVE_OPEN;
      comp2Timer = millis();
      led2Green();
      servo2.write(SERVO_UNLOCKED);
      publishStatus(2, "open");
    }

    void closeSensitive() {
      Serial.println("[C2] Auto-closing sensitive compartment.");
      comp2State = IDLE;
      led2Off();
      servo2.write(SERVO_LOCKED);
      publishStatus(2, "closed");
    }

    #if RFID_ENABLED
    void timeoutSensitive() {
      Serial.println("[C2] RFID timeout — locking sensitive compartment.");
      comp2State = IDLE;
      led2Off();
      servo2.write(SERVO_LOCKED);
      publishStatus(2, "rfid_timeout");
    }
    #endif

    // ════════════════════════════════════════════════════════════
    //  MQTT CALLBACK (incoming prescriptions)
    // ════════════════════════════════════════════════════════════

    void mqttCallback(char* topic, byte* payload, unsigned int len) {
      Serial.printf("\n[MQTT ↓] Topic: %s\n", topic);

      StaticJsonDocument<200> doc;
      DeserializationError err = deserializeJson(doc, payload, len);
      if (err) {
        Serial.printf("[MQTT] JSON error: %s\n", err.c_str());
        return;
      }

      // Reset command
      if (doc["reset"].as<bool>()) {
        Serial.println("[MQTT] Reset received — locking all compartments.");
        closeNormal();
        closeSensitive();
        return;
      }

      // Dispense command
      if (!doc.containsKey("compartment")) {
        Serial.println("[MQTT] Missing 'compartment' key — ignoring.");
        return;
      }

      int comp = doc["compartment"].as<int>();
      Serial.printf("[MQTT] Dispense request → compartment %d\n", comp);

      if (comp == 1) {
        if (comp1State == IDLE) {
          activateNormal();
        } else {
          Serial.println("[C1] Already active — ignoring duplicate.");
        }
      } else if (comp == 2) {
        if (comp2State == IDLE) {
          activateSensitive();
        } else {
          Serial.println("[C2] Already active — ignoring duplicate.");
        }
      } else {
        Serial.printf("[MQTT] Unknown compartment number: %d\n", comp);
      }
    }

    // ════════════════════════════════════════════════════════════
    //  WiFi / MQTT CONNECT
    // ════════════════════════════════════════════════════════════

    void connectWiFi() {
      if (WiFi.status() == WL_CONNECTED) return;

      Serial.printf("[WiFi] Connecting to %s", WIFI_SSID);
      WiFi.mode(WIFI_STA);
      WiFi.begin(WIFI_SSID, WIFI_PASSWORD);

      while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
      }

      Serial.printf("\n[WiFi] Connected  IP: %s\n", WiFi.localIP().toString().c_str());
    }

    void connectMQTT() {
      while (!mqtt.connected()) {
        Serial.printf("[MQTT] Connecting to %s ...", MQTT_BROKER);

        if (mqtt.connect(MQTT_CLIENT_ID)) {
          Serial.println(" OK");
          mqtt.subscribe(TOPIC_DISPENSE);
          Serial.printf("[MQTT] Subscribed → %s\n", TOPIC_DISPENSE);
          publishStatus(0, "online");
        } else {
          Serial.printf(" Failed (rc=%d)  retrying in 3 s\n", mqtt.state());
          delay(3000);
        }
      }
    }

    // ════════════════════════════════════════════════════════════
    //  SETUP
    // ════════════════════════════════════════════════════════════

    void setup() {
      Serial.begin(115200);
      delay(200);

      Serial.println();
      Serial.println("╔══════════════════════════════════════════╗");
      Serial.println("║   Smart Pharmacy Shelf System — Boot     ║");
      Serial.println("╚══════════════════════════════════════════╝");

    #if RFID_ENABLED
      Serial.println("[RFID]  Feature: ENABLED");
    #else
      Serial.println("[RFID]  Feature: DISABLED (set RFID_ENABLED 1 to re-enable)");
    #endif

      // LED pins
      const uint8_t ledPins[] = {
        LED1_RED, LED1_YELLOW, LED1_GREEN,
        LED2_RED, LED2_YELLOW, LED2_GREEN
      };
      for (uint8_t pin : ledPins) {
        pinMode(pin, OUTPUT);
        digitalWrite(pin, LOW);
      }
      Serial.println("[LED]   All pins initialized — OFF.");

      // Servos
      ESP32PWM::allocateTimer(0);
      ESP32PWM::allocateTimer(1);
      servo1.setPeriodHertz(50);
      servo2.setPeriodHertz(50);
      servo1.attach(SERVO1_PIN, 500, 2400);
      servo2.attach(SERVO2_PIN, 500, 2400);
      servo1.write(SERVO_LOCKED);
      servo2.write(SERVO_LOCKED);
      Serial.println("[Servo] Both servos initialized — LOCKED.");

      // RFID
    #if RFID_ENABLED
      SPI.begin();
      rfid.PCD_Init();
      Serial.println("[RFID]  RC522 initialized.");
      rfid.PCD_DumpVersionToSerial();
    #endif

      // Network
      connectWiFi();

      mqtt.setServer(MQTT_BROKER, MQTT_PORT);
      mqtt.setCallback(mqttCallback);
      mqtt.setBufferSize(512);
      connectMQTT();

      Serial.println("[System] Ready and listening.\n");
    }

    // ════════════════════════════════════════════════════════════
    //  LOOP
    // ════════════════════════════════════════════════════════════

    void loop() {
      // Keep connections alive
      if (WiFi.status() != WL_CONNECTED) connectWiFi();
      if (!mqtt.connected()) connectMQTT();
      mqtt.loop();

      unsigned long now = millis();

      // Compartment 1 timer
      if (comp1State == NORMAL_ACTIVE && (now - comp1Timer >= COMPARTMENT_OPEN_MS)) {
        closeNormal();
      }

      // Compartment 2 state machine
      if (comp2State == SENSITIVE_PENDING) {

    #if RFID_ENABLED
        // RFID path

        // 1. Check for RFID timeout first
        if (now - comp2Timer >= RFID_WAIT_TIMEOUT_MS) {
          timeoutSensitive();
          return;
        }

        // 2. Don't read RFID while deny-flash is active
        if (denyFlash) {
          if (now - denyTimer >= RFID_DENY_FLASH_MS) {
            denyFlash = false;
            led2Orange();  // Return to waiting colour
          }
          return;
        }

        // 3. Poll for a new RFID card
        if (rfid.PICC_IsNewCardPresent() && rfid.PICC_ReadCardSerial()) {
          printScannedUID();

          if (isAuthorizedTag()) {
            openSensitive();
          } else {
            Serial.println("[RFID]  Unauthorized tag — access DENIED.");
            publishStatus(2, "rfid_denied");
            led2Red();
            denyFlash = true;
            denyTimer = now;
          }

          rfid.PICC_HaltA();
          rfid.PCD_StopCrypto1();
        }

    #else
        // RFID disabled path
        // Show orange briefly, then open automatically.
        if (now - comp2Timer >= COMPARTMENT_OPEN_MS) {
          openSensitive();
        }
    #endif
      }

      // Auto-close sensitive compartment
      if (comp2State == SENSITIVE_OPEN && (now - comp2Timer >= COMPARTMENT_OPEN_MS)) {
        closeSensitive();
      }
    }