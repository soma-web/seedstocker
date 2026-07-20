import fastify from 'fastify';
import cors from '@fastify/cors';
import fstatic from '@fastify/static';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { sqlite } from './db.js';
import { initializeDatabase } from './migrations.js';
import { logMessage } from './scraper.js';
import strainRoutes from './routes/strains.js';
import scraperRoutes from './routes/scraper.js';
import adminRoutes from './routes/admin.js';
import aiRoutes from './routes/ai.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB schema via versioned migrations
logMessage('info', 'Initializing database tables...');
initializeDatabase(sqlite);
logMessage('success', 'Database tables are ready.');

const dbFilePath = path.resolve(__dirname, '../data/seedstocker.db');

const app = fastify({ logger: false });

// Make dbFilePath available to route modules
app.decorate('dbFilePath', dbFilePath);

// Enable CORS
await app.register(cors, {
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// Serve frontend build static files if they exist (production)
const distPath = path.resolve(__dirname, '../../dist');
if (fs.existsSync(distPath)) {
  logMessage('info', `Serving production static files from: ${distPath}`);
  app.register(fstatic, {
    root: path.join(distPath, 'assets'),
    prefix: '/assets/'
  });

  const serveIndex = (req, reply) => {
    reply.type('text/html').send(fs.readFileSync(path.join(distPath, 'index.html')));
  };

  app.get('/', serveIndex);
  app.get('/admin', serveIndex);
  app.get('/descriptions', serveIndex);
  app.get('/rewritten-descriptions', serveIndex);
  app.get('/strain/*', serveIndex);
}

// Register route modules
await app.register(strainRoutes);
await app.register(scraperRoutes);
await app.register(adminRoutes);
await app.register(aiRoutes);

// Fallback to index.html for React SPA router (for production build fallback)
app.setNotFoundHandler((req, reply) => {
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    return reply.sendFile('index.html');
  }
  reply.status(404).send({ error: 'Not Found' });
});

// Start fastify server
const port = 3002;
const start = async () => {
  try {
    await app.listen({ port, host: '0.0.0.0' });
    logMessage('success', `Fastify server running on http://localhost:${port}`);
  } catch (err) {
    logMessage('error', `Server startup failed: ${err.message}`);
    process.exit(1);
  }
};

start();
