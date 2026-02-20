import fs from "fs";
import path from "path";
import { loadConfig, saveConfig } from "~/lib/config.server";
import type { Route } from "./+types/api.workdir";

export async function loader() {
  const cfg = loadConfig();
  return Response.json({
    workingDir: cfg.workingDir,
    workingDirType: cfg.workingDirType || "local",
    s3Uri: cfg.s3Uri || "",
  });
}

export async function action({ request }: Route.ActionArgs) {
  if (request.method !== "POST") {
    return Response.json({ error: "Method not allowed" }, { status: 405 });
  }
  const body = await request.json();
  const cfg = loadConfig();
  const inputPath = String(body.path || "").trim();
  const workingDirType = String(
    body.workingDirType || (inputPath.startsWith("s3://") ? "s3" : "local")
  );
  if (!inputPath) {
    return Response.json(
      { success: false, error: "path is required" },
      { status: 400 }
    );
  }
  if (workingDirType === "local") {
    const resolved = path.resolve(inputPath);
    if (!fs.existsSync(resolved)) {
      return Response.json(
        { success: false, error: `Path not found: ${resolved}` },
        { status: 400 }
      );
    }
    cfg.workingDir = resolved;
    cfg.workingDirType = "local";
    cfg.s3Uri = "";
  } else {
    cfg.workingDir = inputPath;
    cfg.workingDirType = "s3";
    cfg.s3Uri = inputPath;
  }
  saveConfig(cfg);
  return Response.json({
    success: true,
    path: cfg.workingDir,
    workingDirType: cfg.workingDirType,
  });
}
