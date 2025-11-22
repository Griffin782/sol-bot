/**
 * Test script for buildPositionMonitorRequest validation
 */

import util from "util";
import bs58 from "bs58";
import { validatePubkeys } from "./src/utils/yellowstoneFilterUtils";
import { CommitmentLevel, SubscribeRequest } from "@triton-one/yellowstone-grpc";

// Sample test data with valid base58 addresses
const sampleWatchedPools = [
  {
    pool: "7YhE9VQj9FWt8g3Dr75Cqcpcq8aBPdC9fP6tYvCZRKpJ",         // valid 32-byte base58
    bondingCurve: "3nfsqFRuQmQJDvJse9nyCuWHa6ZS7JtBQWvM5p38xg9Z" // valid 32-byte base58
  },
  {
    pool: "9ZJFA8R5TovJBoW15uZr86GttUpgUp7CFuQabVbzHzBE",
    bondingCurve: "7FJqF2HVVqNhZp46bv5GPaqhC5t6K5DkoQr8E8AcbqmH"
  }
];

/**
 * Replicate the buildPositionMonitorRequest function for testing
 */
function buildPositionMonitorRequest(
  watchedPools: any[],
  fromSlot: number | null = null
): SubscribeRequest {
  // pools → array of { pool: ".", bondingCurve: "." }
  const safePoolKeys = validatePubkeys(
    watchedPools.map((w) => w.pool),
    "pool"
  );

  const safeBondingKeys = validatePubkeys(
    watchedPools.map((w) => w.bondingCurve),
    "bondingCurve"
  );

  // Flatten into one list of pubkeys
  const allKeys = [...safePoolKeys, ...safeBondingKeys];

  const request: SubscribeRequest = {
    commitment: CommitmentLevel.CONFIRMED,
    accounts: {},
    slots: {},
    transactions: {
      positionMonitor: {
        vote: false,
        failed: false,
        // Yellowstone expects string[] of base58 pubkeys here
        accountInclude: [],
        accountExclude: [],
        accountRequired: allKeys,
      },
    },
    transactionsStatus: {},
    entry: {},
    blocks: {},
    blocksMeta: {},
    accountsDataSlice: [],
  };

  if (fromSlot !== null) {
    request.fromSlot = String(fromSlot);
  }

  return request;
}

/**
 * Validate base58 string and check if it decodes to 32 bytes
 */
function validateBase58Pubkey(pubkey: string): { valid: boolean; length: number; error?: string } {
  try {
    const decoded = bs58.decode(pubkey);
    return {
      valid: decoded.length === 32,
      length: decoded.length,
      error: decoded.length !== 32 ? `Wrong size: ${decoded.length} bytes (expected 32)` : undefined
    };
  } catch (e) {
    return {
      valid: false,
      length: 0,
      error: `Invalid base58: ${String(e)}`
    };
  }
}

/**
 * Run validation tests
 */
