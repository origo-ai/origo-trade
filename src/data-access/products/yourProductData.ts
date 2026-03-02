import { isSupabaseConfigured, supabase } from "@/lib/supabase";
import { CUSTOMER_SCOPE_NOT_MAPPED_MESSAGE, resolveCustomerScope } from "@/data-access/customer/scope";

export type ProductRequestStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "NEED_MORE_INFO"
  | "READY"
  | "UNLOCKED"
  | "NOT_SUPPORTED";

export type ProductConfidence = "HIGH" | "MEDIUM" | "LOW";

export type MissingInfoChecklist = {
  packaging: boolean;
  application: boolean;
  target_market: boolean;
  material: boolean;
};

export type ProductRequestRecord = {
  id: string;
  customer_id: string | null;
  customer_email: string;
  customer_username: string;
  customer_workspace: string;
  product_name: string;
  hs_code: string | null;
  product_details: string | null;
  target_market: string | null;
  image_url: string | null;
  image_file_name: string | null;
  status: ProductRequestStatus;
  submitted_at: string;
  updated_at: string;
  updated_by: string | null;
  customer_message: string | null;
  admin_note: string | null;
  missing_info_checklist: MissingInfoChecklist;
  confidence: ProductConfidence;
  ready_summary: string | null;
};

export type ReadyTopCountry = {
  country: string;
  code: string;
  share: number;
};

export type ReadyBuyerPreview = {
  buyer_display_name: string;
  country: string;
  country_code: string;
  import_volume_kg: number;
  frequency: string;
  last_active_year: number;
};

export type ReadyPageProduct = {
  id: string;
  product_name: string;
  hs_code: string | null;
  buyers_2023_count: number;
  countries_2023_count: number;
  buyers_2026_count: number;
  top_countries_2023: ReadyTopCountry[];
  buyer_snapshot_preview: ReadyBuyerPreview[];
  ready_copy: string | null;
  created_at: string;
  updated_at: string;
};

export type ReadyPageProductUpdateInput = Partial<
  Pick<
    ReadyPageProduct,
    | "buyers_2026_count"
    | "ready_copy"
    | "top_countries_2023"
    | "buyer_snapshot_preview"
    | "hs_code"
  >
>;

export type ProductRequestCreateInput = {
  customer_id?: string;
  customer_email: string;
  customer_username: string;
  customer_workspace: string;
  product_name: string;
  hs_code?: string;
  product_details?: string;
  target_market?: string;
  image_url?: string;
  image_file_name?: string;
};

export type ProductRequestUpdateInput = Partial<
  Pick<
    ProductRequestRecord,
    | "status"
    | "updated_by"
    | "customer_message"
    | "admin_note"
    | "ready_summary"
    | "hs_code"
    | "product_details"
    | "target_market"
    | "image_url"
    | "image_file_name"
    | "product_name"
    | "customer_workspace"
  >
> & {
  missing_info_checklist?: Partial<MissingInfoChecklist>;
};

export type LoadProductRequestsOptions = {
  customerId?: string | null;
  customerEmail?: string | null;
  limit?: number;
};

const REQUEST_STORAGE_KEY = "origo-your-product-requests-v1";
const LOCAL_READY_PRODUCTS_KEY = "origo-ready-page-products-v1";
const DEFAULT_CHECKLIST: MissingInfoChecklist = {
  packaging: false,
  application: false,
  target_market: false,
  material: false,
};

type BuyerSignalRow = {
  product_name: string;
  signal_year: number;
  buyer_display_name: string;
  country: string;
  country_code: string;
  import_volume_kg: number;
  frequency: string;
  last_active_year: number;
};

const LOCAL_READY_PRODUCTS: ReadyPageProduct[] = [];

