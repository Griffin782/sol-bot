# Critical System Test Examples

This document provides ready-to-use test templates for the 4 critical systems with zero test coverage.

---

## 1. PARTIAL-EXIT-SYSTEM.ts Tests

**File Location:** `src/core/__tests__/PARTIAL-EXIT-SYSTEM.test.ts`

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  PartialExitManager,
  DEFAULT_EXIT_TIERS,
  PositionWithExits,
  ExitResult
} from '../PARTIAL-EXIT-SYSTEM';

describe('PartialExitManager', () => {
  let manager: PartialExitManager;
  const mockMint = 'TestMint123456789';
  const mockCallback = jest.fn();

  beforeEach(() => {
    manager = new PartialExitManager();
    mockCallback.mockClear();
  });

  describe('Position Creation', () => {
    it('should create position with correct initial values', () => {
      manager.addPosition({
        mint: mockMint,
        symbol: 'TEST',
        entryPrice: 0.001,
        initialAmount: 1000000,
        investedSOL: 1.0
      });

      const position = manager.getPosition(mockMint);

      expect(position).toBeDefined();
      expect(position.mint).toBe(mockMint);
      expect(position.remainingAmount).toBe(1000000);
      expect(position.isComplete).toBe(false);
    });

    it('should calculate trigger prices correctly', () => {
      manager.addPosition({
        mint: mockMint,
        entryPrice: 0.001,
        initialAmount: 1000000,
        investedSOL: 1.0
      });

      const position = manager.getPosition(mockMint);

      // Tier 1: 2x = 0.002
      expect(position.exitTiers[0].triggerPrice).toBe(0.002);
      // Tier 2: 4x = 0.004
      expect(position.exitTiers[1].triggerPrice).toBe(0.004);
      // Tier 3: 6x = 0.006
      expect(position.exitTiers[2].triggerPrice).toBe(0.006);
      // Tier 4: Moonbag = Infinity
      expect(position.exitTiers[3].triggerPrice).toBe(Infinity);
    });

    it('should initialize all tiers as not executed', () => {
      manager.addPosition({
        mint: mockMint,
        entryPrice: 0.001,
        initialAmount: 1000000,
        investedSOL: 1.0
      });

      const position = manager.getPosition(mockMint);

      position.exitTiers.forEach(tier => {
        expect(tier.executed).toBe(false);
      });
    });
  });

  describe('Price Updates and Triggers', () => {
    beforeEach(() => {
      manager.addPosition({
        mint: mockMint,
        entryPrice: 0.001,
        initialAmount: 1000000,
        investedSOL: 1.0
      });
    });

    it('should not trigger any tier at 1.5x', () => {
      manager.updatePrice(mockMint, 0.0015);
      const position = manager.getPosition(mockMint);

      expect(position.exitTiers.every(t => !t.executed)).toBe(true);
    });

    it('should trigger tier 1 at 2x price', () => {
      manager.updatePrice(mockMint, 0.002);
      const triggers = manager.checkPositionExits(mockMint);

      expect(triggers).toHaveLength(1);
      expect(triggers[0].name).toBe('Tier 1 - First Profit');
      expect(triggers[0].multiplier).toBe(2);
    });

    it('should trigger tier 2 at 4x price', () => {
      // First trigger tier 1
      manager.updatePrice(mockMint, 0.002);
      manager.checkPositionExits(mockMint);

      // Then trigger tier 2
      manager.updatePrice(mockMint, 0.004);
      const triggers = manager.checkPositionExits(mockMint);

      expect(triggers).toHaveLength(1);
      expect(triggers[0].name).toBe('Tier 2 - Strong Gain');
    });

    it('should trigger multiple tiers if price jumps', () => {
      // Jump from entry to 5x (should trigger tiers 1 and 2)
      manager.updatePrice(mockMint, 0.005);
      const triggers = manager.checkPositionExits(mockMint);

      expect(triggers.length).toBeGreaterThanOrEqual(2);
    });

    it('should never trigger moonbag tier', () => {
      // Even at 100x price
      manager.updatePrice(mockMint, 0.1);
      const triggers = manager.checkPositionExits(mockMint);

      // Should have triggered tiers 1, 2, 3 but NOT moonbag
      expect(triggers).toHaveLength(3);
      expect(triggers.every(t => t.name !== 'Tier 4 - Moonbag')).toBe(true);
    });
  });

  describe('Exit Execution', () => {
    beforeEach(() => {
      manager.addPosition({
        mint: mockMint,
        entryPrice: 0.001,
        initialAmount: 1000000,
        investedSOL: 1.0
      });
    });

    it('should sell correct percentage for tier 1', async () => {
      manager.updatePrice(mockMint, 0.002);
      const triggers = manager.checkPositionExits(mockMint);

      // Tier 1 should sell 25% of 1,000,000 = 250,000 tokens
      const expectedAmount = 1000000 * 0.25;
      expect(triggers[0].percentage).toBe(25);
    });

    it('should update remaining amount after exit', async () => {
      // Mock the exit execution
      const mockExitResult: ExitResult = {
        success: true,
        tier: DEFAULT_EXIT_TIERS[0],
        actualAmountSold: 250000,
        profitSOL: 0.25,
        remainingAmount: 750000,
        transactionSignature: 'mock_sig'
      };

      manager.updatePrice(mockMint, 0.002);
      // Simulate exit
      await manager.executeExit(mockMint, DEFAULT_EXIT_TIERS[0], mockExitResult);

      const position = manager.getPosition(mockMint);
      expect(position.remainingAmount).toBe(750000);
    });

    it('should calculate profit correctly', async () => {
      manager.updatePrice(mockMint, 0.002);

      // Sold 250,000 tokens at 0.002 = 0.5 SOL
      // Invested 0.25 SOL for those tokens (25% of 1.0 SOL)
      // Profit = 0.5 - 0.25 = 0.25 SOL

      const expectedProfit = 0.25;
      // Test profit calculation logic
    });

    it('should mark tier as executed after exit', async () => {
      manager.updatePrice(mockMint, 0.002);
      const triggers = manager.checkPositionExits(mockMint);

      const mockExitResult: ExitResult = {
        success: true,
        tier: triggers[0],
        actualAmountSold: 250000,
        profitSOL: 0.25,
        remainingAmount: 750000
      };

      await manager.executeExit(mockMint, triggers[0], mockExitResult);

      const position = manager.getPosition(mockMint);
      expect(position.exitTiers[0].executed).toBe(true);
    });

    it('should not trigger same tier twice', () => {
      // First trigger
      manager.updatePrice(mockMint, 0.002);
      manager.checkPositionExits(mockMint);

      // Try to trigger again
      manager.updatePrice(mockMint, 0.0025);
      const triggers = manager.checkPositionExits(mockMint);

      expect(triggers).toHaveLength(0);
    });
  });

  describe('Position Completion', () => {
    beforeEach(() => {
      manager.addPosition({
        mint: mockMint,
        entryPrice: 0.001,
        initialAmount: 1000000,
        investedSOL: 1.0
      });
    });

    it('should mark position complete after all non-moonbag tiers', async () => {
      // Execute all 3 tiers (not moonbag)
      manager.updatePrice(mockMint, 0.01); // Trigger all tiers

      const position = manager.getPosition(mockMint);
      // After 3 tiers executed (75% sold), only moonbag remains
      expect(position.remainingAmount).toBeLessThan(300000); // 25% moonbag
    });

    it('should preserve 25% as moonbag', async () => {
      // Execute all tiers
      manager.updatePrice(mockMint, 0.01);

      const position = manager.getPosition(mockMint);
      const moonbagPercentage = (position.remainingAmount / 1000000) * 100;

      expect(moonbagPercentage).toBeCloseTo(25, 1);
    });
  });

  describe('Edge Cases', () => {
    it('should handle position not found', () => {
      const position = manager.getPosition('NonExistentMint');
      expect(position).toBeUndefined();
    });

    it('should handle price updates for non-existent position', () => {
      expect(() => {
        manager.updatePrice('NonExistentMint', 0.002);
      }).not.toThrow();
    });

    it('should handle zero initial amount', () => {
      expect(() => {
        manager.addPosition({
          mint: 'ZeroMint',
          entryPrice: 0.001,
          initialAmount: 0,
          investedSOL: 0
        });
      }).toThrow();
    });

    it('should handle negative entry price', () => {
      expect(() => {
        manager.addPosition({
          mint: 'NegativeMint',
          entryPrice: -0.001,
          initialAmount: 1000000,
          investedSOL: 1.0
        });
      }).toThrow();
    });
  });
});
```

---

## 2. jupiterHandler.ts Tests

**File Location:** `src/utils/handlers/__tests__/jupiterHandler.test.ts`

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { swapToken, unSwapToken } from '../jupiterHandler';
import axios from 'axios';

// Mock axios
jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

// Mock env validator
jest.mock('../../env-validator', () => ({
  validateEnv: () => ({
    RPC_HTTPS_URI: 'https://mock-rpc.solana.com',
    PRIVATE_KEY: '[11,22,33,44]', // Array format
    WALLET_PUBLIC_KEY: 'MockWalletPublicKey123'
  })
}));

describe('jupiterHandler', () => {
  const mockLogger = {
    writeLog: jest.fn()
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('swapToken - Input Validation', () => {
    it('should reject invalid outputMint', async () => {
      const result = await swapToken('ValidMint', '', 0.1, mockLogger);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid outputMint');
    });

    it('should reject zero inputAmount', async () => {
      const result = await swapToken('ValidIn', 'ValidOut', 0, mockLogger);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid inputAmount');
    });

    it('should reject negative inputAmount', async () => {
      const result = await swapToken('ValidIn', 'ValidOut', -0.1, mockLogger);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid inputAmount');
    });
  });

  describe('swapToken - Private Key Handling', () => {
    it('should handle array format private key', async () => {
      // Mock successful quote response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          outAmount: '1000000',
          otherAmountThreshold: '950000'
        }
      });

      // Test should not throw on array format key
      await expect(
        swapToken('SOL', 'USDC', 0.001, mockLogger)
      ).resolves.toBeDefined();
    });

    it('should handle base58 format private key', async () => {
      // Override mock for base58 format
      jest.spyOn(require('../../env-validator'), 'validateEnv')
        .mockReturnValue({
          PRIVATE_KEY: 'Base58EncodedKey123456789',
          RPC_HTTPS_URI: 'https://mock-rpc.solana.com'
        });

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          outAmount: '1000000',
          otherAmountThreshold: '950000'
        }
      });

      await expect(
        swapToken('SOL', 'USDC', 0.001, mockLogger)
      ).resolves.toBeDefined();
    });
  });

  describe('swapToken - Rate Limiting', () => {
    it('should apply rate limit delay', async () => {
      const startTime = Date.now();

      mockedAxios.get.mockResolvedValueOnce({
        data: {
          outAmount: '1000000',
          otherAmountThreshold: '950000'
        }
      });

      await swapToken('SOL', 'USDC', 0.001, mockLogger);

      const elapsed = Date.now() - startTime;
      // Should have at least 100ms delay (default)
      expect(elapsed).toBeGreaterThanOrEqual(100);
    });

    it('should handle 429 rate limit error', async () => {
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 429 }
      });

      const result = await swapToken('SOL', 'USDC', 0.001, mockLogger);

      expect(result.success).toBe(false);
      expect(mockLogger.writeLog).toHaveBeenCalledWith(
        expect.anything(),
        expect.stringContaining('429'),
        expect.anything()
      );
    });

    it('should retry on 429 error', async () => {
      // First call: 429 error
      mockedAxios.get.mockRejectedValueOnce({
        response: { status: 429 }
      });

      // Second call: success
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          outAmount: '1000000',
          otherAmountThreshold: '950000'
        }
      });

      await swapToken('SOL', 'USDC', 0.001, mockLogger);

      // Should have attempted twice
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });
  });

  describe('swapToken - Quote Fetching', () => {
    it('should fetch quote with correct parameters', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          outAmount: '1000000',
          otherAmountThreshold: '950000'
        }
      });

      await swapToken('SOL_MINT', 'USDC_MINT', 0.1, mockLogger);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('quote'),
        expect.objectContaining({
          params: expect.objectContaining({
            inputMint: 'SOL_MINT',
            outputMint: 'USDC_MINT',
            amount: expect.any(Number)
          })
        })
      );
    });

    it('should handle quote API error', async () => {
      mockedAxios.get.mockRejectedValueOnce(
        new Error('Quote API failed')
      );

      const result = await swapToken('SOL', 'USDC', 0.1, mockLogger);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('swapToken - Transaction Execution', () => {
    it('should execute swap with valid quote', async () => {
      // Mock quote response
      mockedAxios.get.mockResolvedValueOnce({
        data: {
          outAmount: '1000000',
          otherAmountThreshold: '950000',
          quoteResponse: {}
        }
      });

      // Mock swap response
      mockedAxios.post.mockResolvedValueOnce({
        data: {
          swapTransaction: 'base64EncodedTransaction'
        }
      });

      const result = await swapToken('SOL', 'USDC', 0.1, mockLogger);

      expect(mockedAxios.post).toHaveBeenCalled();
    });

    it('should handle transaction simulation failure', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { outAmount: '1000000' }
      });

      mockedAxios.post.mockRejectedValueOnce({
        response: {
          data: { error: 'Transaction simulation failed' }
        }
      });

      const result = await swapToken('SOL', 'SCAM_TOKEN', 0.1, mockLogger);

      expect(result.success).toBe(false);
    });
  });

  describe('unSwapToken - Sell Logic', () => {
    it('should handle sell with correct parameters', async () => {
      mockedAxios.get.mockResolvedValueOnce({
        data: { outAmount: '100000000' }
      });

      await unSwapToken('TOKEN_MINT', 1000000, mockLogger);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.stringContaining('quote'),
        expect.objectContaining({
          params: expect.objectContaining({
            inputMint: 'TOKEN_MINT',
            outputMint: expect.stringContaining('111111'), // SOL
            amount: 1000000
          })
        })
      );
    });

    it('should handle sell of zero tokens', async () => {
      const result = await unSwapToken('TOKEN', 0, mockLogger);

      expect(result.success).toBe(false);
    });
  });
});
```

