/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Static export so the console can be hosted on Cloudflare Pages. The app
  // talks to the GenLayer contract directly from the browser, so no server
  // runtime is needed.
  output: "export",
  images: { unoptimized: true },
};

export default nextConfig;
