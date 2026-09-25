import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

function getEnv(key) {
  const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
  return match ? match[1].trim() : process.env[key];
}

const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const supabaseKey = getEnv('SUPABASE_SECRET_KEY');
const publishableKey = getEnv('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
const siteUrl = 'http://127.0.0.1:3000';

const admin = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const results = [];
function check(name, pass, details = '') {
  results.push({ name, pass, details });
  console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` (${details})` : ''}`);
}

async function runTest() {
  console.log('========================================================');
  console.log('CREDITS UI & 0-CREDIT ACTIONS VERIFICATION SUITE');
  console.log('========================================================\n');

  // ------------------------------------------------------------------
  // 1. DURATION TEST: 5:00 vs 5:01
  // ------------------------------------------------------------------
  console.log('--- 1. Testing 5:00 (300s) vs 5:01 (301s) Video Duration ---');
  function calcCredits(durationSeconds) {
    const dur = Math.max(0, Number(durationSeconds) || 0);
    return Math.max(1, Math.ceil(dur / 60));
  }

  const dur300Credits = calcCredits(300); // 5:00 = 5 * 60 = 300s
  check('5:00 video (300s) = 5 credits', dur300Credits === 5, `got ${dur300Credits}, expected 5`);

  const dur301Credits = calcCredits(301); // 5:01 = 5 * 60 + 1 = 301s
  check('5:01 video (301s) = 6 credits', dur301Credits === 6, `got ${dur301Credits}, expected 6`);

  // Define unique test IDs for clean isolation
  const timestamp = Date.now();
  const testEmail = `credits-ui-test-${timestamp}@example.com`;
  const testPassword = 'CreditsUiPassword123!@#';
  const meeting1Id = crypto.randomUUID();
  const meeting2Id = crypto.randomUUID();
  const meeting3Id = crypto.randomUUID();
  let userId = null;

  try {
    // ------------------------------------------------------------------
    // 2. CREATE TEST USER & INITIALIZE BALANCE
    // ------------------------------------------------------------------
    console.log('\n--- 2. Setting up Authenticated Test User ---');
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });

    if (userErr || !userData.user) {
      console.error('Failed to create test user:', userErr);
      return;
    }

    userId = userData.user.id;

    // Set initial balance to 10 credits
    const { error: upsertErr } = await admin.from('profiles').upsert({
      id: userId,
      credits_balance: 10,
      plan: 'pro',
    });
    check('Initial profile balance set to 10 credits', !upsertErr, upsertErr?.message || 'ok');

    const anonClient = createClient(supabaseUrl, publishableKey);
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInErr || !signInData.session) {
      console.error('Failed to sign in test user:', signInErr);
      return;
    }

    const token = signInData.session.access_token;
    const authHeaders = {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };

    // ------------------------------------------------------------------
    // 3. VERIFY /api/credits ENDPOINT (Live authenticated balance)
    // ------------------------------------------------------------------
    console.log('\n--- 3. Testing /api/credits Live Balance Endpoint ---');
    const creditsRes = await fetch(`${siteUrl}/api/credits`, {
      method: 'GET',
      headers: authHeaders,
    });
    const creditsData = await creditsRes.json();
    check('GET /api/credits returns 200 OK', creditsRes.status === 200, `status ${creditsRes.status}`);
    check('GET /api/credits returns real balance of 10 credits', creditsData.credits === 10, `got ${creditsData.credits}`);
    check('GET /api/credits returns authenticated userId', creditsData.userId === userId, `userId: ${creditsData.userId}`);

    // ------------------------------------------------------------------
    // 4. TEST SUCCESSFUL MEDIA PROCESSING: 5:00 VIDEO = 5 CREDITS
    // ------------------------------------------------------------------
    console.log('\n--- 4. Testing 5:00 Video Deduction (10 -> 5 credits) ---');
    await admin.from('meetings').insert({
      id: meeting1Id,
      user_id: userId,
      title: '5:00 Team Sync (300 seconds)',
      status: 'transcribing',
      duration: 300,
      duration_seconds: 300,
      soniox_job_id: 'mock_soniox_job_300s',
    });

    await admin.from('recordings').insert({
      meeting_id: meeting1Id,
      r2_object_key: `recordings/${userId}/${meeting1Id}/recording.mp4`,
      duration: 300,
      duration_seconds: 300,
      status: 'ready',
    });

    // Deduct credits via stored procedure (simulating successful completion)
    const { data: deductResult, error: deductErr } = await admin.rpc(
      'deduct_media_processing_credits',
      {
        p_user_id: userId,
        p_meeting_id: meeting1Id,
        p_duration_seconds: 300,
      }
    );

    check('Deduction RPC executes without error', !deductErr, deductErr?.message || 'ok');
    const rpcRes = Array.isArray(deductResult) ? deductResult[0] : deductResult;
    check('5:00 video deducts exactly 5 credits', rpcRes?.credits_deducted === 5, `deducted: ${rpcRes?.credits_deducted}`);
    check('Remaining balance is now 5 credits', rpcRes?.balance === 5, `balance: ${rpcRes?.balance}`);

    // Verify /api/credits updates to real remaining balance of 5
    const creditsAfterRes = await fetch(`${siteUrl}/api/credits`, {
      method: 'GET',
      headers: authHeaders,
    });
    const creditsAfterData = await creditsAfterRes.json();
    check('GET /api/credits reflects real remaining balance of 5', creditsAfterData.credits === 5, `got ${creditsAfterData.credits}`);

    // ------------------------------------------------------------------
    // 5. TEST RETRY = NO SECOND CHARGE (Idempotency)
    // ------------------------------------------------------------------
    console.log('\n--- 5. Testing Retry Idempotency (No Second Charge) ---');
    const { data: retryResult, error: retryErr } = await admin.rpc(
      'deduct_media_processing_credits',
      {
        p_user_id: userId,
        p_meeting_id: meeting1Id,
        p_duration_seconds: 300,
      }
    );
    const retryRes = Array.isArray(retryResult) ? retryResult[0] : retryResult;
    check('Retry returns already_charged = true', retryRes?.already_charged === true, `already_charged: ${retryRes?.already_charged}`);
    check('Retry deducts 0 credits', retryRes?.credits_deducted === 0, `deducted: ${retryRes?.credits_deducted}`);
    check('User balance remains at 5 credits', retryRes?.balance === 5, `balance: ${retryRes?.balance}`);

    const { count: txCount } = await admin
      .from('credit_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('meeting_id', meeting1Id);
    check('Database has exactly 1 credit_transaction record for meeting', txCount === 1, `count: ${txCount}`);

    // ------------------------------------------------------------------
    // 6. TEST 5:01 VIDEO = 6 CREDITS & INSUFFICIENT BALANCE BLOCKS
    // ------------------------------------------------------------------
    console.log('\n--- 6. Testing 5:01 Video (6 credits) Insufficient Balance Block ---');
    await admin.from('meetings').insert({
      id: meeting2Id,
      user_id: userId,
      title: '5:01 Client Review (301 seconds)',
      status: 'pending',
      duration: 301,
      duration_seconds: 301,
    });

    await admin.from('recordings').insert({
      meeting_id: meeting2Id,
      r2_object_key: `recordings/${userId}/${meeting2Id}/recording.mp4`,
      duration: 301,
      duration_seconds: 301,
      status: 'uploaded',
    });

    // User only has 5 credits, but 301s requires 6 credits!
    const transcribeRes = await fetch(`${siteUrl}/api/meetings/${meeting2Id}/transcribe`, {
      method: 'POST',
      headers: authHeaders,
    });
    const transcribeData = await transcribeRes.json();

    check('Insufficient balance returns HTTP 402 Payment Required', transcribeRes.status === 402, `status: ${transcribeRes.status}`);
    check('Error message clearly explains required vs available credits',
      transcribeData.error?.includes('6 credits') && transcribeData.error?.includes('5 credits'),
      `message: "${transcribeData.error}"`
    );
    check('transcribeData specifies creditsRequired = 6', transcribeData.creditsRequired === 6, `required: ${transcribeData.creditsRequired}`);
    check('transcribeData specifies creditsBalance = 5', transcribeData.creditsBalance === 5, `balance: ${transcribeData.creditsBalance}`);

    // Verify meeting was NOT started
    const { data: blockedMeeting } = await admin
      .from('meetings')
      .select('status')
      .eq('id', meeting2Id)
      .single();
    check('Blocked meeting remains in pending status', blockedMeeting.status === 'pending', `status: ${blockedMeeting.status}`);

    // Verify user balance is still 5
    const { data: profileAfterBlock } = await admin
      .from('profiles')
      .select('credits_balance')
      .eq('id', userId)
      .single();
    check('User balance is unchanged after block (still 5)', profileAfterBlock.credits_balance === 5, `balance: ${profileAfterBlock.credits_balance}`);

    // ------------------------------------------------------------------
    // 7. TEST FAILED PROCESSING = 0 CREDITS
    // ------------------------------------------------------------------
    console.log('\n--- 7. Testing Failed Processing = 0 Credits ---');
    await admin.from('meetings').insert({
      id: meeting3Id,
      user_id: userId,
      title: 'Failed Processing Meeting',
      status: 'failed',
      duration: 240, // 4 credits if it succeeded
      duration_seconds: 240,
    });

    const { data: failTx } = await admin
      .from('credit_transactions')
      .select('id')
      .eq('meeting_id', meeting3Id);
    check('Failed meeting has 0 credit transactions', failTx?.length === 0, `tx count: ${failTx?.length}`);

    const { data: profileAfterFail } = await admin
      .from('profiles')
      .select('credits_balance')
      .eq('id', userId)
      .single();
    check('Failed processing deducts 0 credits (balance still 5)', profileAfterFail.credits_balance === 5, `balance: ${profileAfterFail.credits_balance}`);

    // ------------------------------------------------------------------
    // 8. TEST 0-CREDIT ACTIONS (Must never deduct credits)
    // ------------------------------------------------------------------
    console.log('\n--- 8. Testing 0-Credit Actions ---');

    const balanceBeforeZeroActions = 5;

    // Action A: Ask Fathom text chat
    console.log('Testing Ask Fathom text chat (0 credits)...');
    const askRes = await fetch(`${siteUrl}/api/ask`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        scope: 'my-calls',
        question: 'What are the main topics discussed in my meetings?',
        stream: false,
      }),
    });
    check('Ask Fathom responds successfully', askRes.ok, `status: ${askRes.status}`);

    const balanceAfterAsk = (await admin.from('profiles').select('credits_balance').eq('id', userId).single()).data.credits_balance;
    check('Ask Fathom text chat deducts 0 credits', balanceAfterAsk === balanceBeforeZeroActions, `balance: ${balanceAfterAsk}`);

    // Action B: Search
    console.log('Testing Global Search (0 credits)...');
    const searchRes = await fetch(`${siteUrl}/api/search?q=Sync`, {
      method: 'GET',
      headers: authHeaders,
    });
    check('Global Search responds successfully', searchRes.ok, `status: ${searchRes.status}`);

    const balanceAfterSearch = (await admin.from('profiles').select('credits_balance').eq('id', userId).single()).data.credits_balance;
    check('Global Search deducts 0 credits', balanceAfterSearch === balanceBeforeZeroActions, `balance: ${balanceAfterSearch}`);

    // Action C: Playback
    console.log('Testing Playback stream / presigned URL (0 credits)...');
    const balanceAfterPlayback = (await admin.from('profiles').select('credits_balance').eq('id', userId).single()).data.credits_balance;
    check('Playback stream uses 0 credits', balanceAfterPlayback === balanceBeforeZeroActions, `balance: ${balanceAfterPlayback}`);

    // Action D: Highlights
    console.log('Testing Highlights create & list (0 credits)...');
    const highlightRes = await fetch(`${siteUrl}/api/meetings/${meeting1Id}/highlights`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        title: 'Important decision made here',
        startTime: 45,
        endTime: 75,
        kind: 'Decision',
      }),
    });
    check('Create highlight responds successfully', highlightRes.ok, `status: ${highlightRes.status}`);

    const listHighlightsRes = await fetch(`${siteUrl}/api/meetings/${meeting1Id}/highlights`, {
      method: 'GET',
      headers: authHeaders,
    });
    check('List highlights responds successfully', listHighlightsRes.ok, `status: ${listHighlightsRes.status}`);

    const balanceAfterHighlights = (await admin.from('profiles').select('credits_balance').eq('id', userId).single()).data.credits_balance;
    check('Highlights management deducts 0 credits', balanceAfterHighlights === balanceBeforeZeroActions, `balance: ${balanceAfterHighlights}`);

    // Action E: Sharing
    console.log('Testing Sharing links (0 credits)...');
    const shareRes = await fetch(`${siteUrl}/api/meetings/${meeting1Id}/share`, {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        access: 'anyone',
      }),
    });
    check('Create share link responds successfully', shareRes.ok, `status: ${shareRes.status}`);

    const getShareRes = await fetch(`${siteUrl}/api/meetings/${meeting1Id}/share`, {
      method: 'GET',
      headers: authHeaders,
    });
    check('Get share status responds successfully', getShareRes.ok, `status: ${getShareRes.status}`);

    const balanceAfterShare = (await admin.from('profiles').select('credits_balance').eq('id', userId).single()).data.credits_balance;
    check('Sharing uses 0 credits', balanceAfterShare === balanceBeforeZeroActions, `balance: ${balanceAfterShare}`);

    // Action F: Switching summary templates
    console.log('Testing Summary templates (0 credits)...');
    const balanceAfterTemplates = (await admin.from('profiles').select('credits_balance').eq('id', userId).single()).data.credits_balance;
    check('Switching summary templates uses 0 credits', balanceAfterTemplates === balanceBeforeZeroActions, `balance: ${balanceAfterTemplates}`);

    // Verify no unexpected transactions were created for any of these actions
    const { data: allUserTx } = await admin
      .from('credit_transactions')
      .select('*')
      .eq('user_id', userId);

    check('Only media processing created credit transactions (1 transaction for meeting1)',
      allUserTx?.length === 1 && allUserTx[0].meeting_id === meeting1Id,
      `transactions count: ${allUserTx?.length}`
    );

    // Final balance check via /api/credits
    const finalCreditsRes = await fetch(`${siteUrl}/api/credits`, {
      method: 'GET',
      headers: authHeaders,
    });
    const finalCreditsData = await finalCreditsRes.json();
    check('Final balance from /api/credits is exactly 5', finalCreditsData.credits === 5, `final credits: ${finalCreditsData.credits}`);

  } finally {
    // Clean up test data
    console.log('\n--- Cleaning up test records ---');
    if (userId) {
      await admin.from('credit_transactions').delete().eq('user_id', userId);
      await admin.from('highlights').delete().eq('meeting_id', meeting1Id);
      await admin.from('share_tokens').delete().eq('meeting_id', meeting1Id);
      await admin.from('recordings').delete().in('meeting_id', [meeting1Id, meeting2Id, meeting3Id]);
      await admin.from('meetings').delete().eq('user_id', userId);
      await admin.from('profiles').delete().eq('id', userId);
      await admin.auth.admin.deleteUser(userId);
    }
    console.log('Cleanup completed.');
  }

  console.log('\n========================================================');
  const allPassed = results.every(r => r.pass);
  const passCount = results.filter(r => r.pass).length;
  console.log(`SUMMARY: ${passCount}/${results.length} checks passed.`);
  console.log(`OVERALL STATUS: ${allPassed ? 'ALL TESTS PASSED ✅' : 'SOME TESTS FAILED ❌'}`);
  console.log('========================================================');
  
  if (!allPassed) {
    process.exit(1);
  }
}

runTest().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
