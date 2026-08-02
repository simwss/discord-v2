import { createServer, type Server } from "node:http";
import type { Logger } from "pino";

export interface HealthState {
  /** True once the gateway connection is up. */
  isReady: () => boolean;
}

/**
 * Minimal liveness/readiness endpoint so a container orchestrator can tell a
 * running bot from a wedged one. Uses `node:http` directly — v1 pulled in
 * Express and an exposed port for a server it never actually started.
 *
 * - `GET /health` — the process is alive.
 * - `GET /ready`  — the Discord gateway is connected.
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

  const server = createServer((req, res) => {
    const path = (req.url ?? "/").split("?")[0];

    if (path === "/health") {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok" }));
      return;
    }

    if (path === "/ready") {
      const ready = state.isReady();
      res.writeHead(ready ? 200 : 503, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: ready ? "ready" : "connecting" }));
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
