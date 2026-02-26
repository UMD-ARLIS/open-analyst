import { useEffect, useRef, useCallback } from 'react';
import { Outlet, useLoaderData, useRevalidator } from 'react-router';
import { useAppStore } from '~/lib/store';
import { Sidebar } from '~/components/Sidebar';
import { PermissionDialog } from '~/components/PermissionDialog';
import { ConfigModal } from '~/components/ConfigModal';
import { Titlebar } from '~/components/Titlebar';
import { SandboxSyncToast } from '~/components/SandboxSyncToast';
import type { AppConfig } from '~/lib/types';
import { getBrowserConfig, saveBrowserConfig } from '~/lib/browser-config';
import { headlessSaveConfig } from '~/lib/headless-api';

export { loader } from './_app.loader.server';

export default function AppLayout() {
  const {
    pendingPermission,
    settings,
    showConfigModal,
    isConfigured,
    appConfig,
    sandboxSyncStatus,
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

  // Bridge: sync loader data into Zustand
  useEffect(() => {
    if (loaderData) {
      setProjects(loaderData.projects);
      setActiveProjectId(loaderData.activeProjectId);
      setWorkingDir(loaderData.workingDir);
      setIsConfigured(loaderData.isConfigured);
    }
  }, [loaderData, setProjects, setActiveProjectId, setWorkingDir, setIsConfigured]);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const browserConfig = getBrowserConfig();
    setAppConfig(browserConfig);
  }, []);

  useEffect(() => {
    if (settings.theme === 'light') {
      document.documentElement.classList.add('light');
    } else {
      document.documentElement.classList.remove('light');
    }
  }, [settings.theme]);

  const handleConfigSave = useCallback(
    async (newConfig: Partial<AppConfig>) => {
      const saved = saveBrowserConfig(newConfig);
      await headlessSaveConfig(newConfig);
      setAppConfig(saved);
      revalidate();
    },
    [setAppConfig, revalidate],
  );

  const handleConfigClose = useCallback(() => {
    setShowConfigModal(false);
  }, [setShowConfigModal]);

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-background">
      <Titlebar />

      <div className="flex-1 flex overflow-hidden">
        <Sidebar />

        <main className="flex-1 flex flex-col overflow-hidden bg-background">
          <Outlet />
        </main>
      </div>

      {pendingPermission && <PermissionDialog permission={pendingPermission} />}

      <ConfigModal
        isOpen={showConfigModal}
        onClose={handleConfigClose}
        onSave={handleConfigSave}
        initialConfig={appConfig}
        isFirstRun={!isConfigured}
      />

      <SandboxSyncToast status={sandboxSyncStatus} />
    </div>
  );
}
