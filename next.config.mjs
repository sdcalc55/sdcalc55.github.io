/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: { unoptimized: true },
  devIndicators: false,
  logging: { browserToTerminal: 'error' },
}

export default nextConfig
