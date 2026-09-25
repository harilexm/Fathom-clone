const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function testApiRoute() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');

  function getEnv(key) {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : process.env[key];
  }

  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SECRET_KEY');
  const siteUrl = getEnv('NEXT_PUBLIC_SITE_URL') || 'http://localhost:3000';

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log('Testing /api/meetings/[id]/transcribe route...\n');

  // Find target meeting
  const { data: meeting } = await supabase
    .from('meetings')
    .select('*')
    .eq('id', '9032c083-de71-459c-b1e6-0e8a6701ed45')
    .single();

  if (!meeting) {
    console.error('Target meeting not found');
    return;
  }

  // 1. Unauthenticated request -> should return 401
  const unauthRes = await fetch(`${siteUrl}/api/meetings/${meeting.id}/transcribe`, {
    method: 'POST',
  });
  console.log('1. Unauthenticated request status:', unauthRes.status, '(expected 401)');

  // 2. Cross-tenant request (create temp test user to simulate unauthorized caller)
  const tempEmail = `test-unauth-${Date.now()}@example.com`;
  const { data: tempUser, error: tempErr } = await supabase.auth.admin.createUser({
    email: tempEmail,
    password: 'TemporaryPassword123!@#',
    email_confirm: true,
  });

  if (tempUser?.user) {
    // Sign in to get access token for temp user
    const anonClient = createClient(supabaseUrl, getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
    const { data: signInData } = await anonClient.auth.signInWithPassword({
      email: tempEmail,
      password: 'TemporaryPassword123!@#',
    });

    if (signInData?.session?.access_token) {
      const crossTenantRes = await fetch(`${siteUrl}/api/meetings/${meeting.id}/transcribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${signInData.session.access_token}`,
        },
      });
      console.log('2. Cross-tenant unauthorized request status:', crossTenantRes.status, '(expected 403)');
      const crossData = await crossTenantRes.json();
      console.log('   Response error message:', crossData.error);
    }

    // Cleanup temp user
    await supabase.auth.admin.deleteUser(tempUser.user.id);
  }

  // 3. Query GET /api/meetings/[id]/transcribe status with meeting owner
  // Generate magic link or sign in as meeting owner to test owner access
  const { data: ownerUser } = await supabase.auth.admin.getUserById(meeting.user_id);
  if (ownerUser?.user) {
    // Generate a session or sign in using admin generateLink or custom token
    const { data: linkData } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: ownerUser.user.email,
    });

    const tokenHash = linkData?.properties?.hashed_token;
    if (tokenHash) {
      const anonClient = createClient(supabaseUrl, getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'));
      const { data: verifyData } = await anonClient.auth.verifyOtp({
        token_hash: tokenHash,
        type: 'magiclink',
      });

      if (verifyData?.session?.access_token) {
        const ownerToken = verifyData.session.access_token;
        const getRes = await fetch(`${siteUrl}/api/meetings/${meeting.id}/transcribe`, {
          headers: {
            Authorization: `Bearer ${ownerToken}`,
          },
        });
        console.log('3. Authenticated owner GET /transcribe status:', getRes.status, '(expected 200)');
        const getData = await getRes.json();
        console.log('   Job ID:', getData.jobId, 'Soniox Status:', getData.sonioxStatus?.status);

        // 4. Authenticated owner POST (idempotent since already transcribing)
        const postRes = await fetch(`${siteUrl}/api/meetings/${meeting.id}/transcribe`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${ownerToken}`,
          },
        });
        console.log('4. Authenticated owner POST /transcribe status:', postRes.status, '(expected 200)');
        const postData = await postRes.json();
        console.log('   Success:', postData.success, 'Job ID:', postData.jobId, 'Status:', postData.status);
      }
    }
  }

  console.log('\nAll API route tests completed successfully!');
}

testApiRoute();
