const API_BASE = import.meta.env.VITE_ADMIN_API_URL || (import.meta.env.DEV ? "http://localhost:4000" : "");
const API_ROOT = `${API_BASE}/api/admin/customer-portal`;

type MyCompanyContractRow = {
  id: string;
  customer: string;
  contractId: string;
  commitDate: string | null;
  status: string;
  ton: number;
  acc: number;
  product: string;
  job: string;
  team: string;
  contractType: string;
  dateTo: string | null;
  remainingTon: number;
};

type MyCompanyStockRow = {
  id: string;
  factory: string;
  qty: number;
  tag: string;
  type: string;
};

type MyCompanyInvoiceRow = {
  id: string;
  invoiceDate: string | null;
  statusType: string;
  usd: number;
  tons: number;
  customerName: string;
  factory: string;
};

type MyCompanyDeliveryRow = {
  id: string;
  deliveryDate: string | null;
  quantity: number;
  contractId: string | null;
  job: string | null;
};

type MyCompanyYourProductRow = {
  id: string;
  customer_email: string | null;
  product_name: string | null;
  status: string | null;
  updated_at: string | null;
};

export type MyCompanySnapshot = {
  source: string;
  matchedProfileEmail: string | null;
  contractRows: MyCompanyContractRow[];
  stockRows: MyCompanyStockRow[];
  invoiceRows: MyCompanyInvoiceRow[];
  deliveryRows: MyCompanyDeliveryRow[];
  yourProductRows: MyCompanyYourProductRow[];
};

type OrdersShipmentsDeliveryRow = {
  id: string;
  delivery_id: string;
  contract_id: string;
  job: string | null;
  delivery_date: string | null;
  record: string | null;
  quantity: number;
  remark: string | null;
};

type OrdersShipmentsContractRow = {
  id: string;
  customer: string;
  contractType: string;
  contractId: string;
  commitDate: string | null;
  job: string;
  jobValue: string | null;
  product: string;
  team: string;
  status: string;
  price: number | null;
  paymentTerms: string | null;
  ton: number;
  acc: number;
  remainingTon: number;
  dateFrom: string | null;
  dateTo: string | null;
};

export type CustomerPortalContext = {
  source: string;
  matchedProfileEmail: string | null;
  customerId: string | null;
  companyName: string;
  role: string;
  isActive: boolean;
};

export type OrdersShipmentsSnapshot = {
  source: string;
  matchedProfileEmail: string | null;
  customerId: string | null;
  contractRows: OrdersShipmentsContractRow[];
  deliveryRows: OrdersShipmentsDeliveryRow[];
};

type InventoryRow = {
  id: string;
  stockId: string;
  factory: string;
  qty: number;
  tag: string;
  type: string;
};

type InvoiceRow = {
  id: string;
  invoice: string;
  tons: number;
  totalInvoice: number;
  usd: number;
  contact: boolean;
  credit: boolean;
  exportFlag: boolean;
  team: string;
  thb: number;
  bookingNo: string;
  contract: string;
  convertDate: string | null;
  convertRate: number;
  customerName: string;
  factory: string;
  invoiceDate: string | null;
  price: number;
  statusType: string;
  statusDetail: string;
};

export type InventorySnapshot = {
  source: string;
  matchedProfileEmail: string | null;
  customerId: string | null;
  rows: InventoryRow[];
};

export type InvoicesSnapshot = {
  source: string;
  matchedProfileEmail: string | null;
  customerId: string | null;
  rows: InvoiceRow[];
};

export type MarketIntelligenceSnapshot = {
  source: string;
  matchedProfileEmail: string | null;
  customerId: string | null;
  marketSource: string | null;
  companySource: string | null;
  marketRows: Array<Record<string, unknown>>;
  companyRows: Array<Record<string, unknown>>;
};

type YourProductBridgeRow = {
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
  status: string;
  submitted_at: string | null;
  updated_at: string | null;
  updated_by: string | null;
  customer_message: string | null;
  admin_note: string | null;
  missing_info_checklist: Record<string, boolean>;
  confidence: string;
  ready_summary: string | null;
};

export type YourProductSnapshot = {
  source: string;
  matchedProfileEmail: string | null;
  customerId: string | null;
  rows: YourProductBridgeRow[];
};

type CustomerPortalIdentity = {
  email?: string;
  username?: string;
};

const buildIdentityParams = (input: CustomerPortalIdentity) => {
  const params = new URLSearchParams();
  if (input.email?.trim()) params.set("email", input.email.trim());
  if (input.username?.trim()) params.set("username", input.username.trim());
  return params;
};

async function fetchCustomerPortal<T>(path: string, input: CustomerPortalIdentity) {
  const params = buildIdentityParams(input);
  let response: Response;
  try {
    response = await fetch(`${API_ROOT}${path}${params.toString() ? `?${params}` : ""}`);
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error("Customer data API is unavailable. Start backend API with `npm run dev:full`.");
    }
    throw error;
  }
  if (!response.ok) {
    const contentType = response.headers.get("content-type") || "";
    if (!contentType.toLowerCase().includes("application/json")) {
      if (response.status >= 500 || response.status === 404) {
        throw new Error("Customer data API is unavailable. Start backend API with `npm run dev:full`.");
      }
      throw new Error(`Customer data API request failed (${response.status}).`);
    }
    const errorBody = await response.json().catch(() => ({ message: "Request failed" }));
    throw new Error(errorBody.message || "Request failed");
  }

  const result = await response.json() as { data: T };
  return result.data;
}

export async function getMyCompanySnapshot(input: CustomerPortalIdentity) {
  return fetchCustomerPortal<MyCompanySnapshot>("/my-company", input);
}

export async function getCustomerPortalContext(input: CustomerPortalIdentity) {
  return fetchCustomerPortal<CustomerPortalContext>("/context", input);
}

export async function getOrdersShipmentsSnapshot(input: CustomerPortalIdentity) {
  return fetchCustomerPortal<OrdersShipmentsSnapshot>("/orders-shipments", input);
}

export async function getInventorySnapshot(input: CustomerPortalIdentity) {
  return fetchCustomerPortal<InventorySnapshot>("/inventory", input);
}

export async function getInvoicesSnapshot(input: CustomerPortalIdentity) {
  return fetchCustomerPortal<InvoicesSnapshot>("/invoices", input);
}

export async function getMarketIntelligenceSnapshot(input: CustomerPortalIdentity) {
  return fetchCustomerPortal<MarketIntelligenceSnapshot>("/market-intelligence", input);
}

export async function getYourProductSnapshot(input: CustomerPortalIdentity) {
  return fetchCustomerPortal<YourProductSnapshot>("/your-product", input);
}
