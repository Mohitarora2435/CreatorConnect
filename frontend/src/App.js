// src/App.js
import React, { useEffect, useState, useMemo } from "react";

/*
  CreatorConnect - Protected + Modal Campaign Detail + Improved Styles
  Paste/overwrite src/App.js and run `npm start`.
  Backend default: http://localhost:4000
*/

const API = process.env.REACT_APP_API_BASE || "http://localhost:4000";

/* ---------------- name cache ---------------- */
function useNameCache() {
  const cacheRef = React.useRef({});
  async function getName(id) {
    if (!id) return id;
    if (cacheRef.current[id]) return cacheRef.current[id];
    try {
      const res = await fetch(`${API}/api/users/${id}`);
      if (!res.ok) {
        cacheRef.current[id] = id;
        return id;
      }
      const j = await res.json();
      cacheRef.current[id] = j?.name || id;
      return cacheRef.current[id];
    } catch {
      cacheRef.current[id] = id;
      return id;
    }
  }
  return { getName };
}

/* ---------------- auth hook ---------------- */
function useAuth() {
  const [token, setToken] = useState(localStorage.getItem("token"));
  const [user, setUser] = useState(JSON.parse(localStorage.getItem("user") || "null"));

  async function login(email, password) {
    try {
      const res = await fetch(`${API}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.error || "Login failed" };
    } catch (err) {
      return { ok: false, error: err.message || "Login error" };
    }
  }

  async function register(payload) {
    try {
      const res = await fetch(`${API}/api/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("user", JSON.stringify(data.user));
        setToken(data.token);
        setUser(data.user);
        return { ok: true, user: data.user };
      }
      return { ok: false, error: data.error || "Register failed" };
    } catch (err) {
      return { ok: false, error: err.message || "Register error" };
    }
  }

  function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);
  }

  return { token, user, login, register, logout, setUser, setToken };
}

/* ---------------- small UI blocks ---------------- */
function Avatar({ name, size = 44, bg = "#EAF2FF" }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: 10, background: bg,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontWeight: 700, color: "#0b4bd6"
    }}>{name ? name[0].toUpperCase() : "U"}</div>
  );
}

function Toast({ text }) {
  if (!text) return null;
  return <div style={{
    position: "fixed", right: 20, bottom: 20, background: "#0b6fff", color: "#fff",
    padding: "10px 14px", borderRadius: 8, boxShadow: "0 8px 20px rgba(11,103,255,0.2)", zIndex: 4000
  }}>{text}</div>;
}