const loadLocalReadyProducts = () => {
  if (typeof window === "undefined") return LOCAL_READY_PRODUCTS;

  const raw = window.localStorage.getItem(LOCAL_READY_PRODUCTS_KEY);
  if (!raw) return LOCAL_READY_PRODUCTS;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return LOCAL_READY_PRODUCTS;
    const normalized = (parsed as Record<string, unknown>[]).map((row) => ({
      id: normalizeText(row.id) || crypto.randomUUID(),
      product_name: normalizeText(row.product_name),
      hs_code: toNullable(normalizeText(row.hs_code)),
      buyers_2023_count: Number(row.buyers_2023_count ?? 0),
      countries_2023_count: Number(row.countries_2023_count ?? 0),
      buyers_2026_count: Number(row.buyers_2026_count ?? 0),
      top_countries_2023: parseJsonArray<ReadyTopCountry>(row.top_countries_2023),
      buyer_snapshot_preview: parseJsonArray<ReadyBuyerPreview>(row.buyer_snapshot_preview).slice(0, 5),
      ready_copy: toNullable(normalizeText(row.ready_copy)),
      created_at: normalizeText(row.created_at) || nowIso(),
      updated_at: normalizeText(row.updated_at) || nowIso(),
    }));
    return normalized.length > 0 ? normalized : LOCAL_READY_PRODUCTS;
  } catch {
    return LOCAL_READY_PRODUCTS;
  }
};

const saveLocalReadyProducts = (rows: ReadyPageProduct[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LOCAL_READY_PRODUCTS_KEY, JSON.stringify(rows));
};

const buildMetricsByProductFromSignals = (rows: BuyerSignalRow[]) => {
  const grouped = new Map<string, BuyerSignalRow[]>();
  rows.forEach((row) => {
    const key = normalizeText(row.product_name).toUpperCase();
    if (!key) return;
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  });

  const metrics = new Map<
    string,
    {
      buyers_2023_count: number;
      countries_2023_count: number;
      top_countries_2023: ReadyTopCountry[];
      buyer_snapshot_preview: ReadyBuyerPreview[];
    }
  >();

  grouped.forEach((productRows, productKey) => {
    const buyersCount = productRows.length;
    const countryCounter = new Map<string, { country: string; code: string; count: number }>();
    productRows.forEach((row) => {
      const code = normalizeText(row.country_code).toUpperCase();
      const country = normalizeText(row.country);
      if (!code || !country) return;
      const current = countryCounter.get(code) ?? { country, code, count: 0 };
      current.count += 1;
      countryCounter.set(code, current);
    });

    const topCountries = Array.from(countryCounter.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map((item) => ({
        country: item.country,
        code: item.code,
        share: buyersCount > 0 ? Number(((item.count / buyersCount) * 100).toFixed(1)) : 0,
      }));

    const previewRows = [...productRows]
      .sort((a, b) => Number(b.import_volume_kg ?? 0) - Number(a.import_volume_kg ?? 0))
      .slice(0, 5)
      .map((row) => ({
        buyer_display_name: normalizeText(row.buyer_display_name),
        country: normalizeText(row.country),
        country_code: normalizeText(row.country_code).toUpperCase(),
        import_volume_kg: Number(row.import_volume_kg ?? 0),
        frequency: normalizeText(row.frequency) || "Quarterly",
        last_active_year: Number(row.last_active_year ?? 2023),
      }));

    metrics.set(productKey, {
      buyers_2023_count: buyersCount,
      countries_2023_count: countryCounter.size,
      top_countries_2023: topCountries,
      buyer_snapshot_preview: previewRows,
    });
  });

  return metrics;
};

const normalizeText = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizeStatus = (value: unknown): ProductRequestStatus => {
  const normalized = normalizeText(value).toUpperCase();
  switch (normalized) {
    case "DRAFT":
    case "PENDING_REVIEW":
    case "NEED_MORE_INFO":
    case "READY":
    case "UNLOCKED":
    case "NOT_SUPPORTED":
      return normalized;
    default:
      return "PENDING_REVIEW";
  }
};

const normalizeConfidence = (value: unknown): ProductConfidence => {
  const normalized = normalizeText(value).toUpperCase();
  if (normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") {
    return normalized;
  }
  return "LOW";
};

const parseChecklist = (value: unknown): MissingInfoChecklist => {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_CHECKLIST };
  }

  const candidate = value as Partial<MissingInfoChecklist>;
  return {
    packaging: Boolean(candidate.packaging),
    application: Boolean(candidate.application),
    target_market: Boolean(candidate.target_market),
    material: Boolean(candidate.material),
  };
};

