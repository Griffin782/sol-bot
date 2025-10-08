#!/usr/bin/env python3
"""
Crypto Trading Bot Data to IRS Tax Format Converter

Converts trading bot logs to standardized CSV format for crypto tax services
Handles pool transactions, trading logs, and withdrawals
"""

import json
import csv
import pandas as pd
from datetime import datetime
from typing import Dict, List, Any
import re

class CryptoTaxConverter:
    def __init__(self):
        self.transactions = []
        self.token_cache = {}  # Cache for token mint to symbol mapping
        
    def load_token_symbols(self, token_mapping_file=None):
        """Load token mint to symbol mapping"""
        # You'll need to create this mapping or use a token registry
        default_tokens = {
            "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v": "USDC",
            "7cFh3fT6yXSSBqeVqSQm4YS8KUiwopGLErB9WwG4pump": "UNKNOWN_TOKEN",
            "So11111111111111111111111111111111111111112": "SOL"
        }
        
        if token_mapping_file:
            with open(token_mapping_file, 'r') as f:
                custom_tokens = json.load(f)
                default_tokens.update(custom_tokens)
                
        self.token_cache = default_tokens

    def process_pool_transactions(self, pool_csv_path: str):
        """Process pool_transactions.csv file"""
        df = pd.read_csv(pool_csv_path)
        
        for _, row in df.iterrows():
            timestamp = row.iloc[0]
            action_type = row.iloc[1] 
            amount = float(row.iloc[2]) if row.iloc[2] else 0
            
            if action_type == "trade_execution":
                # This is a BUY transaction
                self.transactions.append({
                    'Date': timestamp,
                    'Type': 'BUY',
                    'Buy Amount': abs(amount),  # Make positive
                    'Buy Currency': 'USD',
                    'Sell Amount': '',
                    'Sell Currency': '',
                    'Fee': 0,  # You may need to add fee logic
                    'Fee Currency': 'SOL',
                    'Exchange': 'TradingBot',
                    'Trade Group': f"Trade_{row.iloc[5]}",  # Trade number
                    'Comment': row.iloc[6] if len(row) > 6 else ''
                })
                
            elif action_type in ["profit_return", "loss_return"]:
                # This is a SELL transaction
                self.transactions.append({
                    'Date': timestamp,
                    'Type': 'SELL',
                    'Buy Amount': '',
                    'Buy Currency': '',
                    'Sell Amount': amount,
                    'Sell Currency': 'USD',
                    'Fee': 0,
                    'Fee Currency': 'SOL',
                    'Exchange': 'TradingBot',
                    'Trade Group': f"Trade_{row.iloc[5]}",
                    'Comment': row.iloc[6] if len(row) > 6 else ''
                })

    def process_trading_log(self, trading_json_path: str):
        """Process trading_log.json file"""
        with open(trading_json_path, 'r') as f:
            for line in f:
                if line.strip():
                    data = json.loads(line)
                    
                    if data['action'] == 'immediate_buy':
                        token_symbol = self.get_token_symbol(data['tokenMint'])
                        
                        self.transactions.append({
                            'Date': data['timestamp'],
                            'Type': 'BUY',
                            'Buy Amount': data['amount'] / data['entryPrice'],  # Token amount
                            'Buy Currency': token_symbol,
                            'Sell Amount': data['amount'],  # USD amount
                            'Sell Currency': 'USD',
                            'Fee': 0,  # Add fee calculation if available
                            'Fee Currency': 'SOL',
                            'Exchange': 'TradingBot',
                            'Trade Group': f"Trade_{data['poolStatus']['totalTrades']}",
                            'Comment': f"Entry Price: ${data['entryPrice']:.6f}"
                        })

    def process_withdrawals(self, withdrawals_jsonl_path: str):
        """Process withdrawals.jsonl file"""
        with open(withdrawals_jsonl_path, 'r') as f:
            for line in f:
                if line.strip():
                    data = json.loads(line)
                    
                    # Only process actual withdrawals, not summary lines
                    if 'withdrawalNumber' in data and 'type' in data:
                        withdrawal_type = 'HARDWARE' if data['type'] == 'HARDWARE' else 'TAX_PAYMENT'
                        
                        self.transactions.append({
                            'Date': data['timestamp'],
                            'Type': 'WITHDRAWAL',
                            'Buy Amount': '',
                            'Buy Currency': '',
                            'Sell Amount': data['amountSOL'],
                            'Sell Currency': 'SOL',
                            'Fee': 0,
                            'Fee Currency': 'SOL',
                            'Exchange': 'TradingBot',
                            'Trade Group': f"Withdrawal_{data['withdrawalNumber']}",
                            'Comment': f"{withdrawal_type}: ${data['amountUSD']:.2f}"
                        })

    def get_token_symbol(self, token_mint: str) -> str:
        """Get token symbol from mint address"""
        return self.token_cache.get(token_mint, token_mint[:8] + "...")

    def export_to_csv(self, output_path: str):
        """Export transactions to CSV format for tax services"""
        df = pd.DataFrame(self.transactions)
        
        # Sort by date
        df['Date'] = pd.to_datetime(df['Date'])
        df = df.sort_values('Date')
        
        # Convert back to string for export
        df['Date'] = df['Date'].dt.strftime('%Y-%m-%d %H:%M:%S')
        
        df.to_csv(output_path, index=False)
        return len(df)

    def export_to_rp2_format(self, output_path: str):
        """Export in RP2-specific format"""
        rp2_transactions = []
        
        for tx in self.transactions:
            if tx['Type'] == 'BUY':
                rp2_transactions.append({
                    'unique_id': f"buy_{tx['Trade Group']}_{tx['Date']}",
                    'timestamp': tx['Date'],
                    'asset': tx['Buy Currency'],
                    'exchange': tx['Exchange'],
                    'holder': 'TradingBot',
                    'transaction_type': 'BUY',
                    'spot_price': float(tx['Sell Amount']) / float(tx['Buy Amount']) if tx['Buy Amount'] and tx['Sell Amount'] else 0,
                    'crypto_in': tx['Buy Amount'],
                    'crypto_fee': tx['Fee'],
                    'fiat_in_no_fee': tx['Sell Amount'],
                    'fiat_fee': 0
                })
            elif tx['Type'] == 'SELL':
                rp2_transactions.append({
                    'unique_id': f"sell_{tx['Trade Group']}_{tx['Date']}",
                    'timestamp': tx['Date'],
                    'asset': tx['Sell Currency'] if tx['Sell Currency'] != 'USD' else 'SOL',
                    'exchange': tx['Exchange'],
                    'holder': 'TradingBot',
                    'transaction_type': 'SELL',
                    'spot_price': 0,  # Will be calculated by RP2
                    'crypto_out_no_fee': tx['Sell Amount'],
                    'crypto_fee': tx['Fee'],
                    'fiat_out_no_fee': tx['Sell Amount'],
                    'fiat_fee': 0
                })
        
        df = pd.DataFrame(rp2_transactions)
        df.to_csv(output_path, index=False)
        return len(df)

    def generate_summary(self) -> Dict[str, Any]:
        """Generate summary statistics"""
        total_transactions = len(self.transactions)
        buy_count = len([t for t in self.transactions if t['Type'] == 'BUY'])
        sell_count = len([t for t in self.transactions if t['Type'] == 'SELL'])
        withdrawal_count = len([t for t in self.transactions if t['Type'] == 'WITHDRAWAL'])
        
        return {
            'total_transactions': total_transactions,
            'buy_transactions': buy_count,
            'sell_transactions': sell_count,
            'withdrawals': withdrawal_count,
            'date_range': {
                'start': min([t['Date'] for t in self.transactions]) if self.transactions else None,
                'end': max([t['Date'] for t in self.transactions]) if self.transactions else None
            }
        }

