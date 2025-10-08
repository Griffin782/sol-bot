// Quick script to reset emergency mode
import { EmergencySafetyWrapper } from './src/emergency-safety-wrapper';

console.log("🔧 Resetting Emergency Safety Wrapper...");

try {
  const wrapper = EmergencySafetyWrapper.getInstance();
  wrapper.resetEmergencyMode();
  console.log("✅ Emergency mode reset successfully");
  console.log("🚀 Bot can now execute trades");
} catch (error) {
  console.error("❌ Error resetting emergency mode:", (error as Error).message);
}

process.exit(0);