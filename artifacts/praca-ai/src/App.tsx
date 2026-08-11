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
import Account from '@/pages/Account';
import AdminPanel from '@/pages/AdminPanel';
import VeiculosListing from '@/pages/VeiculosListing';
import VeiculoDetail from '@/pages/VeiculoDetail';
import ImoveisListing from '@/pages/ImoveisListing';
import ImovelDetail from '@/pages/ImovelDetail';
import FarmaciaListing from '@/pages/FarmaciaListing';
import FarmaciaProdutoDetail from '@/pages/FarmaciaProdutoDetail';
import ServicosPage from '@/pages/ServicosPage';
import FretesPage from '@/pages/FretesPage';
import RestaurantesListing from '@/pages/RestaurantesListing';
import RestauranteCardapio from '@/pages/RestauranteCardapio';
import Marketplace from '@/pages/Marketplace';
import DriverLogistics from '@/pages/DriverLogistics';
import ResetPassword from '@/pages/ResetPassword';

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
      <Route path="/reset-password" component={ResetPassword} />
      <Route path="/orders" component={MyOrders} />
      <Route path="/favorites" component={MyFavorites} />
      <Route path="/account/:section" component={Account} />
      <Route path="/veiculos" component={VeiculosListing} />
      <Route path="/veiculos/:id" component={VeiculoDetail} />
      <Route path="/imoveis" component={ImoveisListing} />
      <Route path="/imoveis/:id" component={ImovelDetail} />
      <Route path="/farmacia" component={FarmaciaListing} />
      <Route path="/farmacia/:id" component={FarmaciaProdutoDetail} />
      <Route path="/servicos" component={ServicosPage} />
      <Route path="/fretes" component={FretesPage} />
      <Route path="/restaurantes" component={RestaurantesListing} />
      <Route path="/restaurantes/:vendorId" component={RestauranteCardapio} />
      <Route path="/marketplace" component={Marketplace} />
      <Route path="/entregador" component={DriverLogistics} />
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
  React.useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')?.toUpperCase()
    if (!ref) return
    localStorage.setItem('praca-influencer-coupon', ref)
    fetch(`/api/influenciadores/${encodeURIComponent(ref)}/clique`, { method: 'POST' }).catch(() => undefined)
  }, [])
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
import * as React from 'react';
