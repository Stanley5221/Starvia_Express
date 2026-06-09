'use strict';

const { Expo } = require('expo-server-sdk');

const expo = new Expo();

/**
 * Send Expo push notifications to one or more tokens.
 * Silently skips invalid/null tokens. Non-fatal on send errors.
 *
 * @param {string[]} tokens
 * @param {{ title: string, body: string, data?: object }} payload
 */
async function sendPushNotifications(tokens, payload) {
  const valid = (tokens || []).filter(t => t && Expo.isExpoPushToken(t));
  if (!valid.length) return;

  const messages = valid.map(to => ({
    to,
    sound: 'default',
    title: payload.title,
    body: payload.body,
    data: payload.data ?? {},
    priority: 'high',
    channelId: 'order-offers',
  }));

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const receipts = await expo.sendPushNotificationsAsync(chunk);
      for (const r of receipts) {
        if (r.status === 'error') {
          console.warn('[Push] send error:', r.message, r.details?.error);
        }
      }
    } catch (err) {
      console.error('[Push] chunk failed:', err.message);
    }
  }
}

module.exports = { sendPushNotifications };
