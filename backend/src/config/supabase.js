import { createClient } from '@supabase/supabase-js';
import env from './env.js';

/**
 * Storage Bucket identifiers utilized by the platform.
 * 
 * @type {Readonly<{DOCUMENTS: string, PREVIEWS: string, AUDITS: string}>}
 */
export const STORAGE_BUCKETS = Object.freeze({
  DOCUMENTS: process.env.STORAGE_BUCKET_DOCUMENTS || 'mc-documents',
  SIGNATURES: process.env.STORAGE_BUCKET_SIGNATURES || 'mc-signatures',
  REPORTS: process.env.STORAGE_BUCKET_REPORTS || 'mc-reports',
  TEMPORARY: process.env.STORAGE_BUCKET_TEMPORARY || 'mc-temporary',
});

export const BUCKET_CONFIG = Object.freeze({
  [STORAGE_BUCKETS.DOCUMENTS]: {
    name: STORAGE_BUCKETS.DOCUMENTS,
    allowedExtensions: ['pdf', 'docx', 'xlsx', 'pptx', 'jpg', 'png', 'zip'],
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'application/zip',
    ],
    maxSize: 50 * 1024 * 1024, // 50MB
    accessRules: 'private',
    expirySettings: null, // Permanent documents
  },
  [STORAGE_BUCKETS.SIGNATURES]: {
    name: STORAGE_BUCKETS.SIGNATURES,
    allowedExtensions: ['png', 'jpg', 'jpeg', 'pdf'],
    allowedMimeTypes: ['image/png', 'image/jpeg', 'application/pdf'],
    maxSize: 5 * 1024 * 1024, // 5MB
    accessRules: 'private',
    expirySettings: null,
  },
  [STORAGE_BUCKETS.REPORTS]: {
    name: STORAGE_BUCKETS.REPORTS,
    allowedExtensions: ['pdf', 'xlsx', 'csv'],
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ],
    maxSize: 20 * 1024 * 1024, // 20MB
    accessRules: 'private',
    expirySettings: {
      expireInDays: 30,
    },
  },
  [STORAGE_BUCKETS.TEMPORARY]: {
    name: STORAGE_BUCKETS.TEMPORARY,
    allowedExtensions: ['pdf', 'docx', 'xlsx', 'pptx', 'jpg', 'png', 'zip'],
    allowedMimeTypes: [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'image/jpeg',
      'image/png',
      'application/zip',
    ],
    maxSize: 100 * 1024 * 1024, // 100MB
    accessRules: 'private',
    expirySettings: {
      expireInSeconds: 3600 * 24, // 24 hours
    },
  },
});

let supabaseAnonInstance = null;
let supabaseAdminInstance = null;

/**
 * Retrieves the standard Anon Supabase Client singleton.
 * Configured with the public anon key. Safe for client-facing identity checks.
 * 
 * @function getSupabaseAnonClient
 * @returns {import('@supabase/supabase-js').SupabaseClient} Anon Supabase Client
 */
export function getSupabaseAnonClient() {
  if (!supabaseAnonInstance) {
    supabaseAnonInstance = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAnonInstance;
}

/**
 * Retrieves the privileged Admin Supabase Client singleton.
 * Configured with the service role key. Bypass RLS (Row Level Security) rules.
 * STRICTLY owned by the backend; must never be leaked to clients.
 * Used for admin operations such as document deletes, lock overrides, and signed url generation.
 * 
 * @function getSupabaseAdminClient
 * @returns {import('@supabase/supabase-js').SupabaseClient} Service Role Admin Supabase Client
 */
export function getSupabaseAdminClient() {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  }
  return supabaseAdminInstance;
}

export const supabaseAnon = getSupabaseAnonClient();
export const supabaseAdmin = getSupabaseAdminClient();

export default {
  supabaseAnon,
  supabaseAdmin,
  STORAGE_BUCKETS,
  BUCKET_CONFIG,
};
