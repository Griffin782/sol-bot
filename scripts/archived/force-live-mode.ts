// force-live-mode.ts
console.log("🔨 SLEDGEHAMMER MODE: FORCING ALL SYSTEMS TO LIVE TRADING");
process.env.TEST_MODE = "false";
process.env.SIMULATION_MODE = "false";
export const FORCE_LIVE = true;