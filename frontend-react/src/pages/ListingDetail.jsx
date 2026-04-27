import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';

const API = 'http://localhost:8000';

const ListingDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [listing, setListing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [claiming, setClaiming] = useState(false);
  const [claimSuccess, setClaimSuccess] = useState(false);
  const [chatId, setChatId] = useState(null); 

  const role = localStorage.getItem('kb_role');
  const userName = localStorage.getItem('kb_name') || '';
  const dashboardPath = role === 'food_provider' ? '/fp/dashboard' : '/ngo/dashboard';
  const dashboardLabel = role === 'food_provider' ? 'My Listings' : 'Browse Listings';

  const authHeader = () => ({
    Authorization: `Bearer ${localStorage.getItem('kb_token')}`,
  });

  useEffect(() => {
    const token = localStorage.getItem('kb_token');
    if (!token) { navigate('/login'); return; }

    const fetchListing = async () => {
      try {
        const res = await fetch(`${API}/listings/${id}`, {
          headers: authHeader(),
        });
        if (res.status === 401) { localStorage.clear(); navigate('/login'); return; }
        if (res.status === 403) { setError('You do not have permission to view this listing.'); return; }
        if (res.status === 404) { setError('Listing not found.'); return; }
        if (!res.ok) throw new Error('Failed to load listing');
        const data = await res.json();
        setListing(data);
        setChatId(data.chat_id ?? null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchListing();
  }, [id, navigate]);

  /* ── Claim listing (NGO only) ── */
  const handleClaim = async () => {
    setClaiming(true);
    try {
      const res = await fetch(`${API}/listings/${id}/claim`, {
        method: 'POST',
        headers: { ...authHeader(), 'Content-Type': 'application/json' },
      });
      if (res.status === 401) { localStorage.clear(); navigate('/login'); return; }
      if (res.status === 409) { setError('This listing has already been claimed.'); return; }
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Failed to claim listing');
      }
      const data = await res.json(); 
      setListing(prev => ({ ...prev, status: 'claimed' }));
      setChatId(data.chat_id);
      setClaimSuccess(true);
      setTimeout(() => setClaimSuccess(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setClaiming(false);
    }
  };

  /* ── Helpers ── */
  const fmt = (dt) => {
    if (!dt) return '—';
    return new Date(dt).toLocaleString('en-PK', {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit',
    });
  };

  const getTimeRemaining = (until) => {
    if (!until) return null;
    const diff = new Date(until) - new Date();
    if (diff <= 0) return { text: 'Expired', urgent: true };
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    if (h > 24) return { text: `${Math.floor(h / 24)}d ${h % 24}h remaining`, urgent: false };
    if (h > 0) return { text: `${h}h ${m}m remaining`, urgent: h < 3 };
    return { text: `${m}m remaining`, urgent: true };
  };

  const getInitials = (n) => n ? n.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : '?';

  const logout = () => { localStorage.clear(); navigate('/login'); };

  /* ── Loading ── */
  if (loading) return (
    <div className="ld-page"><div className="ld-state">
      <div className="spinner ld-spinner"></div>
      <p>Loading listing…</p>
    </div></div>
  );

  /* ── Error ── */
  if (error) return (
    <div className="ld-page"><div className="ld-state">
      <div style={{ fontSize: 48, marginBottom: 12 }}>⚠️</div>
      <h2>{error}</h2>
      <Link to={dashboardPath} className="btn btn-brand" style={{ marginTop: 16 }}>← Back to {dashboardLabel}</Link>
    </div></div>
  );

  if (!listing) return null;

  /* ── Computed ── */
  const firstImage = listing.food_items?.find(fi => fi.image_url)?.image_url;
  const totalServings = listing.food_items.reduce((s, fi) => s + (fi.estimated_serving || 0), 0);
  const allWeights = listing.food_items.map(fi => fi.estimated_weight).filter(Boolean);
  const timeInfo = listing.status === 'available' ? getTimeRemaining(listing.available_until) : null;
  const isOwner = role === 'food_provider';

  return (
    <>
      {/* ── Nav bar ── */}
      <nav id="nav">
        <Link to={dashboardPath} className="nav-brand">
          <div className="leaf">🍃</div> Khana Bachao
        </Link>
        <div className="nav-links">
          <Link to={dashboardPath} className="nav-link">{dashboardLabel}</Link>
        </div>
        <div className="nav-right">
          <div className="nav-user">
            <div className={`avatar${role === 'ngo' ? ' ngo' : ''}`}>{getInitials(userName)}</div>
            <span>{userName}</span>
          </div>
          <button className="btn-logout" onClick={logout}>Sign out</button>
        </div>
      </nav>

      {/* ── Page body ── */}
      <div className="ld-page">
        {/* Breadcrumb */}
        <div className="ld-breadcrumb">
          <Link to={dashboardPath} className="ld-breadcrumb-link">{dashboardLabel}</Link>
          <span className="ld-breadcrumb-sep">/</span>
          <span className="ld-breadcrumb-current">Listing #{listing.id}</span>
        </div>

        {/* Hero area — image + summary side by side */}
        <div className="ld-hero-grid">
          <div className="ld-hero-img-wrap">
            {firstImage ? (
              <img src={`${API}${firstImage}`} alt="Food" className="ld-hero-img" />
            ) : (
              <div className="ld-hero-placeholder">🍽️</div>
            )}
            {/* Status + time overlay */}
            <div className="ld-hero-overlay">
              <span className={`badge badge-${listing.status === 'available' && new Date(listing.available_until) <= new Date() ? 'expired' : listing.status}`}>
                {listing.status === 'available' && new Date(listing.available_until) <= new Date() ? 'Expired' : listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}
              </span>
              {timeInfo && !timeInfo.urgent && (
                <span className="ld-time-pill">
                  ⏱ {timeInfo.text}
                </span>
              )}
            </div>
          </div>

          {/* Summary card */}
          <div className="ld-summary">
            <h1 className="ld-title">{listing.food_items.map(fi => fi.item_name).join(', ')}</h1>
            <p className="ld-posted">Posted {fmt(listing.created_at)}</p>

            <div className="ld-info-list">
              <div className="ld-info-row">
                <span className="ld-info-icon">📍</span>
                <div><div className="ld-info-label">Pickup Location</div><div className="ld-info-value">{listing.location}</div></div>
              </div>
              <div className="ld-info-row">
                <span className="ld-info-icon">🕐</span>
                <div><div className="ld-info-label">Available From</div><div className="ld-info-value">{fmt(listing.available_from)}</div></div>
              </div>
              <div className="ld-info-row">
                <span className="ld-info-icon">🕑</span>
                <div><div className="ld-info-label">Available Until</div><div className="ld-info-value">{fmt(listing.available_until)}</div></div>
              </div>
              {totalServings > 0 && (
                <div className="ld-info-row">
                  <span className="ld-info-icon">🍽️</span>
                  <div><div className="ld-info-label">Estimated Servings</div><div className="ld-info-value">~{totalServings} people</div></div>
                </div>
              )}
              {allWeights.length > 0 && (
                <div className="ld-info-row">
                  <span className="ld-info-icon">⚖️</span>
                  <div><div className="ld-info-label">Total Quantity</div><div className="ld-info-value">{allWeights.join(' + ')}</div></div>
                </div>
              )}
              <div className="ld-info-row">
                <span className="ld-info-icon">👤</span>
                <div><div className="ld-info-label">Provider ID</div><div className="ld-info-value">#{listing.food_provider_id}</div></div>
              </div>
              <div className="ld-info-row">
                <span className="ld-info-icon">📋</span>
                <div><div className="ld-info-label">Current Status</div><div className="ld-info-value">{listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}</div></div>
              </div>
            </div>

            {/* Action area */}
            <div className="ld-action">
              {role === 'ngo' && listing.status === 'available' && (
                <button className="btn btn-brand ld-action-btn" onClick={handleClaim} disabled={claiming}>
                  {claiming ? <span className="spinner"></span> : '🤝 Claim this listing'}
                </button>
              )}
              {role === 'ngo' && listing.status === 'claimed' && (
                <button
                  className="btn btn-brand ld-action-btn"
                  onClick={() => navigate(`/chat/${chatId}`)}
                  disabled={!chatId}
                >
                  💬 Open Chat
                </button>
              )}
              {role === 'ngo' && listing.status === 'completed' && (
                <div className="ld-banner completed">✓ This listing has been completed.</div>
              )}
              {isOwner && (
                <Link to={dashboardPath} className="btn ld-action-btn">← Back to My Listings</Link>
              )}
            </div>
          </div>
        </div>

        {/* Food items card */}
        {listing.food_items.length > 0 && (
          <div className="ld-card">
            <h3 className="ld-card-title">🍱 Food Items ({listing.food_items.length})</h3>
            <div className="ld-items-grid">
              {listing.food_items.map(fi => (
                <div key={fi.id} className="ld-item">
                  {fi.image_url ? (
                    <img src={`${API}${fi.image_url}`} alt={fi.item_name} className="ld-item-img" />
                  ) : (
                    <div className="ld-item-img-ph">🍲</div>
                  )}
                  <div className="ld-item-body">
                    <div className="ld-item-name">{fi.item_name}</div>
                    <div className="ld-item-meta">
                      {fi.estimated_weight && <span>⚖️ {fi.estimated_weight}</span>}
                      {fi.estimated_serving && <span>🍽️ ~{fi.estimated_serving} servings</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {listing.notes && (
          <div className="ld-card">
            <h3 className="ld-card-title">📝 Notes from Provider</h3>
            <div className="ld-notes">{listing.notes}</div>
          </div>
        )}

        {/* Metadata footer */}
        <div className="ld-footer">
          <span>Listing #{listing.id}</span>
          <span>Provider #{listing.food_provider_id}</span>
          <span>Created: {fmt(listing.created_at)}</span>
          <span>Status: {listing.status}</span>
        </div>
      </div>

      {/* Claim success toast */}
      {claimSuccess && (
        <div className="success-toast show">✓ Listing claimed successfully! Chat is now enabled.</div>
      )}
    </>
  );
};

export default ListingDetail;
