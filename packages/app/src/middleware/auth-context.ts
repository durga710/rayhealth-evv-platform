import type { Request, Response, NextFunction } from 'express';
import type { AppRole } from '@rayhealth/core';

export function authContext(req: Request, _res: Response, next: NextFunction): void {
  req.auth = {
    agencyId: req.header('x-agency-id') ?? '',
    role: (req.header('x-user-role') ?? 'caregiver') as AppRole,
    userId: req.header('x-user-id')
  };

  next();
}
