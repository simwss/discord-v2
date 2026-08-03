import { createServer, type Server } from "node:http";
import type { Logger } from "pino";

export interface HealthState {
  /** True once the gateway connection is up and the database answers. */
  isReady: () => boolean | Promise<boolean>;
}

/**
 * Minimal liveness/readiness endpoint so a container orchestrator can tell a
 * running bot from a wedged one. Uses `node:http` directly — v1 pulled in
 * Express and an exposed port for a server it never actually started.
 *
 * - `GET /health` — the process is alive.
 * - `GET /ready`  — the Discord gateway is connected and the database answers.
 */
export function startHealthServer(
  port: number,
  state: HealthState,
  logger: Logger,
): Server | null {
  if (port === 0) {
    logger.info("health server disabled (HEALTH_PORT=0)");
    return null;
  }

  async function ready(): Promise<boolean> {
    try {
      return await state.isReady();
    } catch (error) {
      logger.warn({ err: error }, "readiness check threw");
      return false;
    }
  }

  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];

    if (path === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (path === "/ready") {
      // The readiness check does I/O, so the response is written from a
      // promise rather than inline.
      void ready().then((ok) => {
        res.writeHead(ok ? 200 : 503, { "content-type": "application/json" });
        res.end(JSON.stringify({ status: ok ? "ready" : "connecting" }));
      });
      return;
    }

    res.writeHead(404).end();
  });

  server.listen(port, () => {
    logger.info({ port }, "health server listening");
  });

  server.on("error", (error) => {
    logger.error({ err: error, port }, "health server error");
  });

  return server;
}
