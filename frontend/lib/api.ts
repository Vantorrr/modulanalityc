// API клиент v7 - HYBRID APPROACH
// Client: Use local proxy /api/v1
// Server: Use direct HTTPS URL

const getApiUrl = () => {
  // Client side - use proxy to avoid CORS/Mixed Content
  if (typeof window !== 'undefined') {
    return '/api/v1';
  }
  
  // Server side (SSR) - use direct HTTPS connection
  // We can't use relative URL on server side
  return 'https://modulanalityc-production.up.railway.app/api/v1';
};

const API_BASE_URL = getApiUrl();

// Export for cache busting
export const API_VERSION = 'v10-production';

// Debug log
if (typeof window !== 'undefined') {
  console.log('[API v7]', API_BASE_URL);
}

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
  scheduled_date: string;  // Backend field name
  scheduled_time?: string;
  reminder_type: 'analysis' | 'checkup' | 'medication' | 'custom';
  frequency?: 'once' | 'daily' | 'weekly' | 'monthly';
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
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
}

export interface PatientProfile {
  id: number;
  user_id: number;
  body_parameters?: Record<string, any>;
  gender_health?: Record<string, any>;
  medical_history?: any[];
  allergies?: any[];
  chronic_diseases?: any[];
  hereditary_diseases?: any[];
  lifestyle?: Record<string, any>;
  additional_info?: Record<string, any>;
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
  const url = `${API_BASE_URL}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  console.log(`[API Request] ${options.method || 'GET'} ${url}`);
  
  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });
    
    if (!response.ok) {
      console.error(`[API Error] ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.error(`[API Error Body]`, errorText);
      try {
        const error = JSON.parse(errorText);
        throw new Error(error.detail || `HTTP ${response.status}`);
      } catch (e) {
        throw new Error(errorText || `HTTP ${response.status}`);
      }
    }
    
    if (response.status === 204) {
      return {} as T;
    }
    
    const data = await response.json();
    return data;
  } catch (err) {
    console.error(`[API Fetch Failed]`, err);
    throw err;
  }
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
  
  async logout() {
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
    // Backend returns paginated response
    const response = await apiFetch<{ items: Analysis[], total: number }>('/analyses');
    return response.items || [];
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
    
    // Use direct backend URL for file uploads (proxy might have issues with multipart)
    const uploadUrl = 'https://modulanalityc-production.up.railway.app/api/v1/analyses/upload';
    
    console.log('[API Upload]', uploadUrl, file.name);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API Upload Error]', errorText);
      const error = JSON.parse(errorText).catch?.(() => ({ detail: 'Ошибка загрузки' })) || { detail: errorText };
      throw new Error(error.detail || 'Ошибка загрузки');
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
    // Backend returns paginated response
    const response = await apiFetch<{ items: MedicalDocument[], total: number }>(`/medcard${query}`);
    return response.items || [];
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
    
    // Use direct backend URL for file uploads
    const uploadUrl = 'https://modulanalityc-production.up.railway.app/api/v1/medcard/upload';
    
    console.log('[API Medcard Upload]', uploadUrl, file.name);
    
    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[API Medcard Upload Error]', errorText);
      throw new Error('Ошибка загрузки документа');
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
    const response = await apiFetch<{ items: Reminder[], total: number }>('/calendar/reminders');
    return response.items || [];
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

// API для профиля пациента
export const profileApi = {
  async getMyProfile(): Promise<PatientProfile> {
    return apiFetch<PatientProfile>('/profile');
  },
  
  async update(data: Partial<PatientProfile>): Promise<PatientProfile> {
    return apiFetch<PatientProfile>('/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
};

// Типы для таблицы анализов
export interface BiomarkerListItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  last_value?: number;
  last_status?: string;
  last_measured_at?: string;
  last_ref_min?: number;
  last_ref_max?: number;
  total_measurements: number;
  first_measured_at?: string;
}

export interface BiomarkerHistoryItem {
  id: number;
  value: number;
  unit: string;
  status: string;
  ref_min?: number;
  ref_max?: number;
  measured_at?: string;
  analysis_id?: number;
  analysis_title?: string;
  created_at: string;
}

export interface BiomarkerDetail {
  code: string;
  name: string;
  category: string;
  description?: string;
  unit: string;
  history: BiomarkerHistoryItem[];
  total_measurements: number;
  min_value?: number;
  max_value?: number;
  avg_value?: number;
  first_measured_at?: string;
  last_measured_at?: string;
}

export interface BiomarkerValueCreate {
  value: number;
  unit: string;
  measured_at: string; // YYYY-MM-DD
  ref_min?: number;
  ref_max?: number;
  lab_name?: string; // Название лаборатории
}

// API для таблицы анализов (биомаркеры)
export const biomarkersApi = {
  async getAll(category?: string): Promise<{ items: BiomarkerListItem[], total: number }> {
    const query = category ? `?category=${category}` : '';
    return apiFetch(`/biomarkers${query}`);
  },
  
  async getDetail(code: string): Promise<BiomarkerDetail> {
    return apiFetch(`/biomarkers/${code}`);
  },
  
  async addValue(code: string, data: BiomarkerValueCreate): Promise<any> {
    return apiFetch(`/biomarkers/${code}/values`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },
  
  async updateValue(valueId: number, data: Partial<BiomarkerValueCreate>): Promise<any> {
    return apiFetch(`/biomarkers/values/${valueId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },
  
  async deleteValue(valueId: number): Promise<void> {
    return apiFetch(`/biomarkers/values/${valueId}`, {
      method: 'DELETE',
    });
  },
};
