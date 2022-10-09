<script lang="ts" setup>
import {
  VCard,
  IconCheckboxFill,
  VAvatar,
  VButton,
  IconExternalLinkLine,
} from "@halo-dev/components";
import { ref, watchEffect } from "vue";
import { createApi } from "unsplash-js";
import type { Basic as Photo } from "unsplash-js/dist/methods/photos/types";
import type { Basic as Topic } from "unsplash-js/dist/methods/topics/types";
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
const topics = ref<Topic[]>();
const selectedTopic = ref<Topic>();
const photos = ref<Photo[]>([] as Photo[]);
const page = ref(1);
const loading = ref(false);
const selectedPhotos = ref<Set<Photo>>(new Set());
const keyword = ref("");

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

const handleFetchTopics = async () => {
  const unsplash = createApi({ accessKey: accessKey.value });

  const { response } = await unsplash.topics.list({
    page: 1,
    perPage: 100,
    orderBy: "featured",
  });

  topics.value = response?.results;

  if (topics.value?.length) {
    selectedTopic.value = topics.value[0];
    handleFetchPhotos();
  }
};

const handleSelectTopic = (topic: Topic) => {
  selectedTopic.value = topic;
  photos.value = [];
  page.value = 1;
  handleFetchPhotos();
};

const handleFetchPhotos = async () => {
  loading.value = true;
  const unsplash = createApi({ accessKey: accessKey.value });

  if (!selectedTopic.value) {
    return;
  }

  const { response } = await unsplash.topics.getPhotos({
    topicIdOrSlug: selectedTopic.value?.id,
    page: page.value,
    perPage: 48,
  });

  if (response?.results) {
    photos.value = [...photos.value, ...response.results];
  }
  loading.value = false;
};

const handleSearch = async (data?: any) => {
  // clear photos when first search
  if (!keyword.value) {
    page.value = 1;
    photos.value = [];
  }

  if (data) {
    keyword.value = data.keyword;
  }

  if (!data.keyword) {
    photos.value = [];
    page.value = 1;
    handleFetchTopics();
    return;
  }

  loading.value = true;

  const unsplash = createApi({ accessKey: accessKey.value });

  const { response } = await unsplash.search.getPhotos({
    page: page.value,
    perPage: 48,
    query: keyword.value,
  });

  if (response?.results) {
    photos.value = [...photos.value, ...response.results];
  }

  loading.value = false;
};

const handleFetchNext = () => {
  page.value++;

  if (keyword.value) {
    handleSearch();
    return;
  }

  handleFetchPhotos();
};

const handleSelect = async (photo: Photo) => {
  if (selectedPhotos.value.has(photo)) {
    selectedPhotos.value.delete(photo);
    return;
  }
  selectedPhotos.value.add(photo);
};

