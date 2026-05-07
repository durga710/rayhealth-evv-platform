import express from 'express';
import cors from 'cors';
import './types.js';
import { authContext } from './middleware/auth-context.js';
import { requireCapability } from './middleware/require-capability.js';
import { auditLog } from './middleware/audit-log.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(authContext);
  app.use(auditLog);

  // Protected route for testing
  app.get('/agencies/current', requireCapability('agency.read'), (req, res) => {
    res.json({ id: req.auth.agencyId, name: 'Current Agency' });
  });

  return app;
}
