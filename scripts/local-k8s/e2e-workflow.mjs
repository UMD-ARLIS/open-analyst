import { S3Client, HeadObjectCommand } from "@aws-sdk/client-s3";

const baseUrl = (process.env.OPEN_ANALYST_BASE_URL || "http://open-analyst.localtest.me").replace(/\/+$/g, "");
const cookie = String(process.env.OPEN_ANALYST_COOKIE || "").trim();
const artifactBucket = process.env.OPEN_ANALYST_S3_BUCKET || "open-analyst-local";
const artifactPrefix = process.env.OPEN_ANALYST_S3_PREFIX || "open-analyst-vnext";
const s3Endpoint = process.env.OPEN_ANALYST_S3_ENDPOINT || "http://127.0.0.1:9000";
const artifactRegion = process.env.OPEN_ANALYST_S3_REGION || "us-east-1";
const s3AccessKeyId = process.env.OPEN_ANALYST_S3_ACCESS_KEY_ID || "minioadmin";
const s3SecretAccessKey = process.env.OPEN_ANALYST_S3_SECRET_ACCESS_KEY || "minioadmin";

function headers(extra = {}) {
  return {
    "content-type": "application/json",
    ...(cookie ? { cookie } : {}),
    ...extra,
  };
}

async function expectOk(response, label) {
  if (response.ok) return response;
  const body = await response.text().catch(() => "");
  throw new Error(`${label} failed: ${response.status} ${body}`);
}

async function fetchJson(path, init = {}, label = path) {
  const response = await expectOk(fetch(`${baseUrl}${path}`, init), label);
  return response.json();
}

async function waitFor(path, attempts = 60, delayMs = 2000) {
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}${path}`, {
        headers: cookie ? { cookie } : {},
      });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new Error(`Timed out waiting for ${path}`);
}

async function main() {
  await waitFor("/api/health");

  const projectName = `Local Workflow ${Date.now()}`;
  const projectBody = await fetchJson(
    "/api/projects",
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        name: projectName,
        description: "Automated local-k8s workflow check",
        artifactBackend: "s3",
        artifactS3Bucket: artifactBucket,
        artifactS3Region: artifactRegion,
        artifactS3Endpoint: "http://minio:9000",
        artifactS3Prefix: artifactPrefix,
      }),
    },
    "create project"
  );

  const project = projectBody.project;
  if (!project?.id) {
    throw new Error("Project creation did not return an id");
  }

  const staged = await fetchJson(
    `/api/projects/${encodeURIComponent(project.id)}/source-ingest`,
    {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({
        origin: "web",
        url: "https://example.com/",
      }),
    },
    "stage web source"
  );

  const batchId = staged.batch?.id;
  if (!batchId) {
    throw new Error("Source ingest batch creation did not return an id");
  }

  await fetchJson(
    `/api/projects/${encodeURIComponent(project.id)}/source-ingest/${encodeURIComponent(batchId)}/approve`,
    {
      method: "POST",
      headers: cookie ? { cookie } : {},
    },
    "approve source ingest batch"
  );

  let knowledge;
  for (let attempt = 1; attempt <= 30; attempt += 1) {
    knowledge = await fetchJson(
      `/api/projects/${encodeURIComponent(project.id)}/knowledge`,
      {
        headers: cookie ? { cookie } : {},
      },
      "load knowledge"
    );
    if (Array.isArray(knowledge.documents) && knowledge.documents.length > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }

  const document = knowledge?.documents?.[0];
  if (!document?.id || !document?.storageUri) {
    throw new Error("Imported document or storageUri not found in knowledge view");
  }

  const artifactResponse = await expectOk(
    fetch(
      `${baseUrl}/api/projects/${encodeURIComponent(project.id)}/documents/${encodeURIComponent(document.id)}/artifact`,
      {
        headers: cookie ? { cookie } : {},
      }
    ),
    "fetch imported artifact"
  );
  const artifactBody = await artifactResponse.text();
  if (!artifactBody.trim()) {
    throw new Error("Imported artifact body was empty");
  }

  const s3Uri = String(document.storageUri);
  if (!s3Uri.startsWith("s3://")) {
    throw new Error(`Expected s3:// storageUri, got ${s3Uri}`);
  }
  const [, , bucketAndKey] = s3Uri.split(/s3:\/\//);
  const slashIndex = bucketAndKey.indexOf("/");
  const bucket = bucketAndKey.slice(0, slashIndex);
  const key = bucketAndKey.slice(slashIndex + 1);

  const client = new S3Client({
    region: artifactRegion,
    endpoint: s3Endpoint,
    forcePathStyle: true,
    credentials: {
      accessKeyId: s3AccessKeyId,
      secretAccessKey: s3SecretAccessKey,
    },
  });
  await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));

  console.log(JSON.stringify({
    ok: true,
    projectId: project.id,
    batchId,
    documentId: document.id,
    storageUri: s3Uri,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
