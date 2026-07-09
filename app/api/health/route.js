import { NextResponse } from 'next/server';
import { client } from '@/lib/mqttClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await client.ensureConnected();
    return NextResponse.json({ connected: true });
  } catch (err) {
    return NextResponse.json({ connected: false, error: err.message });
  }
}
