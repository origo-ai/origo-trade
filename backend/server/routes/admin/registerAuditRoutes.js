function rowToJson(row, jsonFields) {
  if (!row) return null;
  const copy = { ...row };
  for (const field of jsonFields) {
    if (copy[field] && typeof copy[field] === "string") {
      copy[field] = JSON.parse(copy[field]);
    }
  }
  return copy;
}

export function registerAuditRoutes(app, { authorize, db }) {
  app.get("/api/admin/audit-logs", authorize("audit.read"), (req, res) => {
    const targetId = String(req.query.targetId || "").trim();
    const rows = db.prepare(`
      select *
      from audit_logs
      where (? = '' or target_id = ?)
      order by id desc
      limit 100
    `).all(targetId, targetId);
    res.json({ data: rows.map((row) => rowToJson(row, ["before_json", "after_json"])) });
  });
}
