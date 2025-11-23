// server.js - Prototype backend (in-memory)
// npm i express cors jsonwebtoken
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { randomUUID } = require('crypto'); // built-in UUID

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'demo_secret_key';

// In-memory stores
const users = [];        // { id, name, email, password, role: 'brand'|'creator', profile, verified, firstPaidCollabDone }
const messages = [];     // { id, from, to, text, at }
const campaigns = [];    // { id, brandId, title, niche, budget, description, createdAt, status }
const collaborations = []; // { id, campaignId, brandId, creatorId, amount, status }

// Helpers
function createToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
}
function requireAuth(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).send({ error: 'No token' });
  const token = auth.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const u = users.find(x => x.id === payload.id);
    if (!u) return res.status(401).send({ error: 'Invalid token' });
    req.user = u;
    next();
  } catch (e) {
    return res.status(401).send({ error: 'Invalid token' });
  }
}

// Seed some demo users & campaign
function seed() {
  users.length = 0;
  messages.length = 0;
  campaigns.length = 0;
  collaborations.length = 0;

  const c1 = { id: randomUUID(), name: 'Riya Sharma', email:'riya@demo.com', password:'pass123', role:'creator',
    verified:true, firstPaidCollabDone:false,
    profile:{ niche:'Fashion', platform:'Instagram', followers:52000, engagement:3.4, ageDistribution:{'13-18':12,'19-24':55,'25-34':28,'35+':5}, location:'Delhi' }
  };
  const c2 = { id: randomUUID(), name: 'Tech with Mohan', email:'mohan@demo.com', password:'pass123', role:'creator',
    verified:true, firstPaidCollabDone:false,
    profile:{ niche:'Tech', platform:'YouTube', followers:120000, engagement:4.1, ageDistribution:{'13-18':6,'19-24':40,'25-34':45,'35+':9}, location:'Bengaluru' }
  };
  const c3 = { id: randomUUID(), name: 'Village Voice', email:'village@demo.com', password:'pass123', role:'creator',
    verified:false, firstPaidCollabDone:false,
    profile:{ niche:'Social Cause', platform:'Facebook', followers:8000, engagement:6.8, ageDistribution:{'13-18':20,'19-24':35,'25-34':30,'35+':15}, location:'Rural UP' }
  };
  const b1 = { id: randomUUID(), name: 'Acme Brand', email:'brand@demo.com', password:'pass123', role:'brand', verified:true, profile:{ company:'Acme' } };

  users.push(c1,c2,c3,b1);

  // one campaign (status open)
  const camp = { id: randomUUID(), brandId: b1.id, title: 'Tech Gadget Launch', niche: 'Tech', budget: 50000, description:'Need tech creators for 30s review', createdAt: new Date().toISOString(), status: 'open' };
  campaigns.push(camp);
}
seed();

// Routes

// Auth
app.post('/api/auth/register', (req,res)=>{
  const { name,email,password,role,profile } = req.body;
  if (!name || !email || !password || !role) return res.status(400).send({ error: 'Missing fields' });
  if (users.find(u => u.email === email)) return res.status(400).send({ error: 'Email exists' });
  const user = { id: randomUUID(), name, email, password, role, profile: profile || {}, verified:false, firstPaidCollabDone:false };
  users.push(user);
  const token = createToken(user);
  res.send({ token, user: { id: user.id, name: user.name, role: user.role, verified: user.verified, profile: user.profile } });
});

app.post('/api/auth/login', (req,res)=>{
  const { email,password } = req.body;
  const u = users.find(x => x.email === email && x.password === password);
  if (!u) return res.status(400).send({ error: 'Invalid credentials' });
  const token = createToken(u);
  res.send({ token, user: { id: u.id, name: u.name, role: u.role, verified: u.verified, profile: u.profile } });
});

// Get current user
app.get('/api/me', requireAuth, (req,res) => {
  const u = req.user;
  res.send({ id: u.id, name: u.name, role: u.role, verified: u.verified, profile: u.profile, firstPaidCollabDone: u.firstPaidCollabDone });
});

// List creators (public)
app.get('/api/creators', (req,res) => {
  const { niche, q, age } = req.query;
  let list = users.filter(u => u.role === 'creator');
  if (niche) list = list.filter(c => (c.profile?.niche||'').toLowerCase() === niche.toLowerCase());
  if (q) list = list.filter(c => (c.name + ' ' + (c.profile?.niche||'')).toLowerCase().includes(q.toLowerCase()));
  if (age) {
    list = list.filter(c => {
      const dist = c.profile?.ageDistribution || {};
      const top = Object.entries(dist).sort((a,b) => b[1]-a[1])[0];
      return top && top[0] === age;
    });
  }
  res.send(list.map(({ password, ...rest }) => rest));
});

