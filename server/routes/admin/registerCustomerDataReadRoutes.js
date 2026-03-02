export function registerCustomerDataReadRoutes(app, {
  authorize,
  db,
  getCustomerOrThrow,
}) {
  app.get("/api/admin/customers/:customerId/inventory", authorize("inventory.read"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const rows = db.prepare(`
        select id, sku, product_name, qty, unit, updated_at
        from inventory_items
        where customer_id = ?
        order by datetime(updated_at) desc
      `).all(req.params.customerId);
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/invoices", authorize("invoice.read"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const rows = db.prepare(`
        select id, invoice_no, amount, currency, status, due_date, created_at
        from invoices
        where customer_id = ?
        order by datetime(created_at) desc
      `).all(req.params.customerId);
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  });
}
