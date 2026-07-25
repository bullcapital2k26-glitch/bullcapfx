import { Switch, Route, Redirect } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/components/ThemeProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { useAuth } from "@/hooks/use-auth";
import { Loader2 } from "lucide-react";

import Landing from "@/pages/Landing";
import Login from "@/pages/Login";
import Signup from "@/pages/Signup";
import ForgotPassword from "@/pages/ForgotPassword";
import ResetPassword from "@/pages/ResetPassword";
import Home from "@/pages/Home";
import Markets from "@/pages/Markets";
import Trade from "@/pages/Trade";
import Terminal from "@/pages/Terminal";
import Positions from "@/pages/Positions";
import Wallet from "@/pages/Wallet";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import OnboardingModal from "@/components/OnboardingModal";

import ProfileNotifications from "@/pages/ProfileNotifications";
import ProfileSecurity from "@/pages/ProfileSecurity";
import ProfilePreferences from "@/pages/ProfilePreferences";
import OnlineService from "@/pages/OnlineService";
import ProfileKyc from "@/pages/ProfileKyc";

import AdminDashboard from "@/pages/admin/Dashboard";
import AdminUsers from "@/pages/admin/Users";
import AdminTransactions from "@/pages/admin/Transactions";
import AdminOrders from "@/pages/admin/Orders";
import AdminChat from "@/pages/admin/Chat";
import AdminIBManagement from "@/pages/admin/IBManagement";
import AdminKYC from "@/pages/admin/KYC";
import AdminTradeControl from "@/pages/admin/TradeControl";

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function AdminRoute({ component: Component }: { component: React.ComponentType }) {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
      </div>
    );
  }

  if (!user) return <Redirect to="/login" />;
  if (!user.isAdmin) return <Redirect to="/" />;

  return <Component />;
}

function Router() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Loader2 className="w-10 h-10 animate-spin text-amber-400" />
      </div>
    );
  }

  const showOnboarding = user && !user.onboarded;

  return (
    <>
      {showOnboarding && <OnboardingModal />}
      <Switch>
        <Route path="/" component={user ? Home : Landing} />
        <Route path="/login" component={user ? () => <Redirect to="/" /> : Login} />
        <Route path="/signup" component={user ? () => <Redirect to="/" /> : Signup} />
        <Route path="/forgot-password" component={user ? () => <Redirect to="/" /> : ForgotPassword} />
        <Route path="/reset-password" component={user ? () => <Redirect to="/" /> : ResetPassword} />
        <Route path="/markets">
          <ProtectedRoute component={Markets} />
        </Route>
        <Route path="/trade/:id">
          <ProtectedRoute component={Trade} />
        </Route>
        <Route path="/terminal">
          <ProtectedRoute component={Terminal} />
        </Route>
        <Route path="/positions">
          <ProtectedRoute component={Positions} />
        </Route>
        <Route path="/wallet">
          <ProtectedRoute component={Wallet} />
        </Route>
        <Route path="/profile">
          <ProtectedRoute component={Profile} />
        </Route>
        <Route path="/profile/notifications">
          <ProtectedRoute component={ProfileNotifications} />
        </Route>
        <Route path="/profile/security">
          <ProtectedRoute component={ProfileSecurity} />
        </Route>
        <Route path="/profile/preferences">
          <ProtectedRoute component={ProfilePreferences} />
        </Route>
        <Route path="/profile/online-service">
          <ProtectedRoute component={OnlineService} />
        </Route>
        <Route path="/profile/kyc">
          <ProtectedRoute component={ProfileKyc} />
        </Route>
        <Route path="/admin">
          <AdminRoute component={AdminDashboard} />
        </Route>
        <Route path="/admin/users">
          <AdminRoute component={AdminUsers} />
        </Route>
        <Route path="/admin/transactions">
          <AdminRoute component={AdminTransactions} />
        </Route>
        <Route path="/admin/orders">
          <AdminRoute component={AdminOrders} />
        </Route>
        <Route path="/admin/chat">
          <AdminRoute component={AdminChat} />
        </Route>
        <Route path="/admin/ib">
          <AdminRoute component={AdminIBManagement} />
        </Route>
        <Route path="/admin/kyc">
          <AdminRoute component={AdminKYC} />
        </Route>
        <Route path="/admin/trade-control">
          <AdminRoute component={AdminTradeControl} />
        </Route>
        <Route component={NotFound} />
      </Switch>
    </>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <CurrencyProvider>
            <Toaster />
            <Router />
          </CurrencyProvider>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
