import { useEffect, useRef, type ReactNode } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { Redirect, Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import Landing from '@/pages/landing';
import LegalPage from '@/pages/legal';
import { AlertsPage, BrandsPage, CasesPage, DashboardPage } from '@/pages/workspace-pages';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#25384a',
    colorForeground: '#263342',
    colorMutedForeground: '#65717b',
    colorDanger: '#b8463f',
    colorBackground: '#fbfaf6',
    colorInput: '#fffefa',
    colorInputForeground: '#263342',
    colorNeutral: '#d9d4c8',
    fontFamily: "Inter, ui-sans-serif, system-ui, sans-serif",
    borderRadius: '0.55rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbfaf6] rounded-xl w-[440px] max-w-full overflow-hidden border border-[#ded9ce]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#263342] font-semibold',
    headerSubtitle: 'text-[#65717b]',
    socialButtonsBlockButtonText: 'text-[#263342] font-medium',
    formFieldLabel: 'text-[#34414e] font-medium',
    footerActionLink: 'text-[#344f67] font-semibold',
    footerActionText: 'text-[#65717b]',
    dividerText: 'text-[#65717b]',
    identityPreviewEditButton: 'text-[#344f67]',
    formFieldSuccessText: 'text-[#356858]',
    alertText: 'text-[#8d3834]',
    logoBox: 'mb-2',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#d9d4c8] bg-[#fffefa]',
    formButtonPrimary: 'bg-[#25384a] text-[#fbfaf6] hover:bg-[#334c62]',
    formFieldInput: 'bg-[#fffefa] border-[#d9d4c8] text-[#263342]',
    footerAction: 'bg-transparent',
    dividerLine: 'bg-[#ded9ce]',
    alert: 'bg-[#fff3f0]',
    otpCodeFieldInput: 'bg-[#fffefa] border-[#d9d4c8]',
    formFieldRow: 'mb-4',
    main: 'text-[#263342]',
  },
};

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  const previousId = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const nextId = user?.id ?? null;
      if (previousId.current !== undefined && previousId.current !== nextId) client.clear();
      previousId.current = nextId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function HomeRoute() {
  return <><Show when="signed-in"><Redirect to="/dashboard" /></Show><Show when="signed-out"><Landing /></Show></>;
}

function Protected({ children }: { children: ReactNode }) {
  return <><Show when="signed-in">{children}</Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function AuthRoute({ kind }: { kind: 'sign-in' | 'sign-up' }) {
  return <div className="auth-screen"><div className="auth-backdrop"><div className="auth-rail" /><div className="auth-message"><div className="eyebrow">RISK SENTINEL / PRIVATE WORKSPACE</div><h1>Evidence first.<br /><em>Judgment always.</em></h1><p>Register brand identities and keep every review grounded in its evidence.</p></div></div><div className="auth-form-wrap">{kind === 'sign-in' ? <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /> : <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />}</div></div>;
}

function Router() {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}><Switch>
    <Route path="/" component={HomeRoute} />
    <Route path="/sign-in/*?" component={() => <AuthRoute kind="sign-in" />} />
    <Route path="/sign-up/*?" component={() => <AuthRoute kind="sign-up" />} />
    <Route path="/dashboard">{() => <Protected><DashboardPage /></Protected>}</Route>
    <Route path="/brands">{() => <Protected><BrandsPage /></Protected>}</Route>
    <Route path="/alerts">{() => <Protected><AlertsPage /></Protected>}</Route>
    <Route path="/cases">{() => <Protected><CasesPage /></Protected>}</Route>
    <Route path="/privacy">{() => <LegalPage kind="privacy" />}</Route>
    <Route path="/terms">{() => <LegalPage kind="terms" />}</Route>
    <Route>{() => <div className="not-found"><span className="eyebrow">404 / NOT FOUND</span><h1>This page is outside the record.</h1><a href={basePath || '/'}>Return to Risk Sentinel</a></div>}</Route>
  </Switch></ErrorBoundary>;
}

function ProviderRoutes() {
  const [, setLocation] = useLocation();
  return <ClerkProvider publishableKey={clerkPubKey} proxyUrl={clerkProxyUrl} appearance={clerkAppearance} signInUrl={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} localization={{ signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to your private risk workspace' } }, signUp: { start: { title: 'Create your workspace', subtitle: 'Register brand identities and review evidence' } } }} routerPush={to => setLocation(stripBase(to))} routerReplace={to => setLocation(stripBase(to), { replace: true })}>
    <ClerkCacheInvalidator /><Router />
  </ClerkProvider>;
}

function App() {
  return <QueryClientProvider client={queryClient}><WouterRouter base={basePath}><ProviderRoutes /></WouterRouter><Toaster /></QueryClientProvider>;
}

export default App;