// List brands (public)
app.get('/api/brands', (req,res) => {
  const list = users.filter(u => u.role === 'brand').map(({ password, ...rest }) => rest);
  res.send(list);
});

// Get single user (creator or brand)
app.get('/api/users/:id', (req,res)=>{
  const u = users.find(x => x.id === req.params.id);
  if (!u) return res.status(404).send({ error: 'Not found' });
  const { password, ...rest } = u;
  res.send(rest);
});

// Messages
app.post('/api/messages', requireAuth, (req,res) => {
  const { toId, text } = req.body;
  if (!toId || !text) return res.status(400).send({ error: 'Missing toId/text' });
  const to = users.find(x => x.id === toId);
  if (!to) return res.status(404).send({ error: 'Recipient not found' });
  const m = { id: randomUUID(), from: req.user.id, to: toId, text, at: new Date().toISOString() };
  messages.unshift(m);
  res.send(m);
});

app.get('/api/messages', requireAuth, (req,res) => {
  const my = messages.filter(m => m.from === req.user.id || m.to === req.user.id);
  res.send(my);
});

// Campaigns (brands create)
app.post('/api/campaigns', requireAuth, (req,res) => {
  if (req.user.role !== 'brand') return res.status(403).send({ error: 'Only brands can create campaigns' });
  const { title,niche,budget,description } = req.body;
  if (!title || !niche) return res.status(400).send({ error: 'Missing fields' });
  const c = { id: randomUUID(), brandId: req.user.id, title, niche, budget: budget||0, description: description||'', createdAt: new Date().toISOString(), status: 'open' };
  campaigns.unshift(c);
  res.send(c);
});
app.get('/api/campaigns', (req,res) => res.send(campaigns));

// Quick matches for a campaign (niche match)
app.get('/api/campaigns/:id/matches', (req,res) => {
  const camp = campaigns.find(c => c.id === req.params.id);
  if (!camp) return res.status(404).send({ error: 'Campaign not found' });
  const matched = users.filter(u => u.role === 'creator' && (u.profile?.niche || '').toLowerCase() === (camp.niche||'').toLowerCase());
  res.send(matched.map(({password,...rest})=>rest));
});

// Collaboration: brand offers
app.post('/api/collaborations', requireAuth, (req,res) => {
  if (req.user.role !== 'brand') return res.status(403).send({ error: 'Only brands' });
  const { campaignId, creatorId, amount } = req.body;
  const camp = campaignId ? campaigns.find(c => c.id === campaignId) : null;
  const creator = users.find(u => u.id === creatorId && u.role === 'creator');
  if (!creator) return res.status(404).send({ error: 'Creator not found' });
  const collab = { id: randomUUID(), campaignId: campaignId||null, brandId: req.user.id, creatorId, amount: amount||0, status: 'proposed', createdAt: new Date().toISOString() };
  collaborations.unshift(collab);
  res.send(collab);
});

// Creator accepts a collaboration
app.post('/api/collaborations/:id/accept', requireAuth, (req,res) => {
  const collab = collaborations.find(c => c.id === req.params.id);
  if (!collab) return res.status(404).send({ error: 'Not found' });
  if (collab.creatorId !== req.user.id) return res.status(403).send({ error: 'Only the proposed creator can accept' });
  collab.status = 'accepted';
  // Payment stub: mark as paid instantly for prototype and mark firstPaidCollabDone
  collab.status = 'paid';
  const creator = users.find(u => u.id === req.user.id);
  if (creator && !creator.firstPaidCollabDone) {
    creator.firstPaidCollabDone = true;
  }
  res.send(collab);
});

// List collaborations for current user
app.get('/api/collaborations', requireAuth, (req,res) => {
  const mine = collaborations.filter(c => c.brandId === req.user.id || c.creatorId === req.user.id);
  res.send(mine);
});

// ------------------ NEW: Close campaign route ------------------
// Only the brand that owns the campaign can close it (mark as requirements full)
app.post('/api/campaigns/:id/close', requireAuth, (req, res) => {
  if (req.user.role !== 'brand') return res.status(403).send({ error: 'Only brands' });
  const camp = campaigns.find(c => c.id === req.params.id && c.brandId === req.user.id);
  if (!camp) return res.status(404).send({ error: 'Campaign not found' });
  camp.status = 'closed';
  res.send({ ok: true, campaign: camp });
});

// Simple admin route to reset demo data
app.post('/api/seed', (req,res)=>{
  seed();
  res.send({ ok: true });
});

app.listen(PORT, ()=> console.log('Prototype backend listening on', PORT));
