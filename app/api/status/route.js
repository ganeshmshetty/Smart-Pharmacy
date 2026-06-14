import { client } from '@/lib/mqttClient';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  let listener;

  const stream = new ReadableStream({
    start(controller) {
      // Send historical log first
      const logs = client.getStatusLog();
      logs.forEach((log) => {
        controller.enqueue(`data: ${JSON.stringify(log)}\n\n`);
      });

      // Define listener for new messages
      listener = (event) => {
        try {
          controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
        } catch (e) {
          console.error("Error enqueuing data", e);
        }
      };

      client.addStatusListener(listener);
    },
    cancel() {
      if (listener) {
        client.removeStatusListener(listener);
      }
    }
  });

  request.signal.addEventListener('abort', () => {
    if (listener) {
      client.removeStatusListener(listener);
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
    },
  });
}