---

## 3. automated-reporter.ts (WhaleWatcher) Tests

**File Location:** `src/enhanced/__tests__/automated-reporter.test.ts`

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { WhaleWatcher } from '../automated-reporter';
import { Connection } from '@solana/web3.js';

// Mock Connection
jest.mock('@solana/web3.js', () => ({
  Connection: jest.fn().mockImplementation(() => ({
    getTokenAccountBalance: jest.fn(),
    getTokenLargestAccounts: jest.fn()
  }))
}));

describe('WhaleWatcher', () => {
  let whaleWatcher: WhaleWatcher;
  let mockConnection: jest.Mocked<Connection>;

  beforeEach(() => {
    mockConnection = new Connection('mock') as jest.Mocked<Connection>;
    whaleWatcher = new WhaleWatcher(mockConnection);
  });

  describe('Token Tracking', () => {
    it('should track new token with entry price', () => {
      whaleWatcher.trackToken('TestMint', 0.001, 0.1);

      // Verify token is tracked
      const isTracked = whaleWatcher.isTracking('TestMint');
      expect(isTracked).toBe(true);
    });

    it('should initialize remaining position to 100%', () => {
      whaleWatcher.trackToken('TestMint', 0.001, 1.0);

      const tokenData = whaleWatcher.getTokenData('TestMint');
      expect(tokenData.remainingPosition).toBe(1.0);
    });
  });

  describe('Exit Signal Generation', () => {
    beforeEach(() => {
      whaleWatcher.trackToken('TestMint', 0.001, 1.0);
    });

    it('should detect whale exodus at 2x', async () => {
      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.002, // 2x price
        3 // 3 whales sold
      );

      expect(signal.shouldExit).toBe(true);
      expect(signal.signalType).toBe('whale_exodus');
    });

    it('should detect liquidity drain', async () => {
      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.0015,
        0,
        -50 // 50% liquidity drop
      );

      expect(signal.shouldExit).toBe(true);
      expect(signal.signalType).toBe('liquidity_drain');
    });

    it('should calculate correct profit percentage', async () => {
      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.003, // 3x price
        1
      );

      expect(signal.profitPercentage).toBeCloseTo(200, 0); // 200% gain
    });
  });

  describe('Tiered Exit Logic', () => {
    beforeEach(() => {
      whaleWatcher.trackToken('TestMint', 0.001, 1.0);
    });

    it('should recommend 25% exit at tier 1', async () => {
      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.002, // 2x
        2
      );

      expect(signal.exitPercentage).toBe(25);
    });

    it('should recommend 25% exit at tier 2', async () => {
      // Simulate tier 1 already exited
      whaleWatcher.recordExit('TestMint', 0.25);

      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.004, // 4x
        2
      );

      expect(signal.exitPercentage).toBe(25);
    });

    it('should not recommend same tier twice', async () => {
      // First exit at 2x
      await whaleWatcher.analyzeExitSignals('TestMint', 0.002, 2);
      whaleWatcher.recordExit('TestMint', 0.25);

      // Try to trigger tier 1 again
      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.0021, // Still around 2x
        1
      );

      // Should wait for tier 2 at 4x
      expect(signal.shouldExit).toBe(false);
    });
  });

  describe('Confidence Scoring', () => {
    beforeEach(() => {
      whaleWatcher.trackToken('TestMint', 0.001, 1.0);
    });

    it('should assign high confidence for whale exodus + liquidity drain', async () => {
      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.002,
        5, // Many whales sold
        -40 // Big liquidity drop
      );

      expect(signal.confidence).toBe('high');
    });

    it('should assign medium confidence for whale exodus only', async () => {
      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.002,
        3, // Moderate whale activity
        0 // No liquidity change
      );

      expect(signal.confidence).toBe('medium');
    });

    it('should assign low confidence for weak signals', async () => {
      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.0015, // 1.5x only
        1, // Only 1 whale
        0
      );

      expect(signal.confidence).toBe('low');
    });
  });

  describe('Position Management', () => {
    it('should update remaining position after exit', () => {
      whaleWatcher.trackToken('TestMint', 0.001, 1.0);

      whaleWatcher.recordExit('TestMint', 0.25); // 25% exit

      const tokenData = whaleWatcher.getTokenData('TestMint');
      expect(tokenData.remainingPosition).toBe(0.75);
    });

    it('should track multiple exits', () => {
      whaleWatcher.trackToken('TestMint', 0.001, 1.0);

      whaleWatcher.recordExit('TestMint', 0.25); // First tier
      whaleWatcher.recordExit('TestMint', 0.25); // Second tier

      const tokenData = whaleWatcher.getTokenData('TestMint');
      expect(tokenData.remainingPosition).toBeCloseTo(0.5, 2);
    });
  });

  describe('Edge Cases', () => {
    it('should handle exit signal for untracked token', async () => {
      const signal = await whaleWatcher.analyzeExitSignals(
        'UnknownMint',
        0.002,
        3
      );

      expect(signal.shouldExit).toBe(false);
    });

    it('should handle zero whale activity', async () => {
      whaleWatcher.trackToken('TestMint', 0.001, 1.0);

      const signal = await whaleWatcher.analyzeExitSignals(
        'TestMint',
        0.005, // High price
        0 // But no whale activity
      );

      // Should still evaluate based on price
      expect(signal).toBeDefined();
    });
  });
});
```

---

## 4. token-queue-system.ts Tests

**File Location:** `src/enhanced/__tests__/token-queue-system.test.ts`

```typescript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { TokenQueueManager } from '../token-queue-system';

