export function registerHealthRoute(app, { nowIso }) {
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: nowIso() });
  });
}
