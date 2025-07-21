// Resource pool with bulkhead isolation
export class ResourcePool {
  constructor(options = {}) {
    this.pools = new Map();
    this.defaultPoolSize = options.defaultPoolSize || 10;
    this.maxPoolSize = options.maxPoolSize || 50;
  }

  createPool(name, size = this.defaultPoolSize) {
    if (this.pools.has(name)) {
      throw new Error(`Pool ${name} already exists`);
    }

    const pool = {
      name,
      size,
      available: size,
      active: 0,
      waiting: [],
      metrics: {
        totalRequests: 0,
        successfulRequests: 0,
        failedRequests: 0,
        averageWaitTime: 0,
      },
    };

    this.pools.set(name, pool);
    return pool;
  }

  async acquireResource(poolName, operation, timeout = 5000) {
    const pool = this.pools.get(poolName);
    if (!pool) {
      throw new Error(`Pool ${poolName} does not exist`);
    }

    const startTime = Date.now();
    pool.metrics.totalRequests++;

    try {
      await this.waitForResource(pool, timeout);

      const waitTime = Date.now() - startTime;
      this.updateAverageWaitTime(pool, waitTime);

      const result = await operation();
      pool.metrics.successfulRequests++;
      return result;
    } catch (error) {
      pool.metrics.failedRequests++;
      throw error;
    } finally {
      this.releaseResource(pool);
    }
  }

  async waitForResource(pool, timeout) {
    if (pool.available > 0) {
      pool.available--;
      pool.active++;
      return;
    }

    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const index = pool.waiting.indexOf(resolve);
        if (index > -1) {
          pool.waiting.splice(index, 1);
        }
        reject(new Error(`Resource acquisition timeout for pool ${pool.name}`));
      }, timeout);

      pool.waiting.push(() => {
        clearTimeout(timeoutId);
        pool.available--;
        pool.active++;
        resolve();
      });
    });
  }

  releaseResource(pool) {
    pool.active--;

    if (pool.waiting.length > 0) {
      const next = pool.waiting.shift();
      next();
    } else {
      pool.available++;
    }
  }

  updateAverageWaitTime(pool, waitTime) {
    const { metrics } = pool;
    metrics.averageWaitTime =
      (metrics.averageWaitTime * (metrics.totalRequests - 1) + waitTime) /
      metrics.totalRequests;
  }

  getPoolStats(poolName) {
    const pool = this.pools.get(poolName);
    if (!pool) return null;

    return {
      name: pool.name,
      size: pool.size,
      available: pool.available,
      active: pool.active,
      waiting: pool.waiting.length,
      utilization: (pool.active / pool.size) * 100,
      metrics: { ...pool.metrics },
    };
  }

  getAllStats() {
    const stats = {};
    for (const [name, pool] of this.pools) {
      stats[name] = this.getPoolStats(name);
    }
    return stats;
  }
}

// Database connection pool implementation
export class DatabaseConnectionPool extends ResourcePool {
  constructor(dbConfig) {
    super();
    this.dbConfig = dbConfig;
    this.createPool('read', 20); // 20 connections for read operations
    this.createPool('write', 5); // 5 connections for write operations
    this.createPool('report', 3); // 3 connections for reporting queries
  }

  async executeQuery(query, params, operationType = 'read') {
    const poolName = this.getPoolForOperation(operationType);

    return this.acquireResource(poolName, async () => {
      // Simulate database query
      const connection = await this.getConnection();
      try {
        return await connection.query(query, params);
      } finally {
        await this.releaseConnection(connection);
      }
    });
  }

  getPoolForOperation(operationType) {
    switch (operationType) {
      case 'write':
      case 'insert':
      case 'update':
      case 'delete':
        return 'write';
      case 'report':
      case 'analytics':
        return 'report';
      default:
        return 'read';
    }
  }

  async getConnection() {
    // Implementation depends on your database driver
    return { query: async (sql, params) => ({ rows: [] }) };
  }

  async releaseConnection(connection) {
    // Return connection to pool
  }
}
