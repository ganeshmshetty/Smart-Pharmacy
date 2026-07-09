import { NextResponse } from 'next/server';
import { client } from '@/lib/mqttClient';

export async function POST(request) {
  try {
    // 1. Ensure the global client is connected
    await client.ensureConnected();

    const body = await request.json();
    const dispenseTopic = process.env.MQTT_TOPIC_DISPENSE || 'pharmacy/dispense';

    if (body.reset) {
      await publishWithQos1(dispenseTopic, { reset: true });
      return NextResponse.json({ success: true, message: "Reset signal sent" });
    }

    if (![1, 2].includes(body.compartment)) {
      return NextResponse.json({ error: "Invalid compartment. Must be 1 or 2." }, { status: 400 });
    }

    const payload = {
      compartment: body.compartment
    };

    // 2. Publish with QoS 1 and await the PUBACK from the broker
    await publishWithQos1(dispenseTopic, payload);
    
    return NextResponse.json({ success: true, message: `Compartment ${body.compartment} activated` });
  } catch (error) {
    return NextResponse.json({ error: "MQTT dispense failed: " + (error.message || error) }, { status: 503 });
  }
}

// Publish helper wrapping QoS 1 in a Promise
async function publishWithQos1(topic, payload) {
  return new Promise((resolve, reject) => {
    const mqttClient = client.getMqttClient();
    
    // Set a safety timeout
    const timeout = setTimeout(() => {
      reject(new Error("Publish acknowledgment (PUBACK) timed out"));
    }, 4000);

    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve();
    });
  });
}
