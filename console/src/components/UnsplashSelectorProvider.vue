<script lang="ts" setup>
import { useConfig, type BasicConfig } from '@/composables/use-config'
import { BINDING_LABEL_KEY, PLUGIN_NAME } from '@/constants'
import {
  axiosInstance,
  consoleApiClient,
  coreApiClient,
  type Attachment
} from '@halo-dev/api-client'
import {
  IconCheckboxFill,
  IconExternalLinkLine,
  IconUpload,
  Toast,
  VAvatar,
  VButton,
  VCard,
  VLoading,
  VTag
} from '@halo-dev/components'
import type { AttachmentLike } from '@halo-dev/console-shared'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { cloneDeep, set } from 'lodash-es'
import { createApi } from 'unsplash-js'
import type { Basic as Photo } from 'unsplash-js/dist/methods/photos/types'
import type { Basic as Topic } from 'unsplash-js/dist/methods/topics/types'
import { computed, ref, watch } from 'vue'

const queryClient = useQueryClient()

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
const finalSelectedUrls = ref<Set<AttachmentLike>>(new Set())
const photos = ref<Photo[]>([])
const page = ref(1)
const keyword = ref('')
const pluginDetailModal = ref(false)

const { basicConfig, isDownloadMode, accessKey, isFetching: isConfigFetching } = useConfig()

const cleanupAccessKeyWatcher = watch(
  [() => accessKey.value, () => isConfigFetching.value],
  () => {
    if (!isConfigFetching.value && !accessKey.value) {
      Toast.error('未正确配置 Unsplash Access Key')
      pluginDetailModal.value = true
      cleanupAccessKeyWatcher()
    }
  },
  {
    immediate: true
  }
)

