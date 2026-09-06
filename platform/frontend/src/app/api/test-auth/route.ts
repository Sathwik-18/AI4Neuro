import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not available' }, { status: 404 });
  }

  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to get user',
      });
    }

    if (!user) {
      return NextResponse.json({
        status: 'unauthenticated',
        message: 'No user logged in',
      });
    }

    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('id, full_name, role, account_status')
      .eq('id', user.id)
      .single();

    if (profileError) {
      return NextResponse.json({
        status: 'error',
        message: 'Failed to get profile',
      });
    }

    return NextResponse.json({
      status: 'authenticated',
      user: {
        id: user.id,
        role: profile?.role,
      },
    });
  } catch (error: any) {
    return NextResponse.json(
      { status: 'error', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
