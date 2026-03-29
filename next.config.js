/** @type {import('next').NextConfig} */
const isProd = process.env.NODE_ENV === 'production'

const nextConfig = {
  output: 'export',
  // basePath only applies on GitHub Pages; local dev serves at localhost:3000
  basePath:    isProd ? '/advanced-markdown-editor' : '',
  assetPrefix: isProd ? '/advanced-markdown-editor/' : '',
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
