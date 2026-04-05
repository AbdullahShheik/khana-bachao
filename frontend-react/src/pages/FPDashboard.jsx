import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';

const API = 'http://localhost:8000';

const FPDashboard = () => {
  const [user, setUser] = useState({ name: '', role: '' });
  const [listings, setListings] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [showNotif, setShowNotif] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [imageUrl, setImageUrl] = useState(null);
  const [uploading, setUploading] = useState(false);

  // New listing form state
  const [formData, setFormData] = useState({
    name: '',
    qty: '',
    servings: '',
    location: '',
    from: '18:00',
    until: '22:00',
    notes: '',
  });

  const navigate = useNavigate();

  // Helper: get auth header
  const authHeader = () => ({
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('kb_token')}`,
  });

  // Fetch listings from GET /listings/my
  const fetchListings = async () => {
    try {
      const res = await fetch(`${API}/listings/my`, { headers: authHeader() });
      if (res.status === 401) { localStorage.clear(); navigate('/login'); return; }
      if (!res.ok) throw new Error('Failed to load listings');
      const data = await res.json();
      setListings(data);
    } catch (err) {
      console.error('fetchListings error:', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('kb_token');
    const role = localStorage.getItem('kb_role');
    const name = localStorage.getItem('kb_name');

    if (!token || role !== 'food_provider') {
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

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  // Build today's date + time string for the API (timezone-naive)
  const toDatetime = (timeStr) => {
    const today = new Date().toISOString().split('T')[0]; // "2026-04-05"
    return `${today}T${timeStr}:00`; // "2026-04-05T18:00:00"
  };

  // POST /listings with real API call
  // Upload a photo to POST /upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);

      const res = await fetch(`${API}/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${localStorage.getItem('kb_token')}` },
        body: fd,
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.detail || 'Upload failed');
      }

      const data = await res.json();
      setImageUrl(data.url); // e.g. "/uploads/abc123.jpg"
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  };

  const submitListing = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const body = {
        location: formData.location,
        available_from: toDatetime(formData.from),
        available_until: toDatetime(formData.until),
        notes: formData.notes || null,
        food_items: [
          {
            item_name: formData.name,
            estimated_weight: formData.qty || null,
            estimated_serving: formData.servings ? parseInt(formData.servings) : null,
            image_url: imageUrl,
          },
        ],
      };

      const res = await fetch(`${API}/listings`, {
        method: 'POST',
        headers: authHeader(),
        body: JSON.stringify(body),
      });

      if (res.status === 401) { localStorage.clear(); navigate('/login'); return; }
      if (res.status === 403) { setError('Only Food Providers can post listings.'); return; }

      const data = await res.json();
      if (!res.ok) {
        const msg = typeof data.detail === 'string' ? data.detail : 'Failed to create listing.';
        setError(msg);
        return;
      }

      setShowModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);

      // Reset form and refresh listings
      setFormData({
        name: '', qty: '', servings: '', location: '',
        from: '18:00', until: '22:00', notes: ''
      });
      setImageUrl(null);
      fetchListings();
    } catch (err) {
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
  };

  // Format a datetime string for display
  const formatTime = (dt) => {
    if (!dt) return '—';
    const d = new Date(dt);
    return d.toLocaleString('en-PK', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  };

  // Compute stats from real data
  const stats = {
    total: listings.length,
    available: listings.filter(l => l.status === 'available').length,
    claimed: listings.filter(l => l.status === 'claimed').length,
    completed: listings.filter(l => l.status === 'completed').length,
  };

  return (
    <div className="dashboard-fp">
      {/* TOP NAV */}
      <nav id="nav">
        <Link to="/fp/dashboard" className="nav-brand">
          <div className="leaf">🍃</div>
          Khana Bachao
        </Link>

        <div className="nav-links">
          <Link to="/fp/dashboard" className="nav-link active">My Listings</Link>
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
                <div className="notif-item-title">Listing claimed!</div>
                <div className="notif-item-sub">Khidmat Foundation claimed your Biryani listing.</div>
                <div className="notif-item-time">2 min ago</div>
              </div>
            </div>
          )}

          <div className="nav-user">
            <div className="avatar">{getInitials(user.name)}</div>
            <span>{user.name}</span>
          </div>
          <button className="btn-logout" onClick={logout}>Sign out</button>
        </div>
      </nav>

      {/* PAGE CONTENT */}
      <div className="page-wrapper">
        <div className="page-header">
          <div>
            <h1 className="page-title">My Listings</h1>
            <p className="page-subtitle">Manage your surplus food postings</p>
          </div>
          <button className="btn btn-brand" onClick={() => setShowModal(true)}>+ Post surplus food</button>
        </div>

        {/* Stat cards — now computed from real data */}
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-label">Total listings</div><div className="stat-value brand">{stats.total}</div></div>
          <div className="stat-card"><div className="stat-label">Available</div><div className="stat-value teal">{stats.available}</div></div>
          <div className="stat-card"><div className="stat-label">Claimed</div><div className="stat-value amber">{stats.claimed}</div></div>
          <div className="stat-card"><div className="stat-label">Completed</div><div className="stat-value gray">{stats.completed}</div></div>
        </div>

        {/* Listings table — now rendered from API data */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">All listings</span>
            <button className="btn btn-sm btn-ghost">Export</button>
          </div>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Food / Dishes</th>
                  <th>Qty</th>
                  <th>Serves</th>
                  <th>Location</th>
                  <th>Available until</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {listings.length > 0 ? (
                  listings.map(listing => (
                    <tr key={listing.id}>
                      <td>
                        <div className="td-food">
                          {listing.food_items.map(fi => fi.item_name).join(', ')}
                        </div>
                        <div className="td-sub">
                          {listing.food_items.length} dish{listing.food_items.length !== 1 ? 'es' : ''}
                        </div>
                      </td>
                      <td>{listing.food_items[0]?.estimated_weight || '—'}</td>
                      <td>{listing.food_items[0]?.estimated_serving || '—'}</td>
                      <td>{listing.location}</td>
                      <td>{formatTime(listing.available_until)}</td>
                      <td><span className={`badge badge-${listing.status}`}>{listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}</span></td>
                      <td><button className="btn btn-sm btn-ghost" disabled>No chat yet</button></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: '#888' }}>
                      No listings yet. Click "+ Post surplus food" to create your first one!
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* CREATE LISTING MODAL */}
      {showModal && (
        <div className="modal-overlay open">
          <div className="modal">
            <div className="modal-header">
              <h2 className="modal-title">Post surplus food</h2>
              <button className="modal-close" onClick={() => { setShowModal(false); setError(''); }}>✕</button>
            </div>
            <form onSubmit={submitListing}>
              <div className="modal-body">
                {error && <div className="alert alert-error show">{error}</div>}
                <div className="form-group">
                  <label className="form-label">Food name / dishes *</label>
                  <input
                    className="form-input"
                    id="name"
                    type="text"
                    value={formData.name}
                    onChange={handleInputChange}
                    placeholder="e.g. Biryani, Dal, Roti, Salad"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Estimated quantity *</label>
                    <input
                      className="form-input"
                      id="qty"
                      type="text"
                      value={formData.qty}
                      onChange={handleInputChange}
                      placeholder="e.g. 20 kg"
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Approximate servings *</label>
                    <input
                      className="form-input"
                      id="servings"
                      type="number"
                      value={formData.servings}
                      onChange={handleInputChange}
                      placeholder="e.g. 100"
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Pickup location *</label>
                  <input
                    className="form-input"
                    id="location"
                    type="text"
                    value={formData.location}
                    onChange={handleInputChange}
                    placeholder="e.g. 45-B, Block 6, PECHS, Karachi"
                    required
                  />
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Available from *</label>
                    <input
                      className="form-input"
                      id="from"
                      type="time"
                      value={formData.from}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Available until *</label>
                    <input
                      className="form-input"
                      id="until"
                      type="time"
                      value={formData.until}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label className="form-label">Additional notes</label>
                  <textarea
                    className="form-textarea"
                    id="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    placeholder="e.g. Vegetarian, freshly cooked, no pork…"
                  ></textarea>
                </div>
                <div className="form-group">
                  <label className="form-label">Food photo (optional)</label>
                  {imageUrl ? (
                    <div style={{ position: 'relative', display: 'inline-block' }}>
                      <img
                        src={`${API}${imageUrl}`}
                        alt="Preview"
                        style={{ width: '100%', maxHeight: '200px', objectFit: 'cover', borderRadius: '8px' }}
                      />
                      <button
                        type="button"
                        onClick={() => setImageUrl(null)}
                        style={{ position: 'absolute', top: '8px', right: '8px', background: 'rgba(0,0,0,0.6)', color: '#fff', border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', fontSize: '14px' }}
                      >✕</button>
                    </div>
                  ) : (
                    <label className="upload-zone" style={{ cursor: 'pointer' }}>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={handlePhotoUpload}
                        style={{ display: 'none' }}
                      />
                      <div className="upload-icon">{uploading ? '⏳' : '📷'}</div>
                      {uploading ? 'Uploading...' : 'Click to upload a photo — helps NGOs assess quickly'}
                    </label>
                  )}
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => { setShowModal(false); setError(''); }}>Cancel</button>
                <button type="submit" className="btn btn-brand" disabled={loading}>
                  {loading ? <span className="spinner"></span> : 'Post listing →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TOAST */}
      {showToast && (
        <div className="success-toast show">✓ Listing posted! NGOs have been notified.</div>
      )}
    </div>
  );
};

export default FPDashboard;
