import { useLoaderData, useNavigate } from "react-router";
import { SettingsPanel } from "~/components/SettingsPanel";

export { loader } from "./_app.settings.loader.server";

export default function SettingsRoute() {
  const data = useLoaderData<typeof import("./_app.settings.loader.server").loader>();
  const navigate = useNavigate();

  return (
    <SettingsPanel
      isOpen={true}
      onClose={() => navigate(-1)}
      initialData={data}
      mode="page"
    />
  );
}
