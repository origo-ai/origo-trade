export function registerCustomerContextRoutes(app, { authorize, db }) {
  app.get("/api/admin/customer-context/search", authorize("customer.read"), (req, res) => {
    const q = String(req.query.q || "").trim().toLowerCase();
    const rows = db.prepare(`
      select
        c.id as customer_id,
        c.company_name,
        a.email,
        a.username,
        a.role
      from customers c
      join customer_accounts a on a.customer_id = c.id
      where lower(c.company_name) like @q
         or lower(a.email) like @q
         or lower(a.username) like @q
      order by c.company_name asc
      limit 20
    `).all({ q: `%${q}%` });
    res.json({ data: rows });
  });
}
