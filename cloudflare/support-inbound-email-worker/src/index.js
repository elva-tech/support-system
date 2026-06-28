/**
 * Cloudflare Email Worker for support@elvatech.in only.
 *
 * 1. Reads the raw MIME (before forward consumes the stream).
 * 2. Forwards a copy to Gmail (tech.elva@gmail.com).
 * 3. POSTs the same message to the ELVA API webhook (async via waitUntil).
 *
 * Deploy: see README.md in this folder.
 */

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export default {
  async email(message, env, ctx) {
    const forwardTo = env.GMAIL_FORWARD_ADDRESS || "tech.elva@gmail.com";
    const webhookUrl = env.WEBHOOK_URL;
    const webhookSecret = env.INBOUND_WEBHOOK_SECRET;

    let rawMimeBase64 = null;

    try {
      const rawBuffer = await new Response(message.raw).arrayBuffer();
      rawMimeBase64 = arrayBufferToBase64(rawBuffer);
    } catch (error) {
      console.error("Failed to read inbound MIME", error);
    }

    try {
      await message.forward(forwardTo);
    } catch (error) {
      console.error("Failed to forward to Gmail", { forwardTo, error: String(error) });
    }

    if (!webhookUrl || !webhookSecret || !rawMimeBase64) {
      if (!webhookUrl || !webhookSecret) {
        console.error("WEBHOOK_URL or INBOUND_WEBHOOK_SECRET not configured");
      }
      return;
    }

    const webhookTask = fetch(webhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Inbound-Webhook-Secret": webhookSecret
      },
      body: JSON.stringify({
        from: message.from,
        to: message.to,
        rawMimeBase64
      })
    })
      .then(async (response) => {
        if (!response.ok) {
          const body = await response.text();
          console.error("ELVA webhook failed", response.status, body);
        }
      })
      .catch((error) => {
        console.error("ELVA webhook error", error);
      });

    ctx.waitUntil(webhookTask);
  }
};
