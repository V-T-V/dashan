import { defineConfig } from 'vite';

// 开发期把 /api 代理到本地 LLM 代理服务（默认 5180），
// 前端只需请求同源 /api/chat，无需关心跨域或 API Key（Key 仅存于 server 侧）。
export default defineConfig({
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5180',
        changeOrigin: true,
      },
    },
  },
});
