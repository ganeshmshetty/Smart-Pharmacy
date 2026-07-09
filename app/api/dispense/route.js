import { NextResponse } from 'next/server';
import mqtt from 'mqtt';

export async function POST(request) {
  try {
    const body = await request.json();
    const dispenseTopic = process.env.MQTT_TOPIC_DISPENSE || 'pharmacy/dispense';

    if (body.reset) {
      await publishMessage(dispenseTopic, { reset: true });
      return NextResponse.json({ success: true, message: "Reset signal sent" });
    }

    if (![1, 2].includes(body.compartment)) {
      return NextResponse.json({ error: "Invalid compartment. Must be 1 or 2." }, { status: 400 });
    }

    const payload = {
      compartment: body.compartment
    };

    await publishMessage(dispenseTopic, payload);
    return NextResponse.json({ success: true, message: `Compartment ${body.compartment} activated` });
  } catch (error) {
    return NextResponse.json({ error: error.message || "Invalid JSON body" }, { status: 503 });
  }
}

// Robust Serverless Publish & Flush Helper
async function publishMessage(topic, payload) {
  return new Promise((resolve, reject) => {
    const localClient = mqtt.connect({
      host: process.env.MQTT_BROKER.trim(),
      port: parseInt(process.env.MQTT_PORT || '1883', 10),
      protocol: 'mqtt'
    });

    // Timeout safety fallback
    const timeout = setTimeout(() => {
      localClient.end(true);
      reject(new Error("MQTT connection or publish timed out"));
    }, 5000);

    localClient.on('connect', () => {
      // QoS 1 guarantees the broker acknowledges receipt of the message
      localClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
        if (err) {
          clearTimeout(timeout);
          localClient.end(true);
          reject(err);
        } else {
          // Gracefully close connection (flushes socket buffer)
          localClient.end(false, () => {
            clearTimeout(timeout);
            console.log("MQTT message successfully flushed and connection closed.");
            resolve();
          });
        }
      });
    });

    localClient.on('error', (err) => {
      clearTimeout(timeout);
      localClient.end(true);
      reject(err);
    });
  });
}
