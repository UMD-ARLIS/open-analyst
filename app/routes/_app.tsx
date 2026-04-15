import { useEffect, useRef, useCallback } from 'react';
import { Outlet, useLoaderData, useLocation, useRevalidator } from 'react-router';
import { useAppStore } from '~/lib/store';
import { applyTheme, setTheme, getTheme } from '~/lib/theme';
import { ProjectLeftPanel } from '~/components/ProjectLeftPanel';
import { Sidebar } from '~/components/Sidebar';
import { PermissionDialog } from '~/components/PermissionDialog';
import { ConfigModal } from '~/components/ConfigModal';
import { TopNav } from '~/components/TopNav';
import { ProjectContextPanel } from '~/components/ProjectContextPanel';
import type { AppConfig } from '~/lib/types';
import { headlessSaveConfig } from '~/lib/headless-api';

export { loader } from './_app.loader.server';

export default function AppLayout() {
  const {
    pendingPermission,
    settings,
    showConfigModal,
    isConfigured,
    appConfig,
    updateSettings,
    setShowConfigModal,
    setIsConfigured,
    setAppConfig,
    setWorkingDir,
    setProjects,
    setActiveProjectId,
  } = useAppStore();
  const initialized = useRef(false);
  const loaderData = useLoaderData<typeof import('./_app.loader.server').loader>();
  const { revalidate } = useRevalidator();
  const location = useLocation();

  const buildAppConfig = useCallback(
    (model: string): AppConfig => ({
      provider: 'openrouter',
      apiKey: '',
      baseUrl: '',
      model,
      isConfigured: Boolean(model),
    }),
    []
  );

  // Bridge: sync loader data into Zustand
  const hydrated = Boolean(loaderData);
  useEffect(() => {
    if (loaderData) {
      setProjects(loaderData.projects);
      setActiveProjectId(loaderData.activeProjectId);
      setWorkingDir(loaderData.workingDir);
      setIsConfigured(loaderData.isConfigured);
      setAppConfig(buildAppConfig(loaderData.model || ''));
    }
  }, [loaderData, setProjects, setActiveProjectId, setWorkingDir, setIsConfigured, setAppConfig, buildAppConfig]);

  // Revalidate loader data on navigation (handles popstate/back-nav)
  useEffect(() => {
    revalidate();
  }, [location.pathname]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    // Sync persisted theme into Zustand (blocking script already applied it to DOM)
    const persisted = getTheme();
    if (persisted !== settings.theme) {
      updateSettings({ theme: persisted });
    }

    setAppConfig(buildAppConfig(loaderData?.model || ''));
  }, [buildAppConfig, loaderData?.model, setAppConfig]);

  useEffect(() => {
    const resolved = settings.theme === 'system' ? 'light' : settings.theme;
    applyTheme(resolved);
    setTheme(resolved);
  }, [settings.theme]);

  const handleConfigSave = useCallback(
    async (newConfig: Partial<AppConfig>) => {
      await headlessSaveConfig(newConfig);
      setAppConfig(buildAppConfig(String(newConfig.model || loaderData?.model || '')));
      revalidate();
    },
    [buildAppConfig, loaderData?.model, setAppConfig, revalidate]
  );

  const handleConfigClose = useCallback(() => {
    setShowConfigModal(false);
  }, [setShowConfigModal]);

  return (
    <div
      className="h-screen w-screen flex flex-col overflow-hidden bg-background"
      data-hydrated={hydrated || undefined}
    >
      <TopNav />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar
          threads={loaderData?.sidebarThreads ?? []}
          collections={loaderData?.sidebarCollections ?? []}
          documentCounts={loaderData?.sidebarDocumentCounts ?? {}}
        />

        <ProjectLeftPanel />

        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          <Outlet />
        </main>

        <ProjectContextPanel />
      </div>

      {pendingPermission && <PermissionDialog permission={pendingPermission} />}

      <ConfigModal
        isOpen={showConfigModal}
        onClose={handleConfigClose}
        onSave={handleConfigSave}
        initialConfig={appConfig}
        isFirstRun={!isConfigured}
      />
    </div>
  );
}
