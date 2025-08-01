/**
 * Converts a tinybar amount to a hbar amount.
 * @param tinyBars - The tinybar amount.
 * @returns The hbar amount.
 */
export function toHBar(tinyBars: BigNumber): BigNumber {
  return tinyBars.div(100000000);
}