const parseJsonArray = <T,>(value: unknown): T[] => {
  if (Array.isArray(value)) {
    return value as T[];
  }
  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed as T[]) : [];
    } catch {
      return [];
    }
  }
  return [];
};

const isSchemaError = (message: string) =>
  /schema cache|could not find the table|does not exist|column .* does not exist|relation .* does not exist/i.test(
    message,
  );

const nowIso = () => new Date().toISOString();

const toNullable = (value?: string) => {
  const trimmed = (value ?? "").trim();
  return trimmed.length === 0 ? null : trimmed;
};

const normalizeRequestRow = (row: Record<string, unknown>): ProductRequestRecord => {
  const submittedAt = normalizeText(row.submitted_at) || normalizeText(row.created_at) || nowIso();
  const updatedAt = normalizeText(row.updated_at) || submittedAt;

  return {
    id: normalizeText(row.id) || crypto.randomUUID(),
    customer_id: toNullable(normalizeText(row.customer_id)) ?? null,
    customer_email: normalizeText(row.customer_email),
    customer_username: normalizeText(row.customer_username),
    customer_workspace: normalizeText(row.customer_workspace),
    product_name: normalizeText(row.product_name),
    hs_code: toNullable(normalizeText(row.hs_code)) ?? null,
    product_details:
      toNullable(normalizeText(row.product_details)) ??
      toNullable(
        normalizeText(row.details_keyword) ||
          normalizeText(row.details_application) ||
          normalizeText(row.details_material) ||
          normalizeText(row.details_packaging),
      ) ??
      null,
    target_market: toNullable(normalizeText(row.target_market)) ?? null,
    image_url: toNullable(normalizeText(row.image_url)) ?? null,
    image_file_name: toNullable(normalizeText(row.image_file_name)) ?? null,
    status: normalizeStatus(row.status),
    submitted_at: submittedAt,
    updated_at: updatedAt,
    updated_by: toNullable(normalizeText(row.updated_by)) ?? null,
    customer_message: toNullable(normalizeText(row.customer_message)) ?? null,
    admin_note: toNullable(normalizeText(row.admin_note)) ?? null,
    missing_info_checklist: parseChecklist(row.missing_info_checklist),
    confidence: normalizeConfidence(row.confidence),
    ready_summary: toNullable(normalizeText(row.ready_summary)) ?? null,
  };
};

const toRequestRow = (record: ProductRequestRecord) => ({
  ...record,
  missing_info_checklist: { ...record.missing_info_checklist },
});

const toSupabaseRequestPayload = (
  record: ProductRequestRecord,
  options: { legacyDetails?: boolean; includeId?: boolean } = {},
) => {
  const base = {
    customer_id: record.customer_id,
    customer_email: record.customer_email,
    customer_username: record.customer_username,
    customer_workspace: record.customer_workspace,
    product_name: record.product_name,
    hs_code: record.hs_code,
    target_market: record.target_market,
    image_url: record.image_url,
    image_file_name: record.image_file_name,
    status: record.status,
    submitted_at: record.submitted_at,
    updated_at: record.updated_at,
    updated_by: record.updated_by,
    customer_message: record.customer_message,
    admin_note: record.admin_note,
    missing_info_checklist: { ...record.missing_info_checklist },
    confidence: record.confidence,
    ready_summary: record.ready_summary,
  };

  const withDetails = options.legacyDetails
    ? {
        ...base,
        details_keyword: record.product_details,
        details_application: null,
        details_material: null,
        details_packaging: null,
      }
    : {
        ...base,
        product_details: record.product_details,
      };

  if (options.includeId === false) {
    return withDetails;
  }

  return {
    id: record.id,
    ...withDetails,
  };
};

const isMissingProductDetailsColumnError = (message: string) =>
  /product_details/i.test(message) && /schema cache|does not exist/i.test(message);

const loadLocalRequests = () => {
  if (typeof window === "undefined") return [] as ProductRequestRecord[];

  const raw = window.localStorage.getItem(REQUEST_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((row) => normalizeRequestRow(row as Record<string, unknown>))
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));
  } catch {
    return [];
  }
};

