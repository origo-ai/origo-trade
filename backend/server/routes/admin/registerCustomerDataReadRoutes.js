import { createError } from "../../app/errors.js";
import { getSupabaseServerClient } from "../../services/supabase.js";

const normalizeText = (value) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizeNumber = (value) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return 0;
};

const normalizeFactory = (value) => {
  const normalized = normalizeText(value).toUpperCase();
  return normalized || "-";
};

const normalizeNullableText = (value) => {
  const normalized = normalizeText(value);
  return normalized || null;
};

const normalizeBoolean = (value) => {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (normalized === "true" || normalized === "yes" || normalized === "1") return true;
    if (normalized === "false" || normalized === "no" || normalized === "0") return false;
  }
  return false;
};

const isMissingTableError = (error) => {
  const code = error?.code;
  if (code === "PGRST205" || code === "42P01") return true;
  const message = normalizeText(error?.message);
  return /could not find the table|relation .* does not exist|schema cache/i.test(message);
};

const toBridgeStatus = (status, dateTo, ton, acc) => {
  const normalized = normalizeText(status).toLowerCase();
  if (normalized === "complete" || normalized === "completed") return "Complete";
  if (normalized === "overdue") return "Overdue";
  if (normalized === "pending") return "Pending";

  const commitTon = normalizeNumber(ton);
  const deliveredTon = normalizeNumber(acc);
  if (commitTon > 0 && deliveredTon >= commitTon) {
    return "Complete";
  }

  const dueDate = normalizeText(dateTo);
  if (dueDate) {
    const parsed = new Date(dueDate);
    if (!Number.isNaN(parsed.getTime())) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      parsed.setHours(0, 0, 0, 0);
      if (parsed.getTime() < today.getTime() && commitTon - deliveredTon > 0) {
        return "Overdue";
      }
    }
  }

  if (commitTon - deliveredTon > 0) {
    return "Pending";
  }

  return normalizeText(status) || "Unknown";
};

function getBridgeClientOrThrow() {
  const supabase = getSupabaseServerClient();
  if (!supabase) {
    throw createError(
      500,
      "Customer data bridge is not configured. Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.",
    );
  }
  return supabase;
}

async function resolveBridgeProfile(supabase, { email, username }) {
  const normalizedEmail = normalizeText(email).toLowerCase();
  const normalizedUsername = normalizeText(username).toLowerCase();

  if (normalizedEmail) {
    const exactProfile = await supabase
      .from("user_profiles")
      .select("user_id, email, full_name, default_entity_id")
      .ilike("email", normalizedEmail)
      .limit(1)
      .maybeSingle();
    if (!exactProfile.error && exactProfile.data) {
      return exactProfile.data;
    }
  }

  if (normalizedUsername) {
    const fuzzyProfile = await supabase
      .from("user_profiles")
      .select("user_id, email, full_name, default_entity_id")
      .or(`email.ilike.%${normalizedUsername}%,full_name.ilike.%${normalizedUsername}%`)
      .limit(1)
      .maybeSingle();
    if (!fuzzyProfile.error && fuzzyProfile.data) {
      return fuzzyProfile.data;
    }
  }

  const fallbackProfile = await supabase
    .from("user_profiles")
    .select("user_id, email, full_name, default_entity_id")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!fallbackProfile.error && fallbackProfile.data) {
    return fallbackProfile.data;
  }

  return null;
}

const toBridgeConfidence = (value) => {
  const normalized = normalizeNumber(value);
  if (normalized >= 0.85) return "HIGH";
  if (normalized >= 0.6) return "MEDIUM";
  return "LOW";
};

const sortDescText = (left, right) => String(right || "").localeCompare(String(left || ""));

const uniqueTextList = (values, limit = Infinity) => {
  const rows = [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))];
  return Number.isFinite(limit) ? rows.slice(0, limit) : rows;
};

