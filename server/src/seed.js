import 'dotenv/config';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { User, AccessRequest, AuditLog } from './models.js';

await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/security_access');
await Promise.all([User.deleteMany({}), AccessRequest.deleteMany({}), AuditLog.deleteMany({})]);
const password = await bcrypt.hash('Password123!', 10);
const users = await User.insertMany([
  { name: 'Aarav Admin', email: 'admin@security.local', password, role: 'Admin', department: 'IT Governance' },
  { name: 'Sarayu Employee', email: 'employee@security.local', password, role: 'Employee', department: 'Engineering' },
  { name: 'Meera Manager', email: 'manager@security.local', password, role: 'Department Manager', department: 'Engineering' },
  { name: 'Vikram Security', email: 'security@security.local', password, role: 'IT Security Officer', department: 'Information Security' }
]);
const employee = users.find(u => u.role === 'Employee');
await AccessRequest.insertMany([
  { requester: employee._id, resource: 'GitHub Enterprise', resourceType: 'Application', accessLevel: 'Write', reason: 'Maintain the assigned project repository', startDate: new Date(), status: 'Pending Manager' },
  { requester: employee._id, resource: 'Production Analytics', resourceType: 'Database', accessLevel: 'Read', reason: 'Investigate performance metrics for the release', startDate: new Date(), status: 'Pending Security' },
  { requester: employee._id, resource: 'VPN Gateway', resourceType: 'System', accessLevel: 'Read', reason: 'Remote access for approved support rotation', startDate: new Date(), status: 'Approved' }
]);
console.log('Seed complete. Demo password: Password123!');
await mongoose.disconnect();
