// Before: Typical monolithic e-commerce application
export class MonolithicECommerceApp {
	async createOrder(orderData) {
		// Everything mixed together - hard to maintain and scale
		try {
			// Validate order
			if (!orderData.items || orderData.items.length === 0) {
				throw new Error("Order must have items");
			}

			// Check inventory (direct database call)
			const db = await this.getDatabase();
			for (const item of orderData.items) {
				const product = await db.query(
					"SELECT stock FROM products WHERE id = ?",
					[item.productId],
				);
				if (product.stock < item.quantity) {
					throw new Error(`Insufficient stock for product ${item.productId}`);
				}
			}

			// Calculate pricing (business logic mixed with data access)
			let total = 0;
			for (const item of orderData.items) {
				const product = await db.query(
					"SELECT price FROM products WHERE id = ?",
					[item.productId],
				);
				total += product.price * item.quantity;
			}

			// Apply discounts (more business logic)
			const user = await db.query(
				"SELECT loyalty_level FROM users WHERE id = ?",
				[orderData.userId],
			);
			if (user.loyalty_level === "gold") {
				total *= 0.9; // 10% discount
			}

			// Create order (transaction handling mixed in)
			const transaction = await db.beginTransaction();

			const order = await transaction.query(
				"INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)",
				[orderData.userId, total, "pending"],
			);

			// Update inventory
			for (const item of orderData.items) {
				await transaction.query(
					"UPDATE products SET stock = stock - ? WHERE id = ?",
					[item.quantity, item.productId],
				);
			}

			// Send confirmation email (external service call mixed in)
			await this.sendEmail(
				orderData.userEmail,
				"Order Confirmation",
				`Your order #${order.id} has been created`,
			);

			// Process payment (another external service call)
			const paymentResult = await this.processPayment(
				orderData.paymentMethod,
				total,
			);

			if (paymentResult.success) {
				await transaction.query("UPDATE orders SET status = ? WHERE id = ?", [
					"confirmed",
					order.id,
				]);
				await transaction.commit();
			} else {
				await transaction.rollback();
				throw new Error("Payment failed");
			}

			// Update analytics (more mixed concerns)
			await this.updateAnalytics("order_created", { orderId: order.id, total });

			return order;
		} catch (error) {
			console.error("Order creation failed:", error);
			throw error;
		}
	}
}

// After: 5-Layer Architecture implementation
export class LayeredECommerceApp {
	constructor() {
		// Layer 5: Monitoring
		this.monitoring = new MonitoringSystem();

		// Layer 4: Data layer with CQRS
		this.dataStore = new CQRSDataStore({
			writeDB: this.writeDatabase,
			readDBs: [this.readDatabase],
			cache: this.redisCache,
		});

		// Layer 3: Service isolation
		this.inventoryService = new ResilientServiceClient(
			"http://inventory-service",
		);
		this.paymentService = new ResilientServiceClient("http://payment-service");
		this.emailService = new ResilientServiceClient("http://email-service");

		// Layer 2: API Gateway (handled separately)

		// Layer 1: Client interface (handled by frontend)
	}

	async createOrder(orderData) {
		const timer = this.monitoring.time("order_creation");

		try {
			// Execute command through CQRS
			const result = await this.dataStore.executeCommand({
				type: "CREATE_ORDER",
				...orderData,
			});

			timer.end();
			this.monitoring.increment("orders_created", 1);

			return result;
		} catch (error) {
			timer.end();
			this.monitoring.increment("order_creation_errors", 1);
			throw error;
		}
	}
}
// Command handler (separated business logic)
const orderCommandHandlers = {
	CREATE_ORDER: async (command, transaction) => {
		// Clean separation of concerns
		const validator = new OrderValidator();
		const pricingService = new PricingService();
		const inventoryService = new InventoryService();

		// Validate
		await validator.validate(command);

		// Check inventory through service
		await inventoryService.reserveItems(command.items);

		// Calculate pricing through service
		const pricing = await pricingService.calculateTotal(
			command.items,
			command.userId,
		);

		// Create order
		const order = await transaction.query(
			"INSERT INTO orders (user_id, total, status) VALUES (?, ?, ?)",
			[command.userId, pricing.total, "pending"],
		);

		// Return events for further processing
		return [
			{
				type: "ORDER_CREATED",
				orderId: order.id,
				userId: command.userId,
				total: pricing.total,
				items: command.items,
			},
		];
	},
};
// Event handlers (asynchronous processing)
const orderEventHandlers = {
	ORDER_CREATED: async (event) => {
		// Each concern handled separately and asynchronously
		await Promise.allSettled([
			emailService.sendOrderConfirmation(event),
			analyticsService.trackOrderCreation(event),
			fulfillmentService.scheduleProcessing(event),
		]);
	},
};
