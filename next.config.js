/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  // GitHub Pages serves the site at /advanced-markdown-editor/
  basePath: '/advanced-markdown-editor',
  assetPrefix: '/advanced-markdown-editor/',
  images: {
    unoptimized: true, // Required for static export
  },
}

module.exports = nextConfig
