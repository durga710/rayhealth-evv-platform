import express from 'express';
import cors from 'cors';
import './types.js';
import { authContext } from './middleware/auth-context.js';
import { requireCapability } from './middleware/require-capability.js';
import { auditLog } from './middleware/audit-log.js';
import inviteRoutes from './routes/invite-routes.js';
import agencyRoutes from './routes/agency-routes.js';
import staffRoutes from './routes/staff-routes.js';

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(authContext);
  app.use(auditLog);

  app.use('/invites', inviteRoutes);
  app.use('/agencies', agencyRoutes);
  app.use('/staff', staffRoutes);

  // Protected route for testing (keep for now or remove if redundant)
  app.get('/agencies/current-test', requireCapability('agency.read'), (req, res) => {
    res.json({ id: req.auth.agencyId, name: 'Current Agency' });
  });

  return app;
}