const saveLocalRequests = (rows: ProductRequestRecord[]) => {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REQUEST_STORAGE_KEY, JSON.stringify(rows.map(toRequestRow)));
};

const buildConfidence = (input: {
  hsCode?: string | null;
  productDetails?: string | null;
  targetMarket?: string | null;
  matchedReadyProduct?: ReadyPageProduct | null;
}): ProductConfidence => {
  let score = 0;
  if (normalizeText(input.hsCode).length >= 6) score += 1;

  const detailsCount = [input.productDetails, input.targetMarket].filter(
    (value) => normalizeText(value).length > 0,
  ).length;

  if (detailsCount >= 2) score += 1;
  if (input.matchedReadyProduct) score += 1;

  if (score >= 3) return "HIGH";
  if (score >= 2) return "MEDIUM";
  return "LOW";
};

export const statusLabelMap: Record<ProductRequestStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Pending review",
  NEED_MORE_INFO: "Need more info",
  READY: "Ready",
  UNLOCKED: "Unlocked",
  NOT_SUPPORTED: "Not supported",
};

export const statusHintMap: Record<ProductRequestStatus, string> = {
  DRAFT: "Complete product details before submit.",
  PENDING_REVIEW: "We are reviewing your product.",
  NEED_MORE_INFO: "Please update product details.",
  READY: "Preview available.",
  UNLOCKED: "Full buyer intelligence is available.",
  NOT_SUPPORTED: "Not enough matching data.",
};

export async function loadReadyPageProducts() {
  if (!isSupabaseConfigured || !supabase) {
    return { rows: loadLocalReadyProducts(), source: "local" as const };
  }

  const { data, error } = await supabase
    .from("ready_page_products")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    if (isSchemaError(error.message)) {
      return { rows: LOCAL_READY_PRODUCTS, source: "local" as const };
    }
    throw error;
  }

  let signalMetricsByProduct = new Map<
    string,
    {
      buyers_2023_count: number;
      countries_2023_count: number;
      top_countries_2023: ReadyTopCountry[];
      buyer_snapshot_preview: ReadyBuyerPreview[];
    }
  >();

  const signalResponse = await supabase
    .from("ready_page_buyer_signals")
    .select("product_name, signal_year, buyer_display_name, country, country_code, import_volume_kg, frequency, last_active_year")
    .eq("signal_year", 2023)
    .limit(50000);

  if (!signalResponse.error) {
    signalMetricsByProduct = buildMetricsByProductFromSignals((signalResponse.data ?? []) as BuyerSignalRow[]);
  } else if (!isSchemaError(signalResponse.error.message)) {
    throw signalResponse.error;
  }

  const rows = ((data ?? []) as Record<string, unknown>[]).map((row) => {
    const productKey = normalizeText(row.product_name).toUpperCase();
    const fromSignals = signalMetricsByProduct.get(productKey);
    return {
    id: normalizeText(row.id) || crypto.randomUUID(),
    product_name: normalizeText(row.product_name),
    hs_code: toNullable(normalizeText(row.hs_code)),
    buyers_2023_count: fromSignals?.buyers_2023_count ?? Number(row.buyers_2023_count ?? 0),
    countries_2023_count: fromSignals?.countries_2023_count ?? Number(row.countries_2023_count ?? 0),
    buyers_2026_count: Number(row.buyers_2026_count ?? 0),
    top_countries_2023: fromSignals?.top_countries_2023 ?? parseJsonArray<ReadyTopCountry>(row.top_countries_2023),
    buyer_snapshot_preview:
      fromSignals?.buyer_snapshot_preview ?? parseJsonArray<ReadyBuyerPreview>(row.buyer_snapshot_preview).slice(0, 5),
    ready_copy: toNullable(normalizeText(row.ready_copy)),
    created_at: normalizeText(row.created_at) || nowIso(),
    updated_at: normalizeText(row.updated_at) || nowIso(),
  } as ReadyPageProduct;
  });

  return {
    rows: rows.length > 0 ? rows : loadLocalReadyProducts(),
    source: rows.length > 0 ? ("supabase" as const) : ("local" as const),
  };
}

