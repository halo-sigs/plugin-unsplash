import {
  definePlugin,
  type AttachmentSelectorPublicState,
} from "@halo-dev/console-shared";
import { markRaw, type Ref } from "vue";
import UnsplashSelectorProvider from "./components/UnsplashSelectorProvider.vue";
import "./styles/tailwind.css";

export default definePlugin({
  name: "PluginUnsplash",
  components: [],
  routes: [],
  menus: [],
  extensionPoints: {
    ATTACHMENT_SELECTOR: (state: Ref<AttachmentSelectorPublicState>) => {
      state.value.providers.push({
        id: "unsplash",
        label: "Unsplash",
        component: markRaw(UnsplashSelectorProvider),
      });
    },
  },
});
