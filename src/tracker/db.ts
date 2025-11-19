import * as sqlite3 from "sqlite3";
import { open } from "sqlite";
import { config } from "./../config";
import { NewPositionRecord, NewTokenRecord } from "../types";

// New token duplicates tracker
export async function createTableNewTokens(database: any): Promise<boolean> {
  try {
    await database.exec(`
    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time INTEGER NOT NULL,
      name TEXT NOT NULL,
      mint TEXT NOT NULL,
      creator TEXT NOT NULL
    );
  `);
    return true;
  } catch (error: any) {
    return false;
  }
}

export async function insertNewToken(newToken: NewTokenRecord) {
  const db = await open({
    filename: config.db.pathname,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const newTokensTableExist = await createTableNewTokens(db);
  if (!newTokensTableExist) {
    await db.close();
  }

  // Proceed with adding holding
  if (newTokensTableExist) {
    const { time, name, mint, creator } = newToken;

    await db.run(
      `
    INSERT INTO tokens (time, name, mint, creator)
    VALUES (?, ?, ?, ?);
  `,
      [time, name, mint, creator]
    );

    await db.close();
  }
}

export async function selectTokenByNameAndCreator(name: string, creator: string): Promise<NewTokenRecord[]> {
  // Open the database
  const db = await open({
    filename: config.db.pathname,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const newTokensTableExist = await createTableNewTokens(db);
  if (!newTokensTableExist) {
    await db.close();
    return [];
  }

  // Query the database for matching tokens
  const tokens = await db.all(
    `
    SELECT * 
    FROM tokens
    WHERE name = ? OR creator = ?;
  `,
    [name, creator]
  );

  // Close the database
  await db.close();

  // Return the results
  return tokens;
}

export async function selectTokenByMint(mint: string): Promise<NewTokenRecord[]> {
  // Open the database
  const db = await open({
    filename: config.db.pathname,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const newTokensTableExist = await createTableNewTokens(db);
  if (!newTokensTableExist) {
    await db.close();
    return [];
  }

  // Query the database for matching tokens
  const tokens = await db.all(
    `
    SELECT * 
    FROM tokens
    WHERE mint = ?;
  `,
    [mint]
  );

  // Close the database
  await db.close();

  // Return the results
  return tokens;
}

// New positions tracker
export async function createTablePositions(database: any): Promise<boolean> {
  try {
    await database.exec(`
    CREATE TABLE IF NOT EXISTS positions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      time INTEGER NOT NULL,
      mint TEXT NOT NULL,
      provider TEXT NOT NULL,
      signer TEXT NOT NULL,
      init_tokens INTEGER NOT NULL,
      init_sol INTEGER NOT NULL,
      init_tx TEXT NOT NULL
    );
  `);
    return true;
  } catch (error: any) {
    return false;
  }
}

/**
 * PHASE 3 - SOL-BOT INTEGRATION: Database Schema Migration
 * Adds fields required for tiered partial exits:
 * - remainingTokens: Tracks tokens left after partial sells
 * - executedTiers: JSON array of tier names that have triggered
 */
export async function migratePositionsForPartialExits(database: any): Promise<boolean> {
  try {
    // Check if columns already exist by attempting to add them
    // SQLite's "IF NOT EXISTS" doesn't work for ALTER TABLE, so we use try/catch

    try {
      await database.exec(`
        ALTER TABLE positions
        ADD COLUMN remainingTokens INTEGER;
      `);
      console.log("✅ [DB MIGRATION] Added remainingTokens column");
    } catch (e: any) {
      if (!e.message.includes("duplicate column")) {
        throw e;
      }
      console.log("ℹ️ [DB MIGRATION] remainingTokens column already exists");
    }

    try {
      await database.exec(`
        ALTER TABLE positions
        ADD COLUMN executedTiers TEXT DEFAULT '[]';
      `);
      console.log("✅ [DB MIGRATION] Added executedTiers column");
    } catch (e: any) {
      if (!e.message.includes("duplicate column")) {
        throw e;
      }
      console.log("ℹ️ [DB MIGRATION] executedTiers column already exists");
    }

    // Initialize remainingTokens for existing positions (set to init_tokens)
    await database.exec(`
      UPDATE positions
      SET remainingTokens = init_tokens
      WHERE remainingTokens IS NULL;
    `);

    // Initialize executedTiers for existing positions (set to empty array)
    await database.exec(`
      UPDATE positions
      SET executedTiers = '[]'
      WHERE executedTiers IS NULL OR executedTiers = '';
    `);

    console.log("✅ [DB MIGRATION] Phase 3 migration complete - partial exits enabled");
    return true;
  } catch (error: any) {
    console.error("❌ [DB MIGRATION] Failed to migrate positions table:", error);
    return false;
  }
}

export async function insertNewPosition(newPosition: NewPositionRecord) {
  const db = await open({
    filename: config.db.pathname,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const newTokensTableExist = await createTablePositions(db);
  if (!newTokensTableExist) {
    await db.close();
  }

  // Phase 3: Run migration to add partial exit fields
  await migratePositionsForPartialExits(db);

  // Proceed with adding holding
  if (newTokensTableExist) {
    const { time, signer, mint, provider, init_tokens, init_sol, init_tx } = newPosition;

    // Phase 3: Initialize new position with partial exit tracking
    await db.run(
      `
    INSERT INTO positions (time, mint, provider, signer, init_tokens, init_sol, init_tx, remainingTokens, executedTiers)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);
  `,
      [time, mint, provider, signer, init_tokens, init_sol, init_tx, init_tokens, '[]']
    );

    await db.close();
  }
}

export async function selectAllPositions(): Promise<NewPositionRecord[]> {
  // Open the database
  const db = await open({
    filename: config.db.pathname,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const newTokensTableExist = await createTablePositions(db);
  if (!newTokensTableExist) {
    await db.close();
    return [];
  }

  // Query the database for matching tokens
  const tokens = await db.all(
    `
    SELECT * 
    FROM positions;
  `
  );

  // Close the database
  await db.close();

  // Return the results
  return tokens;
}

export async function deletePositionsByWallet(walletAddress: string): Promise<boolean> {
  try {
    // Open the database
    const db = await open({
      filename: config.db.pathname,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const positionsTableExists = await createTablePositions(db);
    if (!positionsTableExists) {
      await db.close();
      return false;
    }

    // Delete all positions for the specified wallet
    await db.run(
      `
      DELETE FROM positions
      WHERE signer = ?;
      `,
      [walletAddress]
    );

    // Close the database
    await db.close();

    // Return success
    return true;
  } catch (error) {
    return false;
  }
}

export async function deletePositionByWalletAndMint(walletAddress: string, tokenMint: string): Promise<boolean> {
  try {
    // Open the database
    const db = await open({
      filename: config.db.pathname,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const positionsTableExists = await createTablePositions(db);
    if (!positionsTableExists) {
      await db.close();
      return false;
    }

    // Delete the specific position matching both wallet address and token mint
    await db.run(
      `
      DELETE FROM positions
      WHERE signer = ? AND mint = ?;
      `,
      [walletAddress, tokenMint]
    );

    // Close the database
    await db.close();

    // Return success
    return true;
  } catch (error) {
    return false;
  }
}

export async function deletePositionsByMint(tokenMint: string): Promise<boolean> {
  try {
    // Open the database
    const db = await open({
      filename: config.db.pathname,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const positionsTableExists = await createTablePositions(db);
    if (!positionsTableExists) {
      await db.close();
      return false;
    }

    // Delete all positions for the specified wallet
    await db.run(
      `
      DELETE FROM positions
      WHERE mint = ?;
      `,
      [tokenMint]
    );

    // Close the database
    await db.close();

    // Return success
    return true;
  } catch (error) {
    return false;
  }
}

export async function updatePositionTokenAmount(
  walletAddress: string,
  tokenMint: string,
  newTokenAmount: number,
  newSolAmount: number,
  provider: string
): Promise<boolean> {
  try {
    // Open the database
    const db = await open({
      filename: config.db.pathname,
      driver: sqlite3.Database,
    });

    // Create Table if not exists
    const positionsTableExists = await createTablePositions(db);
    if (!positionsTableExists) {
      await db.close();
      return false;
    }

    // Update the position using a single SQL UPDATE query
    // This avoids race conditions from delete+insert pattern
    await db.run(
      `
      UPDATE positions
      SET init_tokens = ?, init_sol = ?, time = ?, provider = ?, init_tx = ?
      WHERE signer = ? AND mint = ?;
      `,
      [newTokenAmount, newSolAmount, Number(new Date()), provider, "local_merge", walletAddress, tokenMint]
    );

    // Close the database
    await db.close();

    // Return success
    return true;
  } catch (error) {
    return false;
  }
}

export async function getPositionByMint(mint: string): Promise<NewPositionRecord[]> {
  // Open the database
  const db = await open({
    filename: config.db.pathname,
    driver: sqlite3.Database,
  });

  // Create Table if not exists
  const positionsTableExists = await createTablePositions(db);
  if (!positionsTableExists) {
    await db.close();
    return [];
  }

  // Query the database for matching tokens
  const tokens = await db.all(
    `
    SELECT *
    FROM positions
    WHERE mint = ?;
  `,
    [mint]
  );

  // Close the database
  await db.close();

  // Return the results
  return tokens;
}

/**
 * PHASE 4 - SOL-BOT INTEGRATION: Update position after partial sell
 * Updates remainingTokens and tracks executedTiers for tiered exits
 *
 * @param walletAddress - Wallet address that owns the position
 * @param tokenMint - Token mint address
 * @param newRemainingTokens - Tokens remaining after this sell
 * @param tierName - Name of tier that executed (e.g., "TIER 1", "TIER 2")
 * @returns boolean indicating success
 */
export async function updatePartialExit(
  walletAddress: string,
  tokenMint: string,
  newRemainingTokens: number,
  tierName: string
): Promise<boolean> {
  try {
    const db = await open({
      filename: config.db.pathname,
      driver: sqlite3.Database,
    });

    // Get current position to retrieve executedTiers
    const position = await db.get(
      `SELECT executedTiers FROM positions WHERE signer = ? AND mint = ?`,
      [walletAddress, tokenMint]
    );

    if (!position) {
      await db.close();
      return false;
    }

    // Parse executedTiers JSON array
    let executedTiers: string[] = [];
    try {
      executedTiers = JSON.parse(position.executedTiers || '[]');
    } catch (e) {
      executedTiers = [];
    }

    // Add new tier if not already executed and tierName is provided
    if (tierName && !executedTiers.includes(tierName)) {
      executedTiers.push(tierName);
    }

    // Update position with new remaining tokens and executed tiers
    await db.run(
      `
      UPDATE positions
      SET remainingTokens = ?, executedTiers = ?
      WHERE signer = ? AND mint = ?
      `,
      [newRemainingTokens, JSON.stringify(executedTiers), walletAddress, tokenMint]
    );

    await db.close();
    return true;
  } catch (error) {
    console.error("❌ [DB] Failed to update partial exit:", error);
    return false;
  }
}
