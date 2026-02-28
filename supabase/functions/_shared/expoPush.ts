/**
 * Expo Push Notification helper
 * Sends push notifications via the Expo Push API.
 * Batch-sends up to 100 notifications per request.
 */

export interface PushMessage {
  to: string;           // Expo push token
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: 'default' | null;
  badge?: number;
}

export interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

export async function sendPushNotifications(messages: PushMessage[]): Promise<PushTicket[]> {
  if (!messages.length) return [];

  // Batch into chunks of 100 (Expo limit)
  const chunks: PushMessage[][] = [];
  for (let i = 0; i < messages.length; i += 100) {
    chunks.push(messages.slice(i, i + 100));
  }

  const tickets: PushTicket[] = [];
  for (const chunk of chunks) {
    try {
      const res = await fetch(EXPO_PUSH_URL, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Accept-Encoding': 'gzip, deflate',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(chunk),
      });
      const json = await res.json();
      tickets.push(...(json.data ?? []));
    } catch (err) {
      console.error('Push notification batch failed:', err);
    }
  }
  return tickets;
}
