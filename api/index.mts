// Direct relative import. Vercel's @vercel/node bundler does not follow
// workspace symlinks reliably, so importing via the package name resolves
// at build time but the resolved file is not bundled into the function.
// Pointing directly at the compiled JS forces ncc to walk the import graph.

let appInstance: unknown = null;
let bootError: Error | null = null;
try {
  const mod = await import('../packages/app/dist/app.js');
  appInstance = mod.createApp();
} catch (e) {
  bootError = e as Error;
  console.error('BOOT_FAILED', (e as Error).stack || e);
}

const handler = (req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
  if (bootError) {
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json');
    res.end(
      JSON.stringify({
        error: 'BOOT_FAILED',
        name: bootError.name,
        message: bootError.message,
        stack: bootError.stack?.split('\n').slice(0, 12)
      })
    );
    return;
  }
  // @ts-expect-error — express handler is callable
  return appInstance(req, res);
};

export default handler;