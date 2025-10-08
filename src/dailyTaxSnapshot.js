/**
 * Daily Tax Snapshot Generator
 * Runs at 23:59:59 to create dated tax files in monthly folders
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

class DailyTaxSnapshot {
  constructor() {
    this.baseDir = path.join('data', 'tax_reports');
  }

  getDateInfo() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    
    return {
      date: now,
      dateString: `${month}_${day}_${year}`,
      monthFolder: `${year}-${month}`,
      quarter: `Q${Math.ceil((now.getMonth() + 1) / 3)}_${year}`
    };
  }

  async runDailySnapshot() {
    const { dateString, monthFolder, quarter } = this.getDateInfo();
    
    // Create folder structure: data/tax_reports/2025-01/
    const monthPath = path.join(this.baseDir, monthFolder);
    if (!fs.existsSync(monthPath)) {
      fs.mkdirSync(monthPath, { recursive: true });
      console.log(`Created folder: ${monthPath}`);
    }

    // Run the tax processor
    console.log(`Running tax processor for ${dateString}...`);
    
    exec('node src/simpleTaxProcessor.js', (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error}`);
        return;
      }

      // Move and rename the generated files
      const files = [
        { 
          source: path.join('data', 'tax_export_2025.csv'),
          dest: path.join(monthPath, `tax_export_${dateString}.csv`)
        },
        {
          source: path.join('data', 'tax_summary_2025.txt'),
          dest: path.join(monthPath, `tax_summary_${dateString}.txt`)
        },
        {
          source: path.join('data', 'token_registry.json'),
          dest: path.join(monthPath, `token_registry_${dateString}.json`)
        }
      ];

      files.forEach(file => {
        if (fs.existsSync(file.source)) {
          fs.copyFileSync(file.source, file.dest);
          console.log(`✓ Created: ${file.dest}`);
        }
      });

      // Create quarterly summary
      this.createQuarterlySummary(quarter, monthPath);
      
      console.log(`\n✅ Daily tax snapshot complete!`);
      console.log(`📁 Files saved in: ${monthPath}`);
      console.log(`📅 Quarter: ${quarter}`);
    });
  }

  createQuarterlySummary(quarter, monthPath) {
    const summaryPath = path.join(this.baseDir, `${quarter}_summary.txt`);
    const entry = `${new Date().toISOString()}: Snapshot saved to ${monthPath}\n`;
    
    fs.appendFileSync(summaryPath, entry);
    console.log(`✓ Updated quarterly summary: ${quarter}`);
  }

  scheduleDailyRun() {
    const now = new Date();
    const tonight = new Date(now);
    tonight.setHours(23, 59, 59, 0);
    
    const msUntilRun = tonight.getTime() - now.getTime();
    
    if (msUntilRun > 0) {
      console.log(`⏰ Scheduled for ${tonight.toLocaleString()}`);
      console.log(`   (in ${Math.floor(msUntilRun / 1000 / 60)} minutes)`);
      
      setTimeout(() => {
        this.runDailySnapshot();
        // Schedule next day
        setInterval(() => this.runDailySnapshot(), 24 * 60 * 60 * 1000);
      }, msUntilRun);
    } else {
      // If past 23:59:59, run immediately then schedule for tomorrow
      this.runDailySnapshot();
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(23, 59, 59, 0);
      
      setTimeout(() => {
        this.runDailySnapshot();
        setInterval(() => this.runDailySnapshot(), 24 * 60 * 60 * 1000);
      }, tomorrow.getTime() - now.getTime());
    }
  }
}

// Run different modes
if (require.main === module) {
  const snapshot = new DailyTaxSnapshot();
  
  const args = process.argv.slice(2);
  if (args[0] === '--schedule') {
    // Schedule mode: node src/dailyTaxSnapshot.js --schedule
    snapshot.scheduleDailyRun();
  } else {
    // Manual mode: node src/dailyTaxSnapshot.js
    snapshot.runDailySnapshot();
  }
}

module.exports = DailyTaxSnapshot;