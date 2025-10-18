<template>
  <div class="auth-container">
    <!-- 登录表单 -->
    <div v-if="!isRegistering" class="auth-form">
      <h2>登录</h2>
      <form @submit.prevent="login">
        <input v-model="username" type="text" placeholder="用户名" required />
        <input v-model="password" type="password" placeholder="密码" required />
        <div v-if="config.turnstileEnabled" class="cf-turnstile" ref="loginTurnstile"></div>
        <button type="submit" :disabled="config.turnstileEnabled && !loginTurnstileToken">登录</button>
      </form>
      <p v-if="error" class="error">{{ error }}</p>
      <p class="switch-text">
        没有账号？<button class="switch-btn" @click="switchToRegister">注册</button>
      </p>
    </div>

    <!-- 注册表单 -->
    <div v-if="isRegistering" class="auth-form">
      <h2>注册</h2>
      <form @submit.prevent="register">
        <input v-model="regUsername" type="text" placeholder="用户名" required />
        <input v-model="regPassword" type="password" placeholder="密码" required />
        <div v-if="config.turnstileEnabled" class="cf-turnstile" ref="registerTurnstile"></div>
        <button type="submit" :disabled="config.turnstileEnabled && !registerTurnstileToken">注册</button>
      </form>
      <p v-if="regError" class="error">{{ regError }}</p>
      <p class="switch-text">
        已有账号？<button class="switch-btn" @click="switchToLogin">登录</button>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, nextTick } from 'vue';
import { useRouter } from 'vue-router';
import { useNoteStore } from '../stores/noteStore.js';
import { useCategoryStore } from '../stores/categoryStore.js';
import { useConfigStore } from '../stores/configStore.js';
import { login as apiLogin, register as apiRegister } from '../utils/api.js';

const router = useRouter();
const noteStore = useNoteStore();
const categoryStore = useCategoryStore();
const {config} = useConfigStore();

const username = ref('');
const password = ref('');
const error = ref('');

const isRegistering = ref(false);
const regUsername = ref('');
const regPassword = ref('');
const regError = ref('');

const loginTurnstile = ref(null);
const registerTurnstile = ref(null);
const loginTurnstileToken = ref('');
const registerTurnstileToken = ref('');
let loginWidgetId = null;
let registerWidgetId = null;

onMounted(() => {
  // 由于 app.mount() 在 fetchConfig() 之后执行，
  // 所以在这里 configStore.config 肯定已经有值了。
  if (config.turnstileEnabled) {
    nextTick(() => {
      initializeTurnstile();
    });
  }
});

function initializeTurnstile() {
  if (window.turnstile) {
    renderLoginTurnstile();
  } else {
    // 等待turnstile脚本加载
    const checkTurnstile = () => {
      if (window.turnstile) {
        renderLoginTurnstile();
      } else {
        setTimeout(checkTurnstile, 100);
      }
    };
    checkTurnstile();
  }
}

function renderLoginTurnstile() {
  if (loginTurnstile.value && window.turnstile && loginWidgetId === null) {
    loginTurnstile.value.innerHTML = '';
    loginWidgetId = window.turnstile.render(loginTurnstile.value, {
      sitekey: config.turnstileSiteKey,
      callback: (token) => {
        loginTurnstileToken.value = token;
      },
      'error-callback': () => {
        loginTurnstileToken.value = '';
      },
      'expired-callback': () => {
        loginTurnstileToken.value = '';
      }
    });
  }
}

function renderRegisterTurnstile() {
  nextTick(() => {
    if (registerTurnstile.value && window.turnstile && registerWidgetId === null) {
      // 清除任何现有的turnstile实例
      registerTurnstile.value.innerHTML = '';
      
      registerWidgetId = window.turnstile.render(registerTurnstile.value, {
        sitekey: config.turnstileSiteKey,
        callback: (token) => {
          registerTurnstileToken.value = token;
        },
        'error-callback': () => {
          registerTurnstileToken.value = '';
        },
        'expired-callback': () => {
          registerTurnstileToken.value = '';
        }
      });
    }
  });
}

async function login() {
  if (config.turnstileEnabled && !loginTurnstileToken.value) {
    error.value = '请完成验证';
    return;
  }

  try {
    const { token } = await apiLogin(username.value, password.value, loginTurnstileToken.value);
    localStorage.setItem('token', token);
    
    // 登录成功后初始化stores
    await noteStore.initializeNotes();
    await categoryStore.fetchCategories();
    
    router.push('/');
  } catch (err) {
    error.value = err.message;
    // 重置turnstile
    if (window.turnstile && loginWidgetId !== null) {
      window.turnstile.reset(loginWidgetId);
    }
    loginTurnstileToken.value = '';
  }
}

async function register() {
  if (config.turnstileEnabled && !registerTurnstileToken.value) {
    regError.value = '请完成验证';
    return;
  }

  try {
    await apiRegister(regUsername.value, regPassword.value, registerTurnstileToken.value);
    regError.value = '';
    // 注册成功后自动填充登录表单并切换
    username.value = regUsername.value;
    password.value = regPassword.value;
    switchToLogin();
    // 自动登录
    await login();
  } catch (err) {
    regError.value = err.message;
    // 重置turnstile
    if (window.turnstile && registerWidgetId !== null) {
      window.turnstile.reset(registerWidgetId);
    }
    registerTurnstileToken.value = '';
  }
}