function runValidation() {
  console.log("\n" + "=".repeat(80));
  console.log("TESTING buildPositionMonitorRequest()");
  console.log("=".repeat(80) + "\n");

  // Step 1: Create test call
  console.log("Step 1: Creating test call with sample data...\n");
  const req = buildPositionMonitorRequest(sampleWatchedPools, null);

  // Step 2: Print full request
  console.log("Step 2: Full Request Structure:");
  console.log("=".repeat(80));
  console.log(util.inspect(req, { depth: 10, colors: true }));
  console.log("=".repeat(80) + "\n");

  // Step 3 & 4: Validate structure and check for errors
  console.log("Step 3 & 4: Validating Structure...\n");

  const errors: string[] = [];
  const warnings: string[] = [];

  // Check basic structure
  if (!req.transactions) {
    errors.push("❌ Missing 'transactions' field");
  }
  if (!req.transactions?.positionMonitor) {
    errors.push("❌ Missing 'transactions.positionMonitor' field");
  }

  // Check for accountRequired (expected location per user requirements)
  const accountRequired = req.transactions?.positionMonitor?.accountRequired;
  const accountInclude = (req.transactions?.positionMonitor as any)?.accountInclude;
  const accountExclude = (req.transactions?.positionMonitor as any)?.accountExclude;

  console.log("Field Check:");
  console.log(`  accountRequired: ${accountRequired ? `✓ (${(accountRequired as any).length} items)` : '✗ missing'}`);
  console.log(`  accountInclude: ${accountInclude ? `✓ (${accountInclude.length} items)` : '✗ missing'}`);
  console.log(`  accountExclude: ${accountExclude ? `✓ (${accountExclude.length} items)` : '✗ missing'}`);
  console.log();

  // Determine which field contains the pubkeys
  let pubkeyArray: string[] | undefined;
  let pubkeyField: string;

  if (accountRequired && Array.isArray(accountRequired) && accountRequired.length > 0) {
    pubkeyArray = accountRequired as string[];
    pubkeyField = "accountRequired";
  } else if (accountInclude && Array.isArray(accountInclude) && accountInclude.length > 0) {
    pubkeyArray = accountInclude;
    pubkeyField = "accountInclude";
    warnings.push("⚠️  Pubkeys in 'accountInclude' instead of 'accountRequired'");
  } else {
    errors.push("❌ No pubkeys found in accountRequired or accountInclude");
  }

  // Validate pubkeys if found
  if (pubkeyArray) {
    console.log(`Pubkey Array Analysis (field: ${pubkeyField}):`);
    console.log(`  Total entries: ${pubkeyArray.length}`);
    console.log(`  Expected: 4 (2 pools + 2 bonding curves)`);

    if (pubkeyArray.length !== 4) {
      errors.push(`❌ Wrong number of pubkeys: ${pubkeyArray.length} (expected 4)`);
    }

    // Check for nested arrays
    const hasNestedArrays = pubkeyArray.some(item => Array.isArray(item));
    if (hasNestedArrays) {
      errors.push("❌ Nested arrays detected in pubkey array");
    }

    // Check for empty strings
    const hasEmptyStrings = pubkeyArray.some(item => item === "" || item === null || item === undefined);
    if (hasEmptyStrings) {
      errors.push("❌ Empty/null/undefined strings in pubkey array");
    }

    // Validate each pubkey
    console.log("\n  Individual Pubkey Validation:");
    let allValid = true;
    pubkeyArray.forEach((pubkey, index) => {
      const validation = validateBase58Pubkey(pubkey);
      const status = validation.valid ? "✅ PASS" : "❌ FAIL";
      console.log(`    [${index}] ${pubkey}`);
      console.log(`        ${status} - ${validation.length} bytes ${validation.error ? `(${validation.error})` : ''}`);

      if (!validation.valid) {
        allValid = false;
        errors.push(`❌ Pubkey [${index}] validation failed: ${validation.error}`);
      }
    });

    if (allValid) {
      console.log("\n  ✅ All pubkeys passed base58 validation");
    }
  }

  // Check structure matches expected format
  console.log("\n" + "=".repeat(80));
  console.log("Structure Validation:");
  console.log("=".repeat(80));

  const expectedFields = ['commitment', 'accounts', 'slots', 'transactions', 'transactionsStatus', 'entry', 'blocks', 'blocksMeta', 'accountsDataSlice'];
  const actualFields = Object.keys(req);

  console.log("Top-level fields:");
  expectedFields.forEach(field => {
    const exists = actualFields.includes(field);
    console.log(`  ${exists ? '✅' : '❌'} ${field}`);
    if (!exists) {
      errors.push(`❌ Missing top-level field: ${field}`);
    }
  });

  // Check commitment value
  if (req.commitment !== CommitmentLevel.CONFIRMED) {
    errors.push(`❌ Wrong commitment level: ${req.commitment} (expected ${CommitmentLevel.CONFIRMED})`);
  }

  // Step 5: Summary
  console.log("\n" + "=".repeat(80));
  console.log("VALIDATION SUMMARY");
  console.log("=".repeat(80));

  const poolKeys = sampleWatchedPools.map(w => w.pool);
  const bondingKeys = sampleWatchedPools.map(w => w.bondingCurve);

  console.log(`• Number of pool keys: ${poolKeys.length}`);
  console.log(`• Number of bonding curve keys: ${bondingKeys.length}`);
  console.log(`• Total entries in ${pubkeyField}: ${pubkeyArray?.length || 0}`);
  console.log(`• Base58 validation: ${errors.filter(e => e.includes('validation failed')).length === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`• 32-byte length check: ${errors.filter(e => e.includes('Wrong size')).length === 0 ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`• Structure validation: ${errors.filter(e => !e.includes('validation failed') && !e.includes('Wrong size')).length === 0 ? '✅ PASS' : '❌ FAIL'}`);

  // Print warnings
  if (warnings.length > 0) {
    console.log("\n⚠️  WARNINGS:");
    warnings.forEach(w => console.log(`  ${w}`));
  }

  // Print errors
  if (errors.length > 0) {
    console.log("\n❌ ERRORS FOUND:");
    errors.forEach(e => console.log(`  ${e}`));
    console.log("\n🚫 VALIDATION FAILED\n");
    process.exit(1);
  } else {
    console.log("\n✅ ALL VALIDATIONS PASSED\n");
  }

  // Final output
  console.log("=".repeat(80));
  console.log("FINAL VALIDATED OUTPUT");
  console.log("=".repeat(80));
  console.log("transactions.positionMonitor structure:");
  console.log(util.inspect(req.transactions?.positionMonitor, { depth: 5, colors: true }));
  console.log("=".repeat(80) + "\n");
}

// Run the validation
runValidation();
