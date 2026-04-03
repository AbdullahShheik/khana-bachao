const API = "http://localhost:8000";

async function doLogin() {
  const role  = currentRole === 'fp' ? 'food_provider' : 'ngo';
  const email = document.getElementById('emailInput').value;
  const pass  = document.getElementById('passInput').value;

  const res  = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: pass, role })
  });

  if (!res.ok) {
    const err = await res.json();
    alert(err.detail);   // show "Invalid credentials" etc.
    return;
  }

  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  localStorage.setItem('role', data.role);
  localStorage.setItem('name', data.name);

  // redirect based on role
  window.location.href = data.role === 'food_provider'
    ? 'dashboard-fp.html'
    : 'dashboard-ngo.html';
}

async function doRegister() {
  const res = await fetch(`${API}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name:     document.getElementById('nameInput').value,
      email:    document.getElementById('emailInput').value,
      phone:    document.getElementById('phoneInput').value,
      password: document.getElementById('passInput').value
    })
  });

  if (!res.ok) { const e = await res.json(); alert(e.detail); return; }
  const data = await res.json();
  localStorage.setItem('token', data.access_token);
  window.location.href = 'dashboard-fp.html';
}