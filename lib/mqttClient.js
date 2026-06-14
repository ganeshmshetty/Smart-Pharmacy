import mqtt from 'mqtt';

function createMqttConnection() {
  console.log('Creating new MQTT connection...');
  
  const brokerUrl = `mqtts://${process.env.MQTT_BROKER || '490dc156383c4e41b7bc0d4091e6356f.s1.eu.hivemq.cloud'}`;
  const statusTopic = process.env.MQTT_TOPIC_STATUS || 'pharmacy/status';
  
  const options = {
    port: parseInt(process.env.MQTT_PORT || '8883', 10),
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    protocol: "mqtts",
    keepalive: 60,
    reconnectPeriod: 1000,
    connectTimeout: 30 * 1000, // 30 seconds timeout
    clientId: 'smart_pharmacy_web_' + Math.random().toString(16).substring(2, 8),
    clean: true,
  };

  const client = mqtt.connect(brokerUrl, options);
  
  let isConnected = false;
  let statusLog = [];
  const listeners = new Set();
  
  const MAX_LOG_EVENTS = 50;

  client.on('connect', () => {
    console.log('MQTT Client Connected');
    isConnected = true;
    client.subscribe(statusTopic, (err) => {
      if (err) {
        console.error('MQTT Subscribe Error:', err);
      } else {
        console.log(`Subscribed to ${statusTopic}`);
      }
    });
  });

  client.on('message', (topic, message) => {
    if (topic === statusTopic) {
      try {
        const payload = JSON.parse(message.toString());
        // Standardize event format if necessary, ensure ts exists
        const event = {
          compartment: payload.compartment,
          status: payload.status,
          ts: payload.ts || new Date().toISOString()
        };
        
        statusLog.push(event);
        if (statusLog.length > MAX_LOG_EVENTS) {
          statusLog.shift(); // Keep capped to 50
        }
        
        // Notify listeners
        listeners.forEach(listener => listener(event));
      } catch (e) {
        console.error('Failed to parse MQTT message:', e);
      }
    }
  });

  client.on('error', (err) => {
    console.error('MQTT Connection Error:', err);
    isConnected = false;
  });

  client.on('close', () => {
    console.log('MQTT Client Disconnected');
    isConnected = false;
  });

  client.on('reconnect', () => {
    console.log('MQTT Client Reconnecting...');
  });

  return {
    getMqttClient: () => client,
    getStatusLog: () => [...statusLog],
    isConnected: () => isConnected,
    addStatusListener: (listener) => listeners.add(listener),
    removeStatusListener: (listener) => listeners.delete(listener),
  };
}

if (!global._mqttClient) {
  global._mqttClient = createMqttConnection();
}

export const client = global._mqttClient;
