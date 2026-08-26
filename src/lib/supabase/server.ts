/**
 * Supabase server client.
 * Use in Server Components, Server Actions, and API routes.
 *
 * Reads the auth session from cookies — requires Next.js cookies() API.
 * Must be called inside a request context (not at module initialization).
 */

import { createServerClient } from '@supabase/ssr';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import type { Database } from '@/lib/database.types';

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: { name: string; value: string; options?: any }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookie setting is a no-op.
            // The middleware handles session refresh.
          }
        },
      },
    }
  );
}

/**
 * Supabase admin client with service role key.
 * Use ONLY for admin operations that require elevated privileges.
 *
 * WARNING: This bypasses Row Level Security (RLS).
 * Only use for operations that genuinely need admin access:
 * - User invitation
 * - User deletion
 * - Updating user metadata
 *
 * Always verify authorization in your action/route before using this client.
 */
export function createAdminClient() {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  }

  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );
}

export type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
