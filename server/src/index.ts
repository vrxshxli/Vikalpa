/**
 * VIKALPA API server.
 *
 * Mobile app → API layer → Trip Intelligence Engine.
 * Everything the app renders comes from here; nothing is computed on device.
 */
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';

import { trips } from './routes/trips.js';
import { demoSession } from './store.js';
import { resolveModel } from './engine/assistant.js';

const app = express();
const PORT = Number(process.env.PORT ?? 4000);

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('tiny'));

app.get('/api/health', (_req, res) => {
  const session = demoSession();
  res.json({
    ok: true,
    service: 'vikalpa-engine',
    demoTripId: session.trip.id,
    languageModel: resolveModel().name,
    time: new Date().toISOString(),
  });
});

app.use('/api/trips', trips);

app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  const status = error?.status ?? 500;
  if (status >= 500) console.error('[api]', error);
  res.status(status).json({ error: error?.message ?? 'Something went wrong' });
});

app.listen(PORT, () => {
  const session = demoSession();
  console.log(`\n  VIKALPA engine listening on http://localhost:${PORT}`);
  console.log(`  Demo trip: ${session.trip.title} (${session.trip.id})`);
  console.log(`  Language model for intent extraction: ${resolveModel().name}\n`);
});
