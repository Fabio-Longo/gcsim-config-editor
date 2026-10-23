/**
 * Link that opens a config in the gcsim.app simulator. gcsim reads `?cfg=` as
 * url-safe base64 of gzipped JSON `{ config, title?, source? }` and asks the user
 * before replacing their current config (gcsim: ui/.../simulator/sharedConfig.ts).
 */
export async function gcsimSimulatorUrl(payload: { config: string; title?: string; source?: string }): Promise<string> {
  const gzipped = new Blob([JSON.stringify(payload)]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(gzipped).arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const base64 = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `https://gcsim.app/simulator?cfg=${base64}`;
}
