import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

const API = 'http://localhost:8000';

const ChatWindow = () => {
  const { chatId } = useParams();
  const navigate = useNavigate();
  const messagesEndRef = useRef(null);
  const markingReadChatIdRef = useRef(null);

  const role = localStorage.getItem('kb_role');
  const userName = localStorage.getItem('kb_name') || 'User';

  const [threads, setThreads] = useState([]);
  const [activeChatDetail, setActiveChatDetail] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState('');
  const [loadingThreads, setLoadingThreads] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sendError, setSendError] = useState('');

  const dashboardPath = role === 'food_provider' ? '/fp/dashboard' : '/ngo/dashboard';
  const dashboardLabel = role === 'food_provider' ? 'My Listings' : 'Browse Listings';

  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('kb_token')}`,
  });

  const logoutToLogin = useCallback(() => {
    localStorage.clear();
    navigate('/login');
  }, [navigate]);

  const getInitials = (name) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((word) => word[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  const formatThreadTime = (dt) => {
    if (!dt) return '';
    const date = new Date(dt);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    return isToday
      ? date.toLocaleTimeString('en-PK', { hour: 'numeric', minute: '2-digit' })
      : date.toLocaleDateString('en-PK', { month: 'short', day: 'numeric' });
  };

  const formatMessageTime = (dt) => {
    if (!dt) return '';
    return new Date(dt).toLocaleTimeString('en-PK', {
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  const fetchThreads = useCallback(
    async (silent = false) => {
      if (!silent) setLoadingThreads(true);
      try {
        const res = await fetch(`${API}/chats`, {
          headers: authHeader(),
        });

        if (res.status === 401) {
          logoutToLogin();
          return;
        }

        const data = await res.json().catch(() => ([]));
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to load chats.');
        }

        setThreads(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load chats.');
      } finally {
        if (!silent) setLoadingThreads(false);
      }
    },
    [logoutToLogin]
  );

  const fetchChatDetail = useCallback(
    async (targetChatId) => {
      try {
        const res = await fetch(`${API}/chats/${targetChatId}`, {
          headers: authHeader(),
        });

        if (res.status === 401) {
          logoutToLogin();
          return;
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to load chat details.');
        }

        setActiveChatDetail(data);
      } catch (err) {
        setError(err.message || 'Failed to load chat details.');
      }
    },
    [logoutToLogin]
  );

  const fetchMessages = useCallback(
    async (targetChatId, silent = false) => {
      if (!silent) setLoadingMessages(true);
      try {
        const res = await fetch(`${API}/chats/${targetChatId}/messages`, {
          headers: authHeader(),
        });

        if (res.status === 401) {
          logoutToLogin();
          return;
        }

        const data = await res.json().catch(() => ([]));
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to load messages.');
        }

        setMessages(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load messages.');
      } finally {
        if (!silent) setLoadingMessages(false);
      }
    },
    [logoutToLogin]
  );

  const markChatAsRead = useCallback(
    async (targetChatId) => {
      if (!targetChatId || markingReadChatIdRef.current === targetChatId) return;
      markingReadChatIdRef.current = targetChatId;

      try {
        const res = await fetch(`${API}/chats/${targetChatId}/read`, {
          method: 'POST',
          headers: authHeader(),
        });

        if (res.status === 401) {
          logoutToLogin();
          return;
        }

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || 'Failed to update read status.');
        }

        setThreads((prev) =>
          prev.map((thread) =>
            thread.id === targetChatId ? { ...thread, unread_count: 0 } : thread
          )
        );
        setActiveChatDetail((prev) => (prev && prev.id === targetChatId ? { ...prev, unread_count: 0 } : prev));
      } catch {
        // Ignore transient read-sync failures; polling will retry.
      } finally {
        if (markingReadChatIdRef.current === targetChatId) {
          markingReadChatIdRef.current = null;
        }
      }
    },
    [logoutToLogin]
  );

  useEffect(() => {
    const token = localStorage.getItem('kb_token');
    if (!token || (role !== 'food_provider' && role !== 'ngo')) {
      navigate('/login');
      return;
    }

    fetchThreads();
  }, [fetchThreads, navigate, role]);

  const activeChatId = useMemo(() => {
    const parsed = Number(chatId);
    if (!Number.isInteger(parsed) || parsed <= 0) return null;
    return parsed;
  }, [chatId]);

  useEffect(() => {
    if (loadingThreads || activeChatId) return;

    if (threads.length > 0) {
      navigate(`/chat/${threads[0].id}`, { replace: true });
    } else {
      setActiveChatDetail(null);
      setMessages([]);
    }
  }, [activeChatId, loadingThreads, navigate, threads]);

  useEffect(() => {
    if (!activeChatId) return;

    fetchChatDetail(activeChatId);
    fetchMessages(activeChatId);

    const interval = setInterval(() => {
      fetchMessages(activeChatId, true);
      fetchThreads(true);
    }, 4000);

    return () => clearInterval(interval);
  }, [activeChatId, fetchChatDetail, fetchMessages, fetchThreads]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeThread = threads.find((thread) => thread.id === activeChatId) || null;
  const activeUnreadCount = activeThread?.unread_count || 0;
  const totalUnreadChats = threads.filter((thread) => (thread.unread_count || 0) > 0).length;

  useEffect(() => {
    if (!activeChatId || activeUnreadCount <= 0) return;
    markChatAsRead(activeChatId);
  }, [activeChatId, activeUnreadCount, markChatAsRead]);

  const counterpartName =
    role === 'food_provider'
      ? activeChatDetail?.ngo_name || activeThread?.counterpart_name || 'NGO'
      : activeChatDetail?.food_provider_name || activeThread?.counterpart_name || 'Food Provider';

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!activeChatId) return;

    const trimmedMessage = draft.trim();
    if (!trimmedMessage) {
      setSendError('Message cannot be empty.');
      return;
    }

    setSending(true);
    setSendError('');

    try {
      const res = await fetch(`${API}/chats/${activeChatId}/messages`, {
        method: 'POST',
        headers: {
          ...authHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message_text: trimmedMessage }),
      });

      if (res.status === 401) {
        logoutToLogin();
        return;
      }

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || 'Failed to send message.');
      }

      setMessages((prev) => [...prev, data]);
      setDraft('');

      setThreads((prev) =>
        prev.map((thread) =>
          thread.id === activeChatId
            ? {
                ...thread,
                last_message_preview: data.message_text,
                last_message_at: data.sent_at,
                message_count: (thread.message_count || 0) + 1,
                unread_count: 0,
              }
            : thread
        )
      );

      fetchChatDetail(activeChatId);
    } catch (err) {
      setSendError(err.message || 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <nav id="nav">
        <Link to={dashboardPath} className="nav-brand">
          <div className="leaf">🍃</div>
          Khana Bachao
        </Link>

        <div className="nav-links">
          <Link to={dashboardPath} className="nav-link">{dashboardLabel}</Link>
          <Link to="/chat" className="nav-link active nav-link-with-badge">
            Messages
            {totalUnreadChats > 0 && (
              <span className="nav-unread-badge">{totalUnreadChats > 99 ? '99+' : totalUnreadChats}</span>
            )}
          </Link>
        </div>

        <div className="nav-right">
          <div className="nav-user">
            <div className={`avatar${role === 'ngo' ? ' ngo' : ''}`}>{getInitials(userName)}</div>
            <span>{userName}</span>
          </div>
          <button className="btn-logout" onClick={logoutToLogin}>Sign out</button>
        </div>
      </nav>

      <div className="chat-layout">
        <aside className="chat-sidebar">
          <div className="chat-sidebar-header">Conversations</div>

          {loadingThreads ? (
            <div className="empty-state" style={{ padding: '28px 16px' }}>
              <div className="empty-sub">Loading chats...</div>
            </div>
          ) : threads.length === 0 ? (
            <div className="empty-state" style={{ padding: '28px 16px' }}>
              <div className="empty-sub">No chat yet. Claim a listing to start coordinating.</div>
            </div>
          ) : (
            threads.map((thread) => (
              <div
                key={thread.id}
                className={`chat-thread ${thread.id === activeChatId ? 'active' : ''}`}
                onClick={() => navigate(`/chat/${thread.id}`)}
              >
                <div className="chat-thread-meta">
                  <div className="chat-thread-title">{thread.counterpart_name}</div>
                  <div className="chat-thread-time">{formatThreadTime(thread.last_message_at || thread.created_at)}</div>
                </div>
                <div className="chat-thread-sub chat-thread-sub-row">
                  <span>{thread.food_summary}</span>
                  {thread.unread_count > 0 && (
                    <span className="chat-unread-badge">
                      {thread.unread_count > 99 ? '99+' : thread.unread_count}
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </aside>

        <section className="chat-main">
          {error && <div className="alert alert-error show" style={{ margin: '12px 16px 0' }}>{error}</div>}

          {!activeChatId ? (
            <div className="empty-state" style={{ margin: 'auto' }}>
              <div className="empty-icon">💬</div>
              <div className="empty-title">Select a conversation</div>
              <div className="empty-sub">Open a claimed listing chat to coordinate pickup details.</div>
            </div>
          ) : (
            <>
              <div className="chat-topbar">
                <div className={`avatar${role === 'ngo' ? '' : ' ngo'}`}>{getInitials(counterpartName)}</div>
                <div className="chat-topbar-info">
                  <div className="chat-topbar-title">{counterpartName}</div>
                  <div className="chat-topbar-sub">Listing #{activeThread?.listing_id || activeChatDetail?.listing_id}</div>
                </div>
                <div className="chat-listing-pill">
                  <span>{activeThread?.food_summary || activeChatDetail?.food_summary || 'Food listing'}</span>
                </div>
              </div>

              <div className="chat-messages">
                {loadingMessages ? (
                  <div className="empty-state" style={{ paddingTop: '20px' }}>
                    <div className="empty-sub">Loading messages...</div>
                  </div>
                ) : messages.length === 0 ? (
                  <div className="empty-state" style={{ paddingTop: '20px' }}>
                    <div className="empty-sub">No messages yet. Start the coordination.</div>
                  </div>
                ) : (
                  messages.map((message) => {
                    const sentByMe = message.sender_type === role;
                    return (
                      <div key={message.id} className={`msg ${sentByMe ? 'sent' : ''}`}>
                        <div className="msg-avatar">
                          {sentByMe ? getInitials(userName) : getInitials(counterpartName)}
                        </div>
                        <div>
                          <div className="msg-bubble">{message.message_text}</div>
                          <div className="msg-time">{formatMessageTime(message.sent_at)}</div>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {activeChatDetail?.listing_status === 'completed' || activeThread?.listing_status === 'completed' ? (
                <div style={{
                  padding: '16px',
                  textAlign: 'center',
                  color: '#888',
                  fontSize: '14px',
                  borderTop: '1px solid var(--border)',
                  background: 'var(--bg-secondary)'
                }}>
                  🔒 This chat is closed — the pickup has been completed.
                </div>
              ) : (
                <>
                  <form className="chat-input-bar" onSubmit={sendMessage}>
                    <input
                      className="chat-input"
                      type="text"
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      placeholder="Type your message..."
                      maxLength={1000}
                      disabled={sending}
                    />
                    <button className="chat-send" type="submit" disabled={sending}>
                      {sending ? <span className="spinner" style={{ width: 16, height: 16 }} /> : '➤'}
                    </button>
                  </form>
                  {sendError && <div className="alert alert-error show" style={{ margin: '0 16px 12px' }}>{sendError}</div>}
                </>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
};

export default ChatWindow;