export function findReadyProductMatch(productName: string, hsCode?: string | null, readyRows: ReadyPageProduct[] = []) {
  const normalizedName = normalizeText(productName).toUpperCase();
  const normalizedHs = normalizeText(hsCode).replace(/\D+/g, "");

  const byName = readyRows.find((row) => normalizeText(row.product_name).toUpperCase() === normalizedName);
  if (byName) return byName;

  if (normalizedHs.length >= 6) {
    const byHs = readyRows.find((row) => normalizeText(row.hs_code).replace(/\D+/g, "") === normalizedHs);
    if (byHs) return byHs;
  }

  const fuzzy = readyRows.find((row) => normalizedName.includes(normalizeText(row.product_name).toUpperCase()));
  return fuzzy ?? null;
}

export async function loadProductRequests(options: LoadProductRequestsOptions = {}) {
  if (!isSupabaseConfigured || !supabase) {
    return { rows: loadLocalRequests(), source: "local" as const };
  }

  const normalizedCustomerId = normalizeText(options.customerId);
  const normalizedCustomerEmail = normalizeText(options.customerEmail).toLowerCase();
  const queryLimit = Math.max(1, Math.min(Number(options.limit ?? 1000) || 1000, 5000));

  let query = supabase
    .from("your_product_requests")
    .select("*")
    .order("submitted_at", { ascending: false })
    .limit(queryLimit);

  if (normalizedCustomerId) {
    query = query.eq("customer_id", normalizedCustomerId);
  } else if (normalizedCustomerEmail) {
    query = query.ilike("customer_email", normalizedCustomerEmail);
  }

  const { data, error } = await query;

  if (error) {
    if (isSchemaError(error.message)) {
      return { rows: loadLocalRequests(), source: "local" as const };
    }
    throw error;
  }

  return {
    rows: ((data ?? []) as Record<string, unknown>[])
      .map(normalizeRequestRow)
      .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at)),
    source: "supabase" as const,
  };
}

export async function createProductRequest(
  input: ProductRequestCreateInput,
  readyRows: ReadyPageProduct[] = [],
): Promise<ProductRequestRecord> {
  let customerId = toNullable(normalizeText(input.customer_id));
  if (!customerId && isSupabaseConfigured && supabase) {
    const scope = await resolveCustomerScope({
      email: input.customer_email,
      username: input.customer_username,
    });
    customerId = scope.customerId;
  }
  if (!customerId && isSupabaseConfigured && supabase) {
    throw new Error(CUSTOMER_SCOPE_NOT_MAPPED_MESSAGE);
  }

  const matchedReadyProduct = findReadyProductMatch(input.product_name, input.hs_code, readyRows);
  const now = nowIso();
  const record: ProductRequestRecord = {
    id: crypto.randomUUID(),
    customer_id: customerId,
    customer_email: normalizeText(input.customer_email),
    customer_username: normalizeText(input.customer_username),
    customer_workspace: normalizeText(input.customer_workspace),
    product_name: normalizeText(input.product_name),
    hs_code: toNullable(input.hs_code),
    product_details: toNullable(input.product_details),
    target_market: toNullable(input.target_market),
    image_url: toNullable(input.image_url),
    image_file_name: toNullable(input.image_file_name),
    status: "PENDING_REVIEW",
    submitted_at: now,
    updated_at: now,
    updated_by: "Customer",
    customer_message: "We received your product details. ORIGO is reviewing it to generate buyer opportunities.",
    admin_note: null,
    missing_info_checklist: { ...DEFAULT_CHECKLIST },
    confidence: buildConfidence({
      hsCode: input.hs_code,
      productDetails: input.product_details,
      targetMarket: input.target_market,
      matchedReadyProduct,
    }),
    ready_summary: matchedReadyProduct?.ready_copy ?? null,
  };

  if (isSupabaseConfigured && supabase) {
    let response = await supabase
      .from("your_product_requests")
      .insert(toSupabaseRequestPayload(record))
      .select("*")
      .single();

    if (response.error && isMissingProductDetailsColumnError(response.error.message)) {
      response = await supabase
        .from("your_product_requests")
        .insert(toSupabaseRequestPayload(record, { legacyDetails: true }))
        .select("*")
        .single();
    }

    const { data, error } = response;

    if (!error && data) {
      return normalizeRequestRow(data as Record<string, unknown>);
    }

    if (error && !isSchemaError(error.message)) {
      throw error;
    }
  }

  const localRows = loadLocalRequests();
  const nextRows = [record, ...localRows];
  saveLocalRequests(nextRows);
  return record;
}

