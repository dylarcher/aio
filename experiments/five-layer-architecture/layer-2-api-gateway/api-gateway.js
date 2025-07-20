// Express.js API Gateway with advanced middleware
const express = require("express");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const { createProxyMiddleware } = require("http-proxy-middleware");

export class APIGateway {
	constructor() {
		this.app = express();
		this.services = new Map();
		this.setupMiddleware();
		this.setupRoutes();
		this.setupErrorHandling();
	}

	setupMiddleware() {
		// Security headers
		this.app.use(
			helmet({
				contentSecurityPolicy: {
					directives: {
						defaultSrc: ["'self'"],
						styleSrc: ["'self'", "'unsafe-inline'"],
						scriptSrc: ["'self'"],
						imgSrc: ["'self'", "data:", "https:"],
					},
				},
			}),
		);

		// Rate limiting with different tiers
		const createRateLimit = (windowMs, max, message) =>
			rateLimit({
				windowMs,
				max,
				message: { error: message },
				standardHeaders: true,
				legacyHeaders: false,
				handler: (req, res) => {
					res.status(429).json({
						error: message,
						retryAfter: Math.ceil(windowMs / 1000),
					});
				},
			});

		// Different rate limits for different endpoints
		this.app.use(
			"/api/auth",
			createRateLimit(15 * 60 * 1000, 5, "Too many authentication attempts"),
		);
		this.app.use(
			"/api",
			createRateLimit(15 * 60 * 1000, 100, "Too many requests"),
		);

		// Request logging and monitoring
		this.app.use(this.requestLogger);
		this.app.use(this.healthCheck);
	}

	requestLogger = (req, res, next) => {
		const start = Date.now();
		const requestId = this.generateRequestId();

		req.requestId = requestId;
		req.startTime = start;

		res.on("finish", () => {
			const duration = Date.now() - start;
			const logData = {
				requestId,
				method: req.method,
				url: req.url,
				statusCode: res.statusCode,
				duration,
				userAgent: req.get("User-Agent"),
				ip: req.ip,
			};

			console.log(JSON.stringify(logData));

			// Send metrics to monitoring service
			this.recordMetrics(logData);
		});

		next();
	};

	healthCheck = (req, res, next) => {
		if (req.path === "/health") {
			return this.handleHealthCheck(req, res);
		}
		next();
	};

	async handleHealthCheck(req, res) {
		const checks = await Promise.allSettled([
			this.checkDatabase(),
			this.checkRedis(),
			this.checkExternalServices(),
		]);

		const health = {
			status: "healthy",
			timestamp: new Date().toISOString(),
			services: {
				database: checks[0].status === "fulfilled" ? "healthy" : "unhealthy",
				redis: checks[1].status === "fulfilled" ? "healthy" : "unhealthy",
				external: checks[2].status === "fulfilled" ? "healthy" : "unhealthy",
			},
		};

		const hasUnhealthyService = Object.values(health.services).includes(
			"unhealthy",
		);
		if (hasUnhealthyService) {
			health.status = "degraded";
		}

		res.status(hasUnhealthyService ? 503 : 200).json(health);
	}

	setupRoutes() {
		// User service proxy
		this.app.use(
			"/api/users",
			createProxyMiddleware({
				target: process.env.USER_SERVICE_URL,
				changeOrigin: true,
				pathRewrite: { "^/api/users": "" },
				onProxyReq: this.addCorrelationId,
				onError: this.handleProxyError,
			}),
		);

		// Order service proxy
		this.app.use(
			"/api/orders",
			createProxyMiddleware({
				target: process.env.ORDER_SERVICE_URL,
				changeOrigin: true,
				pathRewrite: { "^/api/orders": "" },
				onProxyReq: this.addCorrelationId,
				onError: this.handleProxyError,
			}),
		);
	}

	addCorrelationId = (proxyReq, req) => {
		proxyReq.setHeader("X-Correlation-ID", req.requestId);
		proxyReq.setHeader("X-Forwarded-For", req.ip);
	};

	handleProxyError = (err, req, res) => {
		console.error("Proxy error:", err.message);

		res.status(502).json({
			error: "Service temporarily unavailable",
			requestId: req.requestId,
			retryAfter: 30,
		});
	};

	setupErrorHandling() {
		// 404 handler
		this.app.use((req, res) => {
			res.status(404).json({
				error: "Endpoint not",
				requestId: req.requestId,
			});
		});

		// Global error handler
		this.app.use((err, req, res, next) => {
			console.error("Unhandled error:", err);

			res.status(500).json({
				error: "Internal server error",
				requestId: req.requestId,
			});
		});
	}

	generateRequestId() {
		return Math.random().toString(36).substring(2) + Date.now().toString(36);
	}

	recordMetrics(logData) {
		// Implementation depends on your monitoring service
		// Example: StatsD, Prometheus, CloudWatch, etc.
	}

	async checkDatabase() {
		// Implement database health check
		return Promise.resolve();
	}

	async checkRedis() {
		// Implement Redis health check
		return Promise.resolve();
	}

	async checkExternalServices() {
		// Check external service dependencies
		return Promise.resolve();
	}
}
module.exports = APIGateway;
