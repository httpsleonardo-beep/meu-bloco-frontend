import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchNote, saveNote } from './api';
import './App.css';

const AUTO_SAVE_DELAY = 3000; // 3 segundos

function App() {
    const [content, setContent] = useState('');
    const [version, setVersion] = useState(1);
    const [status, setStatus] = useState('idle'); // idle | loading | saving | saved | error | conflict
    const [errorMsg, setErrorMsg] = useState('');
    const [lastSaved, setLastSaved] = useState(null);
    const [autoSave, setAutoSave] = useState(true);
    const [charCount, setCharCount] = useState(0);

    const autoSaveTimerRef = useRef(null);
    const hasChangesRef = useRef(false);
    const contentRef = useRef(content);
    const versionRef = useRef(version);

    // Keep refs in sync
    useEffect(() => {
        contentRef.current = content;
        versionRef.current = version;
        setCharCount(content.length);
    }, [content, version]);

    // ── Carregar nota ao abrir ──────────────────────────────
    useEffect(() => {
        async function loadNote() {
            setStatus('loading');
            try {
                const data = await fetchNote();
                setContent(data.content || '');
                setVersion(data.version || 1);
                if (data.updated_at) {
                    setLastSaved(new Date(data.updated_at));
                }
                setStatus('idle');
            } catch (err) {
                setStatus('error');
                setErrorMsg('Não foi possível carregar a nota. Verifique sua conexão.');
                console.error(err);
            }
        }
        loadNote();
    }, []);

    // ── Salvar nota ─────────────────────────────────────────
    const handleSave = useCallback(async () => {
        if (status === 'saving') return;

        setStatus('saving');
        setErrorMsg('');

        try {
            const data = await saveNote(contentRef.current, versionRef.current);
            setVersion(data.version);
            setLastSaved(new Date(data.updated_at));
            hasChangesRef.current = false;
            setStatus('saved');

            // Voltar para idle após 2 segundos
            setTimeout(() => {
                setStatus((prev) => (prev === 'saved' ? 'idle' : prev));
            }, 2000);
        } catch (err) {
            if (err.status === 409) {
                setStatus('conflict');
                setErrorMsg(
                    'Conflito: O documento foi alterado por outra pessoa. Recarregue a página para ver as mudanças.'
                );
            } else {
                setStatus('error');
                setErrorMsg(err.message || 'Erro ao salvar.');
            }
            console.error(err);
        }
    }, [status]);

    // ── Auto-save ───────────────────────────────────────────
    useEffect(() => {
        if (!autoSave || !hasChangesRef.current) return;

        if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
        }

        autoSaveTimerRef.current = setTimeout(() => {
            if (hasChangesRef.current) {
                handleSave();
            }
        }, AUTO_SAVE_DELAY);

        return () => {
            if (autoSaveTimerRef.current) {
                clearTimeout(autoSaveTimerRef.current);
            }
        };
    }, [content, autoSave, handleSave]);

    // ── Mudança no texto ────────────────────────────────────
    const handleChange = (e) => {
        setContent(e.target.value);
        hasChangesRef.current = true;
        if (status === 'saved' || status === 'error') {
            setStatus('idle');
        }
    };

    // ── Recarregar ao conflito ──────────────────────────────
    const handleReload = async () => {
        setStatus('loading');
        try {
            const data = await fetchNote();
            setContent(data.content || '');
            setVersion(data.version || 1);
            if (data.updated_at) {
                setLastSaved(new Date(data.updated_at));
            }
            setStatus('idle');
            setErrorMsg('');
        } catch (err) {
            setStatus('error');
            setErrorMsg('Erro ao recarregar.');
        }
    };

    // ── Atalho Ctrl+S ──────────────────────────────────────
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                handleSave();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [handleSave]);

    // ── Formatar data ───────────────────────────────────────
    const formatDate = (date) => {
        if (!date) return '';
        return date.toLocaleString('pt-BR', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
        });
    };

    // ── Render ──────────────────────────────────────────────
    return (
        <div className="app">
            {/* Background animated blobs */}
            <div className="bg-blob blob-1" />
            <div className="bg-blob blob-2" />
            <div className="bg-blob blob-3" />

            <div className="container">
                {/* Header */}
                <header className="header">
                    <div className="header-left">
                        <div className="logo">
                            <span className="logo-icon">📝</span>
                            <h1>Bloco de Notas</h1>
                        </div>
                        <span className="badge">Compartilhado</span>
                    </div>
                    <div className="header-right">
                        <label className="auto-save-toggle" id="auto-save-label">
                            <input
                                type="checkbox"
                                checked={autoSave}
                                onChange={(e) => setAutoSave(e.target.checked)}
                                id="auto-save-checkbox"
                            />
                            <span className="toggle-slider" />
                            <span className="toggle-text">Auto-save</span>
                        </label>
                    </div>
                </header>

                {/* Editor */}
                <main className="editor-wrapper">
                    {status === 'loading' ? (
                        <div className="loading-container">
                            <div className="spinner" />
                            <p>Carregando nota...</p>
                        </div>
                    ) : (
                        <textarea
                            id="note-textarea"
                            className="editor"
                            value={content}
                            onChange={handleChange}
                            placeholder="Comece a escrever aqui... ✍️&#10;&#10;Qualquer pessoa com o link pode editar este documento.&#10;Use Ctrl+S para salvar rapidamente."
                            spellCheck={true}
                            autoFocus
                        />
                    )}
                </main>

                {/* Status Bar */}
                <footer className="status-bar">
                    <div className="status-left">
                        {/* Status indicator */}
                        <div className={`status-indicator status-${status}`}>
                            {status === 'idle' && (
                                <>
                                    <span className="status-dot idle" />
                                    <span>Pronto</span>
                                </>
                            )}
                            {status === 'saving' && (
                                <>
                                    <span className="status-dot saving" />
                                    <span>Salvando...</span>
                                </>
                            )}
                            {status === 'saved' && (
                                <>
                                    <span className="status-dot saved" />
                                    <span>Salvo ✓</span>
                                </>
                            )}
                            {status === 'error' && (
                                <>
                                    <span className="status-dot error" />
                                    <span>Erro</span>
                                </>
                            )}
                            {status === 'conflict' && (
                                <>
                                    <span className="status-dot conflict" />
                                    <span>Conflito</span>
                                </>
                            )}
                            {status === 'loading' && (
                                <>
                                    <span className="status-dot saving" />
                                    <span>Carregando...</span>
                                </>
                            )}
                        </div>

                        {/* Error/Conflict message */}
                        {errorMsg && (
                            <div className="error-message">
                                <span>{errorMsg}</span>
                                {status === 'conflict' && (
                                    <button
                                        className="btn btn-small btn-reload"
                                        onClick={handleReload}
                                        id="reload-button"
                                    >
                                        Recarregar
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="status-right">
                        <span className="char-count">{charCount.toLocaleString('pt-BR')} caracteres</span>
                        {lastSaved && (
                            <span className="last-saved">
                                Última alteração: {formatDate(lastSaved)}
                            </span>
                        )}
                        <button
                            className="btn btn-save"
                            onClick={handleSave}
                            disabled={status === 'saving' || status === 'loading'}
                            id="save-button"
                        >
                            {status === 'saving' ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </footer>
            </div>
        </div>
    );
}

export default App;
