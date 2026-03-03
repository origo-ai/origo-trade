import { createError } from "../app/errors.js";

export function getCustomerOrThrow(db, customerId) {
  const row = db.prepare("select * from customers where id = ?").get(customerId);
  if (!row) throw createError(404, "Customer not found");
  return row;
}

export function getCustomerAccountOrThrow(db, customerId) {
  const row = db.prepare("select * from customer_accounts where customer_id = ?").get(customerId);
  if (!row) throw createError(404, "Customer account not found");
  return row;
}
