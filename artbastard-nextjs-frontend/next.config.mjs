/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: 'http://localhost:3030/api/:path*', // Proxy to Backend API
      },
      {
        source: '/socket.io/:path*',
        destination: 'http://localhost:3030/socket.io/:path*', // Proxy to Backend Socket.IO
      },
    ];
  },
};

export default nextConfig;
