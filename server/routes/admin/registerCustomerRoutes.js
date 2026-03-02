import { z } from "zod";

export function registerCustomerRoutes(app, {
  authorize,
  createError,
  db,
  getCustomerAccountOrThrow,
  getCustomerOrThrow,
  insertAuditLog,
  nowIso,
}) {
  app.get("/api/admin/customers/:customerId", authorize("customer.read"), (req, res, next) => {
    try {
      const { customerId } = req.params;
      const customer = getCustomerOrThrow(db, customerId);
      const account = getCustomerAccountOrThrow(db, customerId);
      const uploadStats = db.prepare(`
        select
          count(*) as total_uploads,
          sum(case when review_status = 'PENDING' then 1 else 0 end) as pending_uploads,
          sum(case when review_status = 'APPROVED' then 1 else 0 end) as approved_uploads
        from uploads
        where customer_id = ? and deleted_at is null
      `).get(customerId);
      const recentActivity = db.prepare(`
        select id, action, target_type, reason, created_at, actor_email
        from audit_logs
        where target_id = ?
        order by id desc
        limit 12
      `).all(customerId);

      res.json({
        data: {
          customer,
          account,
          stats: uploadStats,
          recentActivity,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/customers/:customerId/profile", authorize("customer.write"), (req, res, next) => {
    const schema = z.object({
      company_name: z.string().min(1),
      contact_name: z.string().default(""),
      phone: z.string().default(""),
      country: z.string().default(""),
      notes: z.string().default(""),
    });
    try {
      const input = schema.parse(req.body);
      const { customerId } = req.params;
      const before = getCustomerOrThrow(db, customerId);
      db.prepare(`
        update customers
        set company_name = @company_name,
            contact_name = @contact_name,
            phone = @phone,
            country = @country,
            notes = @notes,
            updated_at = datetime('now')
        where id = @id
      `).run({
        id: customerId,
        ...input,
      });
      const after = getCustomerOrThrow(db, customerId);
      insertAuditLog(db, {
        actor: req.actor,
        action: "customer.profile.update",
        targetType: "customer",
        targetId: customerId,
        beforeData: before,
        afterData: after,
      });
      res.json({ data: after });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/customers/:customerId/account/email", authorize("account.email_change"), (req, res, next) => {
    const schema = z.object({
      newEmail: z.string().email(),
      reason: z.string().min(3),
      forceSignOutAllSessions: z.boolean().optional().default(false),
    });
    try {
      const input = schema.parse(req.body);
      const { customerId } = req.params;
      const accountBefore = getCustomerAccountOrThrow(db, customerId);
      const emailInUse = db
        .prepare("select id from customer_accounts where lower(email) = lower(?) and id <> ?")
        .get(input.newEmail, accountBefore.id);
      if (emailInUse) {
        throw createError(409, "Email is already used by another customer account");
      }

      db.prepare(`
        update customer_accounts
        set email = @email,
            updated_at = datetime('now'),
            force_signout_at = case when @force_signout = 1 then datetime('now') else force_signout_at end
        where id = @id
      `).run({
        id: accountBefore.id,
        email: input.newEmail.toLowerCase(),
        force_signout: input.forceSignOutAllSessions ? 1 : 0,
      });

      if (input.forceSignOutAllSessions) {
        db.prepare(`
          update customer_sessions
          set revoked_at = datetime('now')
          where customer_account_id = ? and revoked_at is null
        `).run(accountBefore.id);
      }

      const accountAfter = getCustomerAccountOrThrow(db, customerId);
      insertAuditLog(db, {
        actor: req.actor,
        action: "account.email.change",
        targetType: "customer_account",
        targetId: accountBefore.id,
        beforeData: accountBefore,
        afterData: accountAfter,
        reason: input.reason,
      });
      res.json({ data: accountAfter });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/customers/:customerId/account/reset-password", authorize("account.reset_password"), (req, res, next) => {
    const schema = z.object({
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      const { customerId } = req.params;
      const account = getCustomerAccountOrThrow(db, customerId);
      insertAuditLog(db, {
        actor: req.actor,
        action: "account.password.reset",
        targetType: "customer_account",
        targetId: account.id,
        beforeData: { email: account.email, username: account.username },
        afterData: { resetTriggeredAt: nowIso() },
        reason: input.reason,
      });
      res.json({
        data: {
          customer_account_id: account.id,
          reset_method: "email_link",
          status: "triggered",
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customers/:customerId/security/sessions", authorize("customer.read"), (req, res, next) => {
    try {
      const account = getCustomerAccountOrThrow(db, req.params.customerId);
      const sessions = db.prepare(`
        select id, device_label, ip_address, user_agent, last_seen_at, revoked_at, created_at
        from customer_sessions
        where customer_account_id = ?
        order by datetime(last_seen_at) desc
      `).all(account.id);
      res.json({ data: sessions });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/admin/customers/:customerId/security/sign-out-all", authorize("account.force_signout"), (req, res, next) => {
    const schema = z.object({
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      const account = getCustomerAccountOrThrow(db, req.params.customerId);
      const beforeCount = db
        .prepare("select count(*) as count from customer_sessions where customer_account_id = ? and revoked_at is null")
        .get(account.id);
      db.prepare(`
        update customer_sessions
        set revoked_at = datetime('now')
        where customer_account_id = ? and revoked_at is null
      `).run(account.id);
      db.prepare(`
        update customer_accounts
        set force_signout_at = datetime('now'), updated_at = datetime('now')
        where id = ?
      `).run(account.id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "account.sessions.signout_all",
        targetType: "customer_account",
        targetId: account.id,
        beforeData: { activeSessions: beforeCount.count },
        afterData: { activeSessions: 0 },
        reason: input.reason,
      });
      res.json({ data: { revoked_sessions: beforeCount.count } });
    } catch (error) {
      next(error);
    }
  });
}
