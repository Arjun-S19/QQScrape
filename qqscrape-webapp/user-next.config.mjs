/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  // GitHub Pages needs to know the base path if you're not using a custom domain
  // If your repo is named "my-repo", use "/my-repo"
  // If you're using a custom domain, you can remove this line
  basePath: process.env.NEXT_PUBLIC_BASE_PATH || '',
  // Disable server components since we're exporting a static site
  experimental: {
    appDir: true,
  },
}

export default nextConfig

