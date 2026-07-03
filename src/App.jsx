import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  Upload,
  MessageSquare,
  Clock,
  History,
  FileJson,
  X,
  Github,
  Moon,
  Sun,
  Menu,
  Settings,
  Trash2
} from 'lucide-react';
import { format } from 'date-fns';
import MarkdownIt from 'markdown-it';
import hljs from 'highlight.js';
import { parseConversations } from './utils/parser';
import { saveRawJson, loadRawJson, clearCachedData, getCacheSize } from './utils/storage';
import './App.css';

const md = new MarkdownIt({
  highlight: function (str, lang) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        return hljs.highlight(str, { language: lang }).value;
      } catch (err) {
        console.error("Error highlighting code:", err);
      }
    }
    return ''; // use external default escaping
  }
});

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

function App() {
  const [conversations, setConversations] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('chatgpt-viewer-theme') || 'dark';
  });
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [cacheSize, setCacheSize] = useState(0);

  const closeMenu = () => setMenuOpen(false);

  // Sync theme to <html> + highlight.js + theme-color meta
  useEffect(() => {
    // Sync data-theme to <html> so body inherits correct CSS variables
    document.documentElement.setAttribute('data-theme', theme);

    // Dynamic highlight.js theme
    const existingLink = document.querySelector('[data-highlight-theme]');
    if (existingLink) {
      existingLink.remove();
    }
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = theme === 'dark'
      ? 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github-dark.min.css'
      : 'https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.11.1/styles/github.min.css';
    link.setAttribute('data-highlight-theme', '');
    document.head.appendChild(link);

    // Update mobile browser chrome color
    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme) {
      metaTheme.content = theme === 'dark' ? '#0f1115' : '#ffffff';
    }
  }, [theme]);

  // Persist theme preference
  useEffect(() => {
    localStorage.setItem('chatgpt-viewer-theme', theme);
  }, [theme]);

  // Restore cached data from IndexedDB on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rawText = await loadRawJson();
        if (cancelled) return;
        if (rawText) {
          const json = JSON.parse(rawText);
          const parsed = parseConversations(json);
          if (cancelled) return;
          setConversations(parsed);
          if (parsed.length > 0) {
            setSelectedId(parsed[0].id);
          }
        }
      } catch (err) {
        console.warn('Failed to restore cached data:', err);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    // Refresh cache size when panel opens
    getCacheSize().then(s => setCacheSize(s)).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Refresh cache size when conversations change
  useEffect(() => {
    getCacheSize().then(s => setCacheSize(s)).catch(() => {});
  }, [conversations]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  const clearCache = async () => {
    if (conversations.length === 0) return;
    setConversations([]);
    setSelectedId(null);
    try {
      await clearCachedData();
      setCacheSize(0);
    } catch (err) {
      console.warn('Failed to clear IndexedDB cache:', err);
    }
  };

  // Handle file upload
  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawText = event.target.result;
        const json = JSON.parse(rawText);
        const parsed = parseConversations(json);
        setConversations(parsed);
        if (parsed.length > 0) {
          setSelectedId(parsed[0].id);
        }
        // Persist raw text to IndexedDB
        await saveRawJson(rawText);
      } catch (err) {
        console.error("Error parsing JSON file:", err);
        alert("Erro ao ler o ficheiro JSON. Certifica-te que é um formato válido de exportação do ChatGPT.");
      }
    };
    reader.readAsText(file);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file && file.type === "application/json") {
      const reader = new FileReader();
      reader.onload = async (event) => {
        try {
          const rawText = event.target.result;
          const json = JSON.parse(rawText);
          const parsed = parseConversations(json);
          setConversations(parsed);
          if (parsed.length > 0) {
            setSelectedId(parsed[0].id);
          }
          // Persist raw text to IndexedDB
          await saveRawJson(rawText);
        } catch (err) {
          console.error("Error parsing JSON file:", err);
          alert("Erro ao ler o ficheiro JSON.");
        }
      };
      reader.readAsText(file);
    }
  };

  const filteredConversations = useMemo(() => {
    if (!searchTerm) return conversations;
    const lowerSearch = searchTerm.toLowerCase();
    return conversations.filter(conv =>
      conv.title.toLowerCase().includes(lowerSearch) ||
      conv.messages.some(msg => msg.content.toLowerCase().includes(lowerSearch))
    );
  }, [conversations, searchTerm]);

  const activeConversation = useMemo(() =>
    conversations.find(c => c.id === selectedId),
    [conversations, selectedId]
  );

  return (
    <div className="app-container" data-theme={theme}
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
    >
      {/* Mobile Overlay */}
      <div className={`sidebar-overlay ${menuOpen ? 'visible' : ''}`} onClick={closeMenu} />

      {/* Mobile Hamburger */}
      <button className="hamburger-btn" onClick={() => setMenuOpen(prev => !prev)} aria-label="Menu">
        <Menu size={24} />
      </button>

      <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1><MessageSquare size={24} /> ChatGPT Viewer</h1>
            <button className="settings-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">
              <Settings size={20} />
            </button>
          </div>
          <div className="search-box">
            <Search size={18} />
            <input
              type="text"
              placeholder="Pesquisar conversas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className="conversation-list">
          {filteredConversations.map(conv => (
            <div
              key={conv.id}
              className={`conversation-item ${selectedId === conv.id ? 'active' : ''}`}
              onClick={() => { setSelectedId(conv.id); closeMenu(); }}
            >
              <div className="title">{conv.title}</div>
              <div className="date">{format(conv.createTime, 'dd MMM yyyy')}</div>
            </div>
          ))}
          {conversations.length > 0 && filteredConversations.length === 0 && (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              Nenhuma conversa encontrada.
            </div>
          )}
        </div>
      </aside>

      <main className="main-content">
        {isLoading ? (
          <div className="welcome-area">
            <div className="drop-zone" style={{ cursor: 'default', borderStyle: 'solid' }}>
              <FileJson />
              <h2>Restoring data...</h2>
              <p>Recuperando dados do cache local.</p>
            </div>
          </div>
        ) : !activeConversation ? (
          <div className="welcome-area">
            <div className={`drop-zone ${isDragging ? 'dragging' : ''}`} onClick={() => document.getElementById('fileInput').click()}>
              <FileJson />
              <h2>Importar Conversas</h2>
              <p>Arrasta o ficheiro <code>conversations.json</code> ou clica para selecionar.</p>
              <input
                id="fileInput"
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          </div>
        ) : (
          <>
            <div className="chat-container">
              {activeConversation.messages.map((msg, idx) => (
                <div key={idx} className={`message ${msg.role}`}>
                  <div className={`${msg.role === "user" ? 'message-bubble' : ''}`}>
                    <div
                      className="message-content"
                      dangerouslySetInnerHTML={{ __html: md.render(msg.content) }}
                    />
                  </div>
                  <div className="message-meta">
                    {msg.role === 'user' ? 'Tu' : (msg.authorName || 'ChatGPT')} • {format(msg.createTime, 'HH:mm')}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Settings Overlay */}
      <div className={`settings-overlay ${settingsOpen ? 'visible' : ''}`} onClick={() => setSettingsOpen(false)} />

      {/* Settings Panel */}
      <div className={`settings-panel ${settingsOpen ? 'open' : ''}`}>
        <div className="settings-header">
          <h2><Settings size={22} /> Settings</h2>
          <button className="settings-close" onClick={() => setSettingsOpen(false)} aria-label="Close settings">
            <X size={20} />
          </button>
        </div>

        {/* Appearance */}
        <div className="settings-section">
          <div className="settings-section-title">Appearance</div>
          <div className="settings-item">
            <div className="settings-item-label">
              <span className="label-title">Theme Mode</span>
              <span className="label-desc">{theme === 'dark' ? '🌙 Dark' : '☀️ Light'}</span>
            </div>
            <button
              className={`toggle-switch ${theme === 'light' ? 'active' : ''}`}
              onClick={toggleTheme}
              aria-label="Toggle theme"
            />
          </div>
        </div>

        {/* Storage & Cache */}
        <div className="settings-section">
          <div className="settings-section-title">Storage &amp; Cache</div>
          <div className="settings-item">
            <div className="settings-item-label">
              <span className="label-title">Cached Conversations</span>
              <span className="label-desc">
                {conversations.length > 0
                  ? `${conversations.length} conversation${conversations.length !== 1 ? 's' : ''} · ${formatBytes(cacheSize)}`
                  : 'No cached data'}
              </span>
            </div>
          </div>
          <div style={{ marginTop: '0.75rem' }}>
            <button
              className="clear-btn"
              onClick={clearCache}
              disabled={conversations.length === 0}
              style={conversations.length === 0 ? { opacity: 0.4, cursor: 'not-allowed' } : {}}
            >
              <Trash2 size={16} /> Clear Cache
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