function switchToRegister() {
  isRegistering.value = true;
  error.value = '';
  renderRegisterTurnstile();
}

function switchToLogin() {
  isRegistering.value = false;
  regError.value = '';
  regUsername.value = '';
  regPassword.value = '';
  registerTurnstileToken.value = '';
  if (window.turnstile && registerWidgetId !== null) {
    window.turnstile.remove(registerWidgetId);
    registerWidgetId = null;
  }
  
  // 重新渲染登录turnstile
  nextTick(() => {
    loginWidgetId = null; // 重置ID以允许重新渲染
    renderLoginTurnstile();
  });
}
</script>

<style scoped>
.auth-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #f0f2f5;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  padding: 1rem;
  box-sizing: border-box;
}

.auth-form {
  width: 100%;
  max-width: 400px;
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

h2 {
  color: #333;
  margin-bottom: 2rem;
  text-align: center;
  font-size: 1.8rem;
}

form {
  display: flex;
  flex-direction: column;
  width: 100%;
  max-width: 400px;
  background: #fff;
  padding: 2rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
  box-sizing: border-box;
}

input {
  padding: 1rem 1.2rem;
  margin-bottom: 1.2rem;
  border: 2px solid #e1e5e9;
  border-radius: 8px;
  font-size: 1rem;
  transition: all 0.2s;
  box-sizing: border-box;
  background-color: #fafbfc;
}

input:focus {
  outline: none;
  border-color: #007bff;
  background-color: #fff;
  box-shadow: 0 0 0 3px rgba(0, 123, 255, 0.1);
}

button {
  padding: 1rem 1.2rem;
  border: none;
  border-radius: 8px;
  background-color: #007bff;
  color: white;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  min-height: var(--touch-target-size);
}

button[type="submit"]:hover {
  background-color: #0056b3;
  transform: translateY(-1px);
}

button[type="submit"]:active {
  transform: translateY(0);
}

.switch-text {
  margin-top: 1.5rem;
  color: #666;
  text-align: center;
  line-height: 1.5;
}

.switch-btn {
  background: none;
  border: none;
  color: #007bff;
  cursor: pointer;
  padding: 0.5rem;
  font-size: inherit;
  font-weight: 600;
  border-radius: 4px;
  transition: all 0.2s;
}

.switch-btn:hover {
  text-decoration: underline;
  background-color: rgba(0, 123, 255, 0.1);
}

.error {
  color: #e74c3c;
  margin-top: 1rem;
  padding: 0.75rem;
  background-color: #fdf2f2;
  border: 1px solid #fecaca;
  border-radius: 6px;
  text-align: center;
  font-size: 0.9rem;
}

/* 移除弹窗样式，现在使用页面切换 */

/* 移动端适配 */
@media (max-width: var(--mobile-breakpoint)) {
  .auth-container {
    padding: var(--spacing-xl) var(--spacing-md);
    min-height: 100vh;
    min-height: 100dvh;
  }
  
  h2 {
    font-size: 1.6rem;
    margin-bottom: var(--spacing-lg);
  }
  
  form {
    max-width: 100%;
    padding: var(--spacing-xl) var(--spacing-lg);
    border-radius: var(--border-radius-lg);
    margin: 0 auto;
  }
  
  input {
    padding: 1.2rem 1.4rem;
    font-size: 16px; /* 防止iOS缩放 */
    margin-bottom: var(--spacing-lg);
    border-radius: 10px;
  }
  
  button {
    padding: 1.2rem 1.4rem;
    font-size: 1.1rem;
    border-radius: 10px;
    min-height: 50px;
  }
  
  p {
    font-size: 1rem;
    margin-top: var(--spacing-xl);
  }
  
  .switch-btn {
    padding: var(--spacing-md) var(--spacing-lg);
    font-size: 1rem;
    min-height: var(--touch-target-size);
  }
}

/* 平板端适配 */
@media (min-width: 769px) and (max-width: var(--tablet-breakpoint)) {
  form {
    max-width: 450px;
    padding: 2.5rem;
  }
  
  input {
    padding: 1.1rem 1.3rem;
    font-size: 1.05rem;
  }
  
  button {
    padding: 1.1rem 1.3rem;
    font-size: 1.05rem;
  }
}

/* 横屏模式优化 */
@media (max-width: var(--mobile-breakpoint)) and (orientation: landscape) {
  .auth-container {
    padding: var(--spacing-md);
  }
  
  h2 {
    font-size: 1.4rem;
    margin-bottom: var(--spacing-md);
  }
  
  form {
    padding: var(--spacing-lg);
    max-height: 80vh;
    overflow-y: auto;
  }
  
  input {
    padding: var(--spacing-md) 1.2rem;
    margin-bottom: var(--spacing-md);
  }
  
  button {
    padding: var(--spacing-md) 1.2rem;
  }
}

/* 触摸设备优化 */
@media (hover: none) and (pointer: coarse) {
  button:hover {
    background-color: #007bff;
    transform: none;
  }
  
  button:active {
    background-color: #0056b3;
    transform: scale(0.98);
  }
  
  .switch-btn:hover {
    text-decoration: none;
    background-color: rgba(0, 123, 255, 0.15);
  }
}
</style>
