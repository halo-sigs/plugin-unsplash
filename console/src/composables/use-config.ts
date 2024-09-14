import { consoleApiClient } from '@halo-dev/api-client'
import { useQuery } from '@tanstack/vue-query'
import { computed } from 'vue'

export interface BasicConfig {
  accessKey?: string
  downloadMode?: {
    enable?: boolean
    policyName?: string
    groupName?: string
    urlType: 'raw' | 'full' | 'regular' | 'small'
  }
}

export function useConfig() {
  const {
    data: basicConfig,
    isLoading,
    isFetching
  } = useQuery({
    queryKey: ['plugin:unsplash:basic-config'],
    queryFn: async () => {
      const { data: configMap } = await consoleApiClient.plugin.plugin.fetchPluginConfig({
        name: 'PluginUnsplash'
      })

      return JSON.parse(configMap.data?.basic || '{}') as BasicConfig
    }
  })

  const accessKey = computed(() => basicConfig.value?.accessKey)
  const isDownloadMode = computed(() => {
    return basicConfig.value?.downloadMode?.enable && basicConfig.value.downloadMode.policyName
  })

  return { basicConfig, accessKey, isDownloadMode, isLoading, isFetching }
}
