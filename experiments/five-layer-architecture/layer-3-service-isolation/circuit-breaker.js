// Advanced Circuit Breaker with exponential backoff
export class CircuitBreaker {
	constructor(options = {}) {
		this.failureThreshold = options.failureThreshold || 5;
		this.timeout = options.timeout || 60000; // 1 minute
		this.monitor = options.monitor || this.defaultMonitor;

		this.state = "CLOSED"; // CLOSED, OPEN, HALF_OPEN
		this.failureCount = 0;
		this.lastFailureTime = null;
		this.nextAttempt = Date.now();
	}

	async execute(operation) {
		if (this.state === "OPEN") {
			if (Date.now() < this.nextAttempt) {
				throw new Error("Circuit breaker is OPEN");
			}
			this.state = "HALF_OPEN";
		}

		try {
			const result = await operation();
			this.onSuccess();
			return result;
		} catch (error) {
			this.onFailure();
			throw error;
		}
	}

	onSuccess() {
		this.failureCount = 0;
		this.state = "CLOSED";
		this.monitor("success");
	}

	onFailure() {
		this.failureCount++;
		this.lastFailureTime = Date.now();

		if (this.failureCount >= this.failureThreshold) {
			this.state = "OPEN";
			this.nextAttempt = Date.now() + this.getBackoffDelay();
		}

		this.monitor("failure", {
			failureCount: this.failureCount,
			state: this.state,
		});
	}

	getBackoffDelay() {
		// Exponential backoff with jitter
		const baseDelay = this.timeout;
		const exponentialDelay =
			baseDelay *
			Math.pow(2, Math.min(this.failureCount - this.failureThreshold, 6));
		const jitter = Math.random() * 0.1 * exponentialDelay;

		return exponentialDelay + jitter;
	}

	defaultMonitor(event, data) {
		console.log(`Circuit Breaker: ${event}`, data);
	}

	getState() {
		return {
			state: this.state,
			failureCount: this.failureCount,
			lastFailureTime: this.lastFailureTime,
			nextAttempt: this.nextAttempt,
		};
	}
}

// Service client with circuit breaker
export class ResilientServiceClient {
	constructor(baseURL, options = {}) {
		this.baseURL = baseURL;
		this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
		this.retryOptions = {
			maxRetries: options.maxRetries || 3,
			backoffMultiplier: options.backoffMultiplier || 2,
			initialDelay: options.initialDelay || 100,
		};
	}

	async makeRequest(endpoint, options = {}) {
		return this.circuitBreaker.execute(async () => {
			return this.retryWithBackoff(async () => {
				const response = await fetch(`${this.baseURL}${endpoint}`, {
					timeout: 10000,
					...options,
				});

				if (!response.ok) {
					throw new Error(`HTTP ${response.status}: ${response.statusText}`);
				}

				return response.json();
			});
		});
	}

	async retryWithBackoff(operation) {
		let lastError;

		for (let attempt = 0; attempt <= this.retryOptions.maxRetries; attempt++) {
			try {
				return await operation();
			} catch (error) {
				lastError = error;

				if (attempt === this.retryOptions.maxRetries) {
					break;
				}

				const delay =
					this.retryOptions.initialDelay *
					Math.pow(this.retryOptions.backoffMultiplier, attempt);

				await this.sleep(delay);
			}
		}

		throw lastError;
	}

	sleep(ms) {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
// Usage
const userService = new ResilientServiceClient("https://api.users.service", {
	circuitBreaker: {
		failureThreshold: 3,
		timeout: 30000,
	},
	maxRetries: 2,
});
// This will automatically handle failures, retries, and circuit breaking
const user = await userService.makeRequest("/users/123");
