import { isSupabaseConfigured, supabase } from "@/lib/supabase";

type CustomerRow = {
  id: string | null;
  company_name: string | null;
  email: string | null;
};

export type CustomerScope = {
  customerId: string | null;
  companyName: string | null;
  source: "users_customer_id" | "customers_email" | "customers_username" | "none";
};

export const ACCOUNT_SCOPE_SETUP_MESSAGE =
  "Account scope setup is incomplete. Admin must run docs/sql/01_scope_migration.sql.";

export const CUSTOMER_SCOPE_NOT_MAPPED_MESSAGE =
  "This account is not ready for scoped data yet. Please contact the admin team.";

export const CUSTOMER_SCOPE_ACCESS_DENIED_MESSAGE =
  "You do not have permission to access this account scope. Please contact the admin team.";

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const isSchemaError = (message: string) =>
  /schema cache|could not find the table|does not exist|column .* does not exist|relation .* does not exist/i.test(
    message,
  );

const parseErrorMessage = (error: unknown) => {
  if (error && typeof error === "object" && "message" in (error as Record<string, unknown>)) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string") return message;
  }
  return String(error ?? "Unknown error");
};

const normalizeCustomerRow = (row: Record<string, unknown>): CustomerRow => ({
  id: normalizeText(row.id) || null,
  company_name: normalizeText(row.company_name) || null,
  email: normalizeText(row.email) || null,
});

const loadCustomerById = async (customerId: string): Promise<CustomerRow | null> => {
  if (!supabase || !customerId) return null;
  const { data, error } = await supabase
    .from("customers")
    .select("id, company_name, email")
    .eq("id", customerId)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return normalizeCustomerRow(data as Record<string, unknown>);
};

const loadCustomerByEmail = async (email: string): Promise<CustomerRow | null> => {
  if (!supabase || !email) return null;
  const { data, error } = await supabase
    .from("customers")
    .select("id, company_name, email")
    .ilike("email", email)
    .maybeSingle();
  if (error) return null;
  if (!data) return null;
  return normalizeCustomerRow(data as Record<string, unknown>);
};

const loadCustomerByUsername = async (username: string): Promise<CustomerRow | null> => {
  if (!supabase || !username) return null;

  const byIdExact = await supabase
    .from("customers")
    .select("id, company_name, email")
    .ilike("id", username)
    .maybeSingle();
  if (!byIdExact.error && byIdExact.data) {
    return normalizeCustomerRow(byIdExact.data as Record<string, unknown>);
  }

  const byIdPartial = await supabase
    .from("customers")
    .select("id, company_name, email")
    .ilike("id", `%${username}%`)
    .maybeSingle();
  if (!byIdPartial.error && byIdPartial.data) {
    return normalizeCustomerRow(byIdPartial.data as Record<string, unknown>);
  }

  const byCompany = await supabase
    .from("customers")
    .select("id, company_name, email")
    .ilike("company_name", `%${username}%`)
    .maybeSingle();
  if (byCompany.error || !byCompany.data) return null;
  return normalizeCustomerRow(byCompany.data as Record<string, unknown>);
};

export const isMissingCustomerScopeColumnError = (error: unknown) => {
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "42703" || code === "PGRST204") return true;
  const message = parseErrorMessage(error).toLowerCase();
  return (
    message.includes("customer_id") &&
    (message.includes("column") || message.includes("schema cache") || message.includes("could not find"))
  );
};

export const getScopeAwareErrorMessage = (error: unknown) => {
  if (isMissingCustomerScopeColumnError(error)) return ACCOUNT_SCOPE_SETUP_MESSAGE;
  const code = (error as { code?: string } | undefined)?.code;
  if (code === "42501" || code === "PGRST116") return CUSTOMER_SCOPE_ACCESS_DENIED_MESSAGE;
  return parseErrorMessage(error);
};

export async function resolveCustomerScope(input: { email?: string; username?: string } = {}): Promise<CustomerScope> {
  if (!isSupabaseConfigured || !supabase) {
    return { customerId: null, companyName: null, source: "none" };
  }

  let normalizedEmail = normalizeText(input.email).toLowerCase();
  const normalizedUsername = normalizeText(input.username);
  let customerIdFromUsers = "";

  const authUserResponse = await supabase.auth.getUser();
  const authUserId = authUserResponse.data.user?.id ?? "";

  if (authUserId) {
    const userRowResponse = await supabase
      .from("users")
      .select("customer_id, email")
      .eq("id", authUserId)
      .maybeSingle();

    if (!userRowResponse.error && userRowResponse.data) {
      const userRow = userRowResponse.data as Record<string, unknown>;
      customerIdFromUsers = normalizeText(userRow.customer_id);
      if (!normalizedEmail) {
        normalizedEmail = normalizeText(userRow.email).toLowerCase();
      }
    } else if (userRowResponse.error && !isSchemaError(parseErrorMessage(userRowResponse.error))) {
      return { customerId: null, companyName: null, source: "none" };
    }
  }

  if (customerIdFromUsers) {
    const customerRow = await loadCustomerById(customerIdFromUsers);
    return {
      customerId: customerIdFromUsers,
      companyName: customerRow?.company_name ?? null,
      source: "users_customer_id",
    };
  }

  if (normalizedEmail) {
    const customerByEmail = await loadCustomerByEmail(normalizedEmail);
    if (customerByEmail?.id) {
      return {
        customerId: customerByEmail.id,
        companyName: customerByEmail.company_name ?? null,
        source: "customers_email",
      };
    }
  }

  if (normalizedUsername) {
    const customerByUsername = await loadCustomerByUsername(normalizedUsername);
    if (customerByUsername?.id) {
      return {
        customerId: customerByUsername.id,
        companyName: customerByUsername.company_name ?? null,
        source: "customers_username",
      };
    }
  }

  return { customerId: null, companyName: null, source: "none" };
}
