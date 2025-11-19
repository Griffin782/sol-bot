export interface NewTokenRecord {
  id?: number; // Optional because it's added by the database
  time: number;
  name: string;
  mint: string;
  creator: string;
}
export interface MintsDataReponse {
  tokenMint?: string;
  solMint?: string;
}
export interface RugResponseExtended {
  mint: string;
  tokenProgram: string;
  creator: string;
  token: {
    mintAuthority: string | null;
    supply: number;
    decimals: number;
    isInitialized: boolean;
    freezeAuthority: string | null;
  };
  token_extensions: unknown | null;
  tokenMeta: {
    name: string;
    symbol: string;
    uri: string;
    mutable: boolean;
    updateAuthority: string;
  };
  topHolders: {
    address: string;
    amount: number;
    decimals: number;
    pct: number;
    uiAmount: number;
    uiAmountString: string;
    owner: string;
    insider: boolean;
  }[];
  freezeAuthority: string | null;
  mintAuthority: string | null;
  risks: {
    name: string;
    value: string;
    description: string;
    score: number;
    level: string;
  }[];
  score: number;
  fileMeta: {
    description: string;
    name: string;
    symbol: string;
    image: string;
  };
  lockerOwners: Record<string, unknown>;
  lockers: Record<string, unknown>;
  lpLockers: unknown | null;
  markets: {
    pubkey: string;
    marketType: string;
    mintA: string;
    mintB: string;
    mintLP: string;
    liquidityA: string;
    liquidityB: string;
  }[];
  totalMarketLiquidity: number;
  totalLPProviders: number;
  rugged: boolean;
}
export interface DataStreamPrograms {
  key: string;
  log_discriminator: string;
  name: string;
  enabled: boolean;
}
export interface DataStreamWallets {
  key: string;
  name: string;
  enabled: boolean;
}
export interface JupiterSwapQuoteResponse {
  inputMint: string;
  inAmount: string;
  outputMint: string;
  outAmount: string;
  otherAmountThreshold: string;
  swapMode: "ExactIn" | "ExactOut";
  slippageBps: number;
  platformFee: number | null;
  priceImpactPct: string;
  routePlan: {
    swapInfo: {
      ammKey: string;
      label: string;
      inputMint: string;
      outputMint: string;
      inAmount: string;
      outAmount: string;
      feeAmount: string;
      feeMint: string;
    };
    percent: number;
  }[];
  contextSlot: number;
  timeTaken: number;
}

/**
 * Swap execution result with token amounts
 * Created: October 28, 2025
 * Purpose: Return actual token amounts from swapToken() instead of just boolean
 */
export interface SwapResult {
  success: boolean;           // Whether swap succeeded
  outputAmount?: number;      // Tokens received (from quote outAmount)
  inputAmount?: number;       // SOL spent (from quote inAmount)
  txSignature?: string;       // Transaction signature if successful
  priceImpactPct?: string;    // Price impact percentage
  error?: string;             // Error message if failed
}

/**
 * Sell swap result for exit tracking
 * Created: November 17, 2025 (Phase 3A)
 * Purpose: Track actual SOL received and tokens sold for real ROI calculation
 */
export interface SellSwapResult {
  success: boolean;           // Whether sell succeeded
  solReceived?: number;       // SOL received from sale (quote outAmount)
  tokensSold?: number;        // Tokens sold (quote inAmount)
  txSignature?: string;       // Transaction signature if successful
  priceImpactPct?: string;    // Price impact percentage
  error?: string;             // Error message if failed
}

export interface JupiterSwapResponse {
  swapTransaction: string;
  lastValidBlockHeight: number;
  prioritizationFeeLamports: number;
  computeUnitLimit: number;
  prioritizationType: {
    computeBudget: {
      microLamports: number;
      estimatedMicroLamports: number;
    };
  };
  dynamicSlippageReport: {
    slippageBps: number;
    otherAmount: number;
    simulatedIncurredSlippageBps: number;
    amplificationRatio: string;
    categoryName: string;
    heuristicMaxSlippageBps: number;
  };
  simulationError: string | null;
}
export interface SniperooSwapResponse {
  data: {
    purchases: {
      txSignature: string;
      tokenAmount: string;
      tokenAmountInUSD: string;
      tokenPriceInUSD: string;
    }[];
    solPriceInUSD: string;
  };
}
export interface HandledMint {
  mint: string;
  provider: string;
}
export interface NewPositionRecord {
  id?: number; // Optional because it's added by the database
  time: number;
  mint: string;
  provider: string;
  signer: string;
  init_tokens: number;
  init_sol: number;
  init_tx: string;
}
