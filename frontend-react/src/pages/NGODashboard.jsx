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
  const [loadingListings, setLoadingListings] = useState(true);

  const navigate = useNavigate();

  // Helper: get auth header
  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('kb_token')}`,
  });

  // Fetch available listings from GET /listings
  const fetchListings = async () => {
    setLoadingListings(true);
    try {
      const res = await fetch(`${API}/listings`, { headers: authHeader() });
      if (res.status === 401) { localStorage.clear(); navigate('/login'); return; }
      if (!res.ok) throw new Error('Failed to load listings');
      const data = await res.json();
      // All listings from this endpoint are "available" (backend filters)
      setListings(data.map(l => ({ ...l, _status: 'available' })));
    } catch (err) {
      console.error('fetchListings error:', err);
    } finally {
      setLoadingListings(false);
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
  }, [navigate]);

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  // Claim is still local-only (backend endpoint not ready yet)
  const claimListing = (id) => {
    setListings(prev => prev.map(l => l.id === id ? { ...l, _status: 'claimed' } : l));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
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
  const filteredListings = listings.filter(l => l._status === filter);
  const availableCount = listings.filter(l => l._status === 'available').length;
  const claimedCount = listings.filter(l => l._status === 'claimed').length;

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
          <Link to="/chat" className="nav-link">Messages</Link>
        </div>

        <div className="nav-right">
          <button className="notif-btn" onClick={() => setShowNotif(!showNotif)}>
            🔔
            <span className="notif-dot"></span>
          </button>

          {showNotif && (
            <div className="notif-panel open">
              <div className="notif-panel-header">Notifications</div>
              <div className="notif-item unread">
                <div className="notif-item-title">New listing available!</div>
                <div className="notif-item-sub">Check the latest surplus food postings.</div>
                <div className="notif-item-time">just now</div>
              </div>
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
          <div className="stat-card"><div className="stat-label">Claimed by you</div><div className="stat-value amber">{claimedCount}</div></div>
          <div className="stat-card"><div className="stat-label">Total pickups done</div><div className="stat-value gray">—</div></div>
          <div className="stat-card"><div className="stat-label">Meals facilitated</div><div className="stat-value brand">—</div></div>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'available' ? 'active' : ''}`} onClick={() => setFilter('available')}>
            Available <span className="filter-count">{availableCount}</span>
          </button>
          <button className={`filter-tab ${filter === 'claimed' ? 'active' : ''}`} onClick={() => setFilter('claimed')}>
            My claims <span className="filter-count">{claimedCount}</span>
          </button>
        </div>

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
                <div key={l.id} className="listing-card">
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
                      <button className="btn btn-sm btn-teal" onClick={() => claimListing(l.id)}>Claim listing</button>
                    ) : l._status === 'claimed' ? (
                      <Link to="/chat" className="btn btn-sm" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}>💬 Chat</Link>
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
