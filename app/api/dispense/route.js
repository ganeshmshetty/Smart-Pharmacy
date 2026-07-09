import { NextResponse } from 'next/server';
import { client } from '@/lib/mqttClient';

export async function POST(request) {
  try {
    await client.ensureConnected();
  } catch (err) {
    return NextResponse.json({ error: "MQTT not connected: " + err.message }, { status: 503 });
  }

  try {
    const body = await request.json();
    const dispenseTopic = process.env.MQTT_TOPIC_DISPENSE || 'pharmacy/dispense';

    if (body.reset) {
      await new Promise((resolve, reject) => {
        client.getMqttClient().publish(dispenseTopic, JSON.stringify({ reset: true }), (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      return NextResponse.json({ success: true, message: "Reset signal sent" });
    }

    if (![1, 2].includes(body.compartment)) {
      return NextResponse.json({ error: "Invalid compartment. Must be 1 or 2." }, { status: 400 });
    }

    const payload = {
      compartment: body.compartment
    };

    await new Promise((resolve, reject) => {
      client.getMqttClient().publish(dispenseTopic, JSON.stringify(payload), (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
    
    return NextResponse.json({ success: true, message: `Compartment ${body.compartment} activated` });
  } catch (error) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
}
