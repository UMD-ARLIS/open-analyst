import { useEffect, useState } from "react";

export function useArtifactObjectUrl(url: string, enabled = true) {
  const [objectUrl, setObjectUrl] = useState<string>("");

  useEffect(() => {
    if (!enabled || !url) {
      setObjectUrl("");
      return;
    }

    let revoked = false;
    let currentObjectUrl = "";

    async function load() {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to fetch preview: ${response.status}`);
        }
        const blob = await response.blob();
        if (revoked) {
          return;
        }
        currentObjectUrl = URL.createObjectURL(blob);
        setObjectUrl(currentObjectUrl);
      } catch {
        if (!revoked) {
          setObjectUrl("");
        }
      }
    }

    void load();
    return () => {
      revoked = true;
      if (currentObjectUrl) {
        URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [enabled, url]);

  return objectUrl;
}