const { data: topics } = useQuery<Topic[] | undefined>({
  queryKey: ['plugin:unsplash:topics', accessKey],
  queryFn: async () => {
    if (!accessKey.value) {
      return []
    }

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
  queryKey: ['plugin:unsplash:photos', keyword, selectedTopic, page, accessKey],
  queryFn: async () => {
    if (!accessKey.value) {
      return []
    }

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

const { data: boundAttachments, refetch: refetchAttachments } = useQuery({
  queryKey: ['plugin:unsplash:bound-attachments', photos],
  queryFn: async () => {
    const ids = photos.value.map((photo) => photo.id)

    const { data } = await coreApiClient.storage.attachment.listAttachment({
      labelSelector: [`unsplash.halo.run/id=(${ids.join(',')})`]
    })

    return data.items
  }
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
  if (downloading.value) {
    return true
  }
  if (props.max !== undefined && props.max <= selectedPhotos.value.size && !isChecked(photo)) {
    return true
  }
  return false
}

watch(
  () => finalSelectedUrls.value,
  (value) => {
    emit('update:selected', Array.from(value))
  },
  {
    deep: true
  }
)

watch(
  () => selectedPhotos.value,
  (value) => {
    console.log(value)
    finalSelectedUrls.value.clear()

    if (isDownloadMode.value) {
      for (const photo of value) {
        const bindAttachment = boundAttachments.value?.find(
          (item) => item.metadata.labels?.[BINDING_LABEL_KEY] === photo.id
        )
        if (bindAttachment) {
          finalSelectedUrls.value.add({
            url: bindAttachment.status?.permalink || '',
            type: bindAttachment.spec.displayName || ''
          })
        }
      }
      return
    }
    for (const photo of value) {
      finalSelectedUrls.value.add({
        url: photo.urls.raw,
        type: photo.alt_description as string
      })
    }
  },
  {
    deep: true
  }
)

// Download photo to attachments
const downloading = ref(false)

async function onDownloadModeChange(value: boolean) {
  if (!accessKey.value) {
    return
  }

  const basicConfigToUpdate = cloneDeep(basicConfig.value)
  set<BasicConfig>(basicConfigToUpdate || {}, 'downloadMode.enable', value)

  const { data: configMap } = await consoleApiClient.plugin.plugin.fetchPluginConfig({
    name: PLUGIN_NAME
  })

  configMap.data = {
    ...configMap.data,
    basic: JSON.stringify(basicConfigToUpdate)
  }

  const { data: updatedConfigMap } = await consoleApiClient.plugin.plugin.updatePluginConfig({
    name: PLUGIN_NAME,
    configMap: configMap
  })

  const updatedBasicConfig = JSON.parse(updatedConfigMap.data?.basic || '{}') as BasicConfig

  if (updatedBasicConfig.downloadMode?.enable && !updatedBasicConfig.downloadMode.policyName) {
    Toast.warning('开启转存模式需要配置附件存储策略')
    pluginDetailModal.value = true
  }

  queryClient.invalidateQueries({ queryKey: ['plugin:unsplash:basic-config'] })
}

const { mutateAsync: bindingAttachmentMutate } = useMutation({
  mutationKey: ['plugin:unsplash:binding-attachment'],
  mutationFn: async ({ attachment, photo }: { attachment: Attachment; photo: Photo }) => {
    const labels = set<{
      [key: string]: string
    }>(attachment.metadata.labels || {}, [BINDING_LABEL_KEY], photo.id)

    return await coreApiClient.storage.attachment.patchAttachment(
      {
        name: attachment.metadata.name,
        jsonPatchInner: [
          {
            op: 'add',
            path: '/metadata/labels',
            value: labels
          }
        ]
      },
      {
        mute: true
      }
    )
  },
  retry: 3
})

async function handleDownloadImage() {
  downloading.value = true

  let hasError = false

  for (const photo of Array.from(selectedPhotos.value)) {
    if (isBound(photo)) {
      continue
    }

    try {
      await downloadSinglePhoto(photo)
    } catch (error) {
      hasError = true
      Toast.error(`图片 ${photo.alt_description} 下载失败`)
    }
  }

  if (hasError) {
    Toast.warning(`部分图片转存失败`)
  } else {
    Toast.success('所有图片转存完成')
  }

  downloading.value = false
}

async function downloadSinglePhoto(photo: Photo) {
  try {
    const { policyName, groupName, urlType } = basicConfig.value?.downloadMode || {}

    const imageResponse = await fetch(photo.urls[urlType || 'raw'])

    const imageBlob = await imageResponse.blob()

    const { data: newAttachment } = await consoleApiClient.storage.attachment.uploadAttachment({
      file: new File(
        [imageBlob],
        `${photo.alt_description?.toLowerCase().replace(/\s+/g, '-') || photo.id}.jpg`,
        { type: imageBlob.type }
      ),
      policyName: policyName as string,
      groupName: groupName
    })

    await bindingAttachmentMutate({
      attachment: newAttachment,
      photo
    })

    const permalink = await getAttachmentPermalink(newAttachment.metadata.name)

    finalSelectedUrls.value.add({
      url: permalink || '',
      type: newAttachment.spec.displayName || ''
    })

    await refetchAttachments()
  } catch (error) {
    throw new Error(`上传失败: ${(error as Error).message}`)
  }
}

async function getAttachmentPermalink(name: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const fetchPermalink = () => {
      coreApiClient.storage.attachment
        .getAttachment({
          name: name
        })
        .then((response) => {
          const permalink = response.data.status?.permalink
          if (permalink) {
            resolve(permalink)
          } else {
            setTimeout(fetchPermalink, 1000)
          }
        })
        .catch((error) => reject(error))
    }
    fetchPermalink()
  })
}

function isBound(photo: Photo) {
  return boundAttachments.value?.some(
    (item) => item.metadata.labels?.[BINDING_LABEL_KEY] === photo.id
  )
}

function onPluginDetailModalClose() {
  pluginDetailModal.value = false
  queryClient.invalidateQueries({ queryKey: ['plugin:unsplash:basic-config'] })
}
</script>
<template>
  <div class="flex items-center justify-between">
    <SearchInput v-model="keyword" class="min-w-0 flex-1 shrink" />

    <div class="flex flex-none items-center gap-2">
      <VButton
        v-if="isDownloadMode && selectedPhotos.size"
        :loading="downloading"
        size="sm"
        type="secondary"
        @click="handleDownloadImage"
      >
        <template #icon>
          <IconUpload class="size-full" />
        </template>
        转存已选择的图片
      </VButton>
      <FormKit
        v-tooltip="'勾选此选项后，会先上传到服务器，然后获得服务器的图片地址'"
        type="checkbox"
        label="转存模式"
        :model-value="basicConfig?.downloadMode?.enable"
        :classes="{ outer: '!p-0 flex-none', wrapper: 'unsplash-checkbox-wrapper' }"
        @input="onDownloadModeChange"
      />
    </div>
  </div>
  <div
    v-if="!keyword"
    class="topics mt-2 flex gap-x-2 gap-y-3 overflow-x-scroll overflow-y-hidden scroll-smooth pb-1"
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
    <div class="grid grid-cols-3 mt-2 gap-x-2 gap-y-3 md:grid-cols-6 sm:grid-cols-3" role="list">
      <VCard
        v-for="(photo, index) in photos"
        :key="index"
        :body-class="['!p-0', 'select-none']"
        :class="{
          'ring-1 ring-black': isChecked(photo),
          'pointer-events-none !cursor-not-allowed opacity-50': isDisabled(photo)
        }"
        class="hover:shadow"
        @click.stop="handleSelect(photo)"
      >
        <div class="group relative bg-white">
          <div class="block aspect-10/8 h-full w-full cursor-pointer overflow-hidden bg-gray-100">
            <img
              class="pointer-events-none size-full object-cover group-hover:opacity-75"
              :src="photo.urls.thumb"
            />
          </div>
          <div
            class="absolute left-0 top-0 h-1/3 w-full ease-in-out group-hover:from-gray-300 group-hover:to-transparent group-hover:bg-gradient-to-b"
            :class="{ 'from-gray-300 to-transparent bg-gradient-to-b': selectedPhotos.has(photo) }"
          >
            <div class="flex items-center justify-between p-1">
              <a :href="photo.links.html" target="_blank">
                <IconExternalLinkLine
                  class="size-6 cursor-pointer text-white opacity-0 transition-all hover:text-black group-hover:opacity-100"
                />
              </a>

              <div class="flex items-center gap-1.5">
                <IconCheckboxFill
                  :class="{
                    '!text-black !opacity-100': selectedPhotos.has(photo)
                  }"
                  class="size-6 cursor-pointer text-white opacity-0 transition-all hover:text-black group-hover:opacity-100"
                />

                <VTag v-if="isBound(photo)" theme="primary">已转存</VTag>
              </div>
            </div>
          </div>
          <div
            :class="{ '!flex': selectedPhotos.has(photo) }"
            class="absolute bottom-0 left-0 hidden w-full from-gray-600 to-transparent bg-gradient-to-t ease-in-out group-hover:flex"
          >
            <div class="w-full flex flex-row items-center gap-2 p-1">
              <VAvatar
                v-if="photo.user.profile_image?.medium"
                :src="photo.user.profile_image.medium"
                circle
                size="sm"
              ></VAvatar>
              <div class="flex flex-1 flex-col truncate">
                <a
                  class="truncate text-xs text-white font-medium hover:underline"
                  :href="photo.user.links.html"
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
    <div v-if="photos.length > 0" class="mt-4 flex items-center justify-center">
      <VButton :loading="isFetching" type="secondary" @click="page++">
        {{ isFetching ? '加载中...' : '加载更多' }}
      </VButton>
    </div>

    <PluginDetailModal
      v-if="pluginDetailModal"
      name="PluginUnsplash"
      @close="onPluginDetailModalClose"
    />
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

<style>
.unsplash-checkbox-wrapper {
  margin: 0 !important;
}
</style>
