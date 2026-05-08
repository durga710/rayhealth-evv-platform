// Raw Node http handler — ESM. Root package.json has "type":"module" so .js
// files are loaded as ECMAScript modules; CJS module.exports here would throw
// at parse time and surface as FUNCTION_INVOCATION_FAILED with no log.
export default function handler(req, res) {
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
}
