import { env } from "~/lib/env.server";

export async function loader() {
  const url = `${env.LITELLM_BASE_URL}/v1/models`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${env.LITELLM_API_KEY}`,
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    return Response.json(
      { error: `Gateway error: ${res.status} ${body}` },
      { status: res.status }
    );
  }

  const data = (await res.json()) as { data?: Array<{ id: string }> };
  const models = (data.data || []).map((m) => ({
    id: m.id,
    name: m.id,
  }));

  return Response.json({ models });
}
