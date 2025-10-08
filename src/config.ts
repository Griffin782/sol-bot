// config.ts - Unified Configuration for sol-bot
import { MASTER_SETTINGS } from './core/UNIFIED-CONTROL';

export const config = {
  // Data stream configuration (from original)
  data_stream: {
    method: "wss", // wss=WebSocket, grpc=gRPC
    mode: "program", // program=To track specific program, wallet=To track specific wallet
    program: [
      {
        key: "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
        log_discriminator: "Program log: Instruction: InitializeMint2",
        name: "pumpfun token creation",
        enabled: true,
      },
      {
        key: "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
        log_discriminator: "Program log: initialize2: InitializeInstruction2",
        name: "raydium pool creation",
        enabled: false,
      },
    ],
    wallet: [
      {
        key: "EmKj5PB2V6QHQ3uD2NkwGSEum3C5z61p8ehWAGyMcBUV",
        name: "MainWallet",
        enabled: false,
      },
    ],
  },
  
  // Pool configuration from UNIFIED-CONTROL
  concurrent_transactions: 1,
  wsol_pc_mint: "So11111111111111111111111111111111111111112",
  
  db: {
    pathname: "src/tracker/tokens.db",
  },
  
  // Token buy configuration with Pool integration
  token_buy: {
    provider: "jupiter", // jupiter or sniperoo
    sol_amount: MASTER_SETTINGS.pool.positionSizeSOL, 
    jupiter: {
      slippageBps: 2000,
      prioFeeMaxSOL: 0.01,
      jitoTipSOL: 0.00312,
      mode: "prio",
      wrapAndUnwrapSol: true,
    },
    play_sound: true,
    play_sound_text: "Order Filled!",
    open_browser: false,
  },
  
  // Token sell configuration with enhanced exit strategy
  token_sell: {
    wallet_token_balances_monitor_interval: 60000,
    jupiter: {
      skip_sell_copy_trade: true,
    },
    sniperoo: {
      enabled: false,
      strategy: "simple",
      stop_loss_config: MASTER_SETTINGS.exit,
    },
  },
  
  // Enhanced checks with Pool safety
  checks: {
    simulation_mode: false, // SET TO TRUE FOR TESTING
    mode: "minimal",
    verbose_logs: true,
    settings: {
      allow_mint_authority: false,
      allow_freeze_authority: false,
      max_alowed_pct_topholders: 35,
      exclude_lp_from_topholders: true,
      block_returning_token_names: true,
      block_returning_token_creators: true,
      allow_insider_topholders: false,
      allow_not_initialized: false,
      allow_rugged: false,
      allow_mutable: false,
      min_total_lp_providers: 1,
      min_total_markets: 1,
      min_total_market_Liquidity: 1000,
      ignore_ends_with_pump: false,
      max_score: 0,
      block_symbols: ["XXX"],
      block_names: ["XXX"],
      allow_symbols: [""],
      allow_names: [""],
      min_token_age_seconds: 0,
      max_token_age_seconds: 0,
      signature_history: 10,
    },
  },
  
  axios: {
    get_timeout: 10000,
  },
  
  // Import Pool management settings
  pool: MASTER_SETTINGS.pool,
  exit: MASTER_SETTINGS.exit,
  entry: MASTER_SETTINGS.entry,
  // performance: MASTER_SETTINGS.performance, // Not available in UNIFIED-CONTROL
  // whales: MASTER_SETTINGS.z_whales,
  execution: MASTER_SETTINGS.execution,
  // network: MASTER_SETTINGS.network, // Not available in UNIFIED-CONTROL - use api.rpcEndpoint instead
  // reporting: MASTER_SETTINGS.z_reporting,
};