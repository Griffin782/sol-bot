import axios from "axios";
import * as dotenv from "dotenv";
import { config } from "../../config";
import { RugResponseExtended, NewTokenRecord } from "../../types";
import { insertNewToken, selectTokenByNameAndCreator } from "../../tracker/db";
import { LogEngineType } from "../managers/logManager";

// Load environment variables from the .env file
dotenv.config();

/**
 * Checks if a token passes all rug check criteria
 * @param tokenMint The token's mint address
 * @returns Promise<boolean> indicating if the token passes all checks
 */
export async function getRugCheckConfirmed(tokenMint: string, logEngine: LogEngineType): Promise<boolean> {
  try {
    const rugResponse = await axios.get<RugResponseExtended>(`https://api.rugcheck.xyz/v1/tokens/${tokenMint}/report`, {
      timeout: config.axios.get_timeout,
    });

    if (!rugResponse.data) return false;

    // For debugging purposes, log the full response data
    if (config.checks.verbose_logs) {
      logEngine.writeLog(`RugCheck`, `Rug check response data: ${rugResponse.data}`, "yellow");
    }

    // Extract information from the token report
    const tokenReport: RugResponseExtended = rugResponse.data;
    const tokenCreator = tokenReport.creator ? tokenReport.creator : tokenMint;
    const mintAuthority = tokenReport.token.mintAuthority;
    const freezeAuthority = tokenReport.token.freezeAuthority;
    const isInitialized = tokenReport.token.isInitialized;
    const tokenName = tokenReport.tokenMeta.name;
    const tokenSymbol = tokenReport.tokenMeta.symbol;
    const tokenMutable = tokenReport.tokenMeta.mutable;
    // Ensure topHolders is always an array, even if it's null or undefined in the response
    let topHolders = tokenReport.topHolders || [];
    const marketsLength = tokenReport.markets ? tokenReport.markets.length : 0;
    const totalLPProviders = tokenReport.totalLPProviders;
    const totalMarketLiquidity = tokenReport.totalMarketLiquidity;
    const isRugged = tokenReport.rugged;
    const rugScore = tokenReport.score;

    // Update topholders if liquidity pools are excluded
    if (config.checks.settings.exclude_lp_from_topholders) {
      // local types
      type Market = {
        liquidityA?: string;
        liquidityB?: string;
      };

      const markets: Market[] | undefined = tokenReport.markets;
      if (markets) {
        // Safely extract liquidity addresses from markets
        const liquidityAddresses: string[] = (markets ?? [])
          .flatMap((market) => [market.liquidityA, market.liquidityB])
          .filter((address): address is string => !!address);

        // Filter out topHolders that match any of the liquidity addresses
        // Ensure topHolders is an array before applying filter
        topHolders = (topHolders || []).filter((holder) => !liquidityAddresses.includes(holder.address));
      }
    }

    // Get config settings
    const rugCheckSettings = config.checks.settings;

    // Set conditions for token validation
    const conditions = [
      {
        check:
          rugCheckSettings.allow_symbols &&
          rugCheckSettings.allow_symbols.length > 0 &&
          rugCheckSettings.allow_symbols[0] !== "" &&
          !(rugCheckSettings.allow_symbols || []).some((symbol) => tokenSymbol.toLowerCase().includes(symbol.toLowerCase())),
        message: "🚫 Symbol '" + tokenSymbol + "'  is not part of the allowed symbols",
      },
      {
        check:
          rugCheckSettings.allow_names &&
          rugCheckSettings.allow_names.length > 0 &&
          rugCheckSettings.allow_names[0] !== "" &&
          !(rugCheckSettings.allow_names || []).some((name) => tokenName.toLowerCase().includes(name.toLowerCase())),
        message: "🚫 Name '" + tokenName + "' is not part of the allowed names",
      },
      {
        check: !rugCheckSettings.allow_mint_authority && mintAuthority !== null,
        message: "🚫 Mint authority should be null",
      },
      {
        check: !rugCheckSettings.allow_not_initialized && !isInitialized,
        message: "🚫 Token is not initialized",
      },
      {
        check: !rugCheckSettings.allow_freeze_authority && freezeAuthority !== null,
        message: "🚫 Freeze authority should be null",
      },
      {
        check: !rugCheckSettings.allow_mutable && tokenMutable !== false,
        message: "🚫 Mutable should be false",
      },
      {
        check: !rugCheckSettings.allow_insider_topholders && (topHolders || []).some((holder) => holder.insider),
        message: "🚫 Insider accounts should not be part of the top holders",
      },
      {
        check: (topHolders || []).some((holder) => holder.pct > rugCheckSettings.max_alowed_pct_topholders),
        message: "🚫 An individual top holder cannot hold more than the allowed percentage of the total supply",
      },
      {
        check: totalLPProviders < rugCheckSettings.min_total_lp_providers,
        message: "🚫 Not enough LP Providers.",
      },
      {
        check: marketsLength < rugCheckSettings.min_total_markets,
        message: "🚫 Not enough Markets.",
      },
      {
        check: totalMarketLiquidity < rugCheckSettings.min_total_market_Liquidity,
        message: "🚫 Not enough Market Liquidity.",
      },
      {
        check: !rugCheckSettings.allow_rugged && isRugged,
        message: "🚫 Token is rugged",
      },
      {
        check: rugCheckSettings.block_symbols && rugCheckSettings.block_symbols.includes(tokenSymbol),
        message: "🚫 Symbol is blocked",
      },
      {
        check: rugCheckSettings.block_names && rugCheckSettings.block_names.includes(tokenName),
        message: "🚫 Name is blocked",
      },
      {
        check: rugScore > rugCheckSettings.max_score && rugCheckSettings.max_score !== 0,
        message: "🚫 Rug score too high.",
      },
      {
        check: rugCheckSettings.ignore_ends_with_pump && tokenMint.toLowerCase().endsWith("pump"),
        message: "🚫 Token name ends with 'pump' which is blocked by configuration.",
      },
    ];

    // Check for duplicate tokens if tracking is enabled
    if (rugCheckSettings.block_returning_token_names || rugCheckSettings.block_returning_token_creators) {
      try {
        // Get duplicates based on token name and creator
        const duplicate = (await selectTokenByNameAndCreator(tokenName, tokenCreator)) || [];

        // Verify if duplicate token or creator was returned
        if (duplicate && duplicate.length !== 0) {
          if (rugCheckSettings.block_returning_token_names && (duplicate || []).some((token) => token.name === tokenName)) {
            logEngine.writeLog(`RugCheck`, `Token with this name was already created`, "red");
            return false;
          }
          if (rugCheckSettings.block_returning_token_creators && (duplicate || []).some((token) => token.creator === tokenCreator)) {
            logEngine.writeLog(`RugCheck`, `Token from this creator was already created`, "red");
            return false;
          }
        }
      } catch (error) {
        logEngine.writeLog(`RugCheck`, `Error checking for duplicate tokens: ${error}`, "red");
        // Continue with other checks even if this one fails
      }
    }

    // Create new token record for tracking
    const newToken: NewTokenRecord = {
      time: Date.now(),
      mint: tokenMint,
      name: tokenName,
      creator: tokenCreator,
    };

    try {
      await insertNewToken(newToken);
    } catch (err) {
      if (rugCheckSettings.block_returning_token_names || rugCheckSettings.block_returning_token_creators) {
        logEngine.writeLog(`RugCheck`, `Unable to store new token for tracking duplicate tokens: ${err}`, "red");
      }
      // Continue with other checks even if this one fails
    }

    // Validate all conditions
    for (const condition of conditions) {
      if (condition.check) {
        logEngine.writeLog(`RugCheck`, `Skipped: ${condition.message}`, "red");
        return false;
      }
    }

    return true;
  } catch (error) {
    logEngine.writeLog(`RugCheck`, `Error in rug check for token: ${tokenMint}: ${error}`, "red");
    return false; // Consider token unsafe if there's an error
  }
}
