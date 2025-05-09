import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const error = requestUrl.searchParams.get('error');
  const redirectTo = requestUrl.searchParams.get('redirectTo') || '/dashboard';

  if (error) {
    return NextResponse.redirect(
      `${requestUrl.origin}/auth/signin?error=${error}`
    );
  }

  if (code) {
    const cookieStore = cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      return NextResponse.redirect(
        `${requestUrl.origin}/auth/signin?error=${error.message}`
      );
    }

    return NextResponse.redirect(`${requestUrl.origin}${redirectTo}`);
  }

  // Return the user to the homepage if something goes wrong
  return NextResponse.redirect(`${requestUrl.origin}/auth/signin?error=callback_failed`);
} 