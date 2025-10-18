import { defineStore } from 'pinia';
import { ref } from 'vue';
import { getConfig } from '@/utils/api';

export const useConfigStore = defineStore('config', () => {
  const config = ref({});

  async function fetchConfig() {
    const response = await getConfig();
    config.value = response;
  }

  return { config, fetchConfig };
});