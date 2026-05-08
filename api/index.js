// Raw Node http handler — no Express/Vercel helpers. Calling res.status(...).json(...)
// throws TypeError on a non-enriched ServerResponse, which the runtime surfaces as
// FUNCTION_INVOCATION_FAILED with Memory: -1MB (worker died pre-stat).
module.exports = (req, res) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(
    JSON.stringify({
      ok: true,
      url: req.url,
      method: req.method,
      node: process.version,
      hasJWT: Boolean(process.env.JWT_SECRET),
      hasDB: Boolean(process.env.DATABASE_URL),
      hasENC: Boolean(process.env.ENCRYPTION_KEY)
    })
  );
};
