"use client";

import { useState, useEffect, useRef } from "react";
import {
  HomeIcon, ClipboardIcon, FolderIcon, CalendarIcon, UserIcon,
  BellIcon, UploadIcon, ActivityIcon, DropletIcon, AlertCircleIcon,
  ChevronRightIcon, ChevronLeftIcon, SearchIcon,
  FileTextIcon, ImageIcon, ArchiveIcon, BarChartIcon, ShieldIcon,
  SparklesIcon, LogOutIcon, HistoryIcon, LoaderIcon, PlusIcon
} from "@/components/Icons";
import {
  analysesApi, medcardApi, calendarApi,
  type Analysis, type MedicalDocument, type Reminder
} from "@/lib/api";

// Модуль встраивается в основное приложение заказчика
// Авторизация происходит на стороне основного приложения
// Пользователь уже залогинен

export default function Home() {
  const [activeTab, setActiveTab] = useState("home");

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-md mx-auto bg-white min-h-screen flex flex-col shadow-xl">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center text-white">
                <ActivityIcon size={22} />
              </div>
              <div>
                <h1 className="text-base font-bold text-gray-900">Анализы</h1>
                <p className="text-xs text-emerald-600 font-semibold">Health Tracker</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center relative text-gray-600 hover:bg-gray-200 transition-colors">
                <BellIcon size={18} />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto">
          {activeTab === "home" && <HomePage />}
          {activeTab === "analyses" && <AnalysesPage />}
          {activeTab === "medcard" && <MedcardPage />}
          {activeTab === "calendar" && <CalendarPage />}
          {activeTab === "profile" && <ProfilePage />}
        </main>

        {/* Bottom Navigation */}
        <nav className="bg-white border-t border-gray-200 px-2 py-2">
          <div className="flex items-center justify-around">
            {[
              { id: "home", label: "Главная", Icon: HomeIcon },
              { id: "analyses", label: "Анализы", Icon: ClipboardIcon },
              { id: "medcard", label: "Медкарта", Icon: FolderIcon },
              { id: "calendar", label: "Календарь", Icon: CalendarIcon },
              { id: "profile", label: "Профиль", Icon: UserIcon },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex flex-col items-center gap-1 py-1 px-3"
              >
                <tab.Icon
                  size={22}
                  className={activeTab === tab.id ? "text-emerald-600" : "text-gray-400"}
                />
                <span className={`text-[10px] font-semibold ${activeTab === tab.id ? "text-emerald-600" : "text-gray-400"}`}>
                  {tab.label}
                </span>
              </button>
            ))}
          </div>
        </nav>
      </div>
    </div>
  );
}

// Главная страница
function HomePage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    analysesApi.getAll()
      .then(setAnalyses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalAnalyses = analyses.length || 12;
  const outOfRangeCount = analyses.reduce((acc, a) => 
    acc + (a.biomarkers?.filter(b => b.status !== 'normal').length || 0), 0
  ) || 3;

  return (
    <div className="px-4 py-5 space-y-5">
      <div>
        <p className="text-sm text-gray-500 mb-1">Добрый день,</p>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Александр 👋</h1>
        
        <div className="bg-emerald-500 rounded-2xl p-5 text-white">
          <p className="text-emerald-100 text-sm mb-1">Индекс здоровья</p>
          <div className="flex items-baseline gap-2 mb-4">
            <span className="text-3xl font-bold">87</span>
            <span className="text-emerald-100 text-sm">/ 100</span>
          </div>
          <div className="flex justify-between text-xs text-emerald-100 mb-2">
            <span>Отлично</span>
            <span>+2.4% за неделю</span>
          </div>
          <div className="h-2 bg-white/20 rounded-full">
            <div className="h-full w-[87%] bg-white rounded-full"></div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-500 flex items-center justify-center mb-2">
            <DropletIcon size={22} />
          </div>
          <div className="text-2xl font-bold text-gray-900">{totalAnalyses}</div>
          <div className="text-xs text-gray-500 mt-1">Загружено анализов</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200">
          <div className="w-10 h-10 rounded-lg bg-rose-50 text-rose-500 flex items-center justify-center mb-2">
            <AlertCircleIcon size={22} />
          </div>
          <div className="text-2xl font-bold text-gray-900">{outOfRangeCount}</div>
          <div className="text-xs text-gray-500 mt-1">Вне нормы</div>
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-lg font-bold text-gray-900">Быстрые действия</h2>
        
        <UploadAnalysisButton />

        <button className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 text-left hover:bg-gray-50">
          <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center">
            <FolderIcon size={24} />
          </div>
          <div className="flex-1">
            <div className="font-bold text-gray-900">Медкарта</div>
            <div className="text-sm text-gray-500">Все документы и история</div>
          </div>
          <ChevronRightIcon size={20} className="text-gray-400" />
        </button>
      </div>
      
      <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-2">
          <SparklesIcon size={16} />
          <span className="text-xs font-bold uppercase">AI Рекомендация</span>
        </div>
        <h3 className="text-lg font-bold mb-2">Дефицит железа?</h3>
        <p className="text-sm text-indigo-100 mb-4">
          На основе последних анализов мы подобрали для вас оптимальный курс витаминов.
        </p>
        <button className="bg-white text-indigo-700 px-4 py-2 rounded-lg font-bold text-sm hover:bg-indigo-50 transition-colors">
          Посмотреть подборку
        </button>
      </div>
    </div>
  );
}

// Кнопка загрузки анализа
function UploadAnalysisButton() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      await analysesApi.upload(file);
      alert('Анализ загружен! Распознавание запущено.');
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки');
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-4 text-left hover:bg-gray-50 disabled:opacity-50"
      >
        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
          {uploading ? <LoaderIcon size={24} /> : <UploadIcon size={24} />}
        </div>
        <div className="flex-1">
          <div className="font-bold text-gray-900">Загрузить анализ</div>
          <div className="text-sm text-gray-500">PDF, JPG или фото</div>
        </div>
        <ChevronRightIcon size={20} className="text-gray-400" />
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.jpg,.jpeg,.png"
        onChange={handleUpload}
        className="hidden"
      />
    </>
  );
}

// Страница анализов
function AnalysesPage() {
  const [analyses, setAnalyses] = useState<Analysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    analysesApi.getAll()
      .then(setAnalyses)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const newAnalysis = await analysesApi.upload(file);
      setAnalyses(prev => [newAnalysis, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  // Демо данные
  const displayAnalyses = analyses.length > 0 ? analyses : [
    { id: 1, title: "Биохимия крови", analysis_date: "28.11.2024", status: "completed" as const, biomarkers: [{ status: "low" as const, name: "Железо ↓" }, { status: "low" as const, name: "Ферритин ↓" }] },
    { id: 2, title: "Общий анализ крови", analysis_date: "28.11.2024", status: "completed" as const, biomarkers: [{ status: "normal" as const, name: "Все в норме" }] },
    { id: 3, title: "Витамин D", analysis_date: "15.11.2024", status: "completed" as const, biomarkers: [{ status: "low" as const, name: "25-OH D ↓" }] },
    { id: 4, title: "Гормоны щитовидной", analysis_date: "01.10.2024", status: "completed" as const, biomarkers: [{ status: "normal" as const, name: "ТТГ" }, { status: "normal" as const, name: "Т4 св." }] },
  ] as any[];

  const outOfRangeCount = displayAnalyses.reduce((acc, a) => 
    acc + (a.biomarkers?.filter((b: any) => b.status !== 'normal').length || 0), 0
  );

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Мои анализы</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 transition-colors"
        >
          {uploading ? <LoaderIcon size={20} /> : <PlusIcon size={20} />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleUpload}
          className="hidden"
        />
      </div>

      {outOfRangeCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 flex gap-3">
          <div className="text-rose-500">
            <AlertCircleIcon size={24} />
          </div>
          <div>
            <div className="font-bold text-rose-900 text-sm mb-1">Внимание: {outOfRangeCount} показателя вне нормы</div>
            <div className="text-xs text-rose-700">
              Рекомендуем проконсультироваться с врачом.
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <LoaderIcon size={24} className="text-emerald-500" />
          </div>
        ) : displayAnalyses.map((item, i) => {
          const hasIssues = item.biomarkers?.some((b: any) => b.status !== 'normal');
          return (
            <div key={item.id || i} className="bg-white rounded-xl border border-gray-200 p-4 hover:shadow-md transition-shadow cursor-pointer">
              <div className="flex justify-between items-start mb-3">
                <div>
                  <div className="font-bold text-gray-900 text-sm">{item.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{item.analysis_date || item.created_at?.split('T')[0]}</div>
                </div>
                <div className={`px-2 py-1 rounded text-[10px] font-bold uppercase ${
                  !hasIssues ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
                }`}>
                  {!hasIssues ? "Норма" : "Отклонение"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {item.biomarkers?.slice(0, 3).map((b: any, j: number) => (
                  <span key={j} className="text-xs px-2 py-1 bg-gray-50 text-gray-600 rounded border border-gray-200">
                    {b.name || (b.status === 'low' ? '↓' : b.status === 'high' ? '↑' : '✓')}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Страница медкарты
function MedcardPage() {
  const [documents, setDocuments] = useState<MedicalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    medcardApi.getAll(filter || undefined)
      .then(setDocuments)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filter]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setUploading(true);
    try {
      const title = file.name.replace(/\.[^/.]+$/, '');
      const newDoc = await medcardApi.upload(file, title, 'other');
      setDocuments(prev => [newDoc, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setUploading(false);
    }
  };

  const categories = [
    { id: "analysis", label: "Анализы", Icon: ClipboardIcon, color: "bg-emerald-50 text-emerald-600" },
    { id: "consultation", label: "Врачи", Icon: UserIcon, color: "bg-blue-50 text-blue-600" },
    { id: "examination", label: "Исслед.", Icon: BarChartIcon, color: "bg-violet-50 text-violet-600" },
    { id: "other", label: "Прочее", Icon: FolderIcon, color: "bg-orange-50 text-orange-600" },
  ];

  // Демо данные
  const displayDocuments = documents.length > 0 ? documents : [
    { id: 1, title: "УЗИ щитовидной железы", created_at: "Сегодня", file_type: "application/pdf", file_size: 2400000 },
    { id: 2, title: "Заключение эндокринолога", created_at: "Вчера", file_type: "application/pdf", file_size: 1100000 },
    { id: 3, title: "Биохимия крови", created_at: "20 ноя", file_type: "image/jpeg", file_size: 850000 },
    { id: 4, title: "МРТ головного мозга", created_at: "15 окт", file_type: "application/zip", file_size: 45000000 },
  ] as any[];

  const getFileIcon = (type: string) => {
    if (type.includes('pdf')) return <FileTextIcon size={18} />;
    if (type.includes('image')) return <ImageIcon size={18} />;
    return <ArchiveIcon size={18} />;
  };

  const formatSize = (bytes: number) => {
    if (bytes > 1000000) return `${(bytes / 1000000).toFixed(1)} MB`;
    return `${(bytes / 1000).toFixed(0)} KB`;
  };

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Медкарта</h1>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          {uploading ? <LoaderIcon size={20} /> : <UploadIcon size={20} />}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.jpg,.jpeg,.png"
          onChange={handleUpload}
          className="hidden"
        />
      </div>
      
      <div className="relative">
        <SearchIcon size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input 
          type="text" 
          placeholder="Поиск документов..." 
          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
      </div>

      <div className="grid grid-cols-4 gap-2">
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setFilter(filter === cat.id ? null : cat.id)}
            className="flex flex-col items-center gap-2"
          >
            <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${filter === cat.id ? cat.color : 'bg-gray-100 text-gray-600'}`}>
              <cat.Icon size={22} />
            </div>
            <span className="text-[11px] font-medium text-gray-600">{cat.label}</span>
          </button>
        ))}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Недавние</h2>
          <button className="text-sm font-semibold text-emerald-600">Все</button>
        </div>
        
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoaderIcon size={24} className="text-emerald-500" />
            </div>
          ) : displayDocuments.map((doc) => (
            <div key={doc.id} className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 hover:shadow-md transition-shadow cursor-pointer">
              <div className="w-11 h-11 rounded-lg bg-gray-50 flex items-center justify-center border border-gray-200 text-gray-500">
                {getFileIcon(doc.file_type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-gray-900 text-sm truncate">{doc.title}</div>
                <div className="text-xs text-gray-400 mt-1">
                  {doc.document_date || doc.created_at?.split?.('T')?.[0] || doc.created_at} • {formatSize(doc.file_size)}
                </div>
              </div>
              <ChevronRightIcon size={18} className="text-gray-300" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Страница календаря
function CalendarPage() {
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentMonth, setCurrentMonth] = useState(new Date());

  useEffect(() => {
    calendarApi.getAll()
      .then(setReminders)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // Демо данные
  const displayReminders = reminders.length > 0 ? reminders : [
    { id: 1, title: "Общий анализ крови", reminder_date: "2024-12-15T09:00:00", reminder_type: "analysis" as const },
    { id: 2, title: "Витамин D", reminder_date: "2024-12-20T10:30:00", reminder_type: "analysis" as const },
    { id: 3, title: "Прием эндокринолога", reminder_date: "2024-12-22T14:00:00", reminder_type: "checkup" as const },
  ] as any[];

  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate();
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  const reminderDays = displayReminders.map(r => new Date(r.reminder_date).getDate());
  const today = new Date().getDate();
  const isCurrentMonth = currentMonth.getMonth() === new Date().getMonth() && currentMonth.getFullYear() === new Date().getFullYear();

  const monthNames = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

  return (
    <div className="px-4 py-5 space-y-4">
      <h1 className="text-xl font-bold text-gray-900">Календарь здоровья</h1>

      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1))}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ChevronLeftIcon size={16} />
          </button>
          <span className="text-sm font-semibold text-gray-900">
            {monthNames[currentMonth.getMonth()]} {currentMonth.getFullYear()}
          </span>
          <button
            onClick={() => setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1))}
            className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
          >
            <ChevronRightIcon size={16} />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs">
          {["Пн","Вт","Ср","Чт","Пт","Сб","Вс"].map(d => (
            <div key={d} className="py-1.5 text-gray-400 font-medium">{d}</div>
          ))}
          {Array.from({ length: adjustedFirstDay }).map((_, i) => (
            <div key={`empty-${i}`} className="py-2"></div>
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => (
            <button
              key={day}
              className={`py-2 rounded-lg font-medium text-sm transition-colors ${
                isCurrentMonth && day === today ? "bg-emerald-500 text-white" :
                reminderDays.includes(day) ? "bg-yellow-50 text-yellow-600 font-bold" :
                "text-gray-900 hover:bg-gray-50"
              }`}
            >
              {day}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        <h2 className="text-base font-bold text-gray-900">Предстоящие</h2>
        <div className="space-y-2">
          {loading ? (
            <div className="flex justify-center py-8">
              <LoaderIcon size={24} className="text-emerald-500" />
            </div>
          ) : displayReminders.map((r) => {
            const date = new Date(r.reminder_date);
            return (
              <div key={r.id} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <CalendarIcon size={18} />
                </div>
                <div className="flex-1">
                  <div className="font-medium text-sm text-gray-900">{r.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    {date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })} • {date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <button className="w-full bg-emerald-500 text-white rounded-xl py-3 font-semibold flex items-center justify-center gap-2 hover:bg-emerald-600 transition-colors">
        <PlusIcon size={18} />
        Добавить напоминание
      </button>
    </div>
  );
}

// Страница профиля
function ProfilePage() {
  const menu = [
    { Icon: UserIcon, label: "Личные данные" },
    { Icon: HistoryIcon, label: "История анализов" },
    { Icon: BellIcon, label: "Уведомления" },
    { Icon: ShieldIcon, label: "Конфиденциальность" },
  ];

  return (
    <div className="px-4 py-5 space-y-4">
      <div className="bg-white border border-gray-200 rounded-xl p-5 text-center">
        <div className="w-20 h-20 rounded-xl bg-emerald-500 text-white text-2xl font-bold flex items-center justify-center mx-auto mb-3">
          АИ
        </div>
        <h2 className="text-lg font-bold text-gray-900">Александр Иванов</h2>
        <p className="text-sm text-gray-400 mt-1">Профиль в Health Tracker</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { value: "12", label: "Анализов" },
          { value: "87%", label: "В норме", color: "text-emerald-600" },
          { value: "6", label: "Месяцев" },
        ].map((s, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-xl p-3 text-center">
            <p className={`text-2xl font-bold ${s.color || "text-gray-900"}`}>{s.value}</p>
            <p className="text-[10px] text-gray-400 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {menu.map((item, i) => (
          <button
            key={i}
            className={`w-full flex items-center gap-3 p-3 text-left hover:bg-gray-50 transition-colors ${
              i !== menu.length - 1 ? "border-b border-gray-200" : ""
            }`}
          >
            <div className="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
              <item.Icon size={18} />
            </div>
            <span className="flex-1 font-medium text-sm text-gray-900">{item.label}</span>
            <ChevronRightIcon size={16} className="text-gray-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