async function resolveBridgeIdentityBundle(supabase, identity) {
  const profile = await resolveBridgeProfile(supabase, identity);
  const userId = normalizeText(profile?.user_id);

  let memberships = [];
  if (userId) {
    const membershipRes = await supabase
      .from("company_user_members")
      .select("entity_id, role, is_active, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(20);

    if (!membershipRes.error) {
      memberships = membershipRes.data ?? [];
    }
  }

  const entityIds = [...new Set([
    normalizeText(profile?.default_entity_id),
    ...memberships.map((row) => normalizeText(row.entity_id)),
  ].filter(Boolean))];

  let entities = [];
  if (entityIds.length > 0) {
    const entityRes = await supabase
      .from("company_entities")
      .select("entity_id, company_name, company_code, company_status")
      .in("entity_id", entityIds)
      .limit(50);

    if (!entityRes.error) {
      entities = entityRes.data ?? [];
    }
  }

  const primaryEntityId = normalizeText(profile?.default_entity_id) || normalizeText(memberships[0]?.entity_id);
  const primaryEntity =
    entities.find((row) => normalizeText(row.entity_id) === primaryEntityId) ??
    entities[0] ??
    null;
  const primaryMembership =
    memberships.find((row) => normalizeText(row.entity_id) === normalizeText(primaryEntity?.entity_id)) ??
    memberships[0] ??
    null;

  return {
    profile,
    memberships,
    entities,
    entityIds,
    primaryEntity,
    primaryMembership,
  };
}

async function loadCustomerContextBridge(identity) {
  const supabase = getBridgeClientOrThrow();
  const {
    profile,
    primaryEntity,
    primaryMembership,
  } = await resolveBridgeIdentityBundle(supabase, identity);

  return {
    source: "supabase_server_bridge",
    matchedProfileEmail: normalizeNullableText(profile?.email),
    customerId:
      normalizeNullableText(primaryEntity?.entity_id) ??
      normalizeNullableText(profile?.default_entity_id),
    companyName:
      normalizeText(primaryEntity?.company_name) ||
      normalizeText(profile?.full_name) ||
      "TRR Group",
    role: normalizeText(primaryMembership?.role) || "customer",
    isActive: primaryMembership?.is_active !== false,
  };
}

async function loadYourProductBridge(identity) {
  const supabase = getBridgeClientOrThrow();
  const {
    profile,
    entityIds,
    primaryEntity,
  } = await resolveBridgeIdentityBundle(supabase, identity);

  if (entityIds.length === 0) {
    return {
      source: "supabase_server_bridge",
      matchedProfileEmail: normalizeNullableText(profile?.email),
      customerId: null,
      rows: [],
    };
  }

  const companyMapRes = await supabase
    .from("company_entity_map")
    .select("market_company_id, is_primary")
    .in("entity_id", entityIds)
    .not("market_company_id", "is", null)
    .limit(5000);

  if (companyMapRes.error) {
    if (isMissingTableError(companyMapRes.error)) {
      return {
        source: "supabase_server_bridge",
        matchedProfileEmail: normalizeNullableText(profile?.email),
        customerId: normalizeNullableText(primaryEntity?.entity_id),
        rows: [],
      };
    }
    throw createError(502, `Your Product bridge failed: ${companyMapRes.error.message || "Unable to load company mappings."}`);
  }

  const marketCompanyIds = [...new Set(
    (companyMapRes.data ?? [])
      .map((row) => normalizeText(row.market_company_id))
      .filter(Boolean),
  )];

  if (marketCompanyIds.length === 0) {
    return {
      source: "supabase_server_bridge",
      matchedProfileEmail: normalizeNullableText(profile?.email),
      customerId: normalizeNullableText(primaryEntity?.entity_id),
      rows: [],
    };
  }

  const [productMapRes, companyRes] = await Promise.all([
    supabase
      .from("company_product_map_sandbox")
      .select("id, company_id, product_id, last_seen_date, trade_rows, total_price_usd, total_weight_kg, total_quantity, product_description_sample, created_at, updated_at")
      .in("company_id", marketCompanyIds)
      .limit(5000),
    supabase
      .from("companies")
      .select("company_id, customer, location")
      .in("company_id", marketCompanyIds)
      .limit(5000),
  ]);

  if (productMapRes.error) {
    if (isMissingTableError(productMapRes.error)) {
      return {
        source: "supabase_server_bridge",
        matchedProfileEmail: normalizeNullableText(profile?.email),
        customerId: normalizeNullableText(primaryEntity?.entity_id),
        rows: [],
      };
    }
    throw createError(502, `Your Product bridge failed: ${productMapRes.error.message || "Unable to load product mappings."}`);
  }

  if (companyRes.error && !isMissingTableError(companyRes.error)) {
    throw createError(502, `Your Product bridge failed: ${companyRes.error.message || "Unable to load company details."}`);
  }

  const productIds = [...new Set(
    (productMapRes.data ?? [])
      .map((row) => normalizeText(row.product_id))
      .filter(Boolean),
  )];

  let catalogRows = [];
  if (productIds.length > 0) {
    const catalogRes = await supabase
      .from("product_catalog_sandbox")
      .select("product_id, product_name, canonical_product, hs_code, application_label, application_confidence, verified, created_at, updated_at, hero_product, description, product_image_url")
      .in("product_id", productIds)
      .limit(5000);

    if (catalogRes.error) {
      if (!isMissingTableError(catalogRes.error)) {
        throw createError(502, `Your Product bridge failed: ${catalogRes.error.message || "Unable to load product catalog."}`);
      }
    } else {
      catalogRows = catalogRes.data ?? [];
    }
  }

  const catalogById = new Map(
    catalogRows.map((row) => [normalizeText(row.product_id), row]),
  );
  const companyById = new Map(
    (companyRes.data ?? []).map((row) => [normalizeText(row.company_id), row]),
  );
  const groupedRows = new Map();

  (productMapRes.data ?? []).forEach((row) => {
    const productId = normalizeText(row.product_id);
    if (!productId) return;

    const group = groupedRows.get(productId) ?? [];
    group.push(row);
    groupedRows.set(productId, group);
  });

  const workspaceName =
    normalizeText(primaryEntity?.company_name) ||
    normalizeText(profile?.full_name) ||
    "TRR Group";
  const rows = [...groupedRows.entries()]
    .map(([productId, productRows]) => {
      const catalog = catalogById.get(productId) ?? null;
      const sortedProductRows = [...productRows].sort(
        (left, right) => normalizeNumber(right.total_weight_kg) - normalizeNumber(left.total_weight_kg),
      );
      const totalTradeRows = productRows.reduce((sum, row) => sum + normalizeNumber(row.trade_rows), 0);
      const totalWeightKg = productRows.reduce((sum, row) => sum + normalizeNumber(row.total_weight_kg), 0);
      const totalValueUsd = productRows.reduce((sum, row) => sum + normalizeNumber(row.total_price_usd), 0);
      const lastSeenDate = [...productRows]
        .map((row) => normalizeText(row.last_seen_date))
        .filter(Boolean)
        .sort(sortDescText)[0] || null;
      const updatedAt = [...productRows]
        .flatMap((row) => [
          normalizeText(row.updated_at),
          normalizeText(row.created_at),
          normalizeText(row.last_seen_date),
        ])
        .filter(Boolean)
        .sort(sortDescText)[0] || null;
      const companyLocations = uniqueTextList(
        sortedProductRows.map((row) => companyById.get(normalizeText(row.company_id))?.location),
        3,
      );
      const topCompanies = uniqueTextList(
        sortedProductRows.map((row) => companyById.get(normalizeText(row.company_id))?.customer),
        3,
      );
      const productName =
        normalizeText(catalog?.product_name) ||
        normalizeText(catalog?.canonical_product) ||
        normalizeText(sortedProductRows[0]?.product_description_sample) ||
        "Product";
      const detailSummaryParts = [
        normalizeText(catalog?.description),
        normalizeText(catalog?.application_label),
        normalizeText(sortedProductRows[0]?.product_description_sample),
      ].filter(Boolean);

      return {
        id: productId,
        customer_id: normalizeNullableText(primaryEntity?.entity_id),
        customer_email: normalizeText(profile?.email),
        customer_username: normalizeText(profile?.full_name) || workspaceName,
        customer_workspace: workspaceName,
        product_name: productName,
        hs_code: normalizeNullableText(catalog?.hs_code),
        product_details: detailSummaryParts[0] || null,
        target_market: companyLocations.length > 0 ? companyLocations.join(", ") : null,
        image_url: normalizeNullableText(catalog?.product_image_url),
        image_file_name: null,
        status: catalog?.hero_product ? "UNLOCKED" : "READY",
        submitted_at: updatedAt || lastSeenDate,
        updated_at: updatedAt || lastSeenDate,
        updated_by: "Supabase Bridge",
        customer_message: topCompanies.length > 0
          ? `Loaded from sandbox mapping for ${topCompanies.join(", ")}.`
          : "Loaded from sandbox mapping.",
        admin_note: null,
        missing_info_checklist: {
          packaging: false,
          application: false,
          target_market: false,
          material: false,
        },
        confidence: toBridgeConfidence(catalog?.application_confidence),
        ready_summary: [
          `${Math.round(totalTradeRows)} trade rows`,
          `${Math.round(totalWeightKg)} KG`,
          totalValueUsd > 0 ? `$${Math.round(totalValueUsd)}` : "",
          lastSeenDate ? `last seen ${lastSeenDate}` : "",
        ].filter(Boolean).join(" • "),
      };
    })
    .sort((left, right) => {
      if (left.status !== right.status) {
        return left.status === "UNLOCKED" ? -1 : 1;
      }
      return sortDescText(left.updated_at, right.updated_at) || left.product_name.localeCompare(right.product_name);
    });

  return {
    source: "supabase_server_bridge",
    matchedProfileEmail: normalizeNullableText(profile?.email),
    customerId: normalizeNullableText(primaryEntity?.entity_id),
    rows,
  };
}

async function loadMyCompanyBridge(identity) {
  const supabase = getBridgeClientOrThrow();
  const profile = await resolveBridgeProfile(supabase, identity);
  const customerLabel = normalizeText(profile?.full_name) || "TRR Group";

  const [contractRes, stockRes, invoiceRes, deliveryRes, yourProductSnapshot] = await Promise.all([
    supabase
      .from("operation_lines")
      .select("line_id, contract_id, job, product, ton, acc, team, date_from, date_to, status")
      .order("date_to", { ascending: false })
      .limit(500),
    supabase
      .from("operation_stock")
      .select("stock_id, factory, qty, tag, type")
      .limit(500),
    supabase
      .from("finance_invoices")
      .select("id, invoice_date, status_type, usd, total_invoice, tons, customer_name, fac")
      .order("invoice_date", { ascending: false })
      .limit(500),
    supabase
      .from("operation_deliveries")
      .select("delivery_id, contract_id, job, delivery_date, quantity")
      .order("delivery_date", { ascending: false })
      .limit(500),
    loadYourProductBridge(identity),
  ]);

  const firstError = contractRes.error || stockRes.error || invoiceRes.error || deliveryRes.error;
  if (firstError) {
    throw createError(502, `Customer data bridge failed: ${firstError.message || "Unable to load data."}`);
  }

  const contractRows = (contractRes.data ?? []).map((row, index) => {
    const ton = normalizeNumber(row.ton);
    const acc = normalizeNumber(row.acc);
    return {
      id: row.line_id || `${row.contract_id || "contract"}-${index}`,
      customer: customerLabel,
      contractId: normalizeText(row.contract_id) || "-",
      commitDate: normalizeText(row.date_from) || null,
      status: normalizeText(row.status) || "Unknown",
      ton,
      acc,
      product: normalizeText(row.product) || "-",
      job: normalizeText(row.job) || "-",
      team: normalizeText(row.team) || "-",
      contractType: "-",
      dateTo: normalizeText(row.date_to) || null,
      remainingTon: ton - acc,
    };
  });

  const stockRows = (stockRes.data ?? []).map((row, index) => ({
    id: String(row.stock_id || index),
    factory: normalizeFactory(row.factory),
    qty: normalizeNumber(row.qty),
    tag: normalizeText(row.tag) || "-",
    type: normalizeText(row.type) || "-",
  }));

  const invoiceRows = (invoiceRes.data ?? []).map((row, index) => ({
    id: row.id || `invoice-${index}`,
    invoiceDate: normalizeText(row.invoice_date) || null,
    statusType: normalizeText(row.status_type) || "Unknown",
    usd: normalizeNumber(row.usd) || normalizeNumber(row.total_invoice),
    tons: normalizeNumber(row.tons),
    customerName: normalizeText(row.customer_name) || customerLabel,
    factory: normalizeFactory(row.fac),
  }));

  const deliveryRows = (deliveryRes.data ?? []).map((row, index) => ({
    id: row.delivery_id || `delivery-${index}`,
    deliveryDate: normalizeText(row.delivery_date) || null,
    quantity: normalizeNumber(row.quantity),
    contractId: normalizeText(row.contract_id) || null,
    job: normalizeText(row.job) || null,
  }));

  return {
    source: "supabase_server_bridge",
    matchedProfileEmail: profile?.email ?? null,
    contractRows,
    stockRows,
    invoiceRows,
    deliveryRows,
    yourProductRows: yourProductSnapshot.rows.map((row) => ({
      id: row.id,
      customer_email: row.customer_email,
      product_name: row.product_name,
      status: row.status,
      updated_at: row.updated_at,
    })),
  };
}

async function loadOrdersShipmentsBridge(identity) {
  const supabase = getBridgeClientOrThrow();
  const profile = await resolveBridgeProfile(supabase, identity);
  const customerLabel = normalizeText(profile?.full_name) || "TRR Group";

  const [contractRes, deliveryRes] = await Promise.all([
    supabase
      .from("operation_lines")
      .select("line_id, contract_id, job, product, ton, acc, team, date_from, date_to, status")
      .order("date_to", { ascending: true })
      .limit(500),
    supabase
      .from("operation_deliveries")
      .select("delivery_id, contract_id, job, delivery_date, quantity")
      .order("delivery_date", { ascending: false })
      .limit(1000),
  ]);

  const firstError = contractRes.error || deliveryRes.error;
  if (firstError) {
    throw createError(502, `Orders & Shipments bridge failed: ${firstError.message || "Unable to load data."}`);
  }

  const contractRows = (contractRes.data ?? []).map((row, index) => {
    const ton = normalizeNumber(row.ton);
    const acc = normalizeNumber(row.acc);
    return {
      id: row.line_id || `${row.contract_id || "contract"}-${index}`,
      customer: customerLabel,
      contractType: "-",
      contractId: normalizeText(row.contract_id) || "-",
      commitDate: normalizeNullableText(row.date_from),
      job: normalizeText(row.job) || "-",
      jobValue: normalizeNullableText(row.job),
      product: normalizeText(row.product) || "-",
      team: normalizeText(row.team) || "-",
      status: toBridgeStatus(row.status, row.date_to, ton, acc),
      price: null,
      paymentTerms: null,
      ton,
      acc,
      remainingTon: ton - acc,
      dateFrom: normalizeNullableText(row.date_from),
      dateTo: normalizeNullableText(row.date_to),
    };
  });

  const deliveryRows = (deliveryRes.data ?? []).map((row, index) => ({
    id: row.delivery_id || `delivery-${index}`,
    delivery_id: row.delivery_id || `delivery-${index}`,
    contract_id: normalizeText(row.contract_id) || "-",
    job: normalizeNullableText(row.job),
    delivery_date: normalizeNullableText(row.delivery_date),
    record: null,
    quantity: normalizeNumber(row.quantity),
    remark: null,
  }));

  return {
    source: "supabase_server_bridge",
    matchedProfileEmail: normalizeNullableText(profile?.email),
    customerId: normalizeNullableText(profile?.default_entity_id),
    contractRows,
    deliveryRows,
  };
}

async function loadInventoryBridge(identity) {
  const supabase = getBridgeClientOrThrow();
  const profile = await resolveBridgeProfile(supabase, identity);

  const stockRes = await supabase
    .from("operation_stock")
    .select("*")
    .limit(1000);

  if (stockRes.error) {
    throw createError(502, `Inventory bridge failed: ${stockRes.error.message || "Unable to load data."}`);
  }

  const rows = (stockRes.data ?? []).map((row, index) => ({
    id: String(row.stock_id || row.id || index),
    stockId: String(row.stock_id || row.id || "-"),
    factory: normalizeFactory(row.factory),
    qty: normalizeNumber(row.qty),
    tag: normalizeText(row.tag) || "-",
    type: normalizeText(row.type) || "-",
  }));

  return {
    source: "supabase_server_bridge",
    matchedProfileEmail: normalizeNullableText(profile?.email),
    customerId: normalizeNullableText(profile?.default_entity_id),
    rows,
  };
}

async function loadInvoicesBridge(identity) {
  const supabase = getBridgeClientOrThrow();
  const profile = await resolveBridgeProfile(supabase, identity);
  const customerLabel = normalizeText(profile?.full_name) || "TRR Group";

  const invoiceRes = await supabase
    .from("finance_invoices")
    .select("*")
    .order("invoice_date", { ascending: false })
    .limit(1000);

  if (invoiceRes.error) {
    throw createError(502, `Invoices bridge failed: ${invoiceRes.error.message || "Unable to load data."}`);
  }

  const rows = (invoiceRes.data ?? []).map((row, index) => {
    const totalInvoice = normalizeNumber(row.total_invoice);
    const usd = normalizeNumber(row.usd) || totalInvoice;
    return {
      id: normalizeText(row.id) || `invoice-${index}`,
      invoice: normalizeText(row.invoice) || normalizeText(row.id) || "-",
      tons: normalizeNumber(row.tons),
      totalInvoice,
      usd,
      contact: normalizeBoolean(row.contact),
      credit: normalizeBoolean(row.credit),
      exportFlag: normalizeBoolean(row.export),
      team: normalizeText(row.team) || "-",
      thb: normalizeNumber(row.thb),
      bookingNo: normalizeText(row.booking_no) || "-",
      contract: normalizeText(row.contract) || normalizeText(row.contract_id) || "-",
      convertDate: normalizeNullableText(row.convert_date),
      convertRate: normalizeNumber(row.convert_rate),
      customerName: normalizeText(row.customer_name) || customerLabel,
      factory: normalizeFactory(row.fac || row.factory),
      invoiceDate: normalizeNullableText(row.invoice_date),
      price: normalizeNumber(row.price),
      statusType: normalizeText(row.status_type) || "Unknown",
      statusDetail: normalizeText(row.status_detail) || "-",
    };
  });

  return {
    source: "supabase_server_bridge",
    matchedProfileEmail: normalizeNullableText(profile?.email),
    customerId: normalizeNullableText(profile?.default_entity_id),
    rows,
  };
}

async function loadOptionalTableRows(supabase, tables, {
  select = "*",
  orderBy = null,
  ascending = false,
  limit = 1000,
} = {}) {
  for (const table of tables) {
    let query = supabase.from(table).select(select);
    if (orderBy) {
      query = query.order(orderBy, { ascending });
    }
    if (Number.isFinite(limit) && limit > 0) {
      query = query.limit(limit);
    }

    const result = await query;
    if (!result.error) {
      return {
        table,
        rows: result.data ?? [],
      };
    }

    if (isMissingTableError(result.error)) {
      continue;
    }

    throw result.error;
  }

  return {
    table: null,
    rows: [],
  };
}

async function loadMarketIntelligenceBridge(identity) {
  const supabase = getBridgeClientOrThrow();
  const profile = await resolveBridgeProfile(supabase, identity);

  let marketSource = null;
  let companySource = null;
  let marketRows = [];
  let companyRows = [];

  try {
    const marketResult = await loadOptionalTableRows(supabase, ["purchase_trend", "purchase_trends"], {
      select: "*",
      orderBy: "date",
      ascending: false,
      limit: 2000,
    });
    marketSource = marketResult.table;
    marketRows = marketResult.rows;
  } catch (error) {
    throw createError(
      502,
      `Market Intelligence bridge failed: ${normalizeText(error?.message) || "Unable to load purchase trends."}`,
    );
  }

  try {
    const companyResult = await loadOptionalTableRows(supabase, ["supabase_companies", "companies"], {
      select: "*",
      orderBy: "created_at",
      ascending: false,
      limit: 1000,
    });
    companySource = companyResult.table;
    companyRows = companyResult.rows;
  } catch (error) {
    throw createError(
      502,
      `Market Intelligence bridge failed: ${normalizeText(error?.message) || "Unable to load company data."}`,
    );
  }

  return {
    source: "supabase_server_bridge",
    matchedProfileEmail: normalizeNullableText(profile?.email),
    customerId: normalizeNullableText(profile?.default_entity_id),
    marketSource,
    companySource,
    marketRows,
    companyRows,
  };
}

export function registerCustomerDataReadRoutes(app, {
  authorize,
  db,
  getCustomerOrThrow,
}) {
  app.get("/api/admin/customer-portal/context", async (req, res, next) => {
    try {
      const data = await loadCustomerContextBridge({
        email: req.query.email,
        username: req.query.username,
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customer-portal/my-company", async (req, res, next) => {
    try {
      const data = await loadMyCompanyBridge({
        email: req.query.email,
        username: req.query.username,
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customer-portal/orders-shipments", async (req, res, next) => {
    try {
      const data = await loadOrdersShipmentsBridge({
        email: req.query.email,
        username: req.query.username,
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customer-portal/inventory", async (req, res, next) => {
    try {
      const data = await loadInventoryBridge({
        email: req.query.email,
        username: req.query.username,
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customer-portal/invoices", async (req, res, next) => {
    try {
      const data = await loadInvoicesBridge({
        email: req.query.email,
        username: req.query.username,
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customer-portal/your-product", async (req, res, next) => {
    try {
      const data = await loadYourProductBridge({
        email: req.query.email,
        username: req.query.username,
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/admin/customer-portal/market-intelligence", async (req, res, next) => {
    try {
      const data = await loadMarketIntelligenceBridge({
        email: req.query.email,
        username: req.query.username,
      });
      res.json({ data });
    } catch (error) {
      next(error);
    }
  });

  if (db && getCustomerOrThrow) {
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
}
