# Tax Compliance System

This directory contains all tax-related files for SOL trading bot transactions.

## Directory Structure

```
tax-compliance/
├── 2025/
│   ├── transactions/
│   │   └── all-transactions.json          # All trading transactions
│   ├── reports/
│   │   └── daily-YYYY-MM-DD.json         # Daily trading summaries
│   ├── form8949/
│   │   └── form8949-data.csv             # IRS Form 8949 compatible data
│   └── year-end-package/
│       ├── tax-summary-2025.json         # Annual summary
│       └── TAX-INSTRUCTIONS-README.txt   # Filing instructions
└── README.md                             # This file
```

## Transaction Types

- **BUY**: Token purchase transactions
- **SELL**: Token sale transactions  
- **FEE**: Transaction fees (deductible)

## Tax Calculation Method

- **FIFO (First In, First Out)**: Default method for cost basis calculation
- **Short-term gains**: All crypto trades held < 1 year
- **Realized gains**: Calculated automatically on sell transactions

## Integration

The TaxComplianceTracker class in `src/advanced-features.ts` automatically:
1. Records all buy/sell transactions
2. Calculates realized gains using FIFO
3. Generates daily reports
4. Creates Form 8949 compatible CSV files
5. Produces year-end tax packages

## Usage

The system activates automatically when trading. Manual functions:
- `generateDailyReport()`: Create today's summary
- `generateForm8949Report()`: Export tax filing data
- `generateYearEndTaxPackage()`: Create complete tax package

## Important Notes

- Keep all files for 7 years (IRS requirement)
- Exchange rates use real-time market prices
- All amounts in USD
- Review accuracy before filing