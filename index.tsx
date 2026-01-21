import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { QRCodeCanvas } from 'qrcode.react';
import { 
  Star, 
  MessageSquare, 
  TrendingUp, 
  Settings, 
  LogOut, 
  ChevronRight, 
  Image as ImageIcon, 
  CheckCircle, 
  AlertCircle,
  ExternalLink,
  MapPin,
  QrCode,
  ArrowLeft,
  Send,
  User,
  Camera,
  Utensils,
  Car,
  ShoppingBag,
  X,
  ShieldCheck,
  Trash2,
  Pencil,
  Flag,
  Plus,
  Menu
} from 'lucide-react';

// --- Types & Mock Data Interfaces ---

type RatingEvent = {
  id: string;
  stars: number;
  timestamp: string;
  source: string;
  wasRedirected: boolean;
};

type Feedback = {
  id: string;
  ratingEventId: string;
  stars: number;
  text: string;
  answers?: Record<string, string[]>;
  customerName?: string;
  customerEmail?: string;
  status: 'NEW' | 'READ' | 'REPLIED';
  flagged?: boolean;
  timestamp: string;
  reply?: string;
};

type EntryPoint = {
  id: string;
  label: string;
  src: string;
};

type BusinessConfig = {
  id: string;
  name: string;
  slug: string;
  minStarThreshold: number; // 1-5
  googlePlaceUrl?: string;
  redirectUrl?: string; // where Cancel / Close / Done send the customer
  logoUrl?: string;
  brandColor: string;
  entryPoints?: EntryPoint[];
  theme?: {
    brandColor?: string;
    pageBg?: string;
    adminBg?: string;
    cardBg?: string;
  };
  feedbackQuestions?: Array<{
    id: string;
    question: string;
    type: 'single' | 'multi';
    options: string[];
  }>;
};

// --- Mock Backend / Local Storage Manager ---

const DEFAULT_CONFIG: BusinessConfig = {
  id: 'biz_123',
  name: 'Bistro & Co.',
  slug: 'bistro-co',
  minStarThreshold: 4,
  googlePlaceUrl: 'https://search.google.com/local/writereview?placeid=EXAMPLE',
  brandColor: '#2563eb', // blue-600
  entryPoints: [
    { id: 'ep_table_1', label: 'Table 1', src: 'table_1' },
    { id: 'ep_email', label: 'Email Footer', src: 'email' },
  ],
  theme: {
    brandColor: '#2563eb',
    pageBg: '#f8fafc',
    adminBg: '#f1f5f9',
    cardBg: '#ffffff'
  },
  redirectUrl: 'https://happycleanlawnscapes.com',
  feedbackQuestions: [
    {
      id: 'service_mode',
      question: 'Did you dine in, take away or get delivery?',
      type: 'single',
      options: ['Dine in', 'Takeaway', 'Delivery']
    },
    {
      id: 'items',
      question: 'What did you get?',
      type: 'multi',
      options: ['Breakfast', 'Brunch', 'Lunch', 'Dinner', 'Coffee', 'Drinks']
    }
  ]
};

const applyTheme = (config: BusinessConfig) => {
  const root = document.documentElement;
  const brand = config.theme?.brandColor || config.brandColor || '#2563eb';
  const pageBg = config.theme?.pageBg || '#f8fafc';
  const adminBg = config.theme?.adminBg || pageBg;
  const cardBg = config.theme?.cardBg || '#ffffff';
  root.style.setProperty('--brand', brand);
  root.style.setProperty('--page-bg', pageBg);
  root.style.setProperty('--admin-bg', adminBg);
  root.style.setProperty('--card-bg', cardBg);
};

const SIMULATED_DELAY = 600;

class DataManager {
  private static STORAGE_KEY = 'reviewflow_db_v1';
  private static UNDO_KEY = 'reviewflow_undo_v1';

  static load(): { config: BusinessConfig; events: RatingEvent[]; feedbacks: Feedback[] } {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) return JSON.parse(stored);
    
    // Seed initial data if empty
    return {
      config: DEFAULT_CONFIG,
      events: [
        { id: 'evt_1', stars: 5, timestamp: new Date(Date.now() - 86400000).toISOString(), source: 'qr-table-1', wasRedirected: true },
        { id: 'evt_2', stars: 2, timestamp: new Date(Date.now() - 172800000).toISOString(), source: 'link-email', wasRedirected: false },
      ],
      feedbacks: [
        { 
          id: 'fb_1', 
          ratingEventId: 'evt_2', 
          stars: 2, 
          text: 'The soup was cold and service was slow.', 
          customerName: 'John Doe', 
          customerEmail: 'john@example.com', 
          status: 'NEW',
          flagged: false,
          timestamp: new Date(Date.now() - 172800000).toISOString() 
        }
      ]
    };
  }

  static save(data: any) {
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
    // Dispatch event for cross-component updates in this POC
    window.dispatchEvent(new Event('db-update'));
  }

  static addEvent(event: RatingEvent) {
    const data = this.load();
    data.events.unshift(event);
    this.save(data);
  }

  static addFeedback(feedback: Feedback) {
    const data = this.load();
    data.feedbacks.unshift(feedback);
    this.save(data);
  }

  static updateConfig(newConfig: Partial<BusinessConfig>) {
    const data = this.load();
    // Store undo snapshot before applying config changes
    localStorage.setItem(this.UNDO_KEY, JSON.stringify({ type: 'config', prev: data.config, ts: Date.now() }));
    data.config = { ...data.config, ...newConfig };
    this.save(data);
  }

  static setConfig(nextConfig: BusinessConfig) {
    const data = this.load();
    localStorage.setItem(this.UNDO_KEY, JSON.stringify({ type: 'config', prev: data.config, ts: Date.now() }));
    data.config = nextConfig;
    this.save(data);
  }

  static getUndoSnapshot(): any | null {
    try {
      const raw = localStorage.getItem(this.UNDO_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  static clearUndoSnapshot() {
    localStorage.removeItem(this.UNDO_KEY);
  }

  static updateFeedback(id: string, patch: Partial<Feedback>) {
    const data = this.load();
    const fb = data.feedbacks.find(f => f.id === id);
    if (fb) {
      Object.assign(fb, patch);
      this.save(data);
    }
  }

  static markAllFeedbackRead() {
    const data = this.load();
    data.feedbacks = data.feedbacks.map(f => (f.status === 'NEW' ? { ...f, status: 'READ' } : f));
    this.save(data);
  }

  static deleteFeedback(ids: string[]) {
    const set = new Set(ids);
    const data = this.load();
    data.feedbacks = data.feedbacks.filter(f => !set.has(f.id));
    this.save(data);
  }

  static upsertEntryPoint(ep: EntryPoint) {
    const data = this.load();
    const existing = data.config.entryPoints || [];
    const idx = existing.findIndex(e => e.id === ep.id);
    const next = idx >= 0 ? existing.map(e => (e.id === ep.id ? ep : e)) : [ep, ...existing];
    this.updateConfig({ entryPoints: next });
  }

  static deleteEntryPoint(id: string) {
    const data = this.load();
    const existing = data.config.entryPoints || [];
    this.updateConfig({ entryPoints: existing.filter(e => e.id !== id) });
  }

  static replyToFeedback(id: string, reply: string) {
    const data = this.load();
    const fb = data.feedbacks.find(f => f.id === id);
    if (fb) {
      fb.reply = reply;
      fb.status = 'REPLIED';
      this.save(data);
    }
  }
}

// --- Toast / In-app Notification ---

const Toast = ({ open, title, message, onClose, onUndo }: any) => {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      {/*
        UX safety:
        If the user hits Enter immediately after saving (common), browsers may trigger the
        first available button inside the dialog. We ensure the default action is "OK",
        not "Undo", by rendering OK first and autofocus-ing it.
      */}
      <div
        className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden"
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onClose?.();
          }
        }}
      >
        <div className="p-5 flex items-start gap-3">
          <div className="mt-0.5 text-[var(--brand)]">
            <CheckCircle size={22} />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-gray-900">{title || 'Saved'}</div>
            {message && <div className="text-sm text-gray-600 mt-1">{message}</div>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        <div className="px-5 pb-5 flex justify-end gap-2">
          <Button onClick={onClose} className="rounded-full" autoFocus>
            OK
          </Button>
          {onUndo && (
            <Button variant="secondary" onClick={onUndo} className="rounded-full">
              Undo
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

// --- Components: Shared ---

const Button = ({ children, onClick, variant = 'primary', className = '', disabled = false, type = 'button', ...rest }: any) => {
  const baseClass = "px-4 py-2 rounded-full font-medium transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed";
  const variants: any = {
    primary: "bg-[var(--brand)] hover:brightness-95 text-white shadow-md",
    secondary: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300",
    outline: "border text-[var(--brand)] border-[var(--brand)] hover:bg-gray-50",
    ghost: "text-gray-500 hover:bg-gray-100",
    text: "text-[var(--brand)] hover:underline px-0 py-0"
  };
  
  return (
    <button type={type} onClick={onClick} className={`${baseClass} ${variants[variant]} ${className}`} disabled={disabled} {...rest}>
      {children}
    </button>
  );
};

const Card = ({ children, className = '' }: any) => (
  <div className={`bg-[var(--card-bg)] rounded-xl border border-gray-100 shadow-sm ${className}`}>
    {children}
  </div>
);

const Chip = ({ label, selected, onClick }: any) => (
  <button 
    type="button"
    onClick={onClick}
    className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${selected ? 'bg-[color:color-mix(in_srgb,var(--brand)_12%,white)] border-[var(--brand)] text-[var(--brand)]' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
  >
    {label}
  </button>
);

const DevelopedByFooter = () => (
  <div className="w-full text-center text-xs text-gray-400 py-4">
    Developed by{' '}
    <a
      href="https://sinuxconsulting.com"
      target="_blank"
      rel="noreferrer"
      className="text-[var(--brand)] hover:underline"
    >
      Sinux Consulting
    </a>
  </div>
);

const QuestionBuilder = ({ value, onChange }: { value: BusinessConfig['feedbackQuestions']; onChange: (v: BusinessConfig['feedbackQuestions']) => void; }) => {
  const questions = value || [];

  const updateQuestion = (idx: number, patch: any) => {
    const next = questions.map((q, i) => (i === idx ? { ...q, ...patch } : q));
    onChange(next);
  };

  const addQuestion = () => {
    const nextId = `q_${Date.now()}`;
    onChange([
      ...questions,
      { id: nextId, question: 'New question', type: 'single', options: ['Option 1'] }
    ]);
  };

  const removeQuestion = (idx: number) => {
    onChange(questions.filter((_, i) => i !== idx));
  };

  const updateOption = (qIdx: number, oIdx: number, value: string) => {
    const q = questions[qIdx];
    const nextOpts = (q.options || []).map((o, i) => (i === oIdx ? value : o));
    updateQuestion(qIdx, { options: nextOpts });
  };

  const addOption = (qIdx: number) => {
    const q = questions[qIdx];
    const opts = q.options || [];
    updateQuestion(qIdx, { options: [...opts, `Option ${opts.length + 1}`] });
  };

  const removeOption = (qIdx: number, oIdx: number) => {
    const q = questions[qIdx];
    const opts = q.options || [];
    updateQuestion(qIdx, { options: opts.filter((_, i) => i !== oIdx) });
  };

  return (
    <div className="space-y-4">
      {questions.length === 0 && (
        <div className="text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg p-4">
          No questions yet. Add your first question below.
        </div>
      )}

      {questions.map((q, idx) => (
        <div key={q.id || idx} className="rounded-xl border border-gray-200 bg-[var(--card-bg)] shadow-sm">
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <input
              type="text"
              value={q.question}
              onChange={(e) => updateQuestion(idx, { question: e.target.value })}
              className="flex-1 p-2 border rounded-lg bg-gray-50"
              placeholder="Question"
            />
            <select
              value={q.type}
              onChange={(e) => updateQuestion(idx, { type: e.target.value === 'single' ? 'single' : 'multi' })}
              className="w-full sm:w-44 p-2 border rounded-lg bg-white"
            >
              <option value="single">Single choice</option>
              <option value="multi">Multiple choice</option>
            </select>
          </div>

          <div className="p-4 space-y-2">
            <div className="text-xs font-semibold text-gray-500 uppercase">Options</div>
            {(q.options || []).map((opt, oIdx) => (
              <div key={oIdx} className="flex items-center gap-2">
                <span className="text-gray-400">•</span>
                <input
                  type="text"
                  value={opt}
                  onChange={(e) => updateOption(idx, oIdx, e.target.value)}
                  className="flex-1 p-2 border rounded-lg bg-gray-50"
                />
                <button
                  type="button"
                  onClick={() => removeOption(idx, oIdx)}
                  className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"
                  aria-label="Remove option"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => addOption(idx)}
              className="inline-flex items-center gap-2 text-sm text-[var(--brand)] hover:underline"
            >
              <Plus size={16} /> Add option
            </button>
          </div>

          <div className="p-4 border-t border-gray-100 flex justify-end">
            <button
              type="button"
              onClick={() => removeQuestion(idx)}
              className="text-sm text-gray-500 hover:text-red-600 inline-flex items-center gap-2"
            >
              <Trash2 size={16} /> Remove question
            </button>
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addQuestion}
        className="w-full border border-gray-300 rounded-xl p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2 font-medium text-gray-900">
          <Plus size={18} /> Add question
        </div>
        <div className="text-xs text-gray-500 mt-1">Build a client-specific set of low-rating questions.</div>
      </button>
    </div>
  );
};

// --- Components: Customer Flow ---

const StarRating = ({ rating, setRating, readOnly = false, size = 'lg' }: any) => {
  const [hover, setHover] = useState(0);

  return (
    <div className="flex gap-1.5">
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = star <= (hover || rating);
        const iconSize = size === 'lg' ? 42 : 24;
        const colorClass = isFilled ? "fill-[var(--brand)] text-[var(--brand)]" : "text-gray-300";
        
        return (
          <button
            key={star}
            type="button"
            className={`${readOnly ? 'cursor-default' : 'cursor-pointer'} transition-transform duration-200 focus:outline-none`}
            onClick={() => !readOnly && setRating(star)}
            onMouseEnter={() => !readOnly && setHover(star)}
            onMouseLeave={() => !readOnly && setHover(0)}
            aria-label={`Rate ${star} stars`}
          >
            <Star 
              size={iconSize} 
              className={`${colorClass} transition-colors duration-200`} 
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
};

const CustomerView = ({ config, onSwitchRole }: any) => {
  const [step, setStep] = useState<'RATING' | 'FEEDBACK' | 'THANKS'>('RATING');
  const [rating, setRating] = useState(0);
  const [loading, setLoading] = useState(false);
  const [redirecting, setRedirecting] = useState(false);
  const [eventId, setEventId] = useState<string | null>(null);

  // Form State
  const [reviewText, setReviewText] = useState('');
  const [contactInfo, setContactInfo] = useState({ name: '', email: '' });
  
  // Visual-only tags for the "vibe"
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});

  const exitToRedirect = () => {
    const url = (config as any).redirectUrl || (config as any).websiteUrl || '';
    if (url && typeof url === 'string') {
      window.location.href = url;
    } else {
      window.location.href = '/';
    }
  };

  // Step 1: Initial Rating Handler
  const handleRatingSubmit = async (stars: number) => {
    setLoading(true);
    setRating(stars);
    
    // Simulate API call
    setTimeout(() => {
      const isPositive = stars >= config.minStarThreshold;
      const newEventId = `evt_${Date.now()}`;
      
      DataManager.addEvent({
        id: newEventId,
        stars,
        timestamp: new Date().toISOString(),
        source: 'web_poc',
        wasRedirected: isPositive
      });
      
      setEventId(newEventId);
      
      if (isPositive) {
        setRedirecting(true);
        // Automatic Redirect logic
        window.location.href = config.googlePlaceUrl;
      } else {
        setStep('FEEDBACK');
        setLoading(false);
      }
    }, SIMULATED_DELAY);
  };

  // Step 2: Rating Change Handler (Inside Form)
  const handleStarChangeInForm = (newStars: number) => {
    setRating(newStars);
    
    // If they upgrade to a positive rating, redirect them!
    if (newStars >= config.minStarThreshold) {
      setRedirecting(true);
      // Small delay to allow user to see the star click register visually before swapping
      setTimeout(() => {
         window.location.href = config.googlePlaceUrl;
      }, 1000);
    }
  };

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    if (!eventId) return;

    setTimeout(() => {
      DataManager.addFeedback({
        id: `fb_${Date.now()}`,
        ratingEventId: eventId,
        stars: rating,
        text: reviewText,
        answers,
        customerName: contactInfo.name,
        customerEmail: contactInfo.email,
        status: 'NEW',
        timestamp: new Date().toISOString()
      });
      setStep('THANKS');
      setLoading(false);
    }, SIMULATED_DELAY);
  };

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter(t => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const toggleAnswer = (qid: string, opt: string, type: 'single' | 'multi') => {
    setAnswers(prev => {
      const current = prev[qid] || [];
      if (type === 'single') {
        return { ...prev, [qid]: current.includes(opt) ? [] : [opt] };
      }
      // multi
      return {
        ...prev,
        [qid]: current.includes(opt) ? current.filter(x => x !== opt) : [...current, opt]
      };
    });
  };

  // 1. Initial Rating Screen
  if (step === 'RATING') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--page-bg)]">
        <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center space-y-8 animate-fade-in">
          <div className="space-y-2">
            <div className="w-16 h-16 bg-[color:color-mix(in_srgb,var(--brand)_16%,white)] text-[var(--brand)] rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin size={32} />
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{config.name}</h1>
            <p className="text-gray-500">How was your experience with us today?</p>
          </div>
          
          <div className="flex justify-center py-4 min-h-[80px]">
            {(loading || redirecting) ? (
              <div className="flex flex-col items-center animate-fade-in">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand)] mb-4"></div>
                {redirecting && <p className="text-[var(--brand)] font-medium">Redirecting to Google Reviews...</p>}
              </div>
            ) : (
              <StarRating rating={rating} setRating={handleRatingSubmit} />
            )}
          </div>

          <p className="text-xs text-gray-400">Your feedback helps us improve.</p>
        </div>
        <DevelopedByFooter />
      </div>
    );
  }

  // 2. Low Rating Form (Internal Feedback - Google Style)
  if (step === 'FEEDBACK') {

    // Show loading/redirecting overlay if the user upgraded their star rating
    if (redirecting) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-[var(--page-bg)]">
                <div className="bg-white p-8 rounded-xl shadow-lg flex flex-col items-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[var(--brand)] mb-4"></div>
                    <p className="text-[var(--brand)] font-medium">Opening Google Reviews...</p>
                </div>
                <DevelopedByFooter />
            </div>
        );
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[var(--page-bg)]">
        <div className="max-w-[480px] w-full bg-white rounded-xl shadow-lg overflow-hidden animate-slide-up">
          
          {/* Header */}
          <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <h1 className="text-lg font-medium text-gray-800">{config.name}</h1>
            <button type="button" onClick={exitToRedirect} className="text-gray-400 hover:text-gray-600">
              <X size={20} />
            </button>
          </div>

          <form onSubmit={handleFeedbackSubmit}>
            <div className="p-6 space-y-6">
              
              {/* User Row */}
              <div className="flex items-center gap-3">
                 <div className="w-10 h-10 rounded-full bg-[var(--brand)] text-white flex items-center justify-center text-sm font-bold">
                   {contactInfo.name ? contactInfo.name.charAt(0).toUpperCase() : <User size={20}/>}
                 </div>
                 <div>
                   <div className="text-sm font-medium text-gray-900">{contactInfo.name || 'Guest'}</div>
                   <div className="text-xs text-gray-500">Posting privately to {config.name}</div>
                 </div>
              </div>

              {/* Stars */}
              <div className="flex justify-start">
                 <StarRating rating={rating} setRating={handleStarChangeInForm} />
              </div>

              {/* Text Area */}
              <div>
                <textarea 
                  required
                  className="w-full p-3 border border-gray-300 rounded-lg focus:ring-1 focus:ring-[var(--brand)] focus:border-[var(--brand)] outline-none min-h-[140px] text-gray-800 placeholder-gray-500 resize-none text-base"
                  placeholder="Share details of your own experience at this place"
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                />
              </div>

              {/* Photo Upload (Mock) */}
              <button type="button" className="w-full py-3 border border-gray-300 rounded-lg flex items-center justify-center gap-2 text-[var(--brand)] font-medium hover:bg-gray-50 transition-colors">
                 <Camera size={20} />
                 Add photos
              </button>

              {/* Chips (Vibe) */}
              <div className="space-y-4 pt-2">
                {(config.feedbackQuestions || []).map(q => (
                  <div key={q.id}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{q.question}</label>
                    <div className="flex flex-wrap gap-2">
                      {q.options.map(opt => (
                        <Chip
                          key={opt}
                          label={opt}
                          selected={(answers[q.id] || []).includes(opt)}
                          onClick={() => toggleAnswer(q.id, opt, q.type)}
                        />
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* Contact / Identify (Mandatory) */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-3 mt-4 border border-gray-200">
                 <div className="flex items-center gap-2 text-sm font-medium text-gray-800">
                    <ShieldCheck size={16} className="text-green-600"/>
                    <span>Contact Information</span>
                    <span className="text-red-500 ml-auto text-xs">* Required</span>
                 </div>
                 <p className="text-xs text-gray-500">
                    To maintain the integrity of our feedback and prevent fake reviews, please verify your details.
                 </p>
                 <div className="grid grid-cols-2 gap-3">
                    <input 
                      required
                      type="text"
                      placeholder="Name"
                      className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:border-[var(--brand)]"
                      value={contactInfo.name}
                      onChange={(e) => setContactInfo({...contactInfo, name: e.target.value})}
                    />
                    <input 
                      required
                      type="email"
                      placeholder="Email"
                      className="w-full p-2 border border-gray-300 rounded-md text-sm outline-none focus:border-[var(--brand)]"
                      value={contactInfo.email}
                      onChange={(e) => setContactInfo({...contactInfo, email: e.target.value})}
                    />
                 </div>
              </div>

            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-gray-100 flex justify-end gap-3 bg-white sticky bottom-0">
               <Button variant="secondary" onClick={exitToRedirect}>Cancel</Button>
               <Button type="submit" disabled={loading}>
                 {loading ? 'Posting...' : 'Post'}
               </Button>
            </div>
          </form>
        </div>
        <DevelopedByFooter />
      </div>
    );
  }

  // 3. Thank You Screen
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--page-bg)]">
      <Card className="max-w-md w-full p-12 text-center space-y-6">
        <div className="w-16 h-16 bg-[color:color-mix(in_srgb,var(--brand)_16%,white)] text-[var(--brand)] rounded-full flex items-center justify-center mx-auto">
          <Send size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Thank You</h2>
          <p className="text-gray-500 mt-2">Your feedback has been shared with us.</p>
        </div>
        <Button variant="secondary" onClick={exitToRedirect}>
          Done
        </Button>
      </Card>
      <DevelopedByFooter />
    </div>
  );
};

// --- Components: Admin Portal ---

const AdminDashboard = ({ onLogout }: any) => {
  const [activeTab, setActiveTab] = useState<'DASHBOARD' | 'FEEDBACK' | 'SETTINGS' | 'LINKS'>('DASHBOARD');
  const [data, setData] = useState<{config: BusinessConfig, events: RatingEvent[], feedbacks: Feedback[]} | null>(null);
  const [selectedFeedback, setSelectedFeedback] = useState<Feedback | null>(null);
  const [replyText, setReplyText] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [draftQuestions, setDraftQuestions] = useState<BusinessConfig['feedbackQuestions']>([]);
  const [draftConfig, setDraftConfig] = useState(() => ({
    name: '',
    minStarThreshold: 4,
    googlePlaceUrl: '',
    redirectUrl: '',
    theme: {
      brandColor: '#2563eb',
      pageBg: '#f8fafc',
      adminBg: '#f1f5f9',
      cardBg: '#ffffff'
    }
  }));


  // Entry Points (Links & QR) management
  const [epModalOpen, setEpModalOpen] = useState(false);
  const [epEditing, setEpEditing] = useState<EntryPoint | null>(null);
  const [epLabel, setEpLabel] = useState('');
  const [epSrc, setEpSrc] = useState('');

  // Feedback inbox management
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Toast
  const [toastOpen, setToastOpen] = useState(false);
  const [toastTitle, setToastTitle] = useState<string>('Saved');
  const [toastMessage, setToastMessage] = useState<string>('');
  const [toastUndo, setToastUndo] = useState<null | (() => void)>(null);

  const showToast = (opts: { title?: string; message?: string; onUndo?: (() => void) | null }) => {
    // Prevent click-through from the triggering button (e.g., Save Changes) onto the toast actions.
    // We defer opening the toast to the next tick so the original click/mouseup completes first.
    setToastTitle(opts.title || 'Saved');
    setToastMessage(opts.message || '');
    setToastUndo(opts.onUndo || null);
    setToastOpen(false);
    window.setTimeout(() => setToastOpen(true), 0);
  };

  useEffect(() => {
    if (!data?.config) return;
    const cfg = data.config;
    setDraftQuestions(cfg.feedbackQuestions || []);
    setDraftConfig({
      name: cfg.name || '',
      minStarThreshold: cfg.minStarThreshold || 4,
      googlePlaceUrl: cfg.googlePlaceUrl || '',
      redirectUrl: cfg.redirectUrl || '',
      theme: {
        brandColor: cfg.theme?.brandColor || cfg.brandColor || '#2563eb',
        pageBg: cfg.theme?.pageBg || '#f8fafc',
        adminBg: cfg.theme?.adminBg || cfg.theme?.pageBg || '#f1f5f9',
        cardBg: cfg.theme?.cardBg || '#ffffff',
      }
    });
  }, [data?.config]);

  // Hydrate Data
  const refreshData = () => {
    setData(DataManager.load());
  };

  useEffect(() => {
    refreshData();
    window.addEventListener('db-update', refreshData);
    return () => window.removeEventListener('db-update', refreshData);
  }, []);

  if (!data) return null;

  const origin = window.location.origin;
  const baseCustomerLink = `${origin}/${data.config.slug}`;
  const linkTable1 = `${baseCustomerLink}?src=table_1`;
  const linkEmail = `${baseCustomerLink}?src=email`;
  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      showToast({ title: 'Copied', message: 'Link copied to clipboard.', onUndo: null });
    } catch {
      // Fallback
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      showToast({ title: 'Copied', message: 'Link copied to clipboard.', onUndo: null });
    }
  };

  // Stats Logic
  const totalReviews = data.events.length;
  const avgRating = totalReviews > 0 
    ? (data.events.reduce((acc, curr) => acc + curr.stars, 0) / totalReviews).toFixed(1)
    : '0.0';
  
  const interceptedCount = data.events.filter(e => !e.wasRedirected).length;
  const redirectCount = data.events.filter(e => e.wasRedirected).length;
  const unreadCount = data.feedbacks.filter(f => f.status === 'NEW').length;

  const handleReply = (id: string) => {
    if (!replyText.trim()) return;
    DataManager.replyToFeedback(id, replyText);
    setReplyText('');
    setSelectedFeedback(null);
  };
  const handleUpdateConfig = (e: React.FormEvent) => {
    e.preventDefault();

    // Persist the entire draft state (controlled inputs)
    const brandColor = draftConfig.theme.brandColor || '#2563eb';
    const pageBg = draftConfig.theme.pageBg || '#f8fafc';
    const adminBg = draftConfig.theme.adminBg || pageBg;
    const cardBg = draftConfig.theme.cardBg || '#ffffff';

    DataManager.updateConfig({
      minStarThreshold: Number(draftConfig.minStarThreshold || data.config.minStarThreshold),
      name: draftConfig.name || data.config.name,
      googlePlaceUrl: draftConfig.googlePlaceUrl || data.config.googlePlaceUrl,
      redirectUrl: draftConfig.redirectUrl || data.config.redirectUrl || 'https://happycleanlawnscapes.com',
      brandColor,
      theme: { brandColor, pageBg, adminBg, cardBg },
      feedbackQuestions: draftQuestions || []
    });

    const undo = () => {
      const snap = DataManager.getUndoSnapshot();
      if (snap?.type === 'config' && snap.prev) {
        DataManager.setConfig(snap.prev as BusinessConfig);
        DataManager.clearUndoSnapshot();
        showToast({ title: 'Reverted', message: 'Your last change was undone.', onUndo: null });
      }
    };

    showToast({ title: 'Changes saved', message: 'Your settings have been updated.', onUndo: undo });
  };

  const handleNavClick = (tab: any) => {
    setActiveTab(tab);
    if (tab === 'FEEDBACK') setSelectedFeedback(null);
    setIsMobileMenuOpen(false);
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const deleteSelected = () => {
    if (selectedIds.size === 0) return;
    DataManager.deleteFeedback(Array.from(selectedIds));
    clearSelection();
    if (selectedFeedback && selectedIds.has(selectedFeedback.id)) {
      setSelectedFeedback(null);
    }
    showToast({ title: 'Deleted', message: 'Selected feedback has been removed.', onUndo: null });
  };

  const markAllRead = () => {
    DataManager.markAllFeedbackRead();
    showToast({ title: 'Updated', message: 'All feedback has been marked as read.', onUndo: null });
  };

  const markOneRead = (id: string) => {
    DataManager.updateFeedback(id, { status: 'READ' });
    showToast({ title: 'Updated', message: 'Marked as read.', onUndo: null });
  };

  const toggleFlag = (id: string) => {
    const current = data.feedbacks.find(f => f.id === id);
    DataManager.updateFeedback(id, { flagged: !current?.flagged });
  };

  const openAddEntryPoint = () => {
    setEpEditing(null);
    setEpLabel('');
    setEpSrc('');
    setEpModalOpen(true);
  };

  const openEditEntryPoint = (ep: EntryPoint) => {
    setEpEditing(ep);
    setEpLabel(ep.label);
    setEpSrc(ep.src);
    setEpModalOpen(true);
  };

  const saveEntryPoint = () => {
    const label = epLabel.trim();
    const src = epSrc.trim();
    if (!label || !src) {
      showToast({ title: 'Missing info', message: 'Please provide both a label and a source value.', onUndo: null });
      return;
    }
    const next: EntryPoint = {
      id: epEditing?.id || `ep_${Date.now()}`,
      label,
      src: src.replace(/\s+/g, '_')
    };
    DataManager.upsertEntryPoint(next);
    setEpModalOpen(false);
    showToast({ title: 'Saved', message: 'Entry point updated.', onUndo: null });
  };

  const deleteEntryPoint = (id: string) => {
    DataManager.deleteEntryPoint(id);
    showToast({ title: 'Deleted', message: 'Entry point removed.', onUndo: null });
  };

  return (
    <div className="flex h-screen bg-[var(--admin-bg)] font-sans text-gray-900 overflow-hidden">

      {/* In-app Toast (replaces browser alerts) */}
      <Toast
        open={toastOpen}
        title={toastTitle}
        message={toastMessage}
        onClose={() => setToastOpen(false)}
        onUndo={toastUndo}
      />

      {/* Entry Point Add/Edit Modal */}
      {epModalOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEpModalOpen(false)} />
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-center justify-between">
              <div>
                <div className="font-semibold text-gray-900">{epEditing ? 'Edit entry point' : 'Add entry point'}</div>
                <div className="text-xs text-gray-500 mt-1">Creates a trackable link + QR for a specific source.</div>
              </div>
              <button onClick={() => setEpModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
                <input
                  value={epLabel}
                  onChange={(e) => setEpLabel(e.target.value)}
                  placeholder="e.g. Table 12"
                  className="w-full p-2 border rounded-lg bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Source value</label>
                <input
                  value={epSrc}
                  onChange={(e) => setEpSrc(e.target.value)}
                  placeholder="e.g. table_12"
                  className="w-full p-2 border rounded-lg bg-gray-50 font-mono text-sm"
                />
                <p className="text-xs text-gray-400 mt-1">Used as <span className="font-mono">?src=...</span>. Spaces will be converted to underscores.</p>
              </div>
            </div>
            <div className="px-5 pb-5 flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setEpModalOpen(false)}>Cancel</Button>
              <Button onClick={saveEntryPoint}>{epEditing ? 'Save' : 'Add'}</Button>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-20 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Responsive */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 transform 
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center gap-2 text-[var(--brand)] font-bold text-xl">
            <TrendingUp />
            <span>ReviewFlow</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="lg:hidden text-gray-500">
             <X size={24} />
          </button>
        </div>
        <div className="mt-2 px-6 text-xs font-semibold text-gray-400 uppercase tracking-wider hidden lg:block">Business Portal</div>

        <nav className="flex-1 p-4 space-y-1">
          <SidebarItem 
            icon={<TrendingUp size={20}/>} 
            label="Dashboard" 
            active={activeTab === 'DASHBOARD'} 
            onClick={() => handleNavClick('DASHBOARD')} 
          />
          <SidebarItem 
            icon={<MessageSquare size={20}/>} 
            label="Inbox" 
            badge={unreadCount > 0 ? unreadCount : undefined}
            active={activeTab === 'FEEDBACK'} 
            onClick={() => handleNavClick('FEEDBACK')} 
          />
          <SidebarItem 
            icon={<QrCode size={20}/>} 
            label="Links & QR" 
            active={activeTab === 'LINKS'} 
            onClick={() => handleNavClick('LINKS')} 
          />
          <SidebarItem 
            icon={<Settings size={20}/>} 
            label="Settings" 
            active={activeTab === 'SETTINGS'} 
            onClick={() => handleNavClick('SETTINGS')} 
          />
        </nav>

        <div className="p-4 border-t border-gray-100">
          <button onClick={onLogout} className="flex items-center gap-3 text-gray-600 hover:text-red-600 transition-colors w-full p-2 rounded-lg">
            <LogOut size={20} />
            <span className="text-sm font-medium">Exit Portal</span>
          </button>
        </div>
      </aside>

      {/* Main Content Wrapper */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        
        {/* Mobile Header */}
        <header className="bg-white border-b border-gray-200 p-4 flex items-center gap-4 lg:hidden flex-shrink-0">
          <button onClick={() => setIsMobileMenuOpen(true)} className="text-gray-600">
            <Menu size={24} />
          </button>
          <span className="font-bold text-lg text-[var(--brand)]">ReviewFlow</span>
        </header>

        {/* Main Scrollable Area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          
          {/* VIEW: DASHBOARD */}
          {activeTab === 'DASHBOARD' && (
            <div className="space-y-6 animate-fade-in">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-end gap-2">
                <div>
                  <h1 className="text-2xl font-bold">Overview</h1>
                  <p className="text-gray-500">Welcome back, {data.config.name}</p>
                </div>
                <div className="text-sm text-gray-400">Last 30 days</div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard label="Avg Rating" value={avgRating} icon={<Star className="text-yellow-400" />} />
                <StatCard label="Total Scans" value={totalReviews} icon={<QrCode className="text-blue-500" />} />
                <StatCard label="Redirects (Google)" value={redirectCount} sub={`${((redirectCount/totalReviews || 0)*100).toFixed(0)}%`} icon={<ExternalLink className="text-green-500" />} />
                <StatCard label="Intercepted" value={interceptedCount} sub="Feedback caught" icon={<AlertCircle className="text-orange-500" />} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <h3 className="font-semibold text-gray-800 mb-4">Recent Activity</h3>
                  <div className="bg-[var(--card-bg)] rounded-xl border border-gray-200 overflow-hidden">
                      {data.events.slice(0, 5).map((evt) => (
                        <div key={evt.id} className="p-4 border-b border-gray-100 last:border-0 flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-2 h-2 rounded-full ${evt.stars >= data.config.minStarThreshold ? 'bg-green-500' : 'bg-red-500'}`}></div>
                            <span className="font-medium text-gray-900">{evt.stars} Stars</span>
                            <span className="text-gray-400 text-sm hidden sm:inline">• {new Date(evt.timestamp).toLocaleDateString()}</span>
                          </div>
                          <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                            {evt.wasRedirected ? 'Redirected' : 'Internal'}
                          </span>
                        </div>
                      ))}
                      {data.events.length === 0 && <div className="p-8 text-center text-gray-400">No activity yet</div>}
                  </div>
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 mb-4">System Health</h3>
                  <Card className="p-4 space-y-4">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Threshold Strategy</span>
                      <span className="font-medium text-blue-600">{data.config.minStarThreshold}+ Stars</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-gray-600">Google Link</span>
                      <span className="font-medium text-green-600 flex items-center gap-1"><CheckCircle size={14}/> Active</span>
                    </div>
                  </Card>
                </div>
              </div>
            </div>
          )}

          {/* VIEW: FEEDBACK INBOX & DETAIL */}
          {activeTab === 'FEEDBACK' && (
            <div className="h-[calc(100vh-8rem)] lg:h-[calc(100vh-6rem)] flex gap-6 relative animate-fade-in">
              {/* List */}
              <div className={`
                ${selectedFeedback ? 'hidden lg:flex lg:w-1/3' : 'w-full'} 
                bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col transition-all duration-300
              `}>
                <div className="p-4 border-b border-gray-100 bg-gray-50">
                  <div className="font-medium text-gray-700 flex justify-between items-center">
                    <span>Feedback Inbox</span>
                    <span className="bg-blue-100 text-gray-700 text-xs px-2 py-1 rounded-full">{unreadCount} New</span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 items-center">
                    <Button variant="secondary" className="text-xs py-1" onClick={markAllRead}>
                      Mark all as read
                    </Button>
                    <Button
                      variant="secondary"
                      className="text-xs py-1"
                      disabled={selectedIds.size === 0}
                      onClick={deleteSelected}
                    >
                      <Trash2 size={14} /> Delete selected
                    </Button>
                    {selectedIds.size > 0 && (
                      <Button variant="ghost" className="text-xs py-1" onClick={clearSelection}>
                        Clear ({selectedIds.size})
                      </Button>
                    )}
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto">
                  {data.feedbacks.length === 0 && (
                    <div className="p-8 text-center text-gray-400">No feedback yet.</div>
                  )}
                  {data.feedbacks.map(fb => (
                    <div 
                      key={fb.id}
                      onClick={() => setSelectedFeedback(fb)}
                      className={`p-4 border-b border-gray-100 cursor-pointer hover:bg-blue-50 transition-colors ${selectedFeedback?.id === fb.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : 'border-l-4 border-l-transparent'}`}
                    >
                      <div className="flex justify-between items-start mb-1 gap-3">
                        <div className="flex items-start gap-2 min-w-0">
                          <input
                            type="checkbox"
                            checked={selectedIds.has(fb.id)}
                            onChange={() => toggleSelected(fb.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 accent-[var(--brand)]"
                          />
                          <div className={`w-2 h-2 rounded-full mt-2 ${fb.status === 'NEW' ? 'bg-blue-500' : 'bg-gray-300'}`}></div>
                          <span className="font-semibold text-gray-900 truncate max-w-[160px]">{fb.customerName || 'Anonymous'}</span>
                          {fb.flagged && (
                            <span className="ml-1 inline-flex items-center text-[var(--brand)]" title="Flagged">
                              <Flag size={14} />
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFlag(fb.id);
                            }}
                            className={`p-1.5 rounded-lg border ${fb.flagged ? 'border-[var(--brand)] bg-[color:color-mix(in_srgb,var(--brand)_10%,white)] text-[var(--brand)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                            title={fb.flagged ? 'Unflag' : 'Flag'}
                          >
                            <Flag size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              DataManager.deleteFeedback([fb.id]);
                              if (selectedFeedback?.id === fb.id) setSelectedFeedback(null);
                              setSelectedIds(prev => {
                                const next = new Set(prev);
                                next.delete(fb.id);
                                return next;
                              });
                              showToast({ title: 'Deleted', message: 'Feedback removed.', onUndo: null });
                            }}
                            className="p-1.5 rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                          <span className="text-xs text-gray-400">{new Date(fb.timestamp).toLocaleDateString()}</span>
                        </div>
                      </div>
                      <div className="flex gap-1 mb-2">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={12} className={i < fb.stars ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                        ))}
                      </div>
                      <p className="text-sm text-gray-600 line-clamp-2">{fb.text}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Detail View */}
              {selectedFeedback && (
                <div className="w-full lg:flex-1 bg-white rounded-xl border border-gray-200 overflow-hidden flex flex-col animate-slide-in-right absolute inset-0 lg:static z-10">
                  <div className="p-4 lg:p-6 border-b border-gray-100 flex justify-between items-center">
                    <div className="flex items-center gap-3 lg:gap-4">
                        <Button variant="ghost" onClick={() => setSelectedFeedback(null)} className="lg:hidden p-1">
                          <ArrowLeft size={20} />
                        </Button>
                        <div className="truncate">
                          <h2 className="text-lg font-bold text-gray-900 truncate">{selectedFeedback.customerName || 'Anonymous'}</h2>
                          <div className="text-sm text-gray-500 truncate">{selectedFeedback.customerEmail || 'No email provided'}</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {selectedFeedback.status === 'NEW' && (
                        <Button variant="secondary" className="text-xs py-1" onClick={() => markOneRead(selectedFeedback.id)}>
                          Mark as read
                        </Button>
                      )}
                      <button
                        onClick={() => toggleFlag(selectedFeedback.id)}
                        className={`p-2 rounded-xl border ${selectedFeedback.flagged ? 'border-[var(--brand)] bg-[color:color-mix(in_srgb,var(--brand)_10%,white)] text-[var(--brand)]' : 'border-gray-200 text-gray-500 hover:bg-gray-50'}`}
                        title={selectedFeedback.flagged ? 'Unflag' : 'Flag'}
                      >
                        <Flag size={16} />
                      </button>
                      <button
                        onClick={() => {
                          DataManager.deleteFeedback([selectedFeedback.id]);
                          setSelectedFeedback(null);
                          setSelectedIds(prev => {
                            const next = new Set(prev);
                            next.delete(selectedFeedback.id);
                            return next;
                          });
                          showToast({ title: 'Deleted', message: 'Feedback removed.', onUndo: null });
                        }}
                        className="p-2 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50"
                        title="Delete"
                      >
                        <Trash2 size={16} />
                      </button>
                      <div className="text-sm text-gray-400 whitespace-nowrap hidden sm:block">
                        ID: {selectedFeedback.id}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 p-4 lg:p-6 overflow-y-auto">
                    <div className="flex items-center gap-2 mb-6">
                      <span className="text-2xl font-bold text-gray-900">{selectedFeedback.stars}.0</span>
                      <div className="flex">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} size={20} className={i < selectedFeedback.stars ? "fill-yellow-400 text-yellow-400" : "text-gray-200"} />
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100 text-gray-800 mb-8 leading-relaxed">
                      "{selectedFeedback.text}"
                    </div>

                    {selectedFeedback.answers && data.config.feedbackQuestions && (
                      <div className="mb-8">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Context</div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          {data.config.feedbackQuestions.map(q => {
                            const vals = selectedFeedback.answers?.[q.id] || [];
                            if (vals.length === 0) return null;
                            return (
                              <div key={q.id} className="bg-white p-3 rounded-lg border border-gray-100">
                                <div className="text-xs font-semibold text-gray-500 mb-1">{q.question}</div>
                                <div className="text-sm text-gray-800">{vals.join(', ')}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {selectedFeedback.reply && (
                      <div className="mb-8 pl-4 border-l-4 border-green-500">
                        <div className="text-xs font-bold text-green-600 uppercase mb-1">Your Reply</div>
                        <p className="text-gray-600 text-sm">{selectedFeedback.reply}</p>
                      </div>
                    )}

                    {!selectedFeedback.reply && selectedFeedback.customerEmail && (
                      <div className="bg-blue-50 p-4 lg:p-6 rounded-xl border border-blue-100">
                        <h3 className="font-bold text-gray-900 mb-2">Reply to Customer</h3>
                        <p className="text-sm text-gray-700 mb-4">This will be sent via email to {selectedFeedback.customerEmail}.</p>
                        <textarea 
                          className="w-full p-3 border border-blue-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none mb-3 min-h-[100px]"
                          placeholder="Type your response here..."
                          value={replyText}
                          onChange={(e) => setReplyText(e.target.value)}
                        />
                        <div className="flex justify-end">
                          <Button onClick={() => handleReply(selectedFeedback.id)}>
                            <Send size={16} /> <span className="hidden sm:inline">Send Reply</span>
                          </Button>
                        </div>
                      </div>
                    )}

                    {!selectedFeedback.customerEmail && !selectedFeedback.reply && (
                      <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm flex items-center gap-2">
                        <AlertCircle size={16} className="flex-shrink-0"/> 
                        <span>Customer did not leave contact details. You cannot reply directly.</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* VIEW: SETTINGS */}
          {activeTab === 'SETTINGS' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <div>
                <h1 className="text-2xl font-bold">Settings</h1>
                <p className="text-gray-500">Configure how the routing works.</p>
              </div>
              
              <Card className="p-4 lg:p-6">
                <form onSubmit={handleUpdateConfig} className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Business Name</label>
                    <input
                      name="bizName"
                      value={draftConfig.name}
                      onChange={(e) => setDraftConfig(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full p-2 border rounded-lg bg-gray-50"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Routing Threshold</label>
                    <div className="p-4 bg-[color:color-mix(in_srgb,var(--brand)_10%,white)] rounded-lg border border-[color:color-mix(in_srgb,var(--brand)_20%,white)] mb-2">
                        <p className="text-sm text-blue-800 mb-2">
                          If a customer rates <strong>{draftConfig.minStarThreshold} stars or higher</strong>, they are <strong>automatically redirected</strong> to Google.
                          <br/>Otherwise, they stay here for internal feedback.
                        </p>
                        <input
                          name="threshold"
                          type="range"
                          min="1"
                          max="5"
                          step="1"
                          value={draftConfig.minStarThreshold}
                          className="w-full accent-[var(--brand)]"
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, minStarThreshold: Number(e.target.value) }))}
                        />
                        <div className="text-right font-bold text-[var(--brand)] mt-1">{draftConfig.minStarThreshold} Stars</div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Google Review Link</label>
                    <input
                      name="googleUrl"
                      value={draftConfig.googlePlaceUrl}
                      onChange={(e) => setDraftConfig(prev => ({ ...prev, googlePlaceUrl: e.target.value }))}
                      className="w-full p-2 border rounded-lg bg-gray-50 font-mono text-xs"
                    />
                    <p className="text-xs text-gray-400 mt-1">Direct link to the review dialog (search.google.com/...)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Exit Redirect URL</label>
                    <input
                      name="redirectUrl"
                      value={draftConfig.redirectUrl}
                      onChange={(e) => setDraftConfig(prev => ({ ...prev, redirectUrl: e.target.value }))}
                      className="w-full p-2 border rounded-lg bg-gray-50 font-mono text-xs"
                      placeholder="https://yourbusiness.com"
                    />
                    <p className="text-xs text-gray-400 mt-1">Used when customers click Cancel, the close (X), or Done.</p>
                  </div>

                  <div className="pt-2">
                    <div className="text-sm font-semibold text-gray-800 mb-2">Theme</div>
                    <p className="text-xs text-gray-500 mb-3">These settings apply to both the customer flow and this dashboard.</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Brand / Accent</label>
                        <input
                          name="brandColor"
                          type="color"
                          value={draftConfig.theme.brandColor}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, theme: { ...prev.theme, brandColor: e.target.value } }))}
                          className="w-full h-11 p-1 border rounded-lg bg-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">Buttons, stars, highlights.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Customer Background</label>
                        <input
                          name="pageBg"
                          type="color"
                          value={draftConfig.theme.pageBg}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, theme: { ...prev.theme, pageBg: e.target.value } }))}
                          className="w-full h-11 p-1 border rounded-lg bg-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">Customer landing background.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Dashboard Background</label>
                        <input
                          name="adminBg"
                          type="color"
                          value={draftConfig.theme.adminBg}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, theme: { ...prev.theme, adminBg: e.target.value } }))}
                          className="w-full h-11 p-1 border rounded-lg bg-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">Main app background.</p>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Card Background</label>
                        <input
                          name="cardBg"
                          type="color"
                          value={draftConfig.theme.cardBg}
                          onChange={(e) => setDraftConfig(prev => ({ ...prev, theme: { ...prev.theme, cardBg: e.target.value } }))}
                          className="w-full h-11 p-1 border rounded-lg bg-white"
                        />
                        <p className="text-xs text-gray-400 mt-1">Panels and cards.</p>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2">
                    <div className="text-sm font-semibold text-gray-800 mb-2">Low-rating Questions</div>
                    <p className="text-xs text-gray-500 mb-3">Configure questions shown when a customer rates below your threshold.</p>
                    <QuestionBuilder value={draftQuestions} onChange={setDraftQuestions} />
                  </div>

                  <div className="pt-4 border-t border-gray-100 flex justify-end">
                    <Button type="submit">Save Changes</Button>
                  </div>
                </form>
              </Card>
            </div>
          )}

          {/* VIEW: LINKS */}
          {activeTab === 'LINKS' && (
            <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
              <div>
                <h1 className="text-2xl font-bold">QR Codes & Links</h1>
                <p className="text-gray-500">Entry points for your customers.</p>
              </div>
              
              <Card className="p-4 lg:p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-center sm:text-left">
                    <h3 className="font-bold text-lg">General QR Code</h3>
                    <p className="text-sm text-gray-500">Default entry point for {data.config.name}</p>
                    <div className="mt-2 text-xs text-gray-400 font-mono break-all">{baseCustomerLink}</div>
                  </div>
                  <div className="bg-[var(--card-bg)] p-2 border rounded-lg flex-shrink-0">
                    <QRCodeCanvas value={baseCustomerLink} size={110} includeMargin />
                  </div>
              </Card>

              {(() => {
                const eps = (data.config.entryPoints || []) as EntryPoint[];
                const buildUrl = (src: string) => `${baseCustomerLink}?src=${encodeURIComponent(src)}`;
                return (
                  <Card className="p-4 lg:p-6">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-semibold text-gray-800">Manage Links</div>
                        <p className="text-sm text-gray-500">Add, edit, or remove customer entry points (tables, invoices, email footers, etc.).</p>
                      </div>
                      <Button onClick={openAddEntryPoint} className="shrink-0">
                        <Plus size={16} /> Add
                      </Button>
                    </div>

                    <div className="mt-4 overflow-x-auto">
                      <table className="min-w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wider text-gray-400 border-b">
                            <th className="py-2 pr-4">Label</th>
                            <th className="py-2 pr-4">Source</th>
                            <th className="py-2 pr-4">Link</th>
                            <th className="py-2 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {eps.length === 0 && (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-gray-400">No entry points yet. Add one to get started.</td>
                            </tr>
                          )}
                          {eps.map(ep => {
                            const url = buildUrl(ep.src);
                            return (
                              <tr key={ep.id} className="border-b last:border-b-0">
                                <td className="py-3 pr-4 font-medium text-gray-900 whitespace-nowrap">{ep.label}</td>
                                <td className="py-3 pr-4 font-mono text-xs text-gray-500 whitespace-nowrap">{ep.src}</td>
                                <td className="py-3 pr-4">
                                  <div className="font-mono text-xs text-gray-500 truncate max-w-[360px]">{url}</div>
                                </td>
                                <td className="py-3 text-right">
                                  <div className="inline-flex items-center gap-2">
                                    <Button variant="outline" className="text-xs py-1" onClick={() => copyToClipboard(url)}>Copy</Button>
                                    <button
                                      onClick={() => openEditEntryPoint(ep)}
                                      className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                                      title="Edit"
                                    >
                                      <Pencil size={16} />
                                    </button>
                                    <button
                                      onClick={() => deleteEntryPoint(ep.id)}
                                      className="p-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50"
                                      title="Delete"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mt-6">
                      <div className="text-sm font-semibold text-gray-800 mb-1">Per-source QR Codes</div>
                      <p className="text-sm text-gray-500 mb-4">Use these to identify where the customer came from.</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {eps.map(ep => {
                          const url = buildUrl(ep.src);
                          return (
                            <div key={`qr_${ep.id}`} className="border rounded-xl p-4 flex items-center justify-between gap-4">
                              <div className="min-w-0">
                                <div className="font-medium">{ep.label}</div>
                                <div className="text-xs text-gray-400 font-mono break-all">{url}</div>
                                <div className="mt-3">
                                  <Button variant="outline" className="text-xs py-1" onClick={() => copyToClipboard(url)}>
                                    Copy Link
                                  </Button>
                                </div>
                              </div>
                              <div className="bg-[var(--card-bg)] p-2 border rounded-lg flex-shrink-0">
                                <QRCodeCanvas value={url} size={92} includeMargin />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </Card>
                );
              })()}
            </div>
          )}

        </main>
      </div>
    </div>
  );
};

// --- Helper Components ---

const SidebarItem = ({ icon, label, badge, active, onClick }: any) => (
  <button 
    onClick={onClick}
    className={`w-full flex items-center justify-between p-3 rounded-lg text-sm font-medium transition-colors mb-1 ${active ? 'bg-[color:color-mix(in_srgb,var(--brand)_12%,white)] text-[var(--brand)]' : 'text-gray-600 hover:bg-gray-50'}`}
  >
    <div className="flex items-center gap-3">
      {icon}
      <span>{label}</span>
    </div>
    {badge && <span className="bg-[var(--brand)] text-white text-[10px] px-2 py-0.5 rounded-full">{badge}</span>}
  </button>
);

const StatCard = ({ label, value, sub, icon }: any) => (
  <div className="bg-[var(--card-bg)] p-6 rounded-xl border border-gray-100 shadow-sm">
    <div className="flex justify-between items-start mb-4">
      <div className="text-gray-500 text-sm font-medium">{label}</div>
      <div className="p-2 bg-gray-50 rounded-lg">{icon}</div>
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
    {sub && <div className="text-xs text-gray-400 mt-1">{sub}</div>}
  </div>
);

// --- Main App Entry ---

const App = () => {
  const computeRoleFromPath = () => (window.location.pathname.startsWith('/admin') ? 'OWNER' : 'CUSTOMER') as 'CUSTOMER' | 'OWNER';
  const [role, setRole] = useState<'CUSTOMER' | 'OWNER'>(computeRoleFromPath());
  const [data, setData] = useState(DataManager.load());

  const refresh = () => {
    const next = DataManager.load();
    setData(next);
    applyTheme(next.config);
  };

  useEffect(() => {
    refresh();
    window.addEventListener('db-update', refresh);
    const onPop = () => setRole(computeRoleFromPath());
    window.addEventListener('popstate', onPop);
    return () => {
      window.removeEventListener('db-update', refresh);
      window.removeEventListener('popstate', onPop);
    };
  }, []);

  const goAdmin = () => {
    window.history.pushState({}, '', '/admin');
    setRole('OWNER');
  };

  const goCustomer = () => {
    window.history.pushState({}, '', '/');
    setRole('CUSTOMER');
  };

  return (
    <>
      {role === 'CUSTOMER' ? (
        <CustomerView config={data.config} onSwitchRole={goAdmin} />
      ) : (
        <AdminDashboard onLogout={goCustomer} />
      )}
    </>
  );
};

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
