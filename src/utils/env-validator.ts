import dotenv from "dotenv";
// Load environment variables
dotenv.config();

export interface EnvConfig {
  RPC_HTTPS_URI: string;
  RPC_WSS_URI: string;
  SNIPEROO_API_KEY: string;
  PUBKEY: string;
  GRPC_HTTP_URI: string;
  PRIVATE_KEY: string;
  GRPC_AUTH_TOKEN: string;
}

export function validateEnv(): EnvConfig {
  const requiredEnvVars = ["RPC_HTTPS_URI", "RPC_WSS_URI"] as const;

  const missingVars = requiredEnvVars.filter((envVar) => {
    return !process.env[envVar];
  });

  if (missingVars.length > 0) {
    throw new Error(`🚫 Missing required environment variables: ${missingVars.join(", ")}`);
  }

  return {
    RPC_HTTPS_URI: process.env.RPC_HTTPS_URI!,
    RPC_WSS_URI: process.env.RPC_WSS_URI!,
    SNIPEROO_API_KEY: process.env.SNIPEROO_API_KEY!,
    PUBKEY: process.env.PUBKEY!,
    GRPC_HTTP_URI: process.env.GRPC_HTTP_URI!,
    PRIVATE_KEY: process.env.PRIVATE_KEY!,
    GRPC_AUTH_TOKEN: process.env.GRPC_AUTH_TOKEN!,
  };
}
