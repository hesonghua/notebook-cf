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
    const query = searchQuery.value.toLowerCase();
    return notes.value.filter(note =>
      note.title.toLowerCase().includes(query)
    );
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
      favorite: false,
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
      await selectedNote.value.save();
    }

    loadingNoteId.value = note.id;
    try {
      await note.fetchContent(); // fetchContent内部会检查是否需要加载
      selectedNote.value = note;
    } catch (error) {
      console.error('Failed to load note content for id:', note.id);
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

  async function updateNoteCategory({ noteId, newCategoryId }) {
    const note = notes.value.find(n => n.id === parseInt(noteId));
    if (note) {
      await note.updateCategory(newCategoryId);
      getCategoryStore().fetchCategories();
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

  return {
    searchQuery,
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
  };
});
