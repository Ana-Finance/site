import { lazy, Suspense } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { isConfigured } from '../lib/supabase';
import { AuthProvider, useAuth } from './auth';
import { Denied, Login, NotConfigured, SetPassword } from './Login';
import { Layout } from './Layout';
import { ConfirmProvider, Spinner, ToastProvider } from '../components/ui';

// Chaque module est chargé à la demande (graphiques et éditeur ne pèsent pas sur la connexion).
const Dashboard = lazy(() => import('../modules/dashboard/Dashboard'));
const Leads = lazy(() => import('../modules/leads/Leads'));
const Analytics = lazy(() => import('../modules/analytics/Analytics'));
const PagesList = lazy(() => import('../modules/pages/PagesList'));
const PageDetail = lazy(() => import('../modules/pages/PageDetail'));
const Editor = lazy(() => import('../modules/editor/Editor'));
const MediaLibrary = lazy(() => import('../modules/media/MediaLibrary'));
const Seo = lazy(() => import('../modules/seo/Seo'));
const Publications = lazy(() => import('../modules/publications/Publications'));
const Settings = lazy(() => import('../modules/settings/Settings'));
const Preview = lazy(() => import('../modules/editor/Preview'));

const Loading = () => <div className="center-screen"><Spinner label="Chargement…" /></div>;

function Gate() {
  const { ready, session, denied, passwordSetup } = useAuth();
  if (!ready) return <Loading />;
  if (session && passwordSetup) return <SetPassword />;
  if (!session) return <Login />;
  if (denied) return <Denied />;
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/preview/:slug" element={<Preview />} />
        <Route element={<Layout />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/demandes" element={<Leads />} />
          <Route path="/analytics" element={<Analytics />} />
          <Route path="/pages" element={<PagesList />} />
          <Route path="/pages/:id" element={<PageDetail />} />
          <Route path="/editor" element={<Editor />} />
          <Route path="/editor/:slug" element={<Editor />} />
          <Route path="/media" element={<MediaLibrary />} />
          <Route path="/seo" element={<Seo />} />
          <Route path="/publications" element={<Publications />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function App() {
  if (!isConfigured) return <NotConfigured />;
  return (
    <ToastProvider>
      <ConfirmProvider>
        <AuthProvider>
          <HashRouter><Gate /></HashRouter>
        </AuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
