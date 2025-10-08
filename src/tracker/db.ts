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

  // Proceed with adding holding
  if (newTokensTableExist) {
    const { time, signer, mint, provider, init_tokens, init_sol, init_tx } = newPosition;

    await db.run(
      `
    INSERT INTO positions (time, mint, provider, signer, init_tokens, init_sol, init_tx)
    VALUES (?, ?, ?, ?, ?, ?, ?);
  `,
      [time, mint, provider, signer, init_tokens, init_sol, init_tx]
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

    // Delete old ones
    deletePositionByWalletAndMint(walletAddress, tokenMint);

    // Add new merged one
    const newPosition: NewPositionRecord = {
      time: Number(new Date()),
      mint: tokenMint,
      signer: walletAddress,
      provider: provider,
      init_sol: newSolAmount,
      init_tokens: newTokenAmount,
      init_tx: "local_merge",
    };
    await insertNewPosition(newPosition);

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
