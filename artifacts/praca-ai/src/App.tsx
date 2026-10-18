import * as React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';
import { PageLoader } from '@/components/ui/skeleton';
import { Route, Switch, Router as WouterRouter, useLocation } from 'wouter';
import { PhoneFrame } from '@/components/layout/PhoneFrame';
import { AuthProvider } from '@/contexts/AuthContext';

const HomePage = React.lazy(() => import('@/pages/Home'));
const ListingPage = React.lazy(() => import('@/pages/Listing'));
const ProductDetail = React.lazy(() => import('@/pages/ProductDetail'));
const Checkout = React.lazy(() => import('@/pages/Checkout'));
const Success = React.lazy(() => import('@/pages/Success'));
const Feed = React.lazy(() => import('@/pages/Feed'));
const Profile = React.lazy(() => import('@/pages/Profile'));
const Login = React.lazy(() => import('@/pages/Login'));
const MyOrders = React.lazy(() => import('@/pages/MyOrders'));
const MyFavorites = React.lazy(() => import('@/pages/MyFavorites'));
const Account = React.lazy(() => import('@/pages/Account'));
const AdminPanel = React.lazy(() => import('@/pages/AdminPanel'));
const VeiculosListing = React.lazy(() => import('@/pages/VeiculosListing'));
const VeiculoDetail = React.lazy(() => import('@/pages/VeiculoDetail'));
const ImoveisListing = React.lazy(() => import('@/pages/ImoveisListing'));
const ImovelDetail = React.lazy(() => import('@/pages/ImovelDetail'));
const FarmaciaListing = React.lazy(() => import('@/pages/FarmaciaListing'));
const FarmaciaProdutoDetail = React.lazy(() => import('@/pages/FarmaciaProdutoDetail'));
const ServicosPage = React.lazy(() => import('@/pages/ServicosPage'));
const FretesPage = React.lazy(() => import('@/pages/FretesPage'));
const RestaurantesListing = React.lazy(() => import('@/pages/RestaurantesListing'));
const RestauranteCardapio = React.lazy(() => import('@/pages/RestauranteCardapio'));
const Marketplace = React.lazy(() => import('@/pages/Marketplace'));
const DriverLogistics = React.lazy(() => import('@/pages/DriverLogistics'));
const ResetPassword = React.lazy(() => import('@/pages/ResetPassword'));
const EnergiaSolar = React.lazy(() => import('@/pages/EnergiaSolar'));
const QuoteRequest = React.lazy(() => import('@/pages/QuoteRequest'));
const RoundsPage = React.lazy(() => import('@/pages/Rounds'));
const QuoteTracking = React.lazy(() => import('@/pages/QuoteTracking'));
const QuoteHistory = React.lazy(() => import('@/pages/QuoteHistory'));

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
        <React.Suspense fallback={<PageLoader />}><Switch><Route path="/admin" component={AdminPanel} /></Switch></React.Suspense>
      ) : (
        <PhoneFrame><React.Suspense fallback={<PageLoader />}><Router /></React.Suspense></PhoneFrame>
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