const isChecked = (photo: Photo) => {
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

await handleFetchUnsplashAccessKey();
await handleFetchTopics();
</script>
<template>
  <div>
    <FormKit id="search-form" type="form" @submit="handleSearch">
      <FormKit
        name="keyword"
        type="text"
        placeholder="输入关键字搜索"
        @keyup.enter="$formkit.submit('search-form')"
      ></FormKit>
    </FormKit>
  </div>
  <div
    v-if="!keyword"
    class="unsplash-topics unsplash-mt-2 unsplash-flex unsplash-gap-y-3 unsplash-gap-x-2 unsplash-overflow-y-hidden unsplash-overflow-x-scroll unsplash-scroll-smooth unsplash-pb-1"
  >
    <div
      v-for="(topic, index) in topics"
      :key="index"
      :class="{
        '!unsplash-bg-gray-200 !unsplash-text-gray-900':
          topic.id === selectedTopic?.id,
      }"
      class="unsplash-rounded-base unsplash-flex unsplash-cursor-pointer unsplash-items-center unsplash-bg-gray-100 unsplash-p-2 unsplash-text-gray-500 unsplash-transition-all hover:unsplash-bg-gray-200 hover:unsplash-text-gray-900 hover:unsplash-shadow-sm"
      @click="handleSelectTopic(topic)"
    >
      <div
        class="unsplash-flex unsplash-flex-1 unsplash-items-center unsplash-truncate"
      >
        <span class="unsplash-truncate unsplash-text-sm">
          {{ topic.title }}({{ topic.total_photos }})
        </span>
      </div>
    </div>
  </div>

  <div
    class="unsplash-mt-2 unsplash-grid unsplash-grid-cols-3 unsplash-gap-x-2 unsplash-gap-y-3 sm:unsplash-grid-cols-3 md:unsplash-grid-cols-6"
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
            :src="photo.urls.small"
          />
        </div>
        <div
          :class="{ '!unsplash-flex': selectedPhotos.has(photo) }"
          class="unsplash-absolute unsplash-top-0 unsplash-left-0 unsplash-hidden unsplash-h-1/3 unsplash-w-full unsplash-justify-between unsplash-bg-gradient-to-b unsplash-from-gray-300 unsplash-to-transparent unsplash-ease-in-out group-hover:unsplash-flex"
        >
          <a
            :href="photo.links.html"
            target="_blank"
            class="unsplash-mt-1 unsplash-ml-1"
          >
            <IconExternalLinkLine
              class="unsplash-h-6 unsplash-w-6 unsplash-cursor-pointer unsplash-text-white unsplash-transition-all hover:unsplash-text-black"
            />
          </a>
          <IconCheckboxFill
            :class="{
              '!unsplash-text-black': selectedPhotos.has(photo),
            }"
            class="unsplash-mt-1 unsplash-mr-1 unsplash-h-6 unsplash-w-6 unsplash-cursor-pointer unsplash-text-white unsplash-transition-all hover:unsplash-text-black"
          />
        </div>
        <div
          :class="{ '!unsplash-flex': selectedPhotos.has(photo) }"
          class="unsplash-absolute unsplash-left-0 unsplash-bottom-0 unsplash-hidden unsplash-w-full unsplash-bg-gradient-to-t unsplash-from-gray-600 unsplash-to-transparent unsplash-ease-in-out group-hover:unsplash-flex"
        >
          <div
            class="p-1 unsplash-flex unsplash-w-full unsplash-flex-row unsplash-items-center unsplash-gap-2"
          >
            <VAvatar
              v-if="photo.user.profile_image?.medium"
              :src="photo.user.profile_image.medium"
              circle
              size="sm"
            ></VAvatar>
            <div
              class="flex unsplash-flex-1 unsplash-flex-col unsplash-truncate"
            >
              <a
                class="unsplash-truncate unsplash-text-xs unsplash-font-medium unsplash-text-white hover:unsplash-underline"
                :href="photo.links.html"
                target="_blank"
              >
                {{ photo.user.name }}
              </a>
              <span
                class="unsplash-truncate unsplash-text-xs unsplash-text-white unsplash-opacity-80"
              >
                {{ photo.user.bio }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </VCard>
  </div>
  <div
    class="unsplash-mt-4 unsplash-flex unsplash-items-center unsplash-justify-center"
  >
    <VButton :loading="loading" type="secondary" @click="handleFetchNext">
      {{ loading ? "加载中..." : "加载更多" }}
    </VButton>
  </div>
</template>
<style scoped>
.unsplash-topics::-webkit-scrollbar-track-piece {
  background-color: #f8f8f8;
  -webkit-border-radius: 2em;
  -moz-border-radius: 2em;
  border-radius: 2em;
}

.unsplash-topics::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

.unsplash-topics::-webkit-scrollbar-thumb {
  background-color: #f2eaea;
  background-clip: padding-box;
  -webkit-border-radius: 2em;
  -moz-border-radius: 2em;
  border-radius: 2em;
}

.unsplash-topics::-webkit-scrollbar-thumb:hover {
  background-color: #bbb;
}
</style>
