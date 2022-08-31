<script lang="ts" setup>
import { VCard, IconCheckboxFill, VTabbar } from "@halo-dev/components";
import { ref, onMounted, watchEffect, computed } from "vue";
import { createApi } from "unsplash-js";
import type { Basic } from "unsplash-js/dist/methods/photos/types";
import type { Basic as Collection } from "unsplash-js/dist/methods/collections/types";
import type { AttachmentLike } from "@halo-dev/admin-shared";
import apiClient from "../utils/api-client";
import type { ConfigMap } from "../types";

withDefaults(
  defineProps<{
    selected: AttachmentLike[];
  }>(),
  {
    selected: () => [],
  }
);

const emit = defineEmits<{
  (event: "update:selected", attachments: AttachmentLike[]): void;
}>();

const accessKey = ref<string>("");
const collections = ref<Collection[]>();
const selectedCollection = ref<string>("");
const photos = ref<Basic[]>();
const selectedPhotos = ref<Set<Basic>>(new Set());

const collectionTabs = computed(() => {
  return collections.value?.map(({ id, title }) => ({
    id: id,
    label: title,
  }));
});

const handleFetchUnsplashAccessKey = async () => {
  try {
    const { data: configMap } = await apiClient.get<ConfigMap>(
      "/api/v1alpha1/configmaps/unsplash-settings"
    );

    accessKey.value = JSON.parse(
      configMap.data?.basic || "{ accessKey: '' }"
    ).accessKey;
  } catch (error) {
    alert("未正确配置 Unsplash 的 Access Key");
    console.error(error);
  }
};

const handleFetchCollections = async () => {
  const unsplash = createApi({ accessKey: accessKey.value });

  const { response } = await unsplash.collections.list({
    page: 1,
    perPage: 5,
  });

  collections.value = response?.results;

  if (collections.value?.length) {
    selectedCollection.value = collections.value[0].id;
    handleFetchUnsplash();
  }
};

const onChangeCollection = (collection: string) => {
  selectedCollection.value = collection;
  handleFetchUnsplash();
};

const handleFetchUnsplash = async () => {
  const unsplash = createApi({ accessKey: accessKey.value });

  const { response } = await unsplash.collections.getPhotos({
    collectionId: selectedCollection.value,
    page: 1,
    perPage: 100,
  });

  photos.value = response?.results;
};

const handleSelect = async (photo: Basic) => {
  if (selectedPhotos.value.has(photo)) {
    selectedPhotos.value.delete(photo);
    return;
  }
  selectedPhotos.value.add(photo);
};

const isChecked = (photo: Basic) => {
  return Array.from(selectedPhotos.value)
    .map((item) => item.id)
    .includes(photo.id);
};

watchEffect(() => {
  const photos = Array.from(selectedPhotos.value).map((photo) => {
    return {
      url: photo.urls.raw,
      type: photo.alt_description as string,
    };
  });
  emit("update:selected", photos);
});

onMounted(async () => {
  await handleFetchUnsplashAccessKey();
  await handleFetchCollections();
});
</script>
<template>
  <VTabbar
    :active-id="selectedCollection"
    :items="collectionTabs"
    type="pills"
    @change="onChangeCollection"
  ></VTabbar>
  <div
    class="unsplash-mt-2 unsplash-grid unsplash-grid-cols-3 unsplash-gap-x-2 unsplash-gap-y-3 sm:unsplash-grid-cols-3 md:unsplash-grid-cols-6 xl:unsplash-grid-cols-8 2xl:unsplash-grid-cols-10"
    role="list"
  >
    <VCard
      v-for="(photo, index) in photos"
      :key="index"
      :body-class="['!unsplash-p-0']"
      :class="{
        'unsplash-ring-1 unsplash-ring-black': isChecked(photo),
      }"
      class="hover:unsplash-shadow"
      @click.stop="handleSelect(photo)"
    >
      <div class="unsplash-group unsplash-relative unsplash-bg-white">
        <div
          class="unsplash-aspect-w-10 unsplash-aspect-h-8 unsplash-block unsplash-h-full unsplash-w-full unsplash-cursor-pointer unsplash-overflow-hidden unsplash-bg-gray-100"
        >
          <img
            class="unsplash-pointer-events-none unsplash-object-cover group-hover:unsplash-opacity-75"
            :src="photo.urls.thumb"
          />
        </div>
        <p
          class="unsplash-pointer-events-none unsplash-block unsplash-truncate unsplash-px-2 unsplash-py-1 unsplash-text-center unsplash-text-xs unsplash-font-medium unsplash-text-gray-700"
        >
          {{ photo.alt_description }}
        </p>
        <div
          :class="{ '!unsplash-flex': selectedPhotos.has(photo) }"
          class="unsplash-absolute unsplash-top-0 unsplash-left-0 unsplash-hidden unsplash-h-1/3 unsplash-w-full unsplash-justify-end unsplash-bg-gradient-to-b unsplash-from-gray-300 unsplash-to-transparent unsplash-ease-in-out group-hover:unsplash-flex"
        >
          <IconCheckboxFill
            :class="{
              '!unsplash-text-black': selectedPhotos.has(photo),
            }"
            class="hover:unsplash-text-primary unsplash-mt-1 unsplash-mr-1 unsplash-h-6 unsplash-w-6 unsplash-cursor-pointer unsplash-text-white unsplash-transition-all"
          />
        </div>
      </div>
    </VCard>
  </div>
</template>
