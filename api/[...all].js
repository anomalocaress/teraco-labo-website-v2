// Vercel serverless entrypoint that forwards all /api/*
// requests to the existing Express app defined in social-integration.js
// This lets us keep the same routes like /api/health, /api/web-reservations, etc.

const { buildApp } = require('./social-integration');

// Build the Express app once per cold start
const app = buildApp();

module.exports = (req, res) => {
  // Delegate directly to Express (it is a request handler function)
  return app(req, res);
};

