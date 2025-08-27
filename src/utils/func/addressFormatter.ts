/**
 * Utility functions for formatting addresses
 */

/**
 * Shortens a Solana address/mint to a more readable format
 * Returns a string in the format "dasd...asdss" (first few chars + ellipsis + last few chars)
 *
 * @param address The full Solana address or mint to shorten
 * @param startChars Number of characters to keep at the beginning (default: 4)
 * @param endChars Number of characters to keep at the end (default: 4)
 * @returns Shortened address string
 */
export function shortenAddress(address: string, startChars: number = 4, endChars: number = 4): string {
  if (!address) {
    return "";
  }

  // Validate the address
  if (typeof address !== "string" || address.trim() === "") {
    return "";
  }

  // If address is shorter than the combined length of start and end chars, return as is
  if (address.length <= startChars + endChars) {
    return address;
  }

  // Extract the beginning and ending portions
  const start = address.slice(0, startChars);
  const end = address.slice(-endChars);

  // Return the shortened format
  return `${start}...${end}`;
}
