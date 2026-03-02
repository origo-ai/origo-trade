import { createError } from "../app/errors.js";
import { getSupabaseServerClient } from "./supabase.js";
import { getCustomerOrThrow } from "./customer-access.js";

async function resolveMarketCompanyId(db, customerId, supabase) {
  const linked = db.prepare("select company_id from customer_market_links where customer_id = ?").get(customerId);
  if (linked?.company_id) {
    return linked.company_id;
  }

  const customer = getCustomerOrThrow(db, customerId);
  const terms = [customer.company_name]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  if (!terms.length) return null;

  for (const term of terms) {
    const { data, error } = await supabase
      .from("supabase_companies")
      .select("company_id, customer_name, customer")
      .or(`customer_name.ilike.%${term}%,customer.ilike.%${term}%`)
      .limit(1);

    if (error) continue;
    const first = data?.[0];
    if (!first?.company_id) continue;

    db.prepare(`
      insert into customer_market_links (customer_id, company_id, source, updated_at)
      values (?, ?, 'auto_match', datetime('now'))
      on conflict(customer_id) do update set
        company_id = excluded.company_id,
        source = excluded.source,
        updated_at = datetime('now')
    `).run(customerId, first.company_id);
    return first.company_id;
  }

  return null;
}

export async function requireMarketContext(db, customerId) {
  getCustomerOrThrow(db, customerId);
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw createError(
      500,
      "Supabase server connection is missing. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (or VITE_SUPABASE_*).",
    );
  }

  const companyId = await resolveMarketCompanyId(db, customerId, supabase);
  if (!companyId) {
    throw createError(
      404,
      "No linked market company_id for this customer. Link it first in Backoffice Market tab.",
    );
  }

  return { supabase, companyId };
}