/* ---------------- App ---------------- */
export default function App() {
  const auth = useAuth();
  const nameCache = useNameCache();

  // routes: home | login | register | dashboard | messages | campaigns | post
  const [route, setRoute] = useState("home");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const [creators, setCreators] = useState([]);
  const [brands, setBrands] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [messages, setMessages] = useState([]);
  const [collabs, setCollabs] = useState([]);

  const [query, setQuery] = useState("");
  const [niche, setNiche] = useState("All");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [regForm, setRegForm] = useState({ name: "", email: "", password: "", role: "brand" });
  const [campaignForm, setCampaignForm] = useState({ title: "", niche: "Tech", budget: "", description: "" });

  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [threadMessages, setThreadMessages] = useState([]);
  const [messageText, setMessageText] = useState("");

  useEffect(() => {
    quickLoad();
    if (auth.user) {
      fetchMessages();
      fetchCollabs();
    } else {
      // clear private lists for guest
      setMessages([]);
      setCollabs([]);
    }
    // eslint-disable-next-line
  }, [auth.user]);

  // redirect guard for protected routes
  useEffect(() => {
    const protectedRoutes = ["dashboard", "messages", "campaigns", "post"];
    if (protectedRoutes.includes(route) && !auth.user) {
      setRoute("login");
      showToast("Please login to access that page");
    }
    // eslint-disable-next-line
  }, [route, auth.user]);

  function showToast(t, ms = 3000) {
    setToast(t);
    setTimeout(() => setToast(""), ms);
  }

  /* ---------- Data fetchers ---------- */
  async function fetchCreators() {
    try {
      const params = new URLSearchParams();
      if (query) params.append("q", query);
      if (niche && niche !== "All") params.append("niche", niche);
      const res = await fetch(`${API}/api/creators?${params.toString()}`);
      if (!res.ok) { setCreators([]); return; }
      const j = await res.json();
      setCreators(Array.isArray(j) ? j : []);
    } catch (e) {
      console.error("fetchCreators", e);
      setCreators([]);
      showToast("Failed to load creators");
    }
  }

  async function fetchBrands() {
    try {
      const res = await fetch(`${API}/api/brands`);
      if (!res.ok) { setBrands([]); return; }
      const j = await res.json();
      setBrands(Array.isArray(j) ? j : []);
    } catch (e) {
      console.error("fetchBrands", e);
      setBrands([]);
      showToast("Failed to load brands");
    }
  }

  async function fetchCampaigns() {
    try {
      const res = await fetch(`${API}/api/campaigns`);
      if (!res.ok) { setCampaigns([]); return; }
      const j = await res.json();
      // ensure status exists
      const normalized = Array.isArray(j) ? j.map(it => ({ status: "open", ...it })) : [];
      setCampaigns(normalized);
    } catch (e) {
      console.error("fetchCampaigns", e);
      setCampaigns([]);
      showToast("Failed to load campaigns");
    }
  }

  async function fetchMessages() {
    if (!auth.token) { setMessages([]); return; }
    try {
      const res = await fetch(`${API}/api/messages`, { headers: { Authorization: `Bearer ${auth.token}` } });
      if (res.status === 401) { showToast("Session expired — please login"); auth.logout(); setMessages([]); return; }
      if (!res.ok) { setMessages([]); return; }
      const j = await res.json();
      setMessages(Array.isArray(j) ? j : []);
    } catch (e) {
      console.error("fetchMessages", e);
      setMessages([]);
      showToast("Failed to load messages");
    }
  }

  async function fetchCollabs() {
    if (!auth.token) { setCollabs([]); return; }
    try {
      const res = await fetch(`${API}/api/collaborations`, { headers: { Authorization: `Bearer ${auth.token}` } });
      if (res.status === 401) { showToast("Session expired — please login"); auth.logout(); setCollabs([]); return; }
      if (!res.ok) { setCollabs([]); return; }
      const j = await res.json();
      setCollabs(Array.isArray(j) ? j : []);
    } catch (e) {
      console.error("fetchCollabs", e);
      setCollabs([]);
      showToast("Failed to load collaborations");
    }
  }

  async function quickLoad() {
    setLoading(true);
    await Promise.all([fetchCreators(), fetchBrands(), fetchCampaigns()]);
    setLoading(false);
  }

  /* ---------- Auth actions ---------- */
  async function doLogin(e) {
    e && e.preventDefault();
    setLoading(true);
    const r = await auth.login(loginForm.email, loginForm.password);
    setLoading(false);
    if (!r.ok) return showToast(r.error || "Login failed");
    showToast("Welcome back");
    setRoute("dashboard");
    fetchMessages();
    fetchCollabs();
  }

  async function doRegister(e) {
    e && e.preventDefault();
    setLoading(true);
    const payload = { name: regForm.name, email: regForm.email, password: regForm.password, role: regForm.role, profile: {} };
    const r = await auth.register(payload);
    setLoading(false);
    if (!r.ok) return showToast(r.error || "Register failed");
    showToast("Account created");
    setRoute("dashboard");
  }

  /* ---------- Messaging ---------- */
  // ---------- frontend: prevent self-messaging ----------
function isSelf(id) {
  return auth.user && id && auth.user.id === id;
}

async function sendMessage(toId, text) {
  if (!auth.token) return showToast("Login first");
  if (!toId) return showToast("No recipient");
  if (isSelf(toId)) return showToast("You can't message yourself");
  if (!text) return showToast("Enter a message");
  try {
    const res = await fetch(`${API}/api/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
      body: JSON.stringify({ toId, text })
    });
    const j = await res.json();
    if (j.error) return showToast(j.error);
    fetchMessages();
    showToast("Message sent");
    return j;
  } catch (e) {
    console.error("sendMessage error", e);
    showToast("Message failed");
  }
}

async function openThread(partnerId) {
  if (!auth.user) { setRoute("login"); showToast("Please login to view messages"); return; }
  if (!partnerId) return showToast("Invalid conversation");
  if (isSelf(partnerId)) { showToast("You can't open a conversation with yourself"); return; }
  setSelectedThread(partnerId);
  const myId = auth.user?.id;
  if (!Array.isArray(messages)) await fetchMessages();
  const thread = (Array.isArray(messages) ? messages : []).filter(m => (m.from === myId && m.to === partnerId) || (m.from === partnerId && m.to === myId));
  thread.sort((a, b) => new Date(a.at || a.createdAt || 0) - new Date(b.at || b.createdAt || 0));
  setThreadMessages(thread);
  setRoute("messages");
}


  async function postThreadMessage() {
    if (!selectedThread) return showToast("Select thread");
    await sendMessage(selectedThread, messageText);
    setMessageText("");
    openThread(selectedThread);
  }

  /* ---------- Campaigns & Collabs ---------- */
  async function doPostCampaign(e) {
    e && e.preventDefault();
    if (!auth.token) return showToast("Login as brand");
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/campaigns`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify(campaignForm)
      });
      if (res.status === 401) { showToast("Session expired"); auth.logout(); setLoading(false); return; }
      if (!res.ok) { const err = await res.json().catch(()=>null); showToast(err?.error || "Post failed"); setLoading(false); return; }
      await fetchCampaigns();
      setCampaignForm({ title: "", niche: "Tech", budget: "", description: "" });
      showToast("Campaign posted");
      setRoute("campaigns");
    } catch (e) {
      console.error("doPostCampaign", e);
      showToast("Failed to post campaign");
    } finally { setLoading(false); }
  }

  async function offerCollab(campaignId, creatorId, amount = 10000) {
    if (!auth.token) return showToast("Login as brand");
    try {
      const res = await fetch(`${API}/api/collaborations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${auth.token}` },
        body: JSON.stringify({ campaignId, creatorId, amount })
      });
      if (res.status === 401) { showToast("Session expired"); auth.logout(); return; }
      if (!res.ok) { const err = await res.json().catch(()=>null); return showToast(err?.error || "Offer failed"); }
      await fetchCollabs();
      showToast("Offer created");
    } catch (e) {
      console.error("offerCollab", e);
      showToast("Offer failed");
    }
  }

  async function acceptCollab(collabId) {
    if (!auth.token) return showToast("Login as creator");
    try {
      const res = await fetch(`${API}/api/collaborations/${collabId}/accept`, { method: "POST", headers: { Authorization: `Bearer ${auth.token}` } });
      if (res.status === 401) { showToast("Session expired"); auth.logout(); return; }
      if (!res.ok) { const err = await res.json().catch(()=>null); return showToast(err?.error || "Accept failed"); }
      await fetchCollabs();
      showToast("Accepted");
    } catch (e) {
      console.error("acceptCollab", e);
      showToast("Accept failed");
    }
  }

  async function closeCampaign(id) {
    if (!auth.token) { showToast("Please login as the brand that created this campaign"); return; }
    const camp = (Array.isArray(campaigns) ? campaigns.find(c => c.id === id) : null);
    if (!camp) { showToast("Campaign not found locally. Refreshing..."); await fetchCampaigns(); return; }
    if (!(auth.user && auth.user.role === "brand" && auth.user.id === camp.brandId)) { showToast("You are not the owner of this campaign"); return; }
    try {
      const res = await fetch(`${API}/api/campaigns/${id}/close`, {
        method: "POST",
        headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" }
      });
      if (res.status === 401) { showToast("Session expired — please login again"); auth.logout(); return; }
      if (!res.ok) {
        let body = null;
        try { body = await res.json(); } catch (e) { body = await res.text().catch(()=>null); }
        console.error("closeCampaign failed", res.status, body);
        const msg = (body && body.error) ? `Close failed: ${body.error}` : `Close failed (status ${res.status})`;
        showToast(msg);
        return;
      }
      await fetchCampaigns();
      showToast("Campaign marked full (closed)");
    } catch (e) {
      console.error("closeCampaign network error", e);
      showToast("Close failed — network error");
    }
  }

  async function findMatches(campaignId) {
    try {
      const res = await fetch(`${API}/api/campaigns/${campaignId}/matches`);
      if (!res.ok) { showToast("Matches failed"); return; }
      const j = await res.json();
      setCreators(Array.isArray(j) ? j : []);
      setRoute("dashboard");
      showToast("Matches loaded");
    } catch (e) {
      console.error("findMatches", e);
      showToast("Matches failed");
    }
  }

  /* ---------- grouped threads ---------- */
  const groupedThreads = useMemo(() => {
    const me = auth.user?.id;
    if (!me) return [];
    if (!Array.isArray(messages)) return [];
    const map = {};
    messages.forEach(m => {
      const other = m.from === me ? m.to : m.from;
      if (!map[other]) map[other] = [];
      map[other].push(m);
    });
    return Object.entries(map).map(([other, msgs]) => ({ other, last: msgs[msgs.length - 1], count: msgs.length }))
      .sort((a, b) => new Date(b.last?.createdAt || b.last?.at || 0) - new Date(a.last?.createdAt || a.last?.at || 0));
  }, [messages, auth.user]);

  /* ---------------- filtered campaigns (role-aware + strict) ---------------- */
  const filteredCampaigns = useMemo(() => {
    if (!Array.isArray(campaigns)) return [];
    if (auth.user?.role === 'brand') {
      // brand sees only their campaigns
      return campaigns.filter(c =>
        c.brandId === auth.user.id &&
        (niche === 'All' || !niche || (c.niche || '').toLowerCase() === (niche || '').toLowerCase())
      );
    }
    // creators or guests see only open campaigns
    return campaigns.filter(c =>
      (c.status || 'open') !== 'closed' &&
      (niche === 'All' || !niche || (c.niche || '').toLowerCase() === (niche || '').toLowerCase())
    );
  }, [campaigns, niche, auth.user]);

  /* --------------- UI render --------------- */
  return (
    <div style={page.app}>
      <style>{embeddedCSS}</style>

      <header style={page.header}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={page.logo}>CC</div>
          <div>
            <div style={{ fontWeight: 800 }}>CreatorConnect</div>
            <div style={{ fontSize: 12, color: "#9CA3AF" }}>Creator × Brand marketplace — demo</div>
          </div>
        </div>

        <nav style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="link" onClick={() => setRoute("home")}>Home</button>
          {/* hide protected links when guest */}
          {auth.user && <button className="link" onClick={() => setRoute("dashboard")}>Dashboard</button>}
          {auth.user && <button className="link" onClick={() => setRoute("campaigns")}>Campaigns</button>}
          {auth.user && <button className="link" onClick={() => setRoute("messages")}>Messages</button>}

          {auth.user ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontWeight: 700 }}>{auth.user.name}</div>
                <div style={{ fontSize: 12, color: "#9CA3AF" }}>{auth.user.role}</div>
              </div>
              <Avatar name={auth.user.name} />
              <button className="btn-ghost" onClick={() => { auth.logout(); setRoute("home"); showToast("Logged out"); }}>Logout</button>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn-primary" onClick={() => setRoute("login")}>Login</button>
              <button className="btn-ghost" onClick={() => setRoute("register")}>Register</button>
            </div>
          )}
        </nav>
      </header>

      <main style={page.main}>
        {/* HOME */}
        {route === "home" && (
          <section style={page.hero}>
            <div>
              <h1 style={{ margin: 0 }}>Find creators that actually match your audience</h1>
              <p style={{ color: "#6b7280", maxWidth: 640 }}>CreatorConnect helps brands discover verified creators with accurate audience signals and enables creators to find genuine brand campaigns — demo prototype for hackathon.</p>
              <div style={{ marginTop: 12 }}>
                <button className="btn-primary" onClick={() => auth.user ? setRoute("dashboard") : setRoute("register")}>Get started</button>
                <button className="btn-ghost" onClick={() => { setLoginForm({ email: "brand@demo.com", password: "pass123" }); setRoute("login"); }}>Use demo</button>
              </div>
            </div>

            <div style={page.heroPreview}>
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <Avatar name="Riya" bg="#FFF5F7" />
                <div>
                  <div style={{ fontWeight: 700 }}>Riya Sharma</div>
                  <div style={{ color: "#6b7280", fontSize: 13 }}>Fashion • Instagram • Delhi</div>
                </div>
              </div>

              <div style={{ marginTop: 14 }}>
                <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                  <div style={{ fontWeight: 800, fontSize: 20 }}>52k</div>
                  <div style={{ color: "#6b7280" }}>followers</div>
                  <div style={{ marginLeft: "auto", color: "#0b6fff", fontWeight: 700 }}>Verified</div>
                </div>
                <div style={{ marginTop: 10, color: "#333" }}>Top age: 19–24 • Engagement 3.4%</div>
              </div>
            </div>
          </section>
        )}

        {/* LOGIN */}
        {route === "login" && (
          <section style={page.center}>
            <div style={page.authCard}>
              <h3 style={{ marginBottom: 6 }}>Sign in</h3>
              <form onSubmit={doLogin} style={{ display: "grid", gap: 10 }}>
                <input className="input" placeholder="Email" value={loginForm.email} onChange={e => setLoginForm({ ...loginForm, email: e.target.value })} required />
                <input className="input" placeholder="Password" type="password" value={loginForm.password} onChange={e => setLoginForm({ ...loginForm, password: e.target.value })} required />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" type="submit">{loading ? "Signing in..." : "Sign in"}</button>
                  <button type="button" className="btn-ghost" onClick={() => { setLoginForm({ email: "brand@demo.com", password: "pass123" }); showToast("Demo brand credentials filled"); }}>Brand demo</button>
                  <button type="button" className="btn-ghost" onClick={() => { setLoginForm({ email: "riya@demo.com", password: "pass123" }); showToast("Demo creator credentials filled"); }}>Creator demo</button>
                </div>
              </form>
              <div style={{ marginTop: 10, color: "#9CA3AF", fontSize: 13 }}>Don't have an account? <button className="link" onClick={() => setRoute("register")}>Register</button></div>
            </div>
          </section>
        )}

        {/* REGISTER */}
        {route === "register" && (
          <section style={page.center}>
            <div style={page.authCard}>
              <h3 style={{ marginBottom: 6 }}>Create account</h3>
              <form onSubmit={doRegister} style={{ display: "grid", gap: 10 }}>
                <input className="input" placeholder="Full name" value={regForm.name} onChange={e => setRegForm({ ...regForm, name: e.target.value })} required />
                <input className="input" placeholder="Email" value={regForm.email} onChange={e => setRegForm({ ...regForm, email: e.target.value })} required />
                <input className="input" placeholder="Password" type="password" value={regForm.password} onChange={e => setRegForm({ ...regForm, password: e.target.value })} required />
                <select className="input" value={regForm.role} onChange={e => setRegForm({ ...regForm, role: e.target.value })}>
                  <option value="brand">Brand</option>
                  <option value="creator">Creator</option>
                </select>
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" type="submit">Create account</button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* DASHBOARD (protected) */}
        {route === "dashboard" && auth.user && (
          <section style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 18 }}>
            <div>
              <div style={page.card}>
                <div style={{ display: "flex", gap: 8 }}>
                  <input className="input" placeholder={auth.user?.role === "brand" ? "Search creators by name or niche..." : "Search brands or campaigns..."} value={query} onChange={e => setQuery(e.target.value)} />
                  <select className="input" value={niche} onChange={e => setNiche(e.target.value)} style={{ width: 160 }}>
                    <option>All</option>
                    <option>Fashion</option>
                    <option>Tech</option>
                    <option>Fitness</option>
                    <option>Social Cause</option>
                  </select>
                  <button className="btn-primary" onClick={() => quickLoad()}>Search</button>
                </div>
              </div>

              {auth.user?.role === "brand" ? (
                <div style={page.card}>
                  <h4>Your Creators</h4>
                  {creators.length === 0 ? <div style={{ color: "#6b7280" }}>No creators found</div> :
                    creators.map(c => (
                      <div key={c.id} style={page.itemCard}>
                        <div style={{ display: "flex", gap: 12 }}>
                          <Avatar name={c.name} bg={c.profile?.location?.toLowerCase().includes("rural") ? "#fff7ed" : "#eef8ff"} />
                          <div style={{ flex: 1 }}>
                            <div style={{ fontWeight: 700 }}>{c.name} {c.verified && <span className="badge">Verified</span>}</div>
                            <div style={{ color: "#6b7280" }}>{c.profile?.niche} • {c.profile?.platform} • {c.profile?.location}</div>
                            <div style={{ marginTop: 6, color: "#333" }}>Followers <strong>{c.profile?.followers || "-"}</strong> • Eng {c.profile?.engagement || "-"}% • Top {c.profile?.ageDistribution ? Object.entries(c.profile.ageDistribution).sort((a,b)=>b[1]-a[1])[0][0] : "-"}</div>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-ghost" onClick={() => openThread(c.id)}>Message</button>
                          <button className="btn-primary" onClick={() => sendMessage(c.id, `Hi ${c.name}, interested in collaborating.`)}>Quick message</button>
                          <button className="btn-success" onClick={() => offerCollab(null, c.id, 10000)}>Offer</button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              ) : (
                <div style={page.card}>
                  <h4>Active Campaigns</h4>
                  {filteredCampaigns.length === 0 ? <div style={{ color: "#6b7280" }}>No campaigns</div> :
                    filteredCampaigns.map(c => (
                      <div key={c.id} style={page.itemCard}>
                        <div>
                          <div style={{ fontWeight: 700 }}>{c.title}</div>
                          <div style={{ color: "#6b7280" }}>{c.niche} • Budget {c.budget}</div>
                          <div style={{ marginTop: 6 }}>{c.description}</div>
                        </div>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn-ghost" onClick={() => { setSelectedCampaign(c); /* modal will show */ }}>View</button>
                          <button className="btn-primary" onClick={() => auth.user ? sendMessage(c.brandId, `Hi, I'm interested in ${c.title}`) : (setRoute("login"), showToast("Please login to contact brand"))}>Contact</button>
                        </div>
                      </div>
                    ))
                  }
                </div>
              )}
            </div>

            <aside>
              <div style={page.card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <h4>Campaigns</h4>
                  {auth.user?.role === "brand" && <button className="link" onClick={() => setRoute("post")}>Post</button>}
                </div>

                {filteredCampaigns.slice(0,6).map(c => (
                  <div key={c.id} style={{ marginTop: 12 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <div style={{ fontWeight: 700 }}>{c.title}</div>
                      {c.status === 'closed' && <span className="badge" style={{ background: "#F3F4F6", color: "#374151" }}>Closed</span>}
                    </div>
                    <div style={{ color: "#6b7280", fontSize: 13 }}>{c.niche} • {c.budget}</div>
                    {auth.user?.role === "brand" && auth.user.id === c.brandId && c.status !== "closed" && <div style={{ marginTop: 8 }}><button className="small" onClick={() => closeCampaign(c.id)}>Mark Full</button></div>}
                  </div>
                ))}
              </div>

              <div style={page.card}>
                <h4>Messages</h4>
                <div>
                  {(messages.length === 0) ? <div style={{ color: "#6b7280" }}>No messages</div> :
                    groupedThreads.map(t => <ThreadListItem key={t.other} thread={t} onOpen={() => openThread(t.other)} getName={nameCache.getName} />)
                  }
                </div>
              </div>

              <div style={page.card}>
                <h4>Collaborations</h4>
                {collabs.length === 0 ? <div style={{ color: "#6b7280" }}>No collaborations</div> :
                  collabs.map(c => (
                    <div key={c.id} style={{ marginTop: 10 }}>
                      <div style={{ fontWeight: 700 }}>{c.id.slice(0,8)}</div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>Status: {c.status}</div>
                      {auth.user?.role === "creator" && c.creatorId === auth.user.id && c.status === "proposed" && <div style={{ marginTop: 8 }}><button className="btn-primary" onClick={() => acceptCollab(c.id)}>Accept</button></div>}
                    </div>
                  ))
                }
              </div>
            </aside>
          </section>
        )}

        {/* MESSAGES (protected) */}
        {route === "messages" && auth.user && (
          <section style={{ display: "grid", gridTemplateColumns: "320px 1fr", gap: 18 }}>
            <div style={page.card}>
              <h4>Threads</h4>
              {groupedThreads.length === 0 ? <div style={{ color: "#6b7280" }}>No conversations</div> : groupedThreads.map(t => <ThreadListItem key={t.other} thread={t} onOpen={() => openThread(t.other)} getName={nameCache.getName} />)}
            </div>

            <div style={page.card}>
              <h4>Conversation</h4>
              {!selectedThread ? <div style={{ color: "#6b7280" }}>Select a thread to view</div> :
                <>
                  <div style={{ maxHeight: 420, overflow: "auto", padding: 8, border: "1px dashed #eef2fb", borderRadius: 8 }}>
                    {threadMessages.length === 0 ? <div style={{ color: "#6b7280" }}>No messages in this thread</div> : threadMessages.map((m, i) => <MessageBubble key={i} msg={m} me={auth.user?.id} getName={nameCache.getName} />)}
                  </div>

                  <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
                    <input className="input" placeholder="Write a message..." value={messageText} onChange={e => setMessageText(e.target.value)} />
                    <button className="btn-primary" onClick={postThreadMessage}>Send</button>
                  </div>
                </>
              }
            </div>
          </section>
        )}

        {/* CAMPAIGNS (protected) */}
        {route === "campaigns" && auth.user && (
          <section>
            <div style={page.card}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3>Campaigns</h3>
                {auth.user?.role === "brand" && <button className="btn-primary" onClick={() => setRoute("post")}>Post new campaign</button>}
              </div>

              <div className="campaignGrid" style={{ marginTop: 12 }}>
                {filteredCampaigns.length === 0 ? <div style={{ color: "#6b7280" }}>No campaigns</div> :
                  filteredCampaigns.map(c => (
                    <div key={c.id} style={{ ...page.campaignCard }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontWeight: 800 }}>{c.title}</div>
                        {c.status === 'closed' && <span className="badge" style={{ background: "#F3F4F6", color: "#374151" }}>Closed</span>}
                      </div>
                      <div style={{ color: "#6b7280", fontSize: 13 }}>{c.niche} • Budget: {c.budget}</div>
                      <div style={{ marginTop: 8, color: "#333", flex: "1 1 auto" }}>{c.description}</div>
                      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        <button className="btn-ghost" onClick={() => setSelectedCampaign(c)}>View</button>
                        <button className="btn-primary" onClick={() => auth.user ? sendMessage(c.brandId, `Hi, I'm interested in ${c.title}`) : (setRoute("login"), showToast("Please login to contact brand"))}>Contact</button>
                        {auth.user?.role === "brand" && auth.user.id === c.brandId && c.status !== "closed" && <button className="small" onClick={() => closeCampaign(c.id)}>Mark Full</button>}
                      </div>
                    </div>
                  ))
                }
              </div>
            </div>
          </section>
        )}

        {/* POST CAMPAIGN */}
        {route === "post" && auth.user?.role === "brand" && (
          <section style={page.center}>
            <div style={{ ...page.card, maxWidth: 720 }}>
              <h3>Post Campaign</h3>
              <form onSubmit={doPostCampaign} style={{ display: "grid", gap: 10 }}>
                <input className="input" placeholder="Title" value={campaignForm.title} onChange={e => setCampaignForm({ ...campaignForm, title: e.target.value })} required />
                <select className="input" value={campaignForm.niche} onChange={e => setCampaignForm({ ...campaignForm, niche: e.target.value })}>
                  <option>Tech</option><option>Fashion</option><option>Fitness</option><option>Social Cause</option>
                </select>
                <input className="input" placeholder="Budget" type="number" value={campaignForm.budget} onChange={e => setCampaignForm({ ...campaignForm, budget: e.target.value })} />
                <textarea className="input" placeholder="Description" value={campaignForm.description} onChange={e => setCampaignForm({ ...campaignForm, description: e.target.value })} />
                <div style={{ display: "flex", gap: 8 }}>
                  <button className="btn-primary" type="submit">Post campaign</button>
                  <button className="btn-ghost" type="button" onClick={() => setRoute("dashboard")}>Cancel</button>
                </div>
              </form>
            </div>
          </section>
        )}

        {/* CAMPAIGN DETAIL MODAL — opens over UI */}
        {selectedCampaign && (
          <div style={modal.backdrop} onClick={() => setSelectedCampaign(null)}>
            <div style={modal.container} onClick={(e) => e.stopPropagation()}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ fontWeight: 800, fontSize: 18 }}>{selectedCampaign.title}</div>
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  {selectedCampaign.status === 'closed' && <span className="badge" style={{ background: "#F3F4F6", color: "#374151" }}>Closed</span>}
                  <button className="btn-ghost" onClick={() => setSelectedCampaign(null)}>Close</button>
                </div>
              </div>
              <div style={{ color: "#6b7280", marginTop: 6 }}>{selectedCampaign.niche} • Budget: {selectedCampaign.budget}</div>
              <p style={{ marginTop: 12 }}>{selectedCampaign.description}</p>
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn-primary" onClick={() => { auth.user ? sendMessage(selectedCampaign.brandId, `Hi, I'm interested in ${selectedCampaign.title}`) : (setRoute("login"), showToast("Please login to contact brand")); }}>Contact brand</button>
                {auth.user?.role === "brand" && auth.user.id === selectedCampaign.brandId && selectedCampaign.status !== "closed" && <button className="small" onClick={() => closeCampaign(selectedCampaign.id)}>Mark Requirements Full</button>}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer style={page.footer}>
        Prototype — in-memory backend. For production: add DB persistence, platform analytics, Stripe payments, and admin KYC.
      </footer>

      <Toast text={toast} />
      {loading && <div style={page.fullLoader}>Loading…</div>}
    </div>
  );
}

/* ---------------- small components ---------------- */
function ThreadListItem({ thread, onOpen, getName }) {
  const [name, setName] = useState(thread.other);
  useEffect(() => {
    let mounted = true;
    getName(thread.other).then(n => { if (mounted) setName(n || thread.other); });
    return () => { mounted = false; };
  }, [thread.other, getName]);
  return (
    <div onClick={onOpen} style={{ padding: 8, borderRadius: 8, display: "flex", gap: 10, alignItems: "center", marginTop: 8, cursor: "pointer", border: "1px solid #f1f5fb" }}>
      <Avatar name={name} />
      <div>
        <div style={{ fontWeight: 700 }}>{name}</div>
        <div style={{ color: "#6b7280" }}>{thread.last?.text?.slice?.(0,60) || ""}</div>
      </div>
      <div style={{ marginLeft: "auto", color: "#9CA3AF" }}>{thread.count}</div>
    </div>
  );
}

function MessageBubble({ msg, me, getName }) {
  const [name, setName] = useState(msg.from);
  const isMe = msg.from === me;
  useEffect(() => {
    let mounted = true;
    getName(msg.from).then(n => { if (mounted) setName(n || msg.from); });
    return () => { mounted = false; };
  }, [msg.from, getName]);
  return (
    <div style={{ display: "flex", gap: 10, marginBottom: 8, justifyContent: isMe ? "flex-end" : "flex-start" }}>
      {!isMe && <Avatar name={name} size={36} />}
      <div style={{ maxWidth: "70%", background: isMe ? "#0b6fff" : "#eef6ff", color: isMe ? "#fff" : "#0b6fff", padding: 10, borderRadius: 8 }}>
        <div style={{ fontSize: 13 }}>{msg.text}</div>
        <div style={{ fontSize: 11, color: isMe ? "#dceeff" : "#6b7280", marginTop: 6 }}>{new Date(msg.at || msg.createdAt || Date.now()).toLocaleString()}</div>
      </div>
      {isMe && <Avatar name={name} size={36} />}
    </div>
  );
}

/* ---------------- styles ---------------- */
const embeddedCSS = `
:root { --bg: #f6f8fb; --card: #fff; --muted: #6b7280; --accent: #0b6fff; }
body { margin:0; background: var(--bg); font-family: Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial; color: #111827; }
.link { background: transparent; border: none; color: var(--muted); padding: 8px 10px; cursor: pointer; font-weight: 600; }
.btn-primary { background: linear-gradient(90deg, #0b6fff, #7ad0ff); color: white; border: none; padding: 8px 12px; border-radius: 10px; cursor: pointer; box-shadow: 0 6px 18px rgba(11,103,255,0.12); }
.btn-ghost { background: transparent; border: 1px solid #e6eef8; color: var(--accent); padding: 8px 12px; border-radius: 10px; cursor: pointer; margin-left: 5px; }
.btn-success { background: #00b894; color: white; border: none; padding: 8px 12px; border-radius: 10px; cursor: pointer; }
.input { padding: 10px 12px; border-radius: 10px; border: 1px solid #e6eef8; outline: none; width: 100%; box-sizing: border-box; background: #fff; width: 300px; }
.thread { padding: 8px; border-radius: 8px; transition: background .15s; }
.thread:hover { background: #f8fbff; }
.badge { background: #e6f7ff; color: #0b6fff; padding: 4px 8px; border-radius: 999px; font-size: 12px; margin-left: 8px; }
.small { background: transparent; border: 1px solid #e6eef8; color: #6b7280; padding: 6px 8px; border-radius: 8px; cursor: pointer; }

/* layout & cards */
.authCard { width: 420px; max-width: calc(100% - 40px); background: #fff; padding: 18px; border-radius: 12px; box-shadow: 0 10px 36px rgba(15,23,42,0.06); display: flex; flex-direction: column; }
.card { background: #fff; padding: 18px; border-radius: 12px; box-shadow: 0 10px 30px rgba(10,20,40,0.04); margin-bottom: 16px; }
.campaignGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 12px; }
.campaignCard { background: #fff; padding: 14px; border-radius: 12px; border: 1px solid #f1f5fb; min-height: 160px; display: flex; flex-direction: column; justify-content: space-between; }

/* hero */
.heroPreview { width: 340px; background: linear-gradient(180deg,#fff,#fbfdff); padding: 18px; border-radius: 12px; box-shadow: 0 12px 36px rgba(10,20,40,0.06); }

/* centers */
.center { display: flex; justify-content: center; padding: 40px 18px; }

/* modal */
.modal-backdrop { position: fixed; inset: 0; background: rgba(10,20,40,0.5); display:flex; align-items:center; justify-content:center; z-index: 3000; }
.modal-container { background: #fff; width: 720px; max-width: calc(100% - 40px); padding: 18px; border-radius: 12px; box-shadow: 0 20px 60px rgba(15,23,42,0.4); }

/* small screens */
@media (max-width: 900px) {
  .authCard { width: 100%; padding: 12px; }
  .campaignCard { min-height: 140px; }
}
`;

// page style objects (JS)
const page = {
  app: { minHeight: "100vh", display: "flex", flexDirection: "column" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "14px 28px", borderBottom: "1px solid rgba(15,23,42,0.06)", background: "#fff", gap: 24 },
  logo: { width: 46, height: 46, borderRadius: 12, background: "linear-gradient(135deg,#0b6fff,#7ad0ff)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 900 },
  main: { maxWidth: 1200, margin: "24px auto", padding: "0 18px", flex: 1 },
  hero: { display: "flex", justifyContent: "space-between", gap: 24, alignItems: "center", marginBottom: 20 },
  heroPreview: { width: 340, background: "#fff", padding: 18, borderRadius: 12, boxShadow: "0 10px 30px rgba(10,20,40,0.06)" },
  center: { display: "flex", justifyContent: "center", paddingTop: 20 },
  card: { background: "#fff", padding: 18, borderRadius: 12, boxShadow: "0 10px 24px rgba(10,20,40,0.04)", marginBottom: 16 },
  authCard: { background: "#fff", padding: 18, borderRadius: 12, boxShadow: "0 10px 24px rgba(10,20,40,0.04)" },
  itemCard: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", padding: 12, borderRadius: 10, border: "1px solid #f1f5fb", marginTop: 12 },
  campaignCard: { background: "#fff", padding: 14, borderRadius: 12, border: "1px solid #f1f5fb", minHeight: 160 },
  footer: { padding: 20, textAlign: "center", color: "#9aa0ad" },
  fullLoader: { position: "fixed", inset: 0, display: "flex", justifyContent: "center", alignItems: "center", background: "rgba(255,255,255,0.6)", zIndex: 2000, fontSize: 18 }
};

// small modal styles used inline
const modal = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(10,20,40,0.5)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000 },
  container: { background: "#fff", width: 720, maxWidth: "calc(100% - 40px)", padding: 18, borderRadius: 12, boxShadow: "0 20px 60px rgba(15,23,42,0.4)" }
};
