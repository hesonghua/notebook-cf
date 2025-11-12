<script setup>
import { onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useNoteStore } from './stores/noteStore.js';
import { useCategoryStore } from './stores/categoryStore.js';
import { useTagStore } from './stores/tagStore.js';


const router = useRouter();
const noteStore = useNoteStore();
const categoryStore = useCategoryStore();
const tagStore = useTagStore();

onMounted(() => {
  // 只在用户已登录时初始化
  const token = localStorage.getItem('token');
  if (token && router.currentRoute.value.path !== '/login') {
    // 验证 token 有效性
    validateTokenAndInitialize(token);
  }
});

// 验证 token 并初始化数据
async function validateTokenAndInitialize(token) {
  try {
    // 尝试获取配置来验证 token 是否有效
    await fetch('/api/config', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Token 有效，初始化数据
    noteStore.initializeNotes();
    categoryStore.fetchCategories();
    tagStore.fetchTags();
  } catch (error) {
    console.error('Token validation failed:', error);
    // Token 无效，清除并重定向到登录页
    localStorage.removeItem('token');
    router.push('/login');
  }
}

// 监听路由变化，当用户登录后初始化
watch(() => router.currentRoute.value.path, (newPath) => {
  if (newPath === '/' && localStorage.getItem('token')) {
    noteStore.initializeNotes();
    categoryStore.fetchCategories();
    tagStore.fetchTags();
  }
});
</script>

<template>
  <div id="app-container">
    <router-view />
    <div v-if="noteStore.loadingNoteId" class="loading-overlay">
      <div class="loader"></div>
    </div>
  </div>
</template>

<style>
#app-container {
  position: relative;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.loading-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(255, 255, 255, 0.8);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 9999;
  backdrop-filter: blur(2px);
}

.loader {
  border: 4px solid #f3f3f3;
  border-top: 4px solid #3498db;
  border-radius: 50%;
  width: 40px;
  height: 40px;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* 移动端优化 */
@media (max-width: var(--mobile-breakpoint)) {
  #app-container {
    height: 100vh;
    height: 100dvh; /* 动态视口高度，避免移动端地址栏影响 */
    width: 100vw;
    overflow-x: hidden;
  }
  
  .loader {
    width: 32px;
    height: 32px;
    border-width: 3px;
  }
}

/* 横屏模式优化 */
@media (max-width: var(--mobile-breakpoint)) and (orientation: landscape) {
  #app-container {
    height: 100vh;
  }
}
</style>
