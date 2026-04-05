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

  useEffect(() => {
    const token = localStorage.getItem('kb_token');
    const role = localStorage.getItem('kb_role');
    const name = localStorage.getItem('kb_name');

    if (!token || role !== 'food_provider') {
      navigate('/login');
      return;
    }

    setUser({ name, role });
    // fetchListings(); // To be implemented when API is ready
  }, [navigate]);

  const logout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const handleInputChange = (e) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };

  const submitListing = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulate API call
      await new Promise(r => setTimeout(r, 1000));

      setShowModal(false);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3500);

      // Reset form
      setFormData({
        name: '', qty: '', servings: '', location: '',
        from: '18:00', until: '22:00', notes: ''
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name) => {
    return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
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
          <Link to="/chat" class="nav-link">Messages</Link>
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
              {/* ... more items */}
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

        {/* Stat cards */}
        <div className="stat-grid">
          <div className="stat-card"><div className="stat-label">Total listings</div><div className="stat-value brand">8</div></div>
          <div className="stat-card"><div className="stat-label">Available</div><div className="stat-value teal">2</div></div>
          <div className="stat-card"><div className="stat-label">Claimed</div><div className="stat-value amber">3</div></div>
          <div className="stat-card"><div className="stat-label">Completed</div><div className="stat-value gray">3</div></div>
        </div>

        {/* Listings table */}
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
                {/* Sample row */}
                <tr>
                  <td><div className="td-food">Biryani, Nihari, Raita</div><div className="td-sub">Wedding event — 3 dishes</div></td>
                  <td>~40 kg</td><td>200</td><td>DHA Phase 5</td><td>Today, 10 PM</td>
                  <td><span className="badge badge-available">Available</span></td>
                  <td><button className="btn btn-sm btn-ghost" disabled>No chat yet</button></td>
                </tr>
                {/* ... more rows */}
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
              <button className="modal-close" onClick={() => setShowModal(false)}>✕</button>
            </div>
            <form onSubmit={submitListing}>
              <div className="modal-body">
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
                  <label className="form-label">Food photos (optional)</label>
                  <div className="upload-zone">
                    <div className="upload-icon">📷</div>
                    Click to upload photos — helps NGOs assess quickly
                  </div>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn" onClick={() => setShowModal(false)}>Cancel</button>
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
