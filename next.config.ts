import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // 모바일에서 PC의 LAN IP로 dev 서버 접속할 때 cross-origin 차단을 해제.
  allowedDevOrigins: ["192.168.0.239", "192.168.0.0/24", "*.local"],
};

export default nextConfig;
