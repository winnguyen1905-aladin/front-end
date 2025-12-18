// vite.config.ts
import { defineConfig } from "file:///home/loi/working/front-end/node_modules/vite/dist/node/index.js";
import react from "file:///home/loi/working/front-end/node_modules/@vitejs/plugin-react/dist/index.js";
import tailwindcss from "file:///home/loi/working/front-end/node_modules/@tailwindcss/vite/dist/index.mjs";
var vite_config_default = defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    sourcemap: true
    // Enable source maps
  },
  resolve: {
    alias: {
      "@": "/src",
      "@socket": "/src/socket",
      "@types": "/src/types",
      "@utils": "/src/utils",
      "@components": "/src/components",
      "@pages": "/src/page",
      "@routes": "/src/routes",
      "@context": "/src/context",
      "@hooks": "/src/hooks"
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9sb2kvd29ya2luZy9mcm9udC1lbmRcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL2xvaS93b3JraW5nL2Zyb250LWVuZC92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9sb2kvd29ya2luZy9mcm9udC1lbmQvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tICd2aXRlJ1xuaW1wb3J0IHJlYWN0IGZyb20gJ0B2aXRlanMvcGx1Z2luLXJlYWN0J1xuaW1wb3J0IHRhaWx3aW5kY3NzIGZyb20gJ0B0YWlsd2luZGNzcy92aXRlJ1xuXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xuICBwbHVnaW5zOiBbcmVhY3QoKSwgdGFpbHdpbmRjc3MoKV0sXG4gIGJ1aWxkOiB7XG4gICAgc291cmNlbWFwOiB0cnVlLCAvLyBFbmFibGUgc291cmNlIG1hcHNcbiAgfSxcbiAgcmVzb2x2ZToge1xuICAgIGFsaWFzOiB7XG4gICAgICAnQCc6ICcvc3JjJyxcbiAgICAgICdAc29ja2V0JzogJy9zcmMvc29ja2V0JyxcbiAgICAgICdAdHlwZXMnOiAnL3NyYy90eXBlcycsXG4gICAgICAnQHV0aWxzJzogJy9zcmMvdXRpbHMnLFxuICAgICAgJ0Bjb21wb25lbnRzJzogJy9zcmMvY29tcG9uZW50cycsXG4gICAgICAnQHBhZ2VzJzogJy9zcmMvcGFnZScsXG4gICAgICAnQHJvdXRlcyc6ICcvc3JjL3JvdXRlcycsXG4gICAgICAnQGNvbnRleHQnOiAnL3NyYy9jb250ZXh0JyxcbiAgICAgICdAaG9va3MnOiAnL3NyYy9ob29rcydcbiAgICB9XG4gIH1cbn0pXG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQW1RLFNBQVMsb0JBQW9CO0FBQ2hTLE9BQU8sV0FBVztBQUNsQixPQUFPLGlCQUFpQjtBQUV4QixJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTLENBQUMsTUFBTSxHQUFHLFlBQVksQ0FBQztBQUFBLEVBQ2hDLE9BQU87QUFBQSxJQUNMLFdBQVc7QUFBQTtBQUFBLEVBQ2I7QUFBQSxFQUNBLFNBQVM7QUFBQSxJQUNQLE9BQU87QUFBQSxNQUNMLEtBQUs7QUFBQSxNQUNMLFdBQVc7QUFBQSxNQUNYLFVBQVU7QUFBQSxNQUNWLFVBQVU7QUFBQSxNQUNWLGVBQWU7QUFBQSxNQUNmLFVBQVU7QUFBQSxNQUNWLFdBQVc7QUFBQSxNQUNYLFlBQVk7QUFBQSxNQUNaLFVBQVU7QUFBQSxJQUNaO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
