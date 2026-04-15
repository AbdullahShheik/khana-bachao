import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:8000';

const Login = () => {
  const [currentRole, setCurrentRole] = useState('fp');
  const [isRegister, setIsRegister] = useState(false);
  const [showVerification, setShowVerification] = useState(false);
  
  // NEW: States for Forgot Password flow
  const [showForgotPass, setShowForgotPass] = useState(false);
  const [forgotPassStep, setForgotPassStep] = useState(1); // 1 = Ask Email, 2 = Ask OTP & New Pass
  const [newPassword, setNewPassword] = useState('');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [verificationCode, setVerificationCode] = useState(''); 
  
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const resetUIStates = () => {
    setError('');
    setSuccessMsg('');
    setShowVerification(false);
    setShowForgotPass(false);
    setForgotPassStep(1);
    setVerificationCode('');
    setNewPassword('');
  };

  const switchRole = (role) => {
    setCurrentRole(role);
    if (role === 'ngo' && isRegister) setIsRegister(false);
    resetUIStates();
  };

  const toggleRegister = () => {
    setIsRegister(!isRegister);
    resetUIStates();
  };

  const toggleForgotPass = () => {
    resetUIStates();
    setShowForgotPass(true);
  };

  const cancelForgotPass = () => {
    resetUIStates();
  };

  
  const handlePhoneChange = (e) => {
    // 1. Remove all non-numeric characters (prevents typing letters/symbols)
    let val = e.target.value.replace(/\D/g, '');

    // 2. Force the number to start with '03'
    if (val.length > 0 && val[0] !== '0') {
      val = '0'; 
    }
    if (val.length > 1 && val[1] !== '3') {
      val = '03';
    }

    // 3. Limit the total length to 11 digits (03 + 9 digits)
    val = val.slice(0, 11);

    // 4. Update the state
    setPhone(val);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      if (showForgotPass) {
        if (forgotPassStep === 1) await doRequestPasswordReset();
        else await doResetPassword();
      } else if (showVerification) {
        await doVerify();
      } else if (isRegister) {
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

  const doRequestPasswordReset = async () => {
    const res = await fetch(`${API}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to request reset');
    
    setSuccessMsg('Reset code sent! Please check your email.');
    setForgotPassStep(2); // Move to OTP and New Password screen
  };

  const doResetPassword = async () => {
    const res = await fetch(`${API}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        email: email.trim(),
        code: verificationCode.trim(),
        new_password: newPassword
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Failed to reset password');
    
    resetUIStates();
    setSuccessMsg('Password reset successfully! You can now sign in.');
  };

  // ... (Keep doRegister, doVerify, handleResendCode, doLogin, saveSession exactly the same as before) ...
  const doRegister = async () => {
    const body = { name: name.trim(), email: email.trim(), phone: phone.trim() || null, password };
    const res = await fetch(`${API}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Registration failed');
    setShowVerification(true);
    setSuccessMsg('Verification code sent! Please check your email inbox.');
  };

  const doVerify = async () => {
    const body = { email: email.trim(), code: verificationCode.trim() };
    const res = await fetch(`${API}/auth/verify`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'Verification failed');
    saveSession(data);
    navigate('/fp/dashboard');
  };

  const handleResendCode = async () => {
    setError(''); setSuccessMsg(''); setLoading(true);
    try {
      const res = await fetch(`${API}/auth/resend-code`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: email.trim() }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Failed to resend code');
      setSuccessMsg('A new code has been sent to your email.');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  const doLogin = async () => {
    const body = { email: email.trim(), password, role: currentRole === 'fp' ? 'food_provider' : 'ngo' };
    const res = await fetch(`${API}/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
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
        {/* ... Hero section remains the same ... */}
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
          <h2 className="login-title">
            {showForgotPass 
              ? 'Reset Password'
              : showVerification ? 'Verify your Email' : isRegister ? 'Create an account' : 'Welcome back'}
          </h2>
          <p className="login-subtitle">
            {showForgotPass 
              ? (forgotPassStep === 1 ? 'Enter your email to receive a reset code' : `Code sent to ${email}`)
              : showVerification 
              ? `We sent a 6-digit code to ${email}` 
              : isRegister ? 'Register as a food provider' : 'Choose your role to continue'}
          </p>

          {!showVerification && !showForgotPass && (
            <div className="role-tabs">
              <button className={`role-tab ${currentRole === 'fp' ? 'active' : ''}`} onClick={() => switchRole('fp')}>🍽 Food Provider</button>
              <button className={`role-tab ${currentRole === 'ngo' ? 'active' : ''}`} onClick={() => switchRole('ngo')}>🤝 NGO</button>
            </div>
          )}

          {error && <div className="alert alert-error show">{error}</div>}
          {successMsg && <div className="alert alert-success show" style={{color: 'green', backgroundColor: '#e8f5e9', border: '1px solid #c8e6c9', padding: '10px', borderRadius: '5px', marginBottom: '1rem', fontSize: '14px'}}>{successMsg}</div>}

          <form onSubmit={handleSubmit}>
            
            {/* --- FORGOT PASSWORD FLOW --- */}
            {showForgotPass ? (
              <>
                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input
                    className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com" required disabled={forgotPassStep === 2}
                  />
                </div>
                
                {forgotPassStep === 2 && (
                  <>
                    <div className="form-group">
                      <label className="form-label">6-Digit Reset Code</label>
                      <input
                        className="form-input" type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)}
                        placeholder="123456" maxLength={6} required style={{ letterSpacing: '4px', fontSize: '18px', textAlign: 'center' }}
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">New Password</label>
                      <input
                        className="form-input" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••" required minLength={6}
                      />
                    </div>
                  </>
                )}

                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? <span className="spinner"></span> : forgotPassStep === 1 ? 'Send Reset Code' : 'Update Password'}
                </button>
                <div style={{marginTop: '15px', textAlign: 'center'}}>
                  <button type="button" onClick={cancelForgotPass} style={{background: 'none', border: 'none', color: '#666', cursor: 'pointer', textDecoration: 'underline'}}>
                    Back to Login
                  </button>
                </div>
              </>
            ) 
            
            /* --- VERIFICATION FLOW --- */
            : showVerification ? (
              <>
                <div className="form-group">
                  <label className="form-label">Verification Code</label>
                  <input
                    className="form-input" type="text" value={verificationCode} onChange={(e) => setVerificationCode(e.target.value)}
                    placeholder="123456" maxLength={6} required style={{ letterSpacing: '4px', fontSize: '18px', textAlign: 'center' }}
                  />
                </div>
                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? <span className="spinner"></span> : 'Verify & Login'}
                </button>
                <div style={{marginTop: '15px', textAlign: 'center'}}>
                  <p style={{fontSize: '14px', marginBottom: '5px'}}>Didn't receive the code?</p>
                  <button type="button" onClick={handleResendCode} disabled={loading} style={{background: 'none', border: 'none', color: '#e65100', cursor: 'pointer', fontWeight: 'bold', textDecoration: 'underline'}}>
                    {loading ? 'Sending...' : 'Resend Code'}
                  </button>
                </div>
              </>
            ) 
            
            /* --- STANDARD LOGIN / REGISTER FLOW --- */
            : (
              <>
                {isRegister && (
                  <div className="reg-fields show">
                    <div className="form-group">
                      <label className="form-label">Organisation / Restaurant name</label>
                      <input className="form-input" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Al-Karim Wedding Hall" required />
                    </div>
                    <div className="form-group">
                      <label className="form-label">WhatsApp / Phone number</label>
                      <input
                        className="form-input"
                        type="tel"
                        value={phone}
                        onChange={handlePhoneChange} // Use our new masking function
                        placeholder="03XXXXXXXXX"
                        pattern="03[0-9]{9}" // HTML5 validation: exactly 03 followed by 9 digits
                        maxLength={11}
                        title="Phone number must start with 03 and be exactly 11 digits long"
                      />
                    </div>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Email address</label>
                  <input className="form-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" required />
                </div>
                
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <label className="form-label">Password</label>
                    {!isRegister && currentRole === 'fp' && (
                      <a onClick={toggleForgotPass} style={{ fontSize: '13px', color: '#e65100', cursor: 'pointer', textDecoration: 'none' }}>
                        Forgot password?
                      </a>
                    )}
                  </div>
                  <input className="form-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" required />
                </div>

                {currentRole === 'ngo' && (
                  <div className="ngo-note" style={{ display: 'block' }}>
                    NGO accounts are pre-verified by administrators. Contact admin if you don't have login credentials yet.
                  </div>
                )}

                <button className="btn-primary" type="submit" disabled={loading}>
                  {loading ? <span className="spinner"></span> : isRegister ? 'Create account' : `Sign in as ${currentRole === 'fp' ? 'Food Provider' : 'NGO'}`}
                </button>
              </>
            )}
          </form>

          {!showVerification && !showForgotPass && currentRole === 'fp' && (
            <div className="login-toggle">
              {isRegister ? (
                <>Already registered? <a onClick={toggleRegister} style={{cursor: 'pointer', color: '#e65100'}}>Sign in</a></>
              ) : (
                <>New here? <a onClick={toggleRegister} style={{cursor: 'pointer', color: '#e65100'}}>Create an account</a></>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;