// =============================================================================
// src/validators/group.validator.js — Zod schemas for group operations
// =============================================================================

const { z } = require('zod');

const CreateGroupSchema = z.object({
  name: z
    .string({ required_error: 'Group name is required' })
    .trim()
    .min(2, 'Group name must be at least 2 characters')
    .max(100),
  members: z.array(z.number().int().positive()).min(1, 'Select at least one member to create a group'),
});

const AddMemberSchema = z.object({
  userId: z.number().int().positive('userId must be a positive integer'),
  joinedAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'joinedAt must be YYYY-MM-DD')
    .optional()
    .default(new Date().toISOString().split('T')[0]),
});

const UpdateMemberSchema = z.object({
  leftAt: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'leftAt must be YYYY-MM-DD'),
});

const RegisterUserSchema = z.object({
  name: z
    .string({ required_error: 'Name is required' })
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(50),
  email: z
    .string({ required_error: 'Email is required' })
    .email('Invalid email address'),
  password: z
    .string({ required_error: 'Password is required' })
    .min(6, 'Password must be at least 6 characters'),
});

const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

module.exports = {
  CreateGroupSchema,
  AddMemberSchema,
  UpdateMemberSchema,
  RegisterUserSchema,
  LoginSchema,
};
