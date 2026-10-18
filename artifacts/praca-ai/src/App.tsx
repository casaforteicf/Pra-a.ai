import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { PhoneFrame } from '@/components/layout/PhoneFrame';
import { AuthProvider } from '@/contexts/AuthContext';

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
import EnergiaSolar from '@/pages/EnergiaSolar';
import QuoteRequest from '@/pages/QuoteRequest';
import RoundsPage from '@/pages/Rounds';
import QuoteTracking from '@/pages/QuoteTracking';
import QuoteHistory from '@/pages/QuoteHistory';

const queryClient = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false, retry: false } },
});

const NOINDEX_PREFIXES = ['/checkout', '/success', '/profile', '/login', '/reset-password', '/orders', '/favorites', '/account', '/admin', '/entregador'];

function SeoManager() {
  const [location] = useLocation();

  React.useEffect(() => {
    const noindex = NOINDEX_PREFIXES.some((prefix) => location === prefix || location.startsWith(`${prefix}/`));
    const robots = document.querySelector('meta[name="robots"]') || document.head.appendChild(document.createElement('meta'));
    robots.setAttribute('name', 'robots');
    robots.setAttribute('content', noindex ? 'noindex, nofollow' : 'index, follow');

    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }

    const params = new URLSearchParams(window.location.search);
    const category = params.get('category');
    const canonicalPath = location === '/listing' && category
      ? `/listing?category=${encodeURIComponent(category)}`
      : location || '/';
    canonical.href = `https://www.pracaai.com.br${canonicalPath}`;

    let ogUrl = document.querySelector('meta[property="og:url"]');
    if (!ogUrl) {
      ogUrl = document.createElement('meta');
      ogUrl.setAttribute('property', 'og:url');
      document.head.appendChild(ogUrl);
    }
    ogUrl.setAttribute('content', canonical.href);
  }, [location]);

  return null;
}

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
      <Route path="/energia-solar" component={EnergiaSolar} />
      <Route path="/cotacao" component={QuoteRequest} />
      <Route path="/cotacao/:id" component={QuoteTracking} />
      <Route path="/minhas-cotacoes" component={QuoteHistory} />
      <Route path="/rodadas" component={RoundsPage} />
      <Route path="/entregador" component={DriverLogistics} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  const [location] = useLocation();
  const isAdmin = location.startsWith('/admin');

  return (
    <>
      <SeoManager />
      {isAdmin ? (
        <Switch><Route path="/admin" component={AdminPanel} /></Switch>
      ) : (
        <PhoneFrame><Router /></PhoneFrame>
      )}
    </>
  );
}

function App() {
  React.useEffect(() => {
    const ref = new URLSearchParams(window.location.search).get('ref')?.toUpperCase();
    if (!ref) return;
    localStorage.setItem('praca-influencer-coupon', ref);
    fetch(`/api/influenciadores/${encodeURIComponent(ref)}/clique`, { method: 'POST' }).catch(() => undefined);
  }, []);

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
