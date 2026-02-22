/**
 * Wait for a specified duration in milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Generate a natural typing delay based on message length
 * Simulates human-like response times
 */
export function naturalDelay(baseDelay: number, messageLength: number = 0): number {
  // Base delay + random variation (±30%)
  const variation = baseDelay * 0.3;
  const base = baseDelay + (Math.random() * variation * 2 - variation);

  // Add typing time based on response length (~50ms per character, capped)
  const typingTime = Math.min(messageLength * 50, 5000);

  return Math.floor(base * 1000 + typingTime);
}

/**
 * Simulate typing in a channel with natural delay
 */
export async function simulateTyping(
  channel: any,
  responseLength: number,
  baseDelaySec: number
): Promise<void> {
  const delayMs = naturalDelay(baseDelaySec, responseLength);

  // Start typing indicator
  try {
    await channel.sendTyping();
  } catch {}

  await sleep(delayMs);

  // If delay is long, refresh typing indicator
  if (delayMs > 8000) {
    try {
      await channel.sendTyping();
    } catch {}
  }
}
