# Smart Pharmacy IoT System

A comprehensive IoT solution that pairs a Next.js web application with an ESP32-based smart shelf to securely and efficiently dispense medications. The system leverages real-time MQTT communication to control physical compartments, requiring RFID authentication for sensitive medications.

## 🌟 Key Features

### Web Interface
- **Next.js & Tailwind CSS**: A modern, responsive web application with dedicated routes for `admin`, `doctor`, and `pharmacy`.
- **Prescription Processing**: Built-in Optical Character Recognition (OCR) using `tesseract.js`.
- **QR Code Integration**: Generate and scan QR codes for prescriptions using `qrcode` and `html5-qrcode`.
- **Real-Time Control**: Communicates with the physical shelf via local MQTT messages.

### Hardware (ESP32 Smart Shelf)
- **Normal & Sensitive Compartments**: Two separate dispensing paths controlled by servo motors.
- **RFID Authentication**: Requires pharmacist staff badge scan (via RC522 RFID reader) before opening the sensitive compartment.
- **Visual Feedback**: Traffic LED modules (Red/Yellow/Green) provide status indication.
- **MQTT Integration**: Subscribes to dispensing commands and publishes real-time status updates back to the web app.

## 🛠️ Technology Stack

- **Frontend**: Next.js 14, React 18, Tailwind CSS, Lucide React
- **Hardware/Firmware**: ESP32, C/C++ (Arduino framework)
- **Communication**: MQTT protocol (HiveMQ Public Cloud Broker)
- **Utilities**: Tesseract.js (OCR), html5-qrcode (Scanner)

## 🚀 Getting Started

### 1. MQTT Broker — HiveMQ (No Setup Required)

The system uses the **HiveMQ public broker** (`broker.hivemq.com`), which requires no installation, account, or authentication.

- **Web app (Next.js)** connects via **WebSocket TLS** on port `8884` (`wss://broker.hivemq.com:8884/mqtt`)
- **ESP32 firmware** connects via **plain TCP** on port `1883`

> **Note:** The HiveMQ public broker is shared and has no persistent storage. It is intended for testing and development only. Do not send sensitive patient data over it.

### 2. Hardware Setup (ESP32)

1. Open `afd.c` in the Arduino IDE (or PlatformIO).
2. Install the required libraries: `PubSubClient`, `MFRC522`, `ESP32Servo`, and `ArduinoJson`.
3. Update the Wi-Fi credentials and the `MQTT_BROKER` IP address in `afd.c` to match your local network.
4. Flash the firmware to your ESP32 board.
5. Wire the RC522 RFID, Traffic LED modules, and SG90 servos according to the pin definitions in the C code comments.

### 3. Web Application Setup

First, install the dependencies:

```bash
npm install
```

Then, run the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to access the web interface.

## 📂 Project Structure

- `/app`: Next.js application routes (`admin`, `doctor`, `pharmacy`, etc.)
- `/components`: Reusable React components
- `/lib`: Helper functions and MQTT client configuration
- `afd.c`: The ESP32 firmware source code
- `mosquitto.conf`: Configuration file for the local MQTT broker
