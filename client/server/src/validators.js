import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().email('Invalid email address.');
export const phoneSchema = z.string().trim().regex(/^[+]?[(]?[0-9][0-9\s().-]{6,19}$/, 'Invalid phone number.').optional().or(z.literal(''));
export const passwordSchema = z.string()
  .min(6, 'Password must be at least 6 characters.')
  .regex(/[0-9]/, 'Password must include at least one number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include at least one special character.');
