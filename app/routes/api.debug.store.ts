import fs from "fs";
import { createProjectStore } from "~/lib/project-store.server";

export async function loader() {
  const store = createProjectStore();
  const storePath = store.STORE_PATH;
  if (!fs.existsSync(storePath)) {
    return new Response("{}", {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  }
  return new Response(fs.readFileSync(storePath, "utf8"), {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}
