<script lang="ts" setup>
import { consoleApiClient } from '@halo-dev/api-client'
import {
  IconCheckboxFill,
  IconExternalLinkLine,
  Toast,
  VAvatar,
  VButton,
  VCard,
  VLoading
} from '@halo-dev/components'
import type { AttachmentLike } from '@halo-dev/console-shared'
import { useQuery } from '@tanstack/vue-query'
import { createApi } from 'unsplash-js'
import type { Basic as Photo } from 'unsplash-js/dist/methods/photos/types'
import type { Basic as Topic } from 'unsplash-js/dist/methods/topics/types'
import { computed, ref, watch, watchEffect } from 'vue'

const props = withDefaults(
  defineProps<{
    selected: AttachmentLike[]
    min?: number
    max?: number
  }>(),
  {
    selected: () => [],
    min: undefined,
    max: undefined
  }
)

const emit = defineEmits<{
  (event: 'update:selected', attachments: AttachmentLike[]): void
}>()

const selectedTopic = ref<Topic>()
const selectedPhotos = ref<Set<Photo>>(new Set())
const photos = ref<Photo[]>([])
const page = ref(1)
const keyword = ref('')

const { data: accessKey } = useQuery({
  queryKey: ['unsplash-access-key'],
  queryFn: async () => {
    const { data: configMap } = await consoleApiClient.plugin.plugin.fetchPluginConfig({
      name: 'PluginUnsplash'
    })

    return JSON.parse(configMap.data?.basic || "{ accessKey: '' }").accessKey
  },
  onSuccess(data) {
    if (!data) {
      Toast.error('未正确配置 Unsplash Access Key')
    }
  },
  onError() {
    Toast.error('未正确配置 Unsplash Access Key')
  }
})

const { data: topics } = useQuery<Topic[] | undefined>({
  queryKey: ['unsplash-topics', accessKey],
  queryFn: async () => {
    const unsplash = createApi({ accessKey: accessKey.value })
    const { response } = await unsplash.topics.list({
      page: 1,
      perPage: 100,
      orderBy: 'featured'
    })
    return response?.results || []
  },
  onSuccess(data) {
    if (data?.length) {
      selectedTopic.value = data[0]
    }
  },
  enabled: computed(() => !!accessKey.value)
})

const { isFetching } = useQuery({
  queryKey: ['unsplash-photos', keyword, selectedTopic, page],
  queryFn: async () => {
    const unsplash = createApi({ accessKey: accessKey.value })

    if (keyword.value) {
      const { response } = await unsplash.search.getPhotos({
        page: page.value,
        perPage: 48,
        query: keyword.value
      })

      return response?.results || []
    }

    if (!selectedTopic.value) {
      return []
    }

    const { response } = await unsplash.topics.getPhotos({
      topicIdOrSlug: selectedTopic.value.id,
      page: page.value,
      perPage: 48
    })

    return response?.results || []
  },
  onSuccess(data) {
    photos.value = [...photos.value, ...data]
  },
  keepPreviousData: true,
  enabled: computed(() => !!accessKey.value)
})

watch(
  () => keyword.value,
  () => {
    photos.value = []
    selectedPhotos.value = new Set()
    page.value = 1
  }
)

const handleSelectTopic = (topic: Topic) => {
  selectedTopic.value = topic
  selectedPhotos.value = new Set()
  photos.value = []
  page.value = 1
}

const handleSelect = async (photo: Photo) => {
  if (selectedPhotos.value.has(photo)) {
    selectedPhotos.value.delete(photo)
    return
  }
  selectedPhotos.value.add(photo)
}

const isChecked = (photo: Photo) => {
  return Array.from(selectedPhotos.value)
    .map((item) => item.id)
    .includes(photo.id)
}

const isDisabled = (photo: Photo) => {
  if (props.max !== undefined && props.max <= selectedPhotos.value.size && !isChecked(photo)) {
    return true
  }
  return false
}

