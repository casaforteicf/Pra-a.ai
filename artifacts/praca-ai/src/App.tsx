import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { PhoneFrame } from '@/components/layout/PhoneFrame';
import { AuthProvider } from '@/contexts/AuthContext';

// Import pages
import HomePage from '@/pages/Home';
import ListingPage from '@/pages/Listing';
import ProductDetail from '@/pages/ProductDetail';
import Checkout from '@/pages/Checkout';
import Success from '@/pages/Success';
import Feed from '@/pages/Feed';
import Profile from '@/pages/Profile';
import Login from '@/pages/Login';
import MyOrders from '@/pages/MyOrders';
import MyFavorites from '@/pages/MyFavorites';
import AdminPanel from '@/pages/AdminPanel';
import VeiculosListing from '@/pages/VeiculosListing';
import VeiculoDetail from '@/pages/VeiculoDetail';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/listing" component={ListingPage} />
      <Route path="/product/:id" component={ProductDetail} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/success/:id" component={Success} />
      <Route path="/success" component={Success} />
      <Route path="/feed" component={Feed} />
      <Route path="/profile" component={Profile} />
      <Route path="/login" component={Login} />
      <Route path="/orders" component={MyOrders} />
      <Route path="/favorites" component={MyFavorites} />
      <Route path="/veiculos" component={VeiculosListing} />
      <Route path="/veiculos/:id" component={VeiculoDetail} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  // Painel de admin é tela cheia (uso desktop pelo Marcos), não faz sentido
  // dentro da moldura de celular usada no resto do app (experiência de
  // consumidor final).
  const isAdmin = location.startsWith('/admin');

  if (isAdmin) {
    return (
      <Switch>
        <Route path="/admin" component={AdminPanel} />
      </Switch>
    );
  }

  return (
    <PhoneFrame>
      <Router />
    </PhoneFrame>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
            <AppShell />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
