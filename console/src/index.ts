import { definePlugin } from "@halo-dev/console-shared";
import { markRaw } from "vue";
import UnsplashSelectorProvider from "./components/UnsplashSelectorProvider.vue";
import "./styles/tailwind.css";

export default definePlugin({
  components: {},
  routes: [],
  extensionPoints: {
    "attachment:selector:create": () => {
      return [
        {
          id: "unsplash",
          label: "Unsplash",
          component: markRaw(UnsplashSelectorProvider),
        },
      ];
    },
  },
});
