import { defineStore } from 'pinia';
import { ref, watch } from 'vue';

export const useThemeStore = defineStore('theme', () => {
  const isDarkMode = ref(localStorage.getItem('darkMode') === 'true');
  
  function toggleDarkMode() {
    isDarkMode.value = !isDarkMode.value;
    localStorage.setItem('darkMode', String(isDarkMode.value));
    updateTheme();
  }
  
  function updateTheme() {
    // 使用 requestAnimationFrame 确保 DOM 更新
    requestAnimationFrame(() => {
      if (isDarkMode.value) {
        document.documentElement.classList.add('dark-mode');
      } else {
        document.documentElement.classList.remove('dark-mode');
      }
    });
  }
  
  function setDarkMode(enabled) {
    isDarkMode.value = enabled;
    localStorage.setItem('darkMode', String(enabled));
    updateTheme();
  }
  
  // 监听 isDarkMode 变化，自动更新主题
  watch(isDarkMode, () => {
    updateTheme();
  }, { immediate: true });
  
  return {
    isDarkMode,
    toggleDarkMode,
    setDarkMode,
    updateTheme
  };
});