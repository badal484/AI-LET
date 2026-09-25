import { createRequire } from 'module';

/**
 * Express 4 does not forward rejected promises from async handlers to the error middleware: the
 * request hangs until the client times out and the rejection is only logged. This patches the route
 * layer once (same approach as `express-async-errors`) so every async handler's rejection reaches
 * `next(err)` and gets the standard error contract. Idempotent.
 */
const require = createRequire(import.meta.url);
type LayerProto = { handle_request: (req: unknown, res: unknown, next: (err?: unknown) => void) => void; handle: (...args: unknown[]) => unknown; __asyncPatched?: boolean };
const Layer = require('express/lib/router/layer.js') as { prototype: LayerProto };

if (!Layer.prototype.__asyncPatched) {
  Layer.prototype.handle_request = function handle(this: LayerProto, req, res, next) {
    const fn = this.handle;
    if (fn.length > 3) return next();
    try {
      const out = fn(req, res, next) as { catch?: unknown } | undefined;
      if (out && typeof (out as Promise<unknown>).catch === 'function') (out as Promise<unknown>).catch((err) => next(err ?? new Error('Rejected without reason')));
    } catch (err) {
      next(err);
    }
  };
  Layer.prototype.__asyncPatched = true;
}

export {};
