import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import path from 'path';
import { fileURLToPath } from 'url';
import { AccessRequest, AuditLog, User } from './models.js';
import { auth, roles } from './middleware.js';

const app = express();
app.use(cors({ origin: process.env.CLIENT_URL?.split(',') || '*' }));
app.use(express.json());
app.use(morgan('dev'));
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.resolve(__dirname, '../../client/dist')));
  app.get('*', (req, res, next) => req.path.startsWith('/api') ? next() : res.sendFile(path.resolve(__dirname, '../../client/dist/index.html')));
}

const log = (action, request, actor, details = '') => AuditLog.create({ action, request, actor, details });
const tokenFor = user => jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '8h' });

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'security-access-api' }));

app.post('/api/auth/register', async (req, res) => {
  try {
    const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const department = typeof req.body.department === 'string' ? req.body.department.trim() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!name || !email || !department || password.length < 8) return res.status(400).json({ message: 'Enter your name, work email, department, and a password of at least 8 characters' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists' });
    const user = await User.create({ name, email, department, password: await bcrypt.hash(password, 10), role: 'Employee' });
    const safeUser = user.toObject(); delete safeUser.password;
    res.status(201).json({ token: tokenFor(user), user: safeUser });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const email = typeof req.body.email === 'string' ? req.body.email.trim().toLowerCase() : '';
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = await User.findOne({ email }).select('+password');
    if (!user || !user.active || !password || !(await bcrypt.compare(password, user.password))) return res.status(401).json({ message: 'Invalid email or password' });
    const safeUser = user.toObject(); delete safeUser.password;
    res.json({ token: tokenFor(user), user: safeUser });
  } catch (error) { res.status(500).json({ message: error.message }); }
});

app.get('/api/auth/me', auth, (req, res) => res.json(req.user));

app.get('/api/users', auth, async (req, res) => {
  const users = req.user.role === 'Admin'
    ? await User.find().select('-password').sort('name')
    : [req.user];
  res.json(users);
});

app.get('/api/requests', auth, async (req, res) => {
  const filter = req.user.role === 'Employee' ? { requester: req.user._id } : {};
  const requests = await AccessRequest.find(filter).populate('requester', 'name email department').sort('-createdAt');
  res.json(requests);
});

app.post('/api/requests', auth, roles('Employee'), async (req, res) => {
  const { resource, resourceType, accessLevel, reason, startDate, endDate } = req.body;
  if (!resource || !resourceType || !accessLevel || !reason || !startDate) return res.status(400).json({ message: 'Complete all required fields' });
  if (endDate && new Date(endDate) < new Date(startDate)) return res.status(400).json({ message: 'End date cannot precede start date' });
  const request = await AccessRequest.create({ requester: req.user._id, resource, resourceType, accessLevel, reason, startDate, endDate });
  await log('REQUEST_SUBMITTED', request._id, req.user._id, `${resource} (${accessLevel})`);
  res.status(201).json(await request.populate('requester', 'name email department'));
});

app.patch('/api/requests/:id/decision', auth, roles('Department Manager', 'IT Security Officer'), async (req, res) => {
  const request = await AccessRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  const { decision, comment = '' } = req.body;
  if (!['Approved', 'Rejected'].includes(decision)) return res.status(400).json({ message: 'Decision must be Approved or Rejected' });
  const isManager = req.user.role === 'Department Manager';
  if (isManager && request.status !== 'Pending Manager') return res.status(400).json({ message: 'This request is not awaiting manager approval' });
  if (!isManager && request.status !== 'Pending Security') return res.status(400).json({ message: 'This request is not awaiting security approval' });
  const field = isManager ? 'managerDecision' : 'securityDecision';
  request[field] = { decision, comment, decidedBy: req.user._id, decidedAt: new Date() };
  request.status = decision === 'Rejected' ? 'Rejected' : (isManager ? 'Pending Security' : 'Approved');
  await request.save(); await log(isManager ? 'MANAGER_DECISION' : 'SECURITY_DECISION', request._id, req.user._id, `${decision}: ${comment}`);
  res.json(await request.populate('requester', 'name email department'));
});

app.patch('/api/requests/:id/revoke', auth, roles('Admin', 'IT Security Officer'), async (req, res) => {
  const request = await AccessRequest.findById(req.params.id);
  if (!request) return res.status(404).json({ message: 'Request not found' });
  if (request.status !== 'Approved') return res.status(400).json({ message: 'Only approved access can be revoked' });
  request.status = 'Revoked'; await request.save(); await log('ACCESS_REVOKED', request._id, req.user._id, req.body.reason || 'Revoked by security policy');
  res.json(request);
});

app.get('/api/audit', auth, async (req, res) => {
  const filter = req.user.role === 'Admin' || req.user.role === 'IT Security Officer'
    ? {}
    : { actor: req.user._id };
  res.json(await AuditLog.find(filter).populate('actor', 'name role').populate({ path: 'request', select: 'resource status requester', populate: { path: 'requester', select: 'name email department' } }).sort('-timestamp').limit(200));
});

app.get('/api/reports/summary', auth, async (req, res) => {
  const [byStatus, byType, total] = await Promise.all([
    AccessRequest.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    AccessRequest.aggregate([{ $group: { _id: '$resourceType', count: { $sum: 1 } } }]),
    AccessRequest.countDocuments()
  ]);
  res.json({ total, byStatus, byType, pendingApprovals: await AccessRequest.countDocuments({ status: { $in: ['Pending Manager', 'Pending Security'] } }) });
});

app.get('/api/reviews', auth, async (req, res) => {
  const reviews = await AccessRequest.find({ status: 'Approved' }).populate('requester', 'name email department').sort('endDate');
  res.json(reviews);
});

const port = process.env.PORT || 5000;
mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/security_access')
  .then(() => app.listen(port, () => console.log(`API running on port ${port}`)))
  .catch(error => { console.error('MongoDB connection failed:', error.message); process.exit(1); });
