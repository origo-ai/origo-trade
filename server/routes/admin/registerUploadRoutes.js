import path from "node:path";
import { z } from "zod";

export function registerUploadRoutes(app, {
  authorize,
  createError,
  db,
  getCustomerOrThrow,
  insertAuditLog,
  upload,
}) {
  app.get("/api/admin/customers/:customerId/uploads", authorize("customer.read"), (req, res, next) => {
    try {
      getCustomerOrThrow(db, req.params.customerId);
      const includeDeleted = String(req.query.includeDeleted || "false") === "true";
      const rows = db.prepare(`
        select *
        from uploads
        where customer_id = @customerId
          and (@includeDeleted = 1 or deleted_at is null)
        order by datetime(created_at) desc
      `).all({
        customerId: req.params.customerId,
        includeDeleted: includeDeleted ? 1 : 0,
      });
      res.json({ data: rows });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/api/admin/customers/:customerId/uploads",
    authorize("upload.manage"),
    upload.single("file"),
    (req, res, next) => {
      const schema = z.object({
        file_name: z.string().min(2).optional(),
        file_type: z.string().min(2).optional(),
        description: z.string().default(""),
        uploaded_by: z.string().min(3),
      });
      try {
        const input = schema.parse(req.body ?? {});
        const customer = getCustomerOrThrow(db, req.params.customerId);
        const id = `upl-${Math.random().toString(36).slice(2, 10)}`;
        const fileName = req.file?.originalname || input.file_name;
        const fileType = req.file?.mimetype || input.file_type;
        if (!fileName || !fileType) {
          throw createError(400, "file_name and file_type are required when file is not uploaded");
        }
        db.prepare(`
          insert into uploads (
            id, customer_id, file_name, file_type, description, review_status, uploaded_by, storage_path
          ) values (
            @id, @customer_id, @file_name, @file_type, @description, 'PENDING', @uploaded_by, @storage_path
          )
        `).run({
          id,
          customer_id: customer.id,
          file_name: fileName,
          file_type: fileType,
          description: input.description,
          uploaded_by: input.uploaded_by,
          storage_path: req.file ? path.relative(process.cwd(), req.file.path) : null,
        });
        const created = db.prepare("select * from uploads where id = ?").get(id);
        insertAuditLog(db, {
          actor: req.actor,
          action: "upload.create",
          targetType: "upload",
          targetId: id,
          afterData: created,
        });
        res.status(201).json({ data: created });
      } catch (error) {
        next(error);
      }
    },
  );

  app.patch("/api/admin/customers/:customerId/uploads/:uploadId", authorize("upload.manage"), (req, res, next) => {
    const schema = z.object({
      file_name: z.string().min(2).optional(),
      file_type: z.string().min(2).optional(),
      description: z.string().optional(),
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      getCustomerOrThrow(db, req.params.customerId);
      const before = db.prepare(`
        select * from uploads where id = ? and customer_id = ? and deleted_at is null
      `).get(req.params.uploadId, req.params.customerId);
      if (!before) throw createError(404, "Upload not found");

      db.prepare(`
        update uploads
        set file_name = coalesce(@file_name, file_name),
            file_type = coalesce(@file_type, file_type),
            description = coalesce(@description, description),
            review_status = 'PENDING',
            reviewer_id = null,
            reviewer_name = null,
            reviewer_comment = null,
            updated_at = datetime('now')
        where id = @id
      `).run({
        id: before.id,
        file_name: input.file_name || null,
        file_type: input.file_type || null,
        description: input.description ?? null,
      });
      const after = db.prepare("select * from uploads where id = ?").get(before.id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "upload.reupload",
        targetType: "upload",
        targetId: before.id,
        beforeData: before,
        afterData: after,
        reason: input.reason,
      });
      res.json({ data: after });
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/admin/customers/:customerId/uploads/:uploadId", authorize("upload.manage"), (req, res, next) => {
    const schema = z.object({
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body || {});
      getCustomerOrThrow(db, req.params.customerId);
      const before = db.prepare(`
        select * from uploads where id = ? and customer_id = ? and deleted_at is null
      `).get(req.params.uploadId, req.params.customerId);
      if (!before) throw createError(404, "Upload not found");
      db.prepare("update uploads set deleted_at = datetime('now') where id = ?").run(before.id);
      const after = db.prepare("select * from uploads where id = ?").get(before.id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "upload.delete",
        targetType: "upload",
        targetId: before.id,
        beforeData: before,
        afterData: after,
        reason: input.reason,
      });
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/admin/customers/:customerId/uploads/:uploadId/review", authorize("upload.review"), (req, res, next) => {
    const schema = z.object({
      review_status: z.enum(["APPROVED", "REJECTED", "CHANGES_REQUESTED"]),
      comment: z.string().default(""),
      reason: z.string().min(3),
    });
    try {
      const input = schema.parse(req.body);
      getCustomerOrThrow(db, req.params.customerId);
      const before = db.prepare(`
        select * from uploads where id = ? and customer_id = ? and deleted_at is null
      `).get(req.params.uploadId, req.params.customerId);
      if (!before) throw createError(404, "Upload not found");
      db.prepare(`
        update uploads
        set review_status = @review_status,
            reviewer_id = @reviewer_id,
            reviewer_name = @reviewer_name,
            reviewer_comment = @reviewer_comment,
            updated_at = datetime('now')
        where id = @id
      `).run({
        id: before.id,
        review_status: input.review_status,
        reviewer_id: req.actor.id,
        reviewer_name: req.actor.email,
        reviewer_comment: input.comment,
      });
      const after = db.prepare("select * from uploads where id = ?").get(before.id);
      insertAuditLog(db, {
        actor: req.actor,
        action: "upload.review",
        targetType: "upload",
        targetId: before.id,
        beforeData: before,
        afterData: after,
        reason: input.reason,
      });
      res.json({ data: after });
    } catch (error) {
      next(error);
    }
  });
}
