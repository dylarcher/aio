// Advanced monitoring and alerting system
export class MonitoringSystem {
  constructor(options = {}) {
    this.metrics = new Map();
    this.alerts = new Map();
    this.dashboards = new Map();
    this.notificationChannels = options.notificationChannels || [];
    this.metricsBuffer = [];
    this.bufferSize = options.bufferSize || 1000;
    this.flushInterval = options.flushInterval || 10000; // 10 seconds

    this.startMetricsCollector();
  }

  // Metrics collection
  recordMetric(name, value, tags = {}) {
    const metric = {
      name,
      value,
      tags,
      timestamp: Date.now(),
    };

    this.metricsBuffer.push(metric);

    // Check for immediate alerts
    this.checkAlerts(metric);

    // Flush buffer if full
    if (this.metricsBuffer.length >= this.bufferSize) {
      this.flushMetrics();
    }
  }

  // Counter metric
  increment(name, value = 1, tags = {}) {
    const current = this.metrics.get(name) || 0;
    this.metrics.set(name, current + value);
    this.recordMetric(name, current + value, { ...tags, type: 'counter' });
  }

  // Gauge metric
  gauge(name, value, tags = {}) {
    this.metrics.set(name, value);
    this.recordMetric(name, value, { ...tags, type: 'gauge' });
  }

  // Histogram metric (for timing, sizes, etc.)
  histogram(name, value, tags = {}) {
    const key = `${name}_histogram`;
    const current = this.metrics.get(key) || [];
    current.push(value);

    // Keep only last 1000 values
    if (current.length > 1000) {
      current.shift();
    }

    this.metrics.set(key, current);

    // Calculate percentiles
    const sorted = [...current].sort((a, b) => a - b);
    const percentiles = {
      p50: this.percentile(sorted, 50),
      p90: this.percentile(sorted, 90),
      p95: this.percentile(sorted, 95),
      p99: this.percentile(sorted, 99),
    };

    this.recordMetric(name, value, {
      ...tags,
      type: 'histogram',
      ...percentiles,
    });
  }

  percentile(sortedArray, p) {
    if (sortedArray.length === 0) return 0;

    const index = Math.ceil((p / 100) * sortedArray.length) - 1;
    return sortedArray[Math.max(0, Math.min(index, sortedArray.length - 1))];
  }

  // Timer decorator
  time(name, tags = {}) {
    const start = performance.now();

    return {
      end: () => {
        const duration = performance.now() - start;
        this.histogram(name, duration, { ...tags, unit: 'ms' });
        return duration;
      },
    };
  }

  // Alert system
  createAlert(name, condition, options = {}) {
    const alert = {
      name,
      condition,
      threshold: options.threshold,
      comparison: options.comparison || 'greater', // greater, less, equal
      window: options.window || 60000, // 1 minute
      cooldown: options.cooldown || 300000, // 5 minutes
      severity: options.severity || 'warning',
      lastTriggered: 0,
      isActive: false,
      description: options.description || `Alert for ${name}`,
    };

    this.alerts.set(name, alert);
  }

  checkAlerts(metric) {
    for (const [alertName, alert] of this.alerts) {
      if (this.shouldCheckAlert(alert, metric)) {
        const triggered = this.evaluateAlert(alert, metric);

        if (triggered && !alert.isActive) {
          this.triggerAlert(alert, metric);
        } else if (!triggered && alert.isActive) {
          this.resolveAlert(alert);
        }
      }
    }
  }

  shouldCheckAlert(alert, metric) {
    // Check if alert applies to this metric
    return (
      alert.condition(metric) &&
      Date.now() - alert.lastTriggered > alert.cooldown
    );
  }

  evaluateAlert(alert, metric) {
    const { value } = metric;
    const { threshold, comparison } = alert;

    switch (comparison) {
      case 'greater':
        return value > threshold;
      case 'less':
        return value < threshold;
      case 'equal':
        return value === threshold;
      default:
        return false;
    }
  }

  async triggerAlert(alert, metric) {
    alert.isActive = true;
    alert.lastTriggered = Date.now();

    const alertMessage = {
      alert: alert.name,
      severity: alert.severity,
      description: alert.description,
      value: metric.value,
      threshold: alert.threshold,
      timestamp: new Date().toISOString(),
      tags: metric.tags,
    };

    console.log('🚨 ALERT TRIGGERED:', alertMessage);

    // Send notifications
    await this.sendNotifications(alertMessage);

    // Record alert as metric
    this.increment('alerts_triggered', 1, {
      alert: alert.name,
      severity: alert.severity,
    });
  }

  async resolveAlert(alert) {
    alert.isActive = false;

    const resolveMessage = {
      alert: alert.name,
      status: 'resolved',
      timestamp: new Date().toISOString(),
    };

    console.log('✅ ALERT RESOLVED:', resolveMessage);
    await this.sendNotifications(resolveMessage);
  }

  async sendNotifications(message) {
    const notifications = this.notificationChannels.map((channel) =>
      this.sendNotification(channel, message),
    );

    await Promise.allSettled(notifications);
  }

