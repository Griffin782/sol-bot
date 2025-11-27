/**
 * Legacy Cleanup - Hard delete broken/legacy positions from DB
 *
 * Runs at startup to ensure PositionMonitor never sees invalid positions.
 * Checks:
 * - Mint address is valid Solana pubkey
 * - Can derive valid bonding curve address for pump.fun tokens
 * - Removes positions that would cause gRPC subscription errors
 */

import { LogEngineType } from "../utils/managers/logManager";
import { selectAllPositions, deletePositionsByMint } from "../tracker/db";
import { derivePumpFunBondingCurve } from "../utils/poolDerivation";
import bs58 from "bs58";

/**
 * Validate a string is a valid Solana pubkey (32 bytes when base58 decoded)
 */
function isValidSolanaPubkey(addr: string | null | undefined): boolean {
  if (!addr || typeof addr !== "string") return false;
  if (addr === "(missing)" || addr === "") return false;

  try {
    const decoded = bs58.decode(addr);
    return decoded.length === 32;
  } catch {
    return false;
  }
}

/**
 * Check if we can derive a valid bonding curve for a mint
 * Returns the derived address if valid, null otherwise
 */
function tryDeriveBondingCurve(mint: string): string | null {
  try {
    const bondingCurveInfo = derivePumpFunBondingCurve(mint);
    const curveAddr = bondingCurveInfo.poolAddress;

    if (isValidSolanaPubkey(curveAddr)) {
      return curveAddr;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Hard-delete legacy/broken positions from DB so they never contaminate
 * monitoring or gRPC subscriptions in future runs.
 *
 * A position is considered "legacy/broken" if:
 * 1. Its mint address is not a valid Solana pubkey
 * 2. We cannot derive a valid bonding curve address for it
 *
 * This ensures PositionMonitor only ever receives positions that
 * will produce valid Yellowstone gRPC subscriptions.
 */
export async function cleanupLegacyPositions(
  logEngine?: LogEngineType
): Promise<{ removed: number; kept: number }> {
  const result = { removed: 0, kept: 0 };

  try {
    const positions = await selectAllPositions();

    if (!positions || positions.length === 0) {
      console.log("[LegacyCleanup] No positions found in DB");
      return result;
    }

    console.log(`[LegacyCleanup] Checking ${positions.length} position(s) for validity...`);

    for (const pos of positions) {
      const mint = pos.mint;

      if (!mint) {
        console.log(`[LegacyCleanup] Skipping position with no mint`);
        continue;
      }

      // Check 1: Is the mint a valid Solana pubkey?
      if (!isValidSolanaPubkey(mint)) {
        result.removed++;
        console.log(
          `[LegacyCleanup] Deleting position with invalid mint: "${mint}"`
        );
        await deletePositionsByMint(mint);

        if (logEngine) {
          logEngine.writeLog(
            "🧹 LegacyCleanup",
            `Removed position with invalid mint: ${mint.slice(0, 16)}...`,
            "yellow"
          );
        }
        continue;
      }

      // Check 2: Can we derive a valid bonding curve?
      const bondingCurve = tryDeriveBondingCurve(mint);

      if (!bondingCurve) {
        result.removed++;
        console.log(
          `[LegacyCleanup] Deleting position - cannot derive valid bonding curve: mint=${mint.slice(0, 8)}...`
        );
        await deletePositionsByMint(mint);

        if (logEngine) {
          logEngine.writeLog(
            "🧹 LegacyCleanup",
            `Removed position ${mint.slice(0, 8)}... (invalid/underivable bonding curve)`,
            "yellow"
          );
        }
        continue;
      }

      // Position is valid
      result.kept++;
      console.log(
        `[LegacyCleanup] ✅ Position valid: mint=${mint.slice(0, 8)}... bonding=${bondingCurve.slice(0, 8)}...`
      );
    }

    console.log(
      `[LegacyCleanup] Complete. Removed ${result.removed} legacy position(s), kept ${result.kept} valid position(s).`
    );

    if (logEngine && result.removed > 0) {
      logEngine.writeLog(
        "🧹 LegacyCleanup",
        `Cleanup complete: removed ${result.removed}, kept ${result.kept}`,
        "green"
      );
    }

    return result;
  } catch (err) {
    console.error("[LegacyCleanup] Error during cleanup:", err);
    if (logEngine) {
      logEngine.writeLog(
        "❌ LegacyCleanup",
        `Error during cleanup: ${String(err)}`,
        "red"
      );
    }
    return result;
  }
}
