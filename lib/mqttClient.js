import mqtt from 'mqtt';

function createMqttConnection() {
  console.log('Creating new MQTT connection...');
  
  const statusTopic = process.env.MQTT_TOPIC_STATUS || 'pharmacy/status';
  
  const client = mqtt.connect(`mqtt://${process.env.MQTT_BROKER}:${process.env.MQTT_PORT}`);
  
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
