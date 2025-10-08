// Quick script to reset emergency mode
// Convert to TypeScript execution

import('./src/emergency-safety-wrapper.js').then(module => {
  console.log("🔧 Resetting Emergency Safety Wrapper...");

  try {
    const wrapper = module.EmergencySafetyWrapper.getInstance();
    wrapper.resetEmergencyMode();
    console.log("✅ Emergency mode reset successfully");
    console.log("🚀 Bot can now execute trades");
  } catch (error) {
    console.error("❌ Error resetting emergency mode:", error.message);
  }

  process.exit(0);
}).catch(error => {
  console.error("❌ Import error:", error.message);
  process.exit(1);
});