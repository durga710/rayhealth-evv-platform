import type { VercelRequest, VercelResponse } from '@vercel/node';

export default function handler(req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    ok: true,
    url: req.url,
    method: req.method,
    hasJWT: Boolean(process.env.JWT_SECRET),
    hasDB: Boolean(process.env.DATABASE_URL),
    hasENC: Boolean(process.env.ENCRYPTION_KEY),
    node: process.version
  });
}