<script lang="ts" setup>
import {
  VCard,
  IconCheckboxFill,
  VAvatar,
  VButton,
  IconExternalLinkLine,
  VLoading,
  Toast,
} from "@halo-dev/components";
import { computed, ref, watch, watchEffect } from "vue";
import { createApi } from "unsplash-js";
import type { Basic as Photo } from "unsplash-js/dist/methods/photos/types";
import type { Basic as Topic } from "unsplash-js/dist/methods/topics/types";
import type { AttachmentLike } from "@halo-dev/console-shared";
import apiClient from "../utils/api-client";
import type { ConfigMap } from "@halo-dev/api-client";
import { useQuery } from "@tanstack/vue-query";

const props = withDefaults(
  defineProps<{
    selected: AttachmentLike[];
    min?: number;
    max?: number;
  }>(),
  {
    selected: () => [],
    min: undefined,
    max: undefined,
  }
);

const emit = defineEmits<{
  (event: "update:selected", attachments: AttachmentLike[]): void;
}>();

const selectedTopic = ref<Topic>();
const selectedPhotos = ref<Set<Photo>>(new Set());
const photos = ref<Photo[]>([]);
const page = ref(1);
const keyword = ref("");

const { data: accessKey } = useQuery({
  queryKey: ["unsplash-access-key"],
  queryFn: async () => {
    const { data: configMap } = await apiClient.get<ConfigMap>(
      "/api/v1alpha1/configmaps/unsplash-settings"
    );

    return JSON.parse(configMap.data?.basic || "{ accessKey: '' }").accessKey;
  },
  onSuccess(data) {
    if (!data) {
      Toast.error("未正确配置 Unsplash Access Key");
    }
  },
  onError() {
    Toast.error("未正确配置 Unsplash Access Key");
  },
});

const { data: topics } = useQuery<Topic[] | undefined>({
  queryKey: ["unsplash-topics", accessKey],
  queryFn: async () => {
    const unsplash = createApi({ accessKey: accessKey.value });
    const { response } = await unsplash.topics.list({
      page: 1,
      perPage: 100,
      orderBy: "featured",
    });
    return response?.results || [];
  },
  onSuccess(data) {
    if (data?.length) {
      selectedTopic.value = data[0];
    }
  },
  enabled: computed(() => !!accessKey.value),
});

const { isFetching } = useQuery({
  queryKey: ["unsplash-photos", keyword, selectedTopic, page],
  queryFn: async () => {
    const unsplash = createApi({ accessKey: accessKey.value });

    if (keyword.value) {
      const { response } = await unsplash.search.getPhotos({
        page: page.value,
        perPage: 48,
        query: keyword.value,
      });

      return response?.results || [];
    }

    if (!selectedTopic.value) {
      return [];
    }

    const { response } = await unsplash.topics.getPhotos({
      topicIdOrSlug: selectedTopic.value.id,
      page: page.value,
      perPage: 48,
    });

    return response?.results || [];
  },
  onSuccess(data) {
    photos.value = [...photos.value, ...data];
  },
  keepPreviousData: true,
  enabled: computed(() => !!accessKey.value),
});

watch(
  () => keyword.value,
  () => {
    photos.value = [];
    selectedPhotos.value = new Set();
    page.value = 1;
  }
);

const handleSelectTopic = (topic: Topic) => {
  selectedTopic.value = topic;
  selectedPhotos.value = new Set();
  photos.value = [];
  page.value = 1;
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

const isDisabled = (photo: Photo) => {
  if (
    props.max !== undefined &&
    props.max <= selectedPhotos.value.size &&
    !isChecked(photo)
  ) {
    return true;
  }
  return false;
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
</script>
<template>
  <div>
    <SearchInput v-model="keyword" />
  </div>
  <div
    v-if="!keyword"
    class="unsplash-topics unsplash-mt-2 unsplash-flex unsplash-gap-x-2 unsplash-gap-y-3 unsplash-overflow-y-hidden unsplash-overflow-x-scroll unsplash-scroll-smooth unsplash-pb-1"
  >
    <div
      v-for="(topic, index) in topics"
      :key="index"
      :class="{
        '!unsplash-bg-gray-200 !unsplash-text-gray-900':
          topic.id === selectedTopic?.id,
      }"
      class="unsplash-flex unsplash-cursor-pointer unsplash-items-center unsplash-rounded unsplash-bg-gray-100 unsplash-p-2 unsplash-text-gray-500 unsplash-transition-all hover:unsplash-bg-gray-200 hover:unsplash-text-gray-900 hover:unsplash-shadow-sm"
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

  <VLoading v-if="isFetching && photos.length === 0" />

  <div v-else>
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
          'unsplash-pointer-events-none !unsplash-cursor-not-allowed unsplash-opacity-50':
            isDisabled(photo),
        }"
        class="hover:unsplash-shadow"
        @click.stop="handleSelect(photo)"
      >
        <div class="unsplash-group unsplash-relative unsplash-bg-white">
          <div
            class="unsplash-aspect-h-8 unsplash-aspect-w-10 unsplash-block unsplash-h-full unsplash-w-full unsplash-cursor-pointer unsplash-overflow-hidden unsplash-bg-gray-100"
          >
            <img
              class="unsplash-pointer-events-none unsplash-object-cover group-hover:unsplash-opacity-75"
              :src="photo.urls.small"
            />
          </div>
          <div
            :class="{ '!unsplash-flex': selectedPhotos.has(photo) }"
            class="unsplash-absolute unsplash-left-0 unsplash-top-0 unsplash-hidden unsplash-h-1/3 unsplash-w-full unsplash-justify-between unsplash-bg-gradient-to-b unsplash-from-gray-300 unsplash-to-transparent unsplash-ease-in-out group-hover:unsplash-flex"
          >
            <a
              :href="photo.links.html"
              target="_blank"
              class="unsplash-ml-1 unsplash-mt-1"
            >
              <IconExternalLinkLine
                class="unsplash-h-6 unsplash-w-6 unsplash-cursor-pointer unsplash-text-white unsplash-transition-all hover:unsplash-text-black"
              />
            </a>
            <IconCheckboxFill
              :class="{
                '!unsplash-text-black': selectedPhotos.has(photo),
              }"
              class="unsplash-mr-1 unsplash-mt-1 unsplash-h-6 unsplash-w-6 unsplash-cursor-pointer unsplash-text-white unsplash-transition-all hover:unsplash-text-black"
            />
          </div>
          <div
            :class="{ '!unsplash-flex': selectedPhotos.has(photo) }"
            class="unsplash-absolute unsplash-bottom-0 unsplash-left-0 unsplash-hidden unsplash-w-full unsplash-bg-gradient-to-t unsplash-from-gray-600 unsplash-to-transparent unsplash-ease-in-out group-hover:unsplash-flex"
          >
            <div
              class="unsplash-flex unsplash-w-full unsplash-flex-row unsplash-items-center unsplash-gap-2 unsplash-p-1"
            >
              <VAvatar
                v-if="photo.user.profile_image?.medium"
                :src="photo.user.profile_image.medium"
                circle
                size="sm"
              ></VAvatar>
              <div
                class="unsplash-flex unsplash-flex-1 unsplash-flex-col unsplash-truncate"
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
      v-if="photos.length > 0"
      class="unsplash-mt-4 unsplash-flex unsplash-items-center unsplash-justify-center"
    >
      <VButton :loading="isFetching" type="secondary" @click="page++">
        {{ isFetching ? "加载中..." : "加载更多" }}
      </VButton>
    </div>
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
