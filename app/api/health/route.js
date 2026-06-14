import { NextResponse } from 'next/server';
import { client } from '@/lib/mqttClient';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({ connected: client.isConnected() });
}
