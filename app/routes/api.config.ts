import { loadConfig, saveConfig, maskApiKey } from "~/lib/config.server";
import type { Route } from "./+types/api.config";

export async function loader() {
  const cfg = loadConfig();
  return Response.json({ ...cfg, apiKey: maskApiKey(cfg.apiKey) });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = await request.json();
  const cfg = { ...loadConfig(), ...body };
  saveConfig(cfg);
  return Response.json({
    success: true,
    config: { ...cfg, apiKey: maskApiKey(cfg.apiKey) },
  });
}
