// validator/server.js
// Phase 6 API server. Run alongside index.js (the dropzone watcher).
// In Phase 7 the docker-compose spins both as a single container with
// two processes, or they can be split. PORT defaults to 4000.
import express from 'express';
import pg from 'pg';
import 'dotenv/config';
import governanceRoutes from './governance-routes.js';

const app  = express();
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const PORT = Number(process.env.API_PORT || 4000);

app.use(express.json());

// Inject pool into req so routes don't import it themselves (easier to test).
app.use((req, _res, next) => { req.pool = pool; next(); });

// CORS — allow the frontend dev server and the deployed origin.
app.use((req, res, next) => {
    const allowed = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',');
    const origin  = req.headers.origin;
    if (origin && allowed.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// Routes
app.use('/api/governance', governanceRoutes);

// Health
app.get('/health', (_req, res) => res.json({ ok: true, ts: new Date().toISOString() }));

app.listen(PORT, () => console.log(`TLaaS API server listening on :${PORT}`));
