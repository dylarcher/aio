// API versioning middleware that supports multiple strategies
export class APIVersioning {
  constructor(options = {}) {
    this.strategy = options.strategy || 'header'; // 'header', 'path', 'query'
    this.defaultVersion = options.defaultVersion || 'v1';
    this.supportedVersions = options.supportedVersions || ['v1'];
  }

  middleware = (req, res, next) => {
    const version = this.extractVersion(req);
    const normalizedVersion = this.normalizeVersion(version);

    if (!this.isVersionSupported(normalizedVersion)) {
      return res.status(400).json({
        error: 'Unsupported API version',
        supportedVersions: this.supportedVersions,
        requested: version,
      });
    }

    req.apiVersion = normalizedVersion;
    res.setHeader('API-Version', normalizedVersion);

    next();
  };

  extractVersion(req) {
    switch (this.strategy) {
      case 'header':
        return (
          req.headers['api-version'] ||
          req.headers['accept']?.match(/version=([^,\s]+)/)?.[1]
        );

      case 'path':
        return req.path.match(/^\/v(\d+(?:\.\d+)*)\//)?.[1];

      case 'query':
        return req.query.version;

      default:
        return this.defaultVersion;
    }
  }

  normalizeVersion(version) {
    if (!version) return this.defaultVersion;

    // Handle different version formats
    if (version.startsWith('v')) return version;
    if (/^\d+(?:\.\d+)*$/.test(version)) return `v${version}`;

    return this.defaultVersion;
  }

  isVersionSupported(version) {
    return this.supportedVersions.includes(version);
  }
}

// Usage
const versioning = new APIVersioning({
  strategy: 'header',
  defaultVersion: 'v1',
  supportedVersions: ['v1', 'v2', 'v2.1'],
});
app.use(versioning.middleware);
