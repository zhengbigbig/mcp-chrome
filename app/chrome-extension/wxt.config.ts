import { defineConfig } from 'wxt';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { config } from 'dotenv';
import { resolve } from 'path';
import { homedir } from 'os';

config({ path: resolve(process.cwd(), '.env') });
config({ path: resolve(process.cwd(), '.env.local') });

const CHROME_EXTENSION_KEY = process.env.CHROME_EXTENSION_KEY;

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  webExt: {
    startUrls: ["https://www.google.com/search?q=123456ss"],
  },
  manifest: {
    // Use environment variable for the key, fallback to undefined if not set
    key: CHROME_EXTENSION_KEY,
    name: 'Chrome MCP Server',
    description: 'Exposes browser capabilities with your own chrome',
    permissions: [
      'nativeMessaging',
      'tabs',
      'activeTab',
      'scripting',
      'downloads',
      'webRequest',
      'debugger',
      'history',
      'bookmarks',
      'offscreen',
      'storage',
      'sidePanel',
    ],
    action: {
      default_title: 'AI 助手 - 打开侧边栏',
      default_icon: {
        '16': 'icon/16.png',
        '32': 'icon/32.png',
        '48': 'icon/48.png',
        '128': 'icon/128.png'
      }
    },
    side_panel: {
      default_path: 'entrypoints/sidepanel/index.html',
    },

    host_permissions: ['<all_urls>'],
    web_accessible_resources: [
      {
        resources: [
          '/models/*', // 允许访问 public/models/ 下的所有文件
          // workers 目录已移除
        ],
        matches: ['<all_urls>'],
      },
    ],
    cross_origin_embedder_policy: {
      value: 'require-corp',
    },
    cross_origin_opener_policy: {
      value: 'same-origin',
    },
    content_security_policy: {
      extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self';",
    },
  },
  vite: (env) => ({
    plugins: [
      viteStaticCopy({
        targets: [
          {
            src: 'inject-scripts/*.js',
            dest: 'inject-scripts',
          },
          // workers 目录已移除

        ],
      }) as any,
    ],
    build: {
      // 我们的构建产物需要兼容到es6
      target: 'es2015',
      // 非生产环境下生成sourcemap
      sourcemap: env.mode !== 'production',
      // 禁用gzip 压缩大小报告，因为压缩大型文件可能会很慢
      reportCompressedSize: false,
      // chunk大小超过1500kb是触发警告
      chunkSizeWarningLimit: 1500,
      minify: false,
    },
  }),
});
