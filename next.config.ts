import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  turbopack: {
    // Set explicit workspace root to avoid false lockfile detection warning
    root: process.cwd(),
  },
}

export default nextConfig