describe('TokenQueueManager', () => {
  let queueManager: TokenQueueManager;

  beforeEach(() => {
    queueManager = new TokenQueueManager(100); // Max 100 tokens
  });

  describe('Token Addition', () => {
    it('should add token to queue', () => {
      queueManager.addTokenToQueue({
        mint: 'TestMint1',
        score: 75,
        detectedAt: Date.now(),
        liquidity: 50000,
        holders: 200
      });

      const queueSize = queueManager.getQueueSize();
      expect(queueSize).toBe(1);
    });

    it('should reject duplicate tokens', () => {
      const token = {
        mint: 'TestMint1',
        score: 75,
        detectedAt: Date.now(),
        liquidity: 50000,
        holders: 200
      };

      queueManager.addTokenToQueue(token);
      queueManager.addTokenToQueue(token); // Duplicate

      expect(queueManager.getQueueSize()).toBe(1);
    });

    it('should maintain max queue size', () => {
      // Add 150 tokens to queue with max 100
      for (let i = 0; i < 150; i++) {
        queueManager.addTokenToQueue({
          mint: `TestMint${i}`,
          score: 50 + i,
          detectedAt: Date.now(),
          liquidity: 10000,
          holders: 100
        });
      }

      expect(queueManager.getQueueSize()).toBeLessThanOrEqual(100);
    });
  });

  describe('Priority Ordering', () => {
    it('should prioritize high-score tokens', () => {
      queueManager.addTokenToQueue({
        mint: 'LowScore',
        score: 60,
        detectedAt: Date.now(),
        liquidity: 10000,
        holders: 50
      });

      queueManager.addTokenToQueue({
        mint: 'HighScore',
        score: 90,
        detectedAt: Date.now(),
        liquidity: 50000,
        holders: 300
      });

      const nextToken = queueManager.getNextToken();
      expect(nextToken.mint).toBe('HighScore');
    });

    it('should use timestamp as tiebreaker for equal scores', () => {
      const now = Date.now();

      queueManager.addTokenToQueue({
        mint: 'Second',
        score: 75,
        detectedAt: now + 1000,
        liquidity: 25000,
        holders: 150
      });

      queueManager.addTokenToQueue({
        mint: 'First',
        score: 75,
        detectedAt: now,
        liquidity: 25000,
        holders: 150
      });

      const nextToken = queueManager.getNextToken();
      expect(nextToken.mint).toBe('First'); // Earlier timestamp
    });
  });

  describe('Token Scoring', () => {
    it('should assign higher score to high liquidity', () => {
      const highLiqScore = queueManager.scoreToken({
        mint: 'HighLiq',
        liquidity: 100000,
        holders: 200,
        volume: 50000,
        priceChange: 0.1
      });

      const lowLiqScore = queueManager.scoreToken({
        mint: 'LowLiq',
        liquidity: 5000,
        holders: 200,
        volume: 50000,
        priceChange: 0.1
      });

      expect(highLiqScore).toBeGreaterThan(lowLiqScore);
    });

    it('should assign higher score to more holders', () => {
      const manyHoldersScore = queueManager.scoreToken({
        mint: 'ManyHolders',
        liquidity: 50000,
        holders: 500,
        volume: 25000,
        priceChange: 0.1
      });

      const fewHoldersScore = queueManager.scoreToken({
        mint: 'FewHolders',
        liquidity: 50000,
        holders: 50,
        volume: 25000,
        priceChange: 0.1
      });

      expect(manyHoldersScore).toBeGreaterThan(fewHoldersScore);
    });

    it('should score healthy tokens above 60', () => {
      const score = queueManager.scoreToken({
        mint: 'Healthy',
        liquidity: 50000,
        holders: 300,
        volume: 100000,
        priceChange: 0.25
      });

      expect(score).toBeGreaterThan(60);
    });

    it('should score scam-pattern tokens below 60', () => {
      const score = queueManager.scoreToken({
        mint: 'Scam',
        liquidity: 1000,
        holders: 5,
        volume: 500,
        priceChange: 0.01
      });

      expect(score).toBeLessThan(60);
    });
  });

  describe('Queue Processing', () => {
    it('should return highest priority token', () => {
      queueManager.addTokenToQueue({
        mint: 'Low',
        score: 65,
        detectedAt: Date.now(),
        liquidity: 20000,
        holders: 100
      });

      queueManager.addTokenToQueue({
        mint: 'High',
        score: 85,
        detectedAt: Date.now(),
        liquidity: 60000,
        holders: 400
      });

      const next = queueManager.getNextToken();
      expect(next.mint).toBe('High');
      expect(next.score).toBe(85);
    });

    it('should remove token after retrieval', () => {
      queueManager.addTokenToQueue({
        mint: 'Test',
        score: 70,
        detectedAt: Date.now(),
        liquidity: 30000,
        holders: 200
      });

      queueManager.getNextToken();
      expect(queueManager.getQueueSize()).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty queue', () => {
      const next = queueManager.getNextToken();
      expect(next).toBeNull();
    });

    it('should handle queue overflow', () => {
      // Fill queue to max
      for (let i = 0; i < 120; i++) {
        queueManager.addTokenToQueue({
          mint: `Mint${i}`,
          score: 70,
          detectedAt: Date.now(),
          liquidity: 25000,
          holders: 150
        });
      }

      // Queue should not exceed max size
      expect(queueManager.getQueueSize()).toBe(100);
    });

    it('should handle tokens with missing data', () => {
      const score = queueManager.scoreToken({
        mint: 'Incomplete',
        liquidity: undefined,
        holders: undefined,
        volume: undefined,
        priceChange: undefined
      });

      // Should not crash, should return low score
      expect(score).toBeLessThan(50);
    });
  });
});
```

---

## Running These Tests

### Setup
```bash
# Install Jest
npm install --save-dev jest @types/jest ts-jest

# Initialize Jest config
npx ts-jest config:init

# Create test directories
mkdir -p src/core/__tests__
mkdir -p src/utils/handlers/__tests__
mkdir -p src/enhanced/__tests__
```

### Execute
```bash
# Run all tests
npm test

# Run specific test file
npx jest PARTIAL-EXIT-SYSTEM.test.ts

# Run with coverage
npx jest --coverage

# Run in watch mode
npx jest --watch
```

---

## Test Coverage Goals

| System | Target Coverage | Priority |
|--------|----------------|----------|
| PARTIAL-EXIT-SYSTEM | 95% | CRITICAL |
| jupiterHandler | 90% | CRITICAL |
| automated-reporter | 85% | HIGH |
| token-queue-system | 85% | HIGH |

---

**Note:** These tests are templates. You'll need to:
1. Install Jest and dependencies
2. Adjust imports based on actual file structure
3. Add missing helper functions
4. Mock external dependencies (Solana connection, axios, etc.)
5. Implement callback functions for async operations
