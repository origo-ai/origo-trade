import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { type ReactElement } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdminDataProvider } from "@/contexts/AdminDataContext";
import { AuthProvider, useAuth, type AccountType } from "@/contexts/AuthContext";
import NotFound from "@/app/pages/NotFound";
import AdminBackoffice from "@/features/admin/pages/AdminBackoffice";
import AdminCustomers from "@/features/admin/pages/AdminCustomers";
import AdminDashboard from "@/features/admin/pages/AdminDashboard";
import AdminDataManagement from "@/features/admin/pages/AdminDataManagement";
import AdminProductSuggestion from "@/features/admin/pages/AdminProductSuggestion";
import AdminUsers from "@/features/admin/pages/AdminUsers";
import AIAgent from "@/features/ai-agent/pages/AIAgent";
import ForgotPassword from "@/features/auth/pages/ForgotPassword";
import Login from "@/features/auth/pages/Login";
import ResetPassword from "@/features/auth/pages/ResetPassword";
import Inventory from "@/features/inventory/pages/Inventory";
import InvoicesPayments from "@/features/invoices-payments/pages/InvoicesPayments";
import MarketIntelligence from "@/features/market-intelligence/pages/MarketIntelligence";
import MarketIntelligenceCompanyProfile from "@/features/market-intelligence/pages/MarketIntelligenceCompanyProfile";
import MyCompany from "@/features/my-company/pages/MyCompany";
import OrdersShipments from "@/features/orders-shipments/pages/OrdersShipments";
import AdminControlEditData from "@/features/uploads/pages/AdminControlEditData";
import UploadCenter from "@/features/uploads/pages/UploadCenter";
import YourProduct from "@/features/your-product/pages/YourProduct";

const queryClient = new QueryClient();

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
          </BrowserRouter>
        </TooltipProvider>
      </AdminDataProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
