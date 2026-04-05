import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const NGO_LISTINGS = [
  { id: 1, emoji: '🍛', name: 'Biryani, Nihari, Raita', qty: '~40 kg', serves: '200', location: 'DHA Phase 5', time: 'Today, 10 PM', status: 'available', provider: 'Al-Karim Wedding Hall', init: 'AK' },
  { id: 2, emoji: '🥘', name: 'Dal, Sabzi, Roti, Kheer', qty: '~22 kg', serves: '100', location: 'Gulshan-e-Iqbal', time: 'Today, 8 PM', status: 'available', provider: 'Friday Community Kitchen', init: 'FC' },
  { id: 3, emoji: '🫕', name: 'Chicken Karahi, Naan', qty: '~15 kg', serves: '80', location: 'Clifton', time: 'Today, 11 PM', status: 'available', provider: 'Spice Route Catering', init: 'SR' },
  // ... more items
];

const NGODashboard = () => {
  const [user, setUser] = useState({ name: '', role: '' });
  const [listings, setListings] = useState(NGO_LISTINGS);
  const [filter, setFilter] = useState('available');
  const [showNotif, setShowNotif] = useState(false);
  const [showToast, setShowToast] = useState(false);

  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem('kb_token');
    const role = localStorage.getItem('kb_role');
    const name = localStorage.getItem('kb_name');

    if (!token || role !== 'ngo') {
      navigate('/login');
      return;
    }

    setUser({ name, role });
  }, [navigate]);

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const claimListing = (id) => {
    setListings(prev => prev.map(l => l.id === id ? { ...l, status: 'claimed' } : l));
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3500);
  };

  const getInitials = (name) => {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  const filteredListings = listings.filter(l => l.status === filter);

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
                <div className="notif-item-sub">Biryani, Nihari, Raita — DHA Phase 5 (200 servings)</div>
                <div className="notif-item-time">5 min ago</div>
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
            <span className="badge badge-new">3 new today</span>
            <button className="btn btn-sm">🔍 Search</button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-label">Available now</div><div className="stat-value teal">6</div></div>
          <div className="stat-card"><div className="stat-label">Claimed by you</div><div className="stat-value amber">2</div></div>
          <div className="stat-card"><div className="stat-label">Total pickups done</div><div className="stat-value gray">14</div></div>
          <div className="stat-card"><div className="stat-label">Meals facilitated</div><div className="stat-value brand">2,180</div></div>
        </div>

        {/* Filter tabs */}
        <div className="filter-tabs">
          <button className={`filter-tab ${filter === 'available' ? 'active' : ''}`} onClick={() => setFilter('available')}>
            Available <span className="filter-count">6</span>
          </button>
          <button className={`filter-tab ${filter === 'claimed' ? 'active' : ''}`} onClick={() => setFilter('claimed')}>
            My claims <span className="filter-count">2</span>
          </button>
          <button className={`filter-tab ${filter === 'completed' ? 'active' : ''}`} onClick={() => setFilter('completed')}>
            History <span className="filter-count">14</span>
          </button>
        </div>

        {/* Listings grid */}
        <div className="listings-grid">
          {filteredListings.length > 0 ? (
            filteredListings.map(l => (
              <div key={l.id} className="listing-card">
                <div className="listing-card-img">
                  <span style={{ fontSize: '48px' }}>{l.emoji}</span>
                  <div className="listing-card-badge">
                    <span className={`badge badge-${l.status}`}>{l.status.charAt(0).toUpperCase() + l.status.slice(1)}</span>
                  </div>
                </div>
                <div className="listing-card-body">
                  <div className="listing-card-title">{l.name}</div>
                  <div className="listing-meta">
                    <div className="listing-meta-row"><span className="listing-meta-icon">⚖️</span>{l.qty} — serves ~{l.serves} people</div>
                    <div className="listing-meta-row"><span className="listing-meta-icon">📍</span>{l.location}</div>
                    <div className="listing-meta-row"><span className="listing-meta-icon">🕐</span>{l.time}</div>
                  </div>
                </div>
                <div className="listing-card-footer">
                  <div className="provider-tag">
                    <div className="provider-dot">{l.init}</div>
                    {l.provider}
                  </div>
                  {l.status === 'available' ? (
                    <button className="btn btn-sm btn-teal" onClick={() => claimListing(l.id)}>Claim listing</button>
                  ) : l.status === 'claimed' ? (
                    <Link to="/chat" className="btn btn-sm" style={{ borderColor: 'var(--brand)', color: 'var(--brand)' }}>💬 Chat</Link>
                  ) : (
                    <button className="btn btn-sm btn-ghost" disabled>Completed</button>
                  )}
                </div>
              </div>
            ))
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