  async sendNotification(channel, message) {
    try {
      switch (channel.type) {
        case 'slack':
          await this.sendSlackNotification(channel, message);
          break;
        case 'email':
          await this.sendEmailNotification(channel, message);
          break;
        case 'webhook':
          await this.sendWebhookNotification(channel, message);
          break;
        default:
          console.log('Unknown notification channel:', channel.type);
      }
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  async sendSlackNotification(channel, message) {
    const webhook = channel.webhook;
    const payload = {
      text: `${message.severity?.toUpperCase() || 'INFO'}: ${message.alert || 'System Alert'}`,
      attachments: [
        {
          color: this.getSeverityColor(message.severity),
          fields: [
            { title: 'Description', value: message.description, short: false },
            { title: 'Value', value: message.value, short: true },
            { title: 'Threshold', value: message.threshold, short: true },
            { title: 'Time', value: message.timestamp, short: true },
          ],
        },
      ],
    };

    await fetch(webhook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  }

  getSeverityColor(severity) {
    switch (severity) {
      case 'critical':
        return '#ff0000';
      case 'warning':
        return '#ffff00';
      case 'info':
        return '#00ff00';
      default:
        return '#808080';
    }
  }

  // Dashboard creation
  createDashboard(name, widgets) {
    const dashboard = {
      name,
      widgets,
      createdAt: Date.now(),
      lastUpdated: Date.now(),
    };

    this.dashboards.set(name, dashboard);
  }

  getDashboardData(name) {
    const dashboard = this.dashboards.get(name);
    if (!dashboard) return null;

    const data = {
      ...dashboard,
      data: {},
    };

    for (const widget of dashboard.widgets) {
      data.data[widget.id] = this.getWidgetData(widget);
    }

    return data;
  }

  getWidgetData(widget) {
    switch (widget.type) {
      case 'metric':
        return this.getMetricValue(widget.metric);
      case 'chart':
        return this.getMetricHistory(widget.metric, widget.timeRange);
      case 'table':
        return this.getMetricTable(widget.metrics);
      default:
        return null;
    }
  }

  getMetricValue(metricName) {
    return this.metrics.get(metricName) || 0;
  }

  getMetricHistory(metricName, timeRange = 3600000) {
    // 1 hour default
    const cutoff = Date.now() - timeRange;
    return this.metricsBuffer
      .filter((m) => m.name === metricName && m.timestamp > cutoff)
      .map((m) => ({ timestamp: m.timestamp, value: m.value }));
  }

  // Metrics flushing
  startMetricsCollector() {
    setInterval(() => {
      this.flushMetrics();
    }, this.flushInterval);
  }

  async flushMetrics() {
    if (this.metricsBuffer.length === 0) return;

    const batch = this.metricsBuffer.splice(0);

    try {
      // Send to metrics storage (InfluxDB, Prometheus, etc.)
      await this.storeMetrics(batch);
    } catch (error) {
      console.error('Failed to flush metrics:', error);
      // Put metrics back in buffer
      this.metricsBuffer.unshift(...batch);
    }
  }

  async storeMetrics(metrics) {
    // Implementation depends on your metrics storage
    // Example: InfluxDB, Prometheus, CloudWatch, etc.
    console.log(`Storing ${metrics.length} metrics`);
  }

  // Health check endpoint
  getHealthStatus() {
    const now = Date.now();
    const activeAlerts = Array.from(this.alerts.values()).filter(
      (a) => a.isActive,
    );

    return {
      status: activeAlerts.length === 0 ? 'healthy' : 'degraded',
      timestamp: new Date(now).toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      activeAlerts: activeAlerts.length,
      metrics: {
        collected: this.metricsBuffer.length,
        stored: this.metrics.size,
      },
    };
  }
}

// Usage example
const monitoring = new MonitoringSystem({
  notificationChannels: [
    {
      type: 'slack',
      webhook: 'https://hooks.slack.com/services/...',
    },
  ],
});
// Create alerts
monitoring.createAlert(
  'high_response_time',
  (metric) => metric.name === 'api_response_time',
  {
    threshold: 1000, // 1 second
    comparison: 'greater',
    severity: 'warning',
    description: 'API response time is too high',
  },
);
monitoring.createAlert(
  'high_error_rate',
  (metric) => metric.name === 'error_rate',
  {
    threshold: 5, // 5%
    comparison: 'greater',
    severity: 'critical',
    description: 'Error rate exceeded acceptable threshold',
  },
);
// Create dashboard
monitoring.createDashboard('api_performance', [
  {
    id: 'response_time',
    type: 'chart',
    metric: 'api_response_time',
    timeRange: 3600000,
  },
  { id: 'error_rate', type: 'metric', metric: 'error_rate' },
  {
    id: 'throughput',
    type: 'chart',
    metric: 'requests_per_second',
    timeRange: 3600000,
  },
]);
// Middleware for Express.js
function monitoringMiddleware(req, res, next) {
  const timer = monitoring.time('api_response_time', {
    method: req.method,
    route: req.route?.path || req.path,
  });

  monitoring.increment('requests_total', 1, {
    method: req.method,
    route: req.route?.path || req.path,
  });

  res.on('finish', () => {
    timer.end();

    monitoring.increment('responses_total', 1, {
      method: req.method,
      status: res.statusCode,
      route: req.route?.path || req.path,
    });

    if (res.statusCode >= 400) {
      monitoring.increment('errors_total', 1, {
        method: req.method,
        status: res.statusCode,
        route: req.route?.path || req.path,
      });
    }
  });

  next();
}
