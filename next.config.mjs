/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Docker 이미지를 경량화하기 위해 standalone 산출물을 사용한다(node_modules 전체 복사 불필요).
  output: "standalone",
};

export default nextConfig;
