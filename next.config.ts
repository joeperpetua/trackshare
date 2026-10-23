import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp is a native module: keep it out of the server bundle.
  serverExternalPackages: ["sharp"],
  // The card route reads font files from node_modules at runtime.
  outputFileTracingIncludes: {
    "/api/card": [
      "./node_modules/@fontsource/bricolage-grotesque/files/*.woff",
      "./node_modules/@fontsource/inter-tight/files/*.woff",
      "./node_modules/@fontsource/jetbrains-mono/files/*.woff",
    ],
  },
};

export default nextConfig;
