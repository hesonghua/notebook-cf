import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';
import { getNotes } from '../utils/api.js';
import { useCategoryStore } from './categoryStore.js';
import { inject } from 'vue';
import { Note } from '../models/Note.js';

export const useNoteStore = defineStore('notes', () => {
  // --- State ---
  const notes = ref([]); // 统一的笔记对象数组，包含标题和内容
  const selectedNote = ref(null); // 当前选中的笔记对象
  const searchQuery = ref('');
  const fullTextSearchResults = ref([]); // 全文搜索结果
  const isLoading = ref(false);
  const loadingNoteId = ref(null); // 正在加载的笔记ID
  const tempIdCounter = ref(0); // 用于生成临时ID
  const emitter = inject('emitter'); // 注入事件总线

  // 获取categoryStore实例的函数
  const getCategoryStore = () => useCategoryStore();
  // 获取未分类的笔记标题
  const uncategorizedNoteTitles = computed(() => {
    return notes.value.filter(note => !note.category_id);
  });

  // 按分类分组的笔记标题
  const titlesByCategory = computed(() => {
    const grouped = {};
    notes.value.forEach(note => {
      if (note.category_id) {
        if (!grouped[note.category_id]) {
          grouped[note.category_id] = [];
        }
        grouped[note.category_id].push(note);
      }
    });
    return grouped;
  });

  const searchResults = computed(() => {
    if (!searchQuery.value) {
      return [];
    }
    
    // 如果有全文搜索结果，优先使用全文搜索结果
    if (fullTextSearchResults.value.length > 0) {
      return fullTextSearchResults.value;
    }
    
    // 否则使用本地搜索（仅搜索已加载的笔记）
    const query = searchQuery.value.toLowerCase();
    return notes.value.filter(note => {
      const titleMatch = note.title.toLowerCase().includes(query);
      // 如果内容已加载，也搜索内容
      const contentMatch = note.content && note.content.toLowerCase().includes(query);
      return titleMatch || contentMatch;
    });
  });

  // --- Actions ---
  // 获取笔记标题列表（不包含内容）
  async function fetchNoteTitles(categoryId = null) {
    if (isLoading.value) return;
    isLoading.value = true;
    try {
      const data = await getNotes(categoryId); // 获取所有笔记
      // 创建Note类的实例
      const noteData = data.notes.map(note => new Note({
        ...note,
        content: null, // 初始不加载内容
        dirty: false,
      }));
      
      if (categoryId) {
        // If fetching for a specific category, we need to merge the results
        const otherNotes = notes.value.filter(n => n.category_id !== categoryId);
        notes.value = [...otherNotes, ...noteData];
      } else {
        notes.value = noteData;
      }
      
      notes.value.sort((a, b) => b.id - a.id);
    } catch (error) {
      console.error("Failed to fetch note titles:", error);
    } finally {
      isLoading.value = false;
    }
  }

  async function initializeNotes() {
    // 初始化时加载所有笔记的标题
    await fetchNoteTitles();
    
    // 恢复之前选中的笔记
    const savedId = JSON.parse(localStorage.getItem('selectedId'));
    if (savedId) {
      const note = notes.value.find(n => n.id === savedId);
      if (note) {
        await note.fetchContent();
        selectedNote.value = note;
      }
    }
  }

  async function forceRefreshNotes() {
    notes.value = [];
    await fetchNoteTitles();
  }

  function handleAddNote() {
    tempIdCounter.value -= 1;
    const tempId = tempIdCounter.value;

    const newNote = new Note({
      id: tempId,
      title: 'New Note',
      content: '# New Note',
      category_id: null,
      created_at: new Date().toISOString(),
      dirty: true,
    });

    notes.value.unshift(newNote);
    handleSelectNote(newNote);

    emitter.emit('onAddNote', { id: tempId });
  }

  async function saveNote(noteToSave) {
    const savedNote = await noteToSave.save();

    getCategoryStore().fetchCategories();
  }

  async function handleSelectNote(note) {
    if (loadingNoteId.value || selectedNote.value?.id === note.id) return;

    // 自动保存当前脏笔记
    if (selectedNote.value?.dirty) {
      try {
        await selectedNote.value.save();
      } catch (error) {
        console.error('Failed to save note before switching:', error);
        // 即使保存失败，也继续切换笔记，但记录错误
        // 可以在这里添加用户提示
      }
    }

    loadingNoteId.value = note.id;
    try {
      await note.fetchContent(); // fetchContent内部会检查是否需要加载
      selectedNote.value = note;
    } catch (error) {
      console.error('Failed to load note content for id:', note.id);
      // 可以在这里添加用户提示，例如显示一个错误消息
    } finally {
      loadingNoteId.value = null;
    }
  }

  async function handleDeleteNote(noteToDelete) {
    const noteIndex = notes.value.findIndex(n => n.id === noteToDelete.id);
    if (noteIndex === -1) return;

    notes.value.splice(noteIndex, 1);
    await noteToDelete.delete();
    getCategoryStore().fetchCategories();

    if (selectedNote.value?.id === noteToDelete.id) {
      if (notes.value.length > 0) {
        const nextNote = notes.value[0];
        await nextNote.fetchContent();
        selectedNote.value = nextNote;
      } else {
        selectedNote.value = null;
      }
    }
  }

  async function updateNoteCategory({ noteId, newCategoryId, refreshCategories = false }) {
    const note = notes.value.find(n => n.id === parseInt(noteId));
    if (note) {
      await note.updateCategory(newCategoryId);
      // 只有明确要求时才刷新分类（例如通过 UI 操作时）
      if (refreshCategories) {
        getCategoryStore().fetchCategories();
      }
    }
  }

  watch(selectedNote, (newNote) => {
    const id = newNote ? newNote.id : null;
    localStorage.setItem('selectedId', JSON.stringify(id));
  });

  function updateSelectedNoteContent(newContent) {
    if (selectedNote.value) {
      selectedNote.value.updateContent(newContent);
    }
  }

  function clearData() {
    // 清空所有数据
    notes.value = [];
    selectedNote.value = null;
    searchQuery.value = '';
    isLoading.value = false;
    loadingNoteId.value = null;
    tempIdCounter.value = 0;
    
    // 清除本地存储
    localStorage.removeItem('selectedId');
  }

  // 全文搜索函数 - 调用后端API
  async function fullTextSearch(query) {
    if (!query) {
      fullTextSearchResults.value = [];
      return;
    }
    
    isLoading.value = true;
    try {
      const data = await getNotes(null, query); // 传递搜索参数
      
      // 创建Note类的实例
      const searchedNotes = data.notes.map(note => new Note({
        ...note,
        content: null, // 初始不加载内容
        dirty: false,
      }));
      
      // 将搜索到的笔记合并到全局 notes 中，避免重复
      searchedNotes.forEach(searchedNote => {
        const existingNoteIndex = notes.value.findIndex(n => n.id === searchedNote.id);
        if (existingNoteIndex === -1) {
          // 如果不存在，添加到 notes 数组
          notes.value.push(searchedNote);
        } else {
          // 如果已存在，更新笔记信息（但保留已加载的内容）
          const existingNote = notes.value[existingNoteIndex];
          if (!existingNote.content) {
            // 如果现有笔记没有内容，可以安全替换
            notes.value[existingNoteIndex] = searchedNote;
          }
          // 如果已有内容，保持不变，避免覆盖用户可能正在编辑的内容
        }
      });
      
      // 重新排序 notes 数组
      notes.value.sort((a, b) => b.id - a.id);
      
      // 设置搜索结果
      fullTextSearchResults.value = searchedNotes;
    } catch (error) {
      console.error("全文搜索失败:", error);
      fullTextSearchResults.value = [];
    } finally {
      isLoading.value = false;
    }
  }
  
  // 监听搜索查询变化，清空全文搜索结果
  watch(searchQuery, (newQuery) => {
    if (!newQuery) {
      fullTextSearchResults.value = [];
    }
  });

  return {
    notes,
    searchQuery,
    fullTextSearchResults,
    isLoading,
    loadingNoteId,
    selectedNote,
    uncategorizedNoteTitles,
    titlesByCategory,
    searchResults,
    initializeNotes,
    forceRefreshNotes,
    handleAddNote,
    saveNote,
    handleSelectNote,
    handleDeleteNote,
    updateNoteCategory,
    updateSelectedNoteContent,
    clearData,
    fullTextSearch,
  };
});

