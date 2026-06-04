import api from '@/lib/axios'

export interface ConfigRow {
  config_key: string
  config_value: string
  description: string
  updated_at: string
}

export const getConfig = () =>
  api.get<{ data: ConfigRow[] }>('/api/config')

export const updateConfig = (configKey: string, configValue: string) =>
  api.put<ConfigRow>(`/api/config/${configKey}`, { config_value: configValue })
