import bs58 from "bs58";

export function assertValidPubkey(key: string, label: string): string {
  let decoded: Uint8Array;

  try {
    decoded = bs58.decode(key.trim());
  } catch (e) {
    throw new Error(
      `[YELLOWSTONE-FILTER] ${label} is not valid base58: "${key}".\n` +
      `Original error: ${(e as Error).message}`
    );
  }

  if (decoded.length !== 32) {
    throw new Error(
      `[YELLOWSTONE-FILTER] ${label} decoded length = ${decoded.length}, expected 32 bytes.\n` +
      `Key: "${key}"`
    );
  }

  return key.trim(); // safe
}

export function validatePubkeys(keys: string[], labelPrefix: string): string[] {
  const validKeys: string[] = [];

  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];

    // Skip empty, null, undefined, or placeholder values
    if (!k || k.trim() === "" || k === "(missing)") {
      console.warn(
        `[YELLOWSTONE-FILTER] ${labelPrefix}[${i}] is empty or placeholder, skipping.`
      );
      continue;
    }

    // Try to validate, skip on failure instead of throwing
    try {
      const validated = assertValidPubkey(k, `${labelPrefix}[${i}]`);
      validKeys.push(validated);
    } catch (e) {
      console.warn(
        `[YELLOWSTONE-FILTER] ${labelPrefix}[${i}] is invalid, skipping: ${(e as Error).message}`
      );
      // Do not throw - just skip this key
    }
  }

  return validKeys;
}