watchEffect(() => {
  const photos = Array.from(selectedPhotos.value).map((photo) => {
    return {
      url: photo.urls.raw,
      type: photo.alt_description as string
    }
  })
  emit('update:selected', photos)
})
</script>
<template>
  <div>
    <SearchInput v-model="keyword" />
  </div>
  <div
    v-if="!keyword"
    class="topics mt-2 flex gap-x-2 gap-y-3 overflow-y-hidden overflow-x-scroll scroll-smooth pb-1"
  >
    <div
      v-for="(topic, index) in topics"
      :key="index"
      :class="{
        '!bg-gray-200 !text-gray-900': topic.id === selectedTopic?.id
      }"
      class="flex cursor-pointer items-center rounded bg-gray-100 p-2 text-gray-500 transition-all hover:bg-gray-200 hover:text-gray-900 hover:shadow-sm"
      @click="handleSelectTopic(topic)"
    >
      <div class="flex flex-1 items-center truncate">
        <span class="truncate text-sm"> {{ topic.title }}({{ topic.total_photos }}) </span>
      </div>
    </div>
  </div>

  <VLoading v-if="isFetching && photos.length === 0" />

  <div v-else>
    <div class="mt-2 gap-x-2 gap-y-3 grid grid-cols-3 sm:grid-cols-3 md:grid-cols-6" role="list">
      <VCard
        v-for="(photo, index) in photos"
        :key="index"
        :body-class="['!p-0']"
        :class="{
          'ring-1 ring-black': isChecked(photo),
          'pointer-events-none !cursor-not-allowed opacity-50': isDisabled(photo)
        }"
        class="hover:shadow"
        @click.stop="handleSelect(photo)"
      >
        <div class="group relative bg-white">
          <div class="cursor-pointer bg-gray-100 aspect-10/8 block h-full w-full overflow-hidden">
            <img
              class="pointer-events-none object-cover group-hover:opacity-75 size-full"
              :src="photo.urls.small"
            />
          </div>
          <div
            :class="{ '!flex': selectedPhotos.has(photo) }"
            class="w-full absolute left-0 top-0 hidden h-1/3 justify-between bg-gradient-to-b from-gray-300 to-transparent ease-in-out group-hover:flex"
          >
            <a :href="photo.links.html" target="_blank" class="ml-1 mt-1">
              <IconExternalLinkLine
                class="cursor-pointer transition-all h-6 w-6 text-white hover:text-black"
              />
            </a>
            <IconCheckboxFill
              :class="{
                '!text-black': selectedPhotos.has(photo)
              }"
              class="mt-1 h-6 w-6 cursor-pointer text-white transition-all hover:text-black mr-1"
            />
          </div>
          <div
            :class="{ '!flex': selectedPhotos.has(photo) }"
            class="absolute left-0 hidden w-full to-transparent ease-in-out group-hover:flex bottom-0 bg-gradient-to-t from-gray-600"
          >
            <div class="flex w-full items-center flex-row gap-2 p-1">
              <VAvatar
                v-if="photo.user.profile_image?.medium"
                :src="photo.user.profile_image.medium"
                circle
                size="sm"
              ></VAvatar>
              <div class="flex flex-1 flex-col truncate">
                <a
                  class="truncate text-white text-xs font-medium hover:underline"
                  :href="photo.links.html"
                  target="_blank"
                >
                  {{ photo.user.name }}
                </a>
                <span class="truncate text-xs text-white opacity-80">
                  {{ photo.user.bio }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </VCard>
    </div>
    <div v-if="photos.length > 0" class="flex items-center mt-4 justify-center">
      <VButton :loading="isFetching" type="secondary" @click="page++">
        {{ isFetching ? '加载中...' : '加载更多' }}
      </VButton>
    </div>
  </div>
</template>
<style scoped>
.topics::-webkit-scrollbar-track-piece {
  background-color: #f8f8f8;
  -webkit-border-radius: 2em;
  -moz-border-radius: 2em;
  border-radius: 2em;
}

.topics::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}

.topics::-webkit-scrollbar-thumb {
  background-color: #f2eaea;
  background-clip: padding-box;
  -webkit-border-radius: 2em;
  -moz-border-radius: 2em;
  border-radius: 2em;
}

.topics::-webkit-scrollbar-thumb:hover {
  background-color: #bbb;
}
</style>
