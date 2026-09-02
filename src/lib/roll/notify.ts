/**
 * Telegram notifications for Roll Order events.
 * Fire-and-forget (no throwing on failure).
 */

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'Markdown' }),
    });
  } catch (e) {
    console.error('Telegram notify failed:', e);
  }
}

export async function notifyNewOrder(orderId: string, amountKrw: number, code: string) {
  const text = `🆕 *New Roll Order*\nID: \`${orderId}\`\nAmount: ₩${amountKrw.toLocaleString()}\nDeposit Code: \`${code}\``;
  await sendTelegram(text);
}

export async function notifyDepositConfirmed(orderId: string, amountKrw: number) {
  const text = `💰 *Deposit Confirmed*\nID: \`${orderId}\`\nAmount: ₩${amountKrw.toLocaleString()}`;
  await sendTelegram(text);
}

export async function notifyFrozen(orderId: string, reason: string) {
  const text = `🚨 *Order Frozen*\nID: \`${orderId}\`\nReason: ${reason}`;
  await sendTelegram(text);
}

export async function notifyLargeOrder(orderId: string, amountKrw: number) {
  const alertThreshold = parseFloat(process.env.ROLL_ALERT_KRW ?? '100000000');
  if (amountKrw >= alertThreshold) {
    const text = `⚠️ *Large Order Alert*\nID: \`${orderId}\`\nAmount: ₩${amountKrw.toLocaleString()}`;
    await sendTelegram(text);
  }
}
