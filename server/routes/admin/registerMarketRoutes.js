import { z } from "zod";

function mapMarketRow(row, customerId) {
  return {
    id: `pt-${row.id}`,
    source_record_id: row.id,
    customer_id: customerId,
    market: row.destination_country || "",
    product_type: row.product || "",
    metric_date: String(row.date || "").slice(0, 10),
    value: Number(row.weight_kg || 0),
    created_at: row.created_at,
  };
}

export function registerMarketRoutes(app, {
  authorize,
  createError,
  db,
  getCustomerOrThrow,
  insertAuditLog,
  requireMarketContext,
  rowToJson,
}) {
  app.get("/api/admin/customers/:customerId/market-intelligence/source-status", authorize("market.read"), async (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const linked = db.prepare("select customer_id, company_id, source, updated_at from customer_market_links where customer_id = ?").get(req.params.customerId);
      res.json({ data: linked || null });
    } catch (error) {
      next(error);
    }
  });

  app.put("/api/admin/customers/:customerId/market-intelligence/link", authorize("market.read"), (req, res, next) => {
    const schema = z.object({
      companyId: z.string().min(1),
    });
    try {
      const input = schema.parse(req.body);
      getCustomerOrThrow(db, req.params.customerId);
      const before = db.prepare("select * from customer_market_links where customer_id = ?").get(req.params.customerId);
      db.prepare(`
        insert into customer_market_links (customer_id, company_id, source, updated_at)
        values (?, ?, 'manual', datetime('now'))
        on conflict(customer_id) do update set
          company_id = excluded.company_id,
          source = excluded.source,
          updated_at = datetime('now')
      `).run(req.params.customerId, input.companyId.trim());
      const after = db.prepare("select * from customer_market_links where customer_id = ?").get(req.params.customerId);
      insertAuditLog(db, {
        actor: req.actor,
        action: "market.link_company",
        targetType: "customer",
        targetId: req.params.customerId,
        beforeData: before,
        afterData: after,
      });
      res.json({ data: after });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/market-intelligence", authorize("market.read"), async (req, res, next) => {
    try {
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);
      const market = String(req.query.market || "").trim();
      const productType = String(req.query.productType || "").trim();
      const dateFrom = String(req.query.dateFrom || "").trim();
      const dateTo = String(req.query.dateTo || "").trim();

      let query = supabase
        .from("purchase_trend")
        .select("id, company_id, destination_country, product, date, weight_kg, created_at")
        .eq("company_id", companyId)
        .order("date", { ascending: true });

      if (market) query = query.eq("destination_country", market);
      if (productType) query = query.ilike("product", `%${productType}%`);
      if (dateFrom) query = query.gte("date", dateFrom);
      if (dateTo) query = query.lte("date", dateTo);

      const { data, error } = await query.limit(5000);
      if (error) throw createError(500, error.message);

      res.json({
        data: (data || []).map((row) => mapMarketRow(row, req.params.customerId)),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/customers/:customerId/market-intelligence/records", authorize("customer.write"), async (req, res, next) => {
    const schema = z.object({
      market: z.string().min(1),
      product_type: z.string().min(1),
      metric_date: z.string().min(8),
      value: z.number().finite().nonnegative(),
      reason: z.string().min(3).default("Manual update from admin"),
    });
    try {
      const input = schema.parse(req.body);
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);

      const payload = {
        company_id: companyId,
        date: input.metric_date,
        destination_country: input.market,
        product: input.product_type,
        hs_code: "170199",
        weight_kg: input.value,
        quantity: input.value,
        total_price_usd: 0,
      };

      const { data, error } = await supabase
        .from("purchase_trend")
        .insert(payload)
        .select("id, company_id, destination_country, product, date, weight_kg, created_at")
        .single();
      if (error) throw createError(500, error.message);

      insertAuditLog(db, {
        actor: req.actor,
        action: "market.record.create",
        targetType: "customer",
        targetId: req.params.customerId,
        afterData: data,
        reason: input.reason,
      });

      res.status(201).json({
        data: mapMarketRow(data, req.params.customerId),
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/customers/:customerId/market-intelligence/records/:recordId", authorize("customer.write"), async (req, res, next) => {
    const schema = z.object({
      market: z.string().min(1),
      product_type: z.string().min(1),
      metric_date: z.string().min(8),
      value: z.number().finite().nonnegative(),
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);
      const recordId = Number(req.params.recordId);
      if (!Number.isFinite(recordId)) throw createError(400, "Invalid record id");

      const { data: before, error: beforeError } = await supabase
        .from("purchase_trend")
        .select("*")
        .eq("id", recordId)
        .eq("company_id", companyId)
        .single();
      if (beforeError || !before) throw createError(404, "Market record not found");

      const { data, error } = await supabase
        .from("purchase_trend")
        .update({
          destination_country: input.market,
          product: input.product_type,
          date: input.metric_date,
          weight_kg: input.value,
          quantity: input.value,
        })
        .eq("id", recordId)
        .eq("company_id", companyId)
        .select("id, company_id, destination_country, product, date, weight_kg, created_at")
        .single();
      if (error) throw createError(500, error.message);

      insertAuditLog(db, {
        actor: req.actor,
        action: "market.record.update",
        targetType: "customer",
        targetId: req.params.customerId,
        beforeData: before,
        afterData: data,
        reason: input.reason,
      });

      res.json({
        data: mapMarketRow(data, req.params.customerId),
      });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/customers/:customerId/market-intelligence/records/:recordId", authorize("customer.write"), async (req, res, next) => {
    const schema = z.object({
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body || {});
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);
      const recordId = Number(req.params.recordId);
      if (!Number.isFinite(recordId)) throw createError(400, "Invalid record id");

      const { data: before, error: beforeError } = await supabase
        .from("purchase_trend")
        .select("*")
        .eq("id", recordId)
        .eq("company_id", companyId)
        .single();
      if (beforeError || !before) throw createError(404, "Market record not found");

      const { error } = await supabase
        .from("purchase_trend")
        .delete()
        .eq("id", recordId)
        .eq("company_id", companyId);
      if (error) throw createError(500, error.message);

      insertAuditLog(db, {
        actor: req.actor,
        action: "market.record.delete",
        targetType: "customer",
        targetId: req.params.customerId,
        beforeData: before,
        reason: input.reason,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/market-intelligence/export.csv", authorize("market.export"), async (req, res, next) => {
    try {
      const { supabase, companyId } = await requireMarketContext(db, req.params.customerId);
      const { data, error } = await supabase
        .from("purchase_trend")
        .select("destination_country, product, date, weight_kg")
        .eq("company_id", companyId)
        .order("date", { ascending: true })
        .limit(5000);
      if (error) throw createError(500, error.message);
      const header = "market,product_type,metric_date,value";
      const csvRows = (data || []).map((row) => `${row.destination_country || ""},${row.product || ""},${String(row.date || "").slice(0, 10)},${Number(row.weight_kg || 0)}`);
      const csv = `${header}\n${csvRows.join("\n")}`;
      res.setHeader("content-type", "text/csv");
      res.send(csv);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/market-intelligence/export.pdf", authorize("market.export"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      res.setHeader("content-type", "application/pdf");
      res.send(Buffer.from("%PDF-1.1\n% ORIGO market intelligence export placeholder\n", "utf8"));
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/market-intelligence/presets", authorize("market.read"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const rows = db.prepare(`
        select id, customer_id, name, filters_json, created_by, created_at
        from market_intelligence_presets
        where customer_id = ?
        order by datetime(created_at) desc
      `).all(req.params.customerId);
      res.json({ data: rows.map((row) => rowToJson(row, ["filters_json"])) });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/customers/:customerId/market-intelligence/presets", authorize("preset.manage"), (req, res, next) => {
    const schema = z.object({
      name: z.string().min(2),
      filters: z.object({
        market: z.string().optional(),
        productType: z.string().optional(),
        dateFrom: z.string().optional(),
        dateTo: z.string().optional(),
      }),
    });
    try {
      const input = schema.parse(req.body);
      getCustomerOrThrow(db, req.params.customerId);
      const id = `preset-${Math.random().toString(36).slice(2, 10)}`;
      db.prepare(`
        insert into market_intelligence_presets (id, customer_id, name, filters_json, created_by)
        values (@id, @customer_id, @name, @filters_json, @created_by)
      `).run({
        id,
        customer_id: req.params.customerId,
        name: input.name,
        filters_json: JSON.stringify(input.filters),
        created_by: req.actor.id,
      });
      const created = db.prepare("select * from market_intelligence_presets where id = ?").get(id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "market.preset.create",
        targetType: "market_preset",
        targetId: id,
        afterData: rowToJson(created, ["filters_json"]),
      });
      res.status(201).json({ data: rowToJson(created, ["filters_json"]) });
    } catch (error) {
      next(error);
    }
  });
}
