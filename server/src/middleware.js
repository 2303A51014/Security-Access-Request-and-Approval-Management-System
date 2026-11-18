import jwt from 'jsonwebtoken';
import { User } from './models.js';

export async function auth(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ message: 'Authentication required' });
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = await User.findById(payload.id).select('-password');
    if (!req.user?.active) return res.status(401).json({ message: 'Account is inactive' });
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export function roles(...allowed) {
  return (req, res, next) => allowed.includes(req.user.role)
    ? next()
    : res.status(403).json({ message: 'You do not have permission for this action' });
}