export async function updateProductRequest(
  id: string,
  updates: ProductRequestUpdateInput,
  readyRows: ReadyPageProduct[] = [],
): Promise<ProductRequestRecord | null> {
  const mergeWithExisting = (existing: ProductRequestRecord) => {
    const mergedChecklist: MissingInfoChecklist = {
      ...existing.missing_info_checklist,
      ...(updates.missing_info_checklist ?? {}),
    };

    const matchedReadyProduct =
      findReadyProductMatch(updates.product_name ?? existing.product_name, updates.hs_code ?? existing.hs_code, readyRows) ??
      null;

    return {
      ...existing,
      ...updates,
      id: existing.id,
      product_name: normalizeText(updates.product_name ?? existing.product_name),
      hs_code: updates.hs_code !== undefined ? toNullable(updates.hs_code) : existing.hs_code,
      product_details:
        updates.product_details !== undefined ? toNullable(updates.product_details) : existing.product_details,
      target_market: updates.target_market !== undefined ? toNullable(updates.target_market) : existing.target_market,
      image_url: updates.image_url !== undefined ? toNullable(updates.image_url) : existing.image_url,
      image_file_name:
        updates.image_file_name !== undefined ? toNullable(updates.image_file_name) : existing.image_file_name,
      customer_workspace:
        updates.customer_workspace !== undefined
          ? normalizeText(updates.customer_workspace)
          : existing.customer_workspace,
      missing_info_checklist: mergedChecklist,
      updated_at: nowIso(),
      confidence: buildConfidence({
        hsCode: updates.hs_code ?? existing.hs_code,
        productDetails: updates.product_details ?? existing.product_details,
        targetMarket: updates.target_market ?? existing.target_market,
        matchedReadyProduct,
      }),
      ready_summary: updates.ready_summary !== undefined
        ? updates.ready_summary
        : (matchedReadyProduct?.ready_copy ?? existing.ready_summary),
    };
  };

  if (isSupabaseConfigured && supabase) {
    const existingResponse = await supabase.from("your_product_requests").select("*").eq("id", id).maybeSingle();
    if (!existingResponse.error && existingResponse.data) {
      const existing = normalizeRequestRow(existingResponse.data as Record<string, unknown>);
      const next = mergeWithExisting(existing);
      let response = await supabase
        .from("your_product_requests")
        .update(toSupabaseRequestPayload(next, { includeId: false }))
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (response.error && isMissingProductDetailsColumnError(response.error.message)) {
        response = await supabase
          .from("your_product_requests")
          .update(toSupabaseRequestPayload(next, { legacyDetails: true, includeId: false }))
          .eq("id", id)
          .select("*")
          .maybeSingle();
      }

      const { data, error } = response;

      if (!error && data) {
        return normalizeRequestRow(data as Record<string, unknown>);
      }

      if (error && !isSchemaError(error.message)) {
        throw error;
      }
    } else if (existingResponse.error && !isSchemaError(existingResponse.error.message)) {
      throw existingResponse.error;
    }
  }

  const localRows = loadLocalRequests();
  const index = localRows.findIndex((row) => row.id === id);
  if (index < 0) return null;
  const next = mergeWithExisting(localRows[index]);
  const nextRows = [...localRows];
  nextRows[index] = next;
  saveLocalRequests(nextRows);
  return next;
}

