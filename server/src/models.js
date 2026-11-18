import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, select: false },
  role: { type: String, enum: ['Admin', 'Employee', 'Department Manager', 'IT Security Officer'], required: true },
  department: { type: String, required: true },
  active: { type: Boolean, default: true }
}, { timestamps: true });

const accessRequestSchema = new mongoose.Schema({
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  resource: { type: String, required: true, trim: true },
  resourceType: { type: String, enum: ['Application', 'System', 'Database', 'File Share', 'Other'], required: true },
  accessLevel: { type: String, enum: ['Read', 'Write', 'Admin'], required: true },
  reason: { type: String, required: true, trim: true },
  startDate: { type: Date, required: true },
  endDate: { type: Date },
  status: { type: String, enum: ['Pending Manager', 'Pending Security', 'Approved', 'Rejected', 'Revoked'], default: 'Pending Manager' },
  managerDecision: { decision: String, comment: String, decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, decidedAt: Date },
  securityDecision: { decision: String, comment: String, decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }, decidedAt: Date }
}, { timestamps: true });

const auditSchema = new mongoose.Schema({
  action: { type: String, required: true },
  request: { type: mongoose.Schema.Types.ObjectId, ref: 'AccessRequest' },
  actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  details: String,
  timestamp: { type: Date, default: Date.now }
});

export const User = mongoose.model('User', userSchema);
export const AccessRequest = mongoose.model('AccessRequest', accessRequestSchema);
export const AuditLog = mongoose.model('AuditLog', auditSchema);
