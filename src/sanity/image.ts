import { createImageUrlBuilder } from "@sanity/image-url";
import { client } from "./client";

const builder = client ? createImageUrlBuilder(client) : null;

// Chainable no-op for when Sanity isn't configured (build-time / missing env vars).
const noop: any = new Proxy({}, { get: () => () => noop, apply: () => noop });
const noopUrlFor = (_source: any) =>
  new Proxy(noop, { get: (_, prop) => (prop === "url" ? () => "/placeholder.svg" : () => noopUrlFor(_source)) });

export function urlFor(source: any) {
  if (!builder) return noopUrlFor(source);
  return builder.image(source);
}
