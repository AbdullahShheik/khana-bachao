import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API = 'http://localhost:8000';
const API_BASE = API; // for building image URLs

const NGODashboard = () => {
  const [user, setUser] = useState({ name: '', role: '' });
  const [listings, setListings] = useState([]);
  const [filter, setFilter] = useState('available');
  const [showNotif, setShowNotif] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [unreadChats, setUnreadChats] = useState(0);
  const [notifications, setNotifications] = useState([]);
  const [unreadNotifs, setUnreadNotifs] = useState(0);
  const [loadingListings, setLoadingListings] = useState(true);
  const [claimingId, setClaimingId] = useState(null);
  const [claimError, setClaimError] = useState('');
  const [emailNotifications, setEmailNotifications] = useState(true);

  const navigate = useNavigate();

  // Helper: get auth header
  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('kb_token')}`,
  });

  const normalizeListing = (listing, fallbackStatus) => ({
    ...listing,
    _status: listing.status || fallbackStatus,
  });

  // Fetch available + claimed listings
  const fetchListings = async () => {
    setLoadingListings(true);
    setClaimError('');
    try {
      const [availableRes, claimedRes] = await Promise.all([
        fetch(`${API}/listings`, { headers: authHeader() }),
        fetch(`${API}/listings/my-claims`, { headers: authHeader() }),
      ]);

      if (availableRes.status === 401 || claimedRes.status === 401) {
        localStorage.clear();
        navigate('/login');
        return;
      }

      const availableData = await availableRes.json();
      const claimedData = await claimedRes.json();

      if (!availableRes.ok) {
        throw new Error(availableData.detail || 'Failed to load available listings');
      }
      if (!claimedRes.ok) {
        throw new Error(claimedData.detail || 'Failed to load your claimed listings');
      }

      const allListings = [
        ...availableData.map((l) => normalizeListing(l, 'available')),
        ...claimedData.map((l) => normalizeListing(l, 'claimed')),
      ];

      const mergedById = new Map();
      allListings.forEach((listing) => mergedById.set(listing.id, listing));
      setListings(Array.from(mergedById.values()));
    } catch (err) {
      console.error('fetchListings error:', err);
      setClaimError(err.message || 'Failed to load listings.');
    } finally {
      setLoadingListings(false);
    }
  };

  const fetchUnreadSummary = async () => {
    try {
      const res = await fetch(`${API}/chats/unread-summary`, { headers: authHeader() });
      if (res.status === 401) {
        localStorage.clear();
        navigate('/login');
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return;
      setUnreadChats(Number(data.total_unread_chats) || 0);
    } catch {
      // Keep existing value on transient errors.
    }
  };

  const fetchProfile = async () => {
    try {
      const res = await fetch(`${API}/auth/me`, { headers: authHeader() });
      if (res.ok) {
        const data = await res.json();
        setEmailNotifications(data.email_notifications);
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
    }
  };

  const fetchNotifications = async () => {
    try {
      const res = await fetch(`${API}/notifications`, {
        headers: authHeader(),
      });
      if (!res.ok) return;
      const data = await res.json();
      setNotifications(data);
      setUnreadNotifs(data.filter(n => !n.is_read).length);
    } catch {
      // keep existing value
    }
  };

  const markNotifsRead = async () => {
    if (unreadNotifs === 0) return;
    try {
      await fetch(`${API}/notifications/mark-read`, {
        method: 'PATCH',
        headers: authHeader(),
      });
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadNotifs(0);
    } catch {
      // ignore
    }
  };

  const toggleNotifications = async () => {
    const newVal = !emailNotifications;
    try {
      const res = await fetch(`${API}/auth/notifications`, {
        method: 'PATCH',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: newVal }),
      });
      if (res.ok) {
        setEmailNotifications(newVal);
      }
    } catch (err) {
      console.error('Failed to update notifications:', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('kb_token');
    const role = localStorage.getItem('kb_role');
    const name = localStorage.getItem('kb_name');

    if (!token || role !== 'ngo') {
      navigate('/login');
      return;
    }

    setUser({ name, role });
    fetchListings();
    fetchUnreadSummary();
    fetchProfile();
    fetchNotifications();

    const interval = setInterval(fetchUnreadSummary, 5000);
    const notifInterval = setInterval(fetchNotifications, 5000);
    return () => { clearInterval(interval); clearInterval(notifInterval); };
  }, [navigate]);

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const claimListing = async (id) => {
    setClaimingId(id);
    setClaimError('');

    try {
      const res = await fetch(`${API}/listings/${id}/claim`, {
        method: 'POST',
        headers: authHeader(),
      });

      const data = await res.json().catch(() => ({}));

      if (res.status === 401) {
        localStorage.clear();
        navigate('/login');
        return;
      }

      if (res.status === 409) {
        await fetchListings();
        throw new Error(data.detail || 'This listing is no longer available for claim.');
      }

      if (!res.ok) {
        throw new Error(data.detail || 'Failed to claim listing.');
      }

      const chatId = data.chat_id;
      setListings((prev) =>
        prev.map((listing) =>
          listing.id === id
            ? { ...listing, status: 'claimed', _status: 'claimed', chat_id: chatId }
            : listing
        )
      );

      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);
    } catch (err) {
      setClaimError(err.message || 'Failed to claim listing.');
    } finally {
      setClaimingId(null);
    }
  };

  const cancelClaim = async (id) => {
    if (!window.confirm('Are you sure you want to cancel this claim? This will also delete the chat history.')) return;
    setClaimingId(id); // reuse state for loading
    try {
      const res = await fetch(`${API}/listings/${id}/unclaim`, {
        method: 'POST',
        headers: authHeader(),
      });
      if (res.status === 401) { localStorage.clear(); navigate('/login'); return; }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to cancel claim');
      }
      // Success! Update local state
      setListings((prev) =>
        prev.map((listing) =>
          listing.id === id
            ? { ...listing, status: 'available', _status: 'available', chat_id: null }
            : listing
        )
      );
    } catch (err) {
      setClaimError(err.message);
    } finally {
      setClaimingId(null);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const formatTime = (dt) => {
    if (!dt) return '—';
    const d = new Date(dt);
    return d.toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  // Get food emoji based on item name
  const getFoodEmoji = (items) => {
    if (!items || items.length === 0) return '🍽️';
    const name = items[0].item_name.toLowerCase();
    if (name.includes('biryani')) return '🍛';
    if (name.includes('dal') || name.includes('sabzi')) return '🥘';
    if (name.includes('karahi') || name.includes('chicken')) return '🫕';
    if (name.includes('roti') || name.includes('naan')) return '🫓';
    return '🍲';
  };

  // Filter listings based on local status
  const filteredListings = listings.filter((l) => {
    if (filter === 'available') return l._status === 'available';
    if (filter === 'claimed') return l._status === 'claimed';
    if (filter === 'completed') return l._status === 'completed';
    return true;
  });

  const availableCount = listings.filter(l => l._status === 'available').length;
  const claimedCount = listings.filter(l => l._status === 'claimed').length;
  const completedCount = listings.filter(l => l._status === 'completed').length;
  
  const totalMeals = listings
    .filter(l => l._status === 'completed')
    .reduce((sum, l) => sum + l.food_items.reduce((s, fi) => s + (fi.estimated_serving || 0), 0), 0);

  return (
    <div className="dashboard-ngo">
      {/* TOP NAV */}
      <nav id="nav">
        <Link to="/ngo/dashboard" className="nav-brand">
          <div className="leaf">🍃</div>
          Khana Bachao
        </Link>

        <div className="nav-links">
          <Link to="/ngo/dashboard" className="nav-link active">Browse Listings</Link>
          <Link to="/chat" className="nav-link nav-link-with-badge">
            Messages
            {unreadChats > 0 && (
              <span className="nav-unread-badge">{unreadChats > 99 ? '99+' : unreadChats}</span>
            )}
          </Link>
        </div>

        <div className="nav-right">
          <button 
            className={`notif-toggle-btn ${emailNotifications ? 'active' : ''}`} 
            onClick={toggleNotifications}
            title={emailNotifications ? 'Disable Email Notifications' : 'Enable Email Notifications'}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '1.2rem', 
              cursor: 'pointer',
              marginRight: '15px',
              opacity: emailNotifications ? 1 : 0.5,
              transition: 'opacity 0.2s'
            }}
          >
            {emailNotifications ? '✉️' : '🚫'}
          </button>
          <button className="notif-btn" onClick={() => { setShowNotif(!showNotif); markNotifsRead(); }}>
            🔔
            {unreadNotifs > 0 && <span className="notif-dot"></span>}
          </button>

          {showNotif && (
            <div className="notif-panel open">
              <div className="notif-panel-header">Notifications</div>
              {notifications.length === 0 ? (
                <div className="notif-item" style={{ color: '#888', fontSize: '14px', padding: '12px' }}>
                  No notifications yet.
                </div>
              ) : (
                notifications.map(n => (
                  <div key={n.id} className={`notif-item ${!n.is_read ? 'unread' : ''}`}>
                    <div className="notif-item-title">{n.title}</div>
                    <div className="notif-item-sub">{n.body}</div>
                    <div className="notif-item-time">{new Date(n.created_at).toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</div>
                  </div>
                ))
              )}
            </div>
          )}

          <div className="nav-user">
            <div className="avatar ngo">{getInitials(user.name)}</div>
            <span>{user.name}</span>
          </div>
          <button className="btn-logout" onClick={logout}>Sign out</button>
        </div>
      </nav>

      {/* PAGE CONTENT */}
      <div className="page-wrapper">
        <div className="page-header">
          <div>
            <h1 className="page-title">Available Food Listings</h1>
            <p className="page-subtitle">Claim surplus food to feed your community</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {availableCount > 0 && <span className="badge badge-new">{availableCount} available</span>}
            <button className="btn btn-sm" onClick={fetchListings}>🔄 Refresh</button>
          </div>
        </div>

        {/* Stat cards — computed from real data */}
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-label">Available now</div><div className="stat-value teal">{availableCount}</div></div>
          <div className="stat-card"><div className="stat-label">Active claims</div><div className="stat-value amber">{claimedCount}</div></div>
          <div className="stat-card"><div className="stat-label">Pickups completed</div><div className="stat-value gray">{completedCount}</div></div>
          <div className="stat-card"><div className="stat-label">Meals facilitated</div><div className="stat-value brand">{totalMeals}</div></div>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'available' ? 'active' : ''}`} onClick={() => setFilter('available')}>
            Available <span className="filter-count">{availableCount}</span>
          </button>
          <button className={`filter-tab ${filter === 'claimed' ? 'active' : ''}`} onClick={() => setFilter('claimed')}>
            My claims <span className="filter-count">{claimedCount}</span>
          </button>
          <button className={`filter-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
            History <span className="filter-count">{completedCount}</span>
          </button>
        </div>

        {claimError && <div className="alert alert-error show">{claimError}</div>}

        {/* Listings grid — now rendered from API data */}
        <div className="listings-grid">
          {loadingListings ? (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-icon">⏳</div>
              <div className="empty-title">Loading listings...</div>
            </div>
          ) : filteredListings.length > 0 ? (
            filteredListings.map(l => {
              const totalServings = l.food_items.reduce((sum, fi) => sum + (fi.estimated_serving || 0), 0);
              const totalWeight = l.food_items.map(fi => fi.estimated_weight).filter(Boolean).join(', ');
              const dishNames = l.food_items.map(fi => fi.item_name).join(', ');

              const hasImage = l.food_items.some(fi => fi.image_url);
              const firstImage = l.food_items.find(fi => fi.image_url)?.image_url;

              return (
                <div key={l.id} className="listing-card" onClick={() => navigate(`/listings/${l.id}`)} style={{ cursor: 'pointer' }}>
                  <div className="listing-card-img">
                    {hasImage ? (
                      <img
                        src={`${API_BASE}${firstImage}`}
                        alt={dishNames}
                        style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '12px 12px 0 0' }}
                      />
                    ) : (
                      <span style={{ fontSize: '48px' }}>{getFoodEmoji(l.food_items)}</span>
                    )}
                    <div className="listing-card-badge">
                      <span className={`badge badge-${l._status}`}>{l._status.charAt(0).toUpperCase() + l._status.slice(1)}</span>
                    </div>
                  </div>
                  <div className="listing-card-body">
                    <div className="listing-card-title">{dishNames}</div>
                    <div className="listing-meta">
                      <div className="listing-meta-row"><span className="listing-meta-icon">⚖️</span>{totalWeight || '—'} — serves ~{totalServings} people</div>
                      <div className="listing-meta-row"><span className="listing-meta-icon">📍</span>{l.location}</div>
                      <div className="listing-meta-row"><span className="listing-meta-icon">🕐</span>{formatTime(l.available_until)}</div>
                    </div>
                  </div>
                  <div className="listing-card-footer">
                    <div className="provider-tag">
                      <div className="provider-dot">FP</div>
                      Provider #{l.food_provider_id}
                    </div>
                      {l._status === 'available' ? (
                        <button
                          className="btn btn-sm btn-teal"
                          onClick={(e) => { e.stopPropagation(); claimListing(l.id); }}
                          disabled={claimingId === l.id}
                        >
                          {claimingId === l.id ? 'Claiming...' : 'Claim listing'}
                        </button>
                      ) : l._status === 'claimed' ? (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            className="btn btn-sm"
                            style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}
                            onClick={(e) => { e.stopPropagation(); navigate(`/chat/${l.chat_id}`); }}
                            disabled={!l.chat_id}
                          >
                            💬 Open Chat
                          </button>
                          <button
                            className="btn btn-sm btn-ghost"
                            style={{ color: '#d32f2f' }}
                            onClick={(e) => { e.stopPropagation(); cancelClaim(l.id); }}
                            disabled={claimingId === l.id}
                          >
                            ✕ Cancel
                          </button>
                        </div>
                      ) : (
                        <button className="btn btn-sm btn-ghost" disabled>Completed</button>
                      )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="empty-state" style={{ gridColumn: '1/-1' }}>
              <div className="empty-icon">📭</div>
              <div className="empty-title">No listings found</div>
              <div className="empty-sub">Check back soon — you'll be notified when new food is posted.</div>
            </div>
          )}
        </div>
      </div>

      {/* TOAST */}
      {showToast && (
        <div className="success-toast show">✓ Listing claimed! Chat is now enabled.</div>
      )}
    </div>
  );
};

export default NGODashboard;
