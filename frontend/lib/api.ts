// API клиент для работы с бэкендом

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api/v1';

// Типы данных
export interface User {
  id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  is_active: boolean;
  is_verified: boolean;
}

export interface Analysis {
  id: number;
  user_id: number;
  title: string;
  lab_name?: string;
  analysis_date?: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  created_at: string;
  biomarkers?: Biomarker[];
}

export interface Biomarker {
  id: number;
  name: string;
  value: number;
  unit: string;
  reference_min?: number;
  reference_max?: number;
  status: 'normal' | 'low' | 'high' | 'critical';
}

export interface MedicalDocument {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  category: 'analysis' | 'consultation' | 'examination' | 'other';
  file_name: string;
  file_type: string;
  file_size: number;
  document_date?: string;
  created_at: string;
}

export interface Reminder {
  id: number;
  user_id: number;
  title: string;
  description?: string;
  reminder_date: string;
  reminder_type: 'analysis' | 'checkup' | 'medication' | 'other';
  is_completed: boolean;
}

export interface Recommendation {
  id: number;
  analysis_id: number;
  recommendation_type: 'ai' | 'doctor';
  content: string;
  products?: Product[];
}

export interface Product {
  id: number;
  name: string;
  description?: string;
  price?: number;
  image_url?: string;
}

// Хранение токена
let authToken: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
}

export function getAuthToken(): string | null {
  if (authToken) return authToken;
  if (typeof window !== 'undefined') {
    authToken = localStorage.getItem('auth_token');
  }
  return authToken;
}

// Базовый fetch с авторизацией
async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getAuthToken();
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });
  
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Ошибка сервера' }));
    throw new Error(error.detail || `HTTP ${response.status}`);
  }
  
  if (response.status === 204) {
    return {} as T;
  }
  
  return response.json();
}

// API для авторизации
export const authApi = {
  async login(email: string, password: string): Promise<{ access_token: string; token_type: string }> {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);
    
    const response = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка авторизации' }));
      throw new Error(error.detail);
    }
    
    const data = await response.json();
    setAuthToken(data.access_token);
    return data;
  },
  
  async register(email: string, password: string): Promise<User> {
    return apiFetch<User>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  },
  
  logout() {
    setAuthToken(null);
  },
};

// API для пользователя
export const userApi = {
  async getMe(): Promise<User> {
    return apiFetch<User>('/users/me');
  },
  
  async updateProfile(data: Partial<User>): Promise<User> {
    return apiFetch<User>('/users/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// API для анализов
export const analysesApi = {
  async getAll(): Promise<Analysis[]> {
    return apiFetch<Analysis[]>('/analyses');
  },
  
  async getById(id: number): Promise<Analysis> {
    return apiFetch<Analysis>(`/analyses/${id}`);
  },
  
  async upload(file: File, title?: string, labName?: string): Promise<Analysis> {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    if (title) formData.append('title', title);
    if (labName) formData.append('lab_name', labName);
    
    const response = await fetch(`${API_BASE_URL}/analyses/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка загрузки' }));
      throw new Error(error.detail);
    }
    
    return response.json();
  },
  
  async delete(id: number): Promise<void> {
    return apiFetch(`/analyses/${id}`, { method: 'DELETE' });
  },
};

// API для медкарты
export const medcardApi = {
  async getAll(category?: string): Promise<MedicalDocument[]> {
    const query = category ? `?category=${category}` : '';
    return apiFetch<MedicalDocument[]>(`/medcard${query}`);
  },
  
  async getById(id: number): Promise<MedicalDocument> {
    return apiFetch<MedicalDocument>(`/medcard/${id}`);
  },
  
  async upload(file: File, title: string, category: string, description?: string, documentDate?: string): Promise<MedicalDocument> {
    const token = getAuthToken();
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('category', category);
    if (description) formData.append('description', description);
    if (documentDate) formData.append('document_date', documentDate);
    
    const response = await fetch(`${API_BASE_URL}/medcard/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ detail: 'Ошибка загрузки' }));
      throw new Error(error.detail);
    }
    
    return response.json();
  },
  
  async update(id: number, data: Partial<MedicalDocument>): Promise<MedicalDocument> {
    return apiFetch<MedicalDocument>(`/medcard/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  async delete(id: number): Promise<void> {
    return apiFetch(`/medcard/${id}`, { method: 'DELETE' });
  },
  
  getDownloadUrl(id: number): string {
    return `${API_BASE_URL}/medcard/${id}/download`;
  },
};

// API для календаря/напоминаний
export const calendarApi = {
  async getAll(): Promise<Reminder[]> {
    return apiFetch<Reminder[]>('/calendar/reminders');
  },
  
  async create(data: Omit<Reminder, 'id' | 'user_id' | 'is_completed'>): Promise<Reminder> {
    return apiFetch<Reminder>('/calendar/reminders', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async update(id: number, data: Partial<Reminder>): Promise<Reminder> {
    return apiFetch<Reminder>(`/calendar/reminders/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  async delete(id: number): Promise<void> {
    return apiFetch(`/calendar/reminders/${id}`, { method: 'DELETE' });
  },
  
  async markCompleted(id: number): Promise<Reminder> {
    return apiFetch<Reminder>(`/calendar/reminders/${id}/complete`, {
      method: 'POST',
    });
  },
};

// API для рекомендаций
export const recommendationsApi = {
  async getForAnalysis(analysisId: number): Promise<Recommendation[]> {
    return apiFetch<Recommendation[]>(`/recommendations/analysis/${analysisId}`);
  },
  
  async getLatest(): Promise<Recommendation[]> {
    return apiFetch<Recommendation[]>('/recommendations/latest');
  },
};

// API для каталога товаров
export const productsApi = {
  async getAll(category?: string): Promise<Product[]> {
    const query = category ? `?category=${category}` : '';
    return apiFetch<Product[]>(`/products${query}`);
  },
  
  async getById(id: number): Promise<Product> {
    return apiFetch<Product>(`/products/${id}`);
  },
};



