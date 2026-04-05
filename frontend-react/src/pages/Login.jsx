import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:8000';

const Login = () => {
  const [currentRole, setCurrentRole] = useState('fp');
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const switchRole = (role) => {
    setCurrentRole(role);
    if (role === 'ngo' && isRegister) setIsRegister(false);
    setError('');
  };

  const toggleRegister = () => {
    setIsRegister(!isRegister);
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegister) {
        await doRegister();
      } else {
        await doLogin();
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const doRegister = async () => {
    const body = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim() || null,
      password,
    };

    const res = await fetch(`${API}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Registration failed');

    saveSession(data);
    navigate('/fp/dashboard');
  };

  const doLogin = async () => {
    const body = {
      email: email.trim(),
      password,
      role: currentRole === 'fp' ? 'food_provider' : 'ngo',
    };

    const res = await fetch(`${API}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Invalid credentials');

    saveSession(data);
    navigate(data.role === 'food_provider' ? '/fp/dashboard' : '/ngo/dashboard');
  };

  const saveSession = (data) => {
    localStorage.setItem('kb_token', data.access_token);
    localStorage.setItem('kb_role', data.role);
    localStorage.setItem('kb_name', data.name);
  };

  return (
    <div className="login-page">
      <div className="login-container">
        {/* LEFT: Hero panel */}
        <div className="login-hero">
          <div>
            <div style={{ fontSize: '32px', marginBottom: '10px' }}>🍛</div>
            <div className="login-hero-brand">Khana Bachao</div>
            <div className="login-hero-sub">
              A coordination platform connecting surplus food providers
              with verified NGOs — reducing waste, feeding communities.
            </div>
            <div className="hero-stat-grid">
              <div className="hero-stat"><div className="hero-stat-num">2.4k</div><div className="hero-stat-label">Meals rescued</div></div>
              <div className="hero-stat"><div className="hero-stat-num">38</div><div className="hero-stat-label">NGO partners</div></div>
              <div className="hero-stat"><div className="hero-stat-num">120</div><div className="hero-stat-label">Active providers</div></div>
              <div className="hero-stat"><div className="hero-stat-num">94%</div><div className="hero-stat-label">Claim rate</div></div>
            </div>
          </div>
          <div className="hero-quote">"No food should go to waste when someone goes hungry."</div>
        </div>

        {/* RIGHT: Form panel */}
        <div className="login-form-side">
          <h2 className="login-title">{isRegister ? 'Create an account' : 'Welcome back'}</h2>
          <p className="login-subtitle">{isRegister ? 'Register as a food provider' : 'Choose your role to continue'}</p>

          <div className="role-tabs">
            <button
              className={`role-tab ${currentRole === 'fp' ? 'active' : ''}`}
              onClick={() => switchRole('fp')}
            >
              🍽 Food Provider
            </button>
            <button
              className={`role-tab ${currentRole === 'ngo' ? 'active' : ''}`}
              onClick={() => switchRole('ngo')}
            >
              🤝 NGO
            </button>
          </div>

          {error && <div className="alert alert-error show">{error}</div>}

          <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="reg-fields show">
                <div className="form-group">
                  <label className="form-label">Organisation / Restaurant name</label>
                  <input
                    className="form-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Al-Karim Wedding Hall"
                    required
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">WhatsApp / Phone number</label>
                  <input
                    className="form-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="+92 300 0000000"
                  />
                </div>
              </div>
            )}

            <div className="form-group">
              <label className="form-label">Email address</label>
              <input
                className="form-input"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                className="form-input"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {currentRole === 'ngo' && (
              <div className="ngo-note" style={{ display: 'block' }}>
                NGO accounts are pre-verified by administrators.
                Contact admin if you don't have login credentials yet.
              </div>
            )}

            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? <span className="spinner"></span> : isRegister ? 'Create account' : `Sign in as ${currentRole === 'fp' ? 'Food Provider' : 'NGO'}`}
            </button>
          </form>

          {currentRole === 'fp' && (
            <div className="login-toggle">
              {isRegister ? (
                <>Already registered? <a onClick={toggleRegister}>Sign in</a></>
              ) : (
                <>New here? <a onClick={toggleRegister}>Create an account</a></>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
