import { defineConfig } from 'wxt';

// See https://wxt.dev/api/config.html
export default defineConfig({
  modules: ['@wxt-dev/module-react'],
  manifest: {
    name: 'MCP Browser Extension',
    description: 'MCP (Model Context Protocol) 浏览器插件 - Client & Server Demo',
    version: '1.0.0',
    permissions: [
      'activeTab',
      'tabs',
      'scripting',
      'contextMenus',
      'storage',
      'sidePanel',
    ],
    host_permissions: [
      'http://localhost:*/*',
      'http://127.0.0.1:*/*',
      'https://*/*',
      'http://*/*',
      '<all_urls>',
    ],
    web_accessible_resources: [
      {
        resources: ['*.js', '*.css', '*.html'],
        matches: ['<all_urls>'],
      },
    ],
    side_panel: {
      default_path: 'sidepanel.html',
    },
    action: {
      default_title: 'Open MCP Panel',
    },
  },
});
