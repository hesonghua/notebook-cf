async function fetchWithAuth(url, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = localStorage.getItem('token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, { ...options, headers });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('token');
    // Use a full page reload to redirect to login, which will clear all app state.
    window.location.href = '/login';
    // Throw an error to stop further execution in the calling function.
    throw new Error('Session expired or invalid.');
  }

  return response;
}

export async function getConfig() {
  const response = await fetchWithAuth('/api/config');
  if (!response.ok) {
    throw new Error('Failed to fetch config');
  }
  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'Failed to fetch config');
  return result.data;
}

export async function login(username, password, turnstileToken) {
  const response = await fetchWithAuth('/api/login', {
    method: 'POST',
    body: JSON.stringify({ username, password, turnstileToken }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message);
  }
  return response.json();
}

export async function register(username, password, turnstileToken) {
  const response = await fetchWithAuth('/api/register', {
    method: 'POST',
    body: JSON.stringify({ username, password, turnstileToken }),
  });
  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message);
  }
  return response.json();
}

// --- Categories API ---

export async function getCategories() {
  const response = await fetchWithAuth('/api/categories');
  if (!response.ok) throw new Error('Failed to fetch categories');
  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'Failed to fetch categories');
  return result.data.categories;
}

export async function addCategory(category) {
  const response = await fetchWithAuth('/api/categories', {
    method: 'POST',
    body: JSON.stringify(category),
  });
  if (!response.ok) throw new Error('Failed to add category');
  return response.json();
}

export async function updateCategory(category) {
  const response = await fetchWithAuth(`/api/categories`, {
    method: 'PUT',
    body: JSON.stringify(category),
  });
  if (!response.ok) throw new Error('Failed to update category');
  return response.json();
}

export async function deleteCategory(id) {
  const response = await fetchWithAuth(`/api/categories`, {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error('Failed to delete category');
}

// --- Notes API ---

export async function getNotes(categoryId, searchQuery) {
  let url = '/api/notes';
  const params = new URLSearchParams();
  
  if (categoryId) {
    params.append('categoryId', categoryId);
  }
  
  if (searchQuery) {
    params.append('search', searchQuery);
  }
  
  if (params.toString()) {
    url += `?${params.toString()}`;
  }
  
  const response = await fetchWithAuth(url);
  if (!response.ok) throw new Error('Failed to fetch notes');
  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'Failed to fetch notes');
  return result.data;
}

export async function getNote(id) {
  const response = await fetchWithAuth(`/api/notes?id=${id}`);
  if (!response.ok) throw new Error('Failed to fetch note');
  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'Failed to fetch note');
  return result.data;
}

export async function addNote(note) {
  const response = await fetchWithAuth('/api/notes', {
    method: 'POST',
    body: JSON.stringify({
      title: note.title,
      content: note.content,
      favorite: note.favorite,
      category_id: note.category_id,
    }),
  });
  if (!response.ok) throw new Error('Failed to add note');
  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'Failed to add note');
  return result.data;
}

export async function updateNote(note) {
  const response = await fetchWithAuth(`/api/notes`, {
    method: 'PUT',
    body: JSON.stringify({
      title: note.title,
      content: note.content,
      favorite: note.favorite,
      category_id: note.category_id,
      id: note.id,
    }),
  });
  if (!response.ok) throw new Error('Failed to update note');
  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'Failed to update note');
  return result.data;
}

export async function deleteNote(id) {
  const response = await fetchWithAuth(`/api/notes`, {
    method: 'DELETE',
    body: JSON.stringify({ id }),
  });
  if (!response.ok) throw new Error('Failed to delete note');
  const result = await response.json();
  if (!result.success) throw new Error(result.message || 'Failed to delete note');
}

// --- Image Upload API ---

export async function uploadImage(file) {
  const formData = new FormData();
  formData.append('image', file);

  const token = localStorage.getItem('token');
  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch('/api/upload-image', {
    method: 'POST',
    headers,
    body: formData,
  });

  if (response.status === 401 || response.status === 403) {
    localStorage.removeItem('token');
    window.location.href = '/login';
    throw new Error('Session expired or invalid.');
  }

  if (!response.ok) {
    const data = await response.json();
    throw new Error(data.message || 'Failed to upload image');
  }

  return response.json();
}
