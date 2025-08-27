// Rate limiter for Helius RPC
export class RateLimiter {
    private requestTimes: number[] = [];
    private maxRequests: number;
    private timeWindow: number;

    constructor(requestsPerSecond: number = 1) {
        this.maxRequests = requestsPerSecond;
        this.timeWindow = 1000; // 1 second in milliseconds
    }

    async waitIfNeeded(): Promise<void> {
        const now = Date.now();
        
        // Remove old requests outside time window
        this.requestTimes = this.requestTimes.filter(
            time => now - time < this.timeWindow
        );

        // If at limit, wait
        if (this.requestTimes.length >= this.maxRequests) {
            const oldestRequest = this.requestTimes[0];
            const waitTime = this.timeWindow - (now - oldestRequest) + 100; // +100ms buffer
            
            console.log(`? Rate limit: waiting ${waitTime}ms...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }

        // Record this request
        this.requestTimes.push(Date.now());
    }
}

// Configure based on your Helius tier
export const heliusLimiter = new RateLimiter(1); // 1 request/second for free tier
// export const heliusLimiter = new RateLimiter(5); // 5 requests/second for developer