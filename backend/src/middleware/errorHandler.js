export function errorHandler(error, _req, res, _next) {
  const statusCode = error.statusCode || 500;

  if (statusCode === 500) {
    let databaseEndpoint;
    try {
      const url = new URL(process.env.DATABASE_URL);
      databaseEndpoint = { host: url.hostname, port: url.port, user: url.username };
    } catch {
      // A missing or malformed URL must not break error handling.
    }
    // Log endpoint metadata without passwords, SQL, or request bodies.
    console.error("Unhandled API error", {
      name: error.name,
      code: error.code,
      hostname: error.hostname,
      databaseEndpoint,
    });
  }

  res.status(statusCode).json({
    error: {
      message: statusCode === 500 ? "Internal server error" : error.message,
    },
  });
}