export async function updateReadyPageProduct(
  id: string,
  updates: ReadyPageProductUpdateInput,
): Promise<ReadyPageProduct | null> {
  const applyMerge = (row: ReadyPageProduct): ReadyPageProduct => ({
    ...row,
    hs_code: updates.hs_code !== undefined ? toNullable(updates.hs_code) : row.hs_code,
    buyers_2026_count:
      updates.buyers_2026_count !== undefined
        ? Math.max(0, Math.floor(Number(updates.buyers_2026_count) || 0))
        : row.buyers_2026_count,
    ready_copy: updates.ready_copy !== undefined ? toNullable(updates.ready_copy) : row.ready_copy,
    top_countries_2023:
      updates.top_countries_2023 !== undefined ? updates.top_countries_2023.slice(0, 5) : row.top_countries_2023,
    buyer_snapshot_preview:
      updates.buyer_snapshot_preview !== undefined
        ? updates.buyer_snapshot_preview.slice(0, 5)
        : row.buyer_snapshot_preview,
    updated_at: nowIso(),
  });

  if (isSupabaseConfigured && supabase) {
    const existingResponse = await supabase.from("ready_page_products").select("*").eq("id", id).maybeSingle();
    if (!existingResponse.error && existingResponse.data) {
      const existing = (existingResponse.data ?? {}) as Record<string, unknown>;
      const current: ReadyPageProduct = {
        id: normalizeText(existing.id) || id,
        product_name: normalizeText(existing.product_name),
        hs_code: toNullable(normalizeText(existing.hs_code)),
        buyers_2023_count: Number(existing.buyers_2023_count ?? 0),
        countries_2023_count: Number(existing.countries_2023_count ?? 0),
        buyers_2026_count: Number(existing.buyers_2026_count ?? 0),
        top_countries_2023: parseJsonArray<ReadyTopCountry>(existing.top_countries_2023),
        buyer_snapshot_preview: parseJsonArray<ReadyBuyerPreview>(existing.buyer_snapshot_preview).slice(0, 5),
        ready_copy: toNullable(normalizeText(existing.ready_copy)),
        created_at: normalizeText(existing.created_at) || nowIso(),
        updated_at: normalizeText(existing.updated_at) || nowIso(),
      };

      const next = applyMerge(current);
      const payload: Record<string, unknown> = {
        hs_code: next.hs_code,
        buyers_2026_count: next.buyers_2026_count,
        ready_copy: next.ready_copy,
        updated_at: next.updated_at,
      };

      if (updates.top_countries_2023 !== undefined) {
        payload.top_countries_2023 = next.top_countries_2023;
      }
      if (updates.buyer_snapshot_preview !== undefined) {
        payload.buyer_snapshot_preview = next.buyer_snapshot_preview;
      }

      const { data, error } = await supabase
        .from("ready_page_products")
        .update(payload)
        .eq("id", id)
        .select("*")
        .maybeSingle();

      if (!error && data) {
        return {
          id: normalizeText(data.id) || id,
          product_name: normalizeText(data.product_name),
          hs_code: toNullable(normalizeText(data.hs_code)),
          buyers_2023_count: Number(data.buyers_2023_count ?? next.buyers_2023_count),
          countries_2023_count: Number(data.countries_2023_count ?? next.countries_2023_count),
          buyers_2026_count: Number(data.buyers_2026_count ?? next.buyers_2026_count),
          top_countries_2023: parseJsonArray<ReadyTopCountry>(data.top_countries_2023),
          buyer_snapshot_preview: parseJsonArray<ReadyBuyerPreview>(data.buyer_snapshot_preview).slice(0, 5),
          ready_copy: toNullable(normalizeText(data.ready_copy)),
          created_at: normalizeText(data.created_at) || next.created_at,
          updated_at: normalizeText(data.updated_at) || next.updated_at,
        };
      }

      if (error && !isSchemaError(error.message)) {
        throw error;
      }
    } else if (existingResponse.error && !isSchemaError(existingResponse.error.message)) {
      throw existingResponse.error;
    }
  }

  const localRows = loadLocalReadyProducts();
  const index = localRows.findIndex((row) => row.id === id);
  if (index < 0) {
    return null;
  }

  const merged = applyMerge(localRows[index]);
  const nextRows = [...localRows];
  nextRows[index] = merged;
  saveLocalReadyProducts(nextRows);
  return merged;
}

export function clearLocalProductRequests() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(REQUEST_STORAGE_KEY);
}

