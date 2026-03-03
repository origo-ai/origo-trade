export function registerHealthRoute(app, { nowIso, sqliteAvailable = null }) {
  app.get("/api/health", (_req, res) => {
    res.json({
      ok: true,
      timestamp: nowIso(),
      ...(typeof sqliteAvailable === "boolean" ? { sqliteAvailable } : {}),
    });
  });
}
