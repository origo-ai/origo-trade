import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, lazy, type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminDataProvider } from "@/contexts/AdminDataContext";
import { AuthProvider, useAuth, type AccountType } from "@/contexts/AuthContext";

const AppLayout = lazy(() => import("@/components/layout/AppLayout").then((module) => ({ default: module.AppLayout })));
const NotFound = lazy(() => import("@/app/pages/NotFound"));
const AdminBackoffice = lazy(() => import("@/features/admin/pages/AdminBackoffice"));
const AdminCustomers = lazy(() => import("@/features/admin/pages/AdminCustomers"));
const AdminDashboard = lazy(() => import("@/features/admin/pages/AdminDashboard"));
const AdminDataManagement = lazy(() => import("@/features/admin/pages/AdminDataManagement"));
const AdminProductSuggestion = lazy(() => import("@/features/admin/pages/AdminProductSuggestion"));
const AdminUsers = lazy(() => import("@/features/admin/pages/AdminUsers"));
const AIAgent = lazy(() => import("@/features/ai-agent/pages/AIAgent"));
const ForgotPassword = lazy(() => import("@/features/auth/pages/ForgotPassword"));
const Login = lazy(() => import("@/features/auth/pages/Login"));
const ResetPassword = lazy(() => import("@/features/auth/pages/ResetPassword"));
const Inventory = lazy(() => import("@/features/inventory/pages/Inventory"));
const InvoicesPayments = lazy(() => import("@/features/invoices-payments/pages/InvoicesPayments"));
const MarketIntelligence = lazy(() => import("@/features/market-intelligence/pages/MarketIntelligence"));
const MarketIntelligenceCompanyProfile = lazy(() => import("@/features/market-intelligence/pages/MarketIntelligenceCompanyProfile"));
const MyCompany = lazy(() => import("@/features/my-company/pages/MyCompany"));
const OrdersShipments = lazy(() => import("@/features/orders-shipments/pages/OrdersShipments"));
const AdminControlEditData = lazy(() => import("@/features/uploads/pages/AdminControlEditData"));
const UploadCenter = lazy(() => import("@/features/uploads/pages/UploadCenter"));
const YourProduct = lazy(() => import("@/features/your-product/pages/YourProduct"));

const queryClient = new QueryClient();

function RouteFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 text-sm text-muted-foreground">
      Loading...
    </div>
  );
}

function HomeRedirect() {
  const { loading, isAuthenticated, accountType } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (accountType === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return <Navigate to="/market-intelligence" replace />;
}

function PublicOnly({ children }: { children: ReactElement }) {
  const { loading, isAuthenticated, accountType } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return children;
  }

  return accountType === "admin"
    ? <Navigate to="/admin" replace />
    : <Navigate to="/market-intelligence" replace />;
}

function ProtectedLayout({ allowedAccountType }: { allowedAccountType: AccountType }) {
  const { loading, isAuthenticated, accountType } = useAuth();

  if (loading) {
    return null;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (accountType !== allowedAccountType) {
    return <Navigate to={accountType === "admin" ? "/admin" : "/market-intelligence"} replace />;
  }

  return <AppLayout />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <AdminDataProvider>
        <TooltipProvider delayDuration={0} skipDelayDuration={0}>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Suspense fallback={<RouteFallback />}>
              <Routes>
                <Route path="/" element={<HomeRedirect />} />
                <Route
                  path="/login"
                  element={(
                    <PublicOnly>
                      <Login />
                    </PublicOnly>
                  )}
                />
                <Route
                  path="/forgot-password"
                  element={<ForgotPassword />}
                />
                <Route path="/backoffice/login" element={<Navigate to="/login" replace />} />
                <Route
                  path="/reset-password"
                  element={<ResetPassword />}
                />

                <Route element={<ProtectedLayout allowedAccountType="customer" />}>
                  <Route path="/market-intelligence" element={<MarketIntelligence />} />
                  <Route path="/market-intelligence/company/:companyId" element={<MarketIntelligenceCompanyProfile />} />
                  <Route path="/ai-agent" element={<AIAgent />} />
                  <Route path="/my-company" element={<Navigate to="/my-company/performance" replace />} />
                  <Route path="/my-company/orders" element={<OrdersShipments />} />
                  <Route path="/my-company/invoices" element={<InvoicesPayments />} />
                  <Route path="/my-company/inventory" element={<Inventory />} />
                  <Route path="/my-company/ai-agent" element={<Navigate to="/ai-agent" replace />} />
                  <Route path="/my-company/performance" element={<MyCompany />} />
                  <Route path="/upload" element={<UploadCenter />} />
                  <Route path="/upload/edit-data" element={<AdminControlEditData />} />
                  <Route path="/upload/your-product" element={<YourProduct />} />
                </Route>

                <Route element={<ProtectedLayout allowedAccountType="admin" />}>
                  <Route path="/admin" element={<AdminBackoffice />} />
                  <Route path="/admin/dashboard" element={<AdminDashboard />} />
                  <Route path="/admin/backoffice" element={<AdminBackoffice />} />
                  <Route path="/admin/customers" element={<AdminCustomers />} />
                  <Route path="/admin/users" element={<AdminUsers />} />
                  <Route path="/admin/data" element={<AdminDataManagement />} />
                  <Route path="/admin/products" element={<AdminProductSuggestion />} />
                </Route>

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </BrowserRouter>
        </TooltipProvider>
      </AdminDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
