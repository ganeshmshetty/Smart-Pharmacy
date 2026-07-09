import { NextResponse } from 'next/server';
import { client } from '@/lib/mqttClient';

export async function POST(request) {
  try {
    // 1. Ensure the global client is connected
    await client.ensureConnected();

    const body = await request.json();
    const dispenseTopic = process.env.MQTT_TOPIC_DISPENSE || 'pharmacy/dispense';

    if (body.reset) {
      client.getMqttClient().publish(dispenseTopic, JSON.stringify({ reset: true }), { qos: 0 });
      // Wait 500ms to allow network buffer to flush
      await new Promise(resolve => setTimeout(resolve, 500));
      return NextResponse.json({ success: true, message: "Reset signal sent" });
    }

    if (![1, 2].includes(body.compartment)) {
      return NextResponse.json({ error: "Invalid compartment. Must be 1 or 2." }, { status: 400 });
    }

    const payload = {
      compartment: body.compartment
    };

    // 2. Publish with QoS 0 (fire and forget)
    client.getMqttClient().publish(dispenseTopic, JSON.stringify(payload), { qos: 0 });

    // 3. Wait 500ms to allow Vercel's OS buffer to flush the packet to the broker
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return NextResponse.json({ success: true, message: `Compartment ${body.compartment} activated` });
  } catch (error) {
    return NextResponse.json({ error: "MQTT dispense failed: " + (error.message || error) }, { status: 503 });
  }
}