def main():
    """Example usage with file requirements check"""
    converter = CryptoTaxConverter()
    
    # Check for required files and provide guidance
    required_files = {
        "pool_transactions.csv": "Your main transaction log",
        "trading_log.json": "Detailed buy transaction data", 
        "withdrawals.jsonl": "Withdrawal transactions"
    }
    
    optional_files = {
        "token_registry.json": "Token mint address to symbol mapping",
        "sell_transactions.csv": "Detailed sell transaction data"
    }
    
    print("Checking for required files...")
    for filename, description in required_files.items():
        try:
            with open(filename, 'r') as f:
                print(f"✓ Found {filename} - {description}")
        except FileNotFoundError:
            print(f"✗ Missing {filename} - {description}")
            return
    
    print("\nChecking for optional files...")
    for filename, description in optional_files.items():
        try:
            with open(filename, 'r') as f:
                print(f"✓ Found {filename} - {description}")
        except FileNotFoundError:
            print(f"⚠ Missing {filename} - {description}")
    
    # Load token symbols and sell data if available
    print("\nLoading configuration...")
    converter.load_token_symbols()
    converter.load_sell_transactions()
    
    # Process your data files
    print("\nProcessing transactions...")
    converter.process_pool_transactions("pool_transactions.csv")
    converter.process_trading_log("trading_log.json")
    converter.process_withdrawals("withdrawals.jsonl")
    
    # Export to different formats
    print("\nExporting files...")
    standard_count = converter.export_to_csv("crypto_tax_standard.csv")
    rp2_count = converter.export_to_rp2_format("crypto_tax_rp2.csv")
    quality_issues = converter.export_data_quality_report("data_quality_report.csv")
    
    # Generate summary
    summary = converter.generate_summary()
    print(f"\n=== PROCESSING SUMMARY ===")
    print(f"Total transactions processed: {summary['total_transactions']}")
    print(f"  - Buy transactions: {summary['buy_transactions']}")
    print(f"  - Sell transactions: {summary['sell_transactions']}")
    print(f"  - Withdrawals: {summary['withdrawals']}")
    print(f"  - Incomplete trades: {summary['incomplete_trades']}")
    print(f"Total fees tracked: ${summary['total_fees']:.2f}")
    
    print(f"\n=== DATA QUALITY ===")
    print(f"Complete transactions: {summary['data_quality']['complete_trades']}")
    print(f"Missing token IDs: {summary['data_quality']['missing_token_ids']}")
    print(f"Transactions with zero fees: {summary['data_quality']['missing_fees']}")
    
    print(f"\n=== FILES GENERATED ===")
    print(f"- crypto_tax_standard.csv ({standard_count} transactions)")
    print(f"- crypto_tax_rp2.csv ({rp2_count} transactions)")
    print(f"- data_quality_report.csv ({quality_issues} issues to review)")
    
    if summary['incomplete_trades'] > 0:
        print(f"\n⚠️  WARNING: {summary['incomplete_trades']} incomplete trades found!")
        print("Check data_quality_report.csv for details and create missing files:")
        print("- sell_transactions.csv (for complete sell data)")
        print("- token_registry.json (for token symbol mapping)")
    
    print(f"\n=== NEXT STEPS ===")
    print("1. Review data_quality_report.csv for any issues")
    print("2. Create missing files if needed:")
    print("   - DATA FOLDER/token_registry.json for unknown tokens")
    print("   - DATA FOLDER/sell_transactions.csv for incomplete sells")
    print("3. Upload crypto_tax_standard.csv to your tax service")
    print("4. Or use crypto_tax_rp2.csv with RP2 open-source tool")

if __name__ == "__main__":
    main()