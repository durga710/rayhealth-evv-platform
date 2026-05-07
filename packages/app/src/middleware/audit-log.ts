import type { Request, Response, NextFunction } from 'express';

export function auditLog(req: Request, _res: Response, next: NextFunction): void {
  // Simple console logger for now, in a real app would emit to an audit service
  if (req.method !== 'GET') {
    console.log(`[AUDIT] User ${req.auth.userId} in Agency ${req.auth.agencyId} performed ${req.method} on ${req.path}`);
  }
  next();
}
