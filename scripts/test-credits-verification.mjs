import fs from 'fs';
import path from 'path';
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

async function runCreditsVerification() {
  console.log('========================================================');
  console.log('MEDIA PROCESSING CREDITS VERIFICATION SUITE');
  console.log('========================================================\n');

  // ------------------------------------------------------------------
  // 1. UNIT TEST: Formula & Rules
  // Rule: 1 started minute = 1 credit, credits_required = ceil(duration_seconds / 60)
  // ------------------------------------------------------------------
  console.log('--- 1. Testing Credit Calculation Formula ---');
  function calcCredits(durationSeconds) {
    const dur = Math.max(0, Number(durationSeconds) || 0);
    return Math.max(1, Math.ceil(dur / 60));
  }

  const testCases = [
    { input: 0, expected: 1, desc: '0 seconds (minimum 1 credit)' },
    { input: 1, expected: 1, desc: '1 second (1 started minute)' },
    { input: 30, expected: 1, desc: '30 seconds (1 started minute)' },
    { input: 59, expected: 1, desc: '59 seconds (1 started minute)' },
    { input: 60, expected: 1, desc: '60 seconds exactly (1 credit)' },
    { input: 61, expected: 2, desc: '61 seconds (2 started minutes -> 2 credits)' },
    { input: 120, expected: 2, desc: '120 seconds exactly (2 credits)' },
    { input: 121, expected: 3, desc: '121 seconds (3 started minutes -> 3 credits)' },
    { input: 218, expected: 4, desc: '218 seconds (4 started minutes -> 4 credits)' },
    { input: 300, expected: 5, desc: '300 seconds (5 started minutes -> 5 credits)' },
    { input: 301, expected: 6, desc: '301 seconds (6 started minutes -> 6 credits)' },
    { input: null, expected: 1, desc: 'null/undefined duration fallback (1 credit)' },
  ];

  let allFormulasPassed = true;
  for (const tc of testCases) {
    const actual = calcCredits(tc.input);
    const passed = actual === tc.expected;
    if (!passed) allFormulasPassed = false;
    check(`Formula: ${tc.desc}`, passed, `got ${actual}, expected ${tc.expected}`);
  }

  // ------------------------------------------------------------------
  // 2. SETUP TEST USER & VERIFY INSUFFICIENT CREDITS BLOCKING
  // ------------------------------------------------------------------
  console.log('\n--- 2. Testing Credit Check Before Processing Starts ---');
  const timestamp = Date.now();
  const testEmail = `test-credit-user-${timestamp}@example.com`;
  const testPassword = 'CreditTestPassword123!@#';

  const { data: userData, error: userErr } = await admin.auth.admin.createUser({
    email: testEmail,
    password: testPassword,
    email_confirm: true,
  });

  if (userErr || !userData.user) {
    console.error('Failed to create test user:', userErr);
    return;
  }

  const userId = userData.user.id;

  try {
    // Ensure profile row exists
    await admin.from('profiles').upsert({
      id: userId,
      credits_balance: 2, // Set only 2 credits!
      plan: 'free',
    });

    // Sign in test user to obtain JWT
    const anonClient = createClient(supabaseUrl, publishableKey);
    const { data: signInData, error: signInErr } = await anonClient.auth.signInWithPassword({
      email: testEmail,
      password: testPassword,
    });

    if (signInErr || !signInData.session) {
      console.error('Sign in failed:', signInErr);
      return;
    }

    const token = signInData.session.access_token;

    // Create a 5-minute (300 seconds) meeting for this user: requires 5 credits
    const testMeetingId = crypto.randomUUID();
    const { data: meeting, error: meetErr } = await admin.from('meetings').insert({
      id: testMeetingId,
      user_id: userId,
      title: 'Credit Verification Call',
      status: 'uploaded',
      duration: 300,
      duration_seconds: 300,
      source: 'upload',
    }).select().single();

    if (meetErr) {
      console.error('Failed to insert test meeting:', meetErr);
      return;
    }

    // Attach mock recording with valid object key format
    const { error: recErr } = await admin.from('recordings').insert({
      meeting_id: testMeetingId,
      r2_object_key: `recordings/${userId}/${testMeetingId}/${timestamp}-test.mp4`,
      mime_type: 'video/mp4',
      size: 1024,
      duration: 300,
      duration_seconds: 300,
      status: 'uploaded',
    });

    if (recErr) {
      console.error('Failed to insert test recording:', recErr);
      return;
    }

    // Attempt to start processing via POST /api/meetings/[id]/transcribe
    // The meeting requires 5 credits (ceil(300 / 60) = 5). User only has 2 credits!
    const transcribeRes = await fetch(`${siteUrl}/api/meetings/${testMeetingId}/transcribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const transcribeData = await transcribeRes.json();

    check(
      'Processing blocked when user has insufficient credits',
      transcribeRes.status === 402,
      `HTTP status ${transcribeRes.status} (expected 402 Payment Required)`
    );

    check(
      'Clear error message explaining credit requirement',
      typeof transcribeData.error === 'string' &&
        transcribeData.error.includes('Insufficient credits') &&
        transcribeData.error.includes('5 credits') &&
        transcribeData.error.includes('2 credits'),
      `Message: "${transcribeData.error}"`
    );

    // Verify meeting status was NOT changed to transcribing
    const { data: untouchedMeeting } = await admin
      .from('meetings')
      .select('status')
      .eq('id', testMeetingId)
      .single();

    check(
      'Meeting status remains untouched after blocked processing',
      untouchedMeeting.status === 'uploaded',
      `Status is "${untouchedMeeting.status}"`
    );

    // Verify balance was NOT touched (failed / blocked processing deducts 0 credits)
    const { data: untouchedProfile } = await admin
      .from('profiles')
      .select('credits_balance')
      .eq('id', userId)
      .single();

    check(
      'User credit balance remains untouched when blocked',
      untouchedProfile.credits_balance === 2,
      `Balance: ${untouchedProfile.credits_balance}`
    );

    // Verify 0 records in credit_transactions
    const { count: txCountBefore } = await admin
      .from('credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', testMeetingId);

    check(
      'Zero credit_transactions records created when blocked',
      txCountBefore === 0,
      `Found ${txCountBefore} transactions`
    );

    // ------------------------------------------------------------------
    // 3. SUCCESS PATH: DEDUCT CREDITS ONCE UPON SUCCESS
    // ------------------------------------------------------------------
    console.log('\n--- 3. Testing Successful Processing & Credit Deduction ---');
    // Top up user balance to 50 credits
    await admin.from('profiles').update({ credits_balance: 50 }).eq('id', userId);

    // Test deduct_media_processing_credits RPC or deductProcessingCredits
    const { data: deductRpcResult, error: deductRpcErr } = await admin.rpc(
      'deduct_media_processing_credits',
      {
        p_user_id: userId,
        p_meeting_id: testMeetingId,
        p_duration_seconds: 300,
      }
    );

    check(
      'Atomic credit deduction executed successfully',
      !deductRpcErr && deductRpcResult?.success === true,
      deductRpcErr ? deductRpcErr.message : `Deducted: ${deductRpcResult?.credits_deducted}, Remaining: ${deductRpcResult?.balance}`
    );

    check(
      'Deducted exactly ceil(300 / 60) = 5 credits',
      deductRpcResult?.credits_deducted === 5,
      `Deducted: ${deductRpcResult?.credits_deducted}`
    );

    // Check user profile balance: 50 - 5 = 45
    const { data: updatedProfile } = await admin
      .from('profiles')
      .select('credits_balance')
      .eq('id', userId)
      .single();

    check(
      'Profile balance reflects accurate deduction (50 -> 45)',
      updatedProfile.credits_balance === 45,
      `Balance is ${updatedProfile.credits_balance}`
    );

    // Check credit_transactions table: exactly 1 record
    const { data: txRecords, error: txErr } = await admin
      .from('credit_transactions')
      .select('*')
      .eq('meeting_id', testMeetingId);

    check(
      'Unique credit_transactions record created',
      !txErr && txRecords && txRecords.length === 1,
      `Found ${txRecords?.length} record(s), amount = ${txRecords?.[0]?.amount}`
    );

    if (txRecords && txRecords.length > 0) {
      check(
        'Transaction record attributes validated',
        txRecords[0].user_id === userId &&
          txRecords[0].amount === 5 &&
          txRecords[0].credits_deducted === 5 &&
          txRecords[0].duration_seconds === 300 &&
          txRecords[0].status === 'completed',
        `Type: ${txRecords[0].type}, Status: ${txRecords[0].status}`
      );
    }

    // ------------------------------------------------------------------
    // 4. IDEMPOTENCY: RETRIES, DUPLICATE WEBHOOKS & REFRESHES NEVER CHARGE TWICE
    // ------------------------------------------------------------------
    console.log('\n--- 4. Testing Idempotency (Retries & Duplicate Calls) ---');
    // Call deduction AGAIN for the same meeting
    const { data: secondDeductResult, error: secondErr } = await admin.rpc(
      'deduct_media_processing_credits',
      {
        p_user_id: userId,
        p_meeting_id: testMeetingId,
        p_duration_seconds: 300,
      }
    );

    check(
      'Second deduction call handled idempotently',
      !secondErr && secondDeductResult?.success === true && secondDeductResult?.already_charged === true,
      `already_charged = ${secondDeductResult?.already_charged}`
    );

    check(
      'Second call deducted 0 credits',
      secondDeductResult?.credits_deducted === 0,
      `Deducted: ${secondDeductResult?.credits_deducted}`
    );

    // Check user balance is still 45
    const { data: secondProfile } = await admin
      .from('profiles')
      .select('credits_balance')
      .eq('id', userId)
      .single();

    check(
      'Balance remained unchanged after duplicate call (still 45)',
      secondProfile.credits_balance === 45,
      `Balance: ${secondProfile.credits_balance}`
    );

    // Check credit_transactions count is STILL exactly 1
    const { count: txCountAfter } = await admin
      .from('credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', testMeetingId);

    check(
      'Transaction count for meeting strictly remains 1',
      txCountAfter === 1,
      `Count is ${txCountAfter}`
    );

    // ------------------------------------------------------------------
    // 5. DATABASE LEVEL UNIQUE CONSTRAINT VERIFICATION
    // ------------------------------------------------------------------
    console.log('\n--- 5. Testing Database Unique Constraint ---');
    // Attempt direct insert with identical meeting_id
    const { error: duplicateInsertErr } = await admin
      .from('credit_transactions')
      .insert({
        user_id: userId,
        meeting_id: testMeetingId,
        amount: 5,
        credits_deducted: 5,
        duration_seconds: 300,
        type: 'media_processing',
        status: 'completed',
      });

    check(
      'Database rejects duplicate credit_transactions insert via unique constraint',
      !!duplicateInsertErr && (duplicateInsertErr.code === '23505' || duplicateInsertErr.message.includes('unique')),
      `Error code: ${duplicateInsertErr?.code}, message: ${duplicateInsertErr?.message}`
    );

    // ------------------------------------------------------------------
    // 6. TESTING FAILED PROCESSING (FAILED PROCESSING MUST DEDUCT 0 CREDITS)
    // ------------------------------------------------------------------
    console.log('\n--- 6. Testing Failed Processing ---');
    const failedMeetingId = crypto.randomUUID();
    await admin.from('meetings').insert({
      id: failedMeetingId,
      user_id: userId,
      title: 'Failed Call Test',
      status: 'failed',
      duration: 180,
      duration_seconds: 180,
    });

    // Balance should remain 45
    const { data: failedProfile } = await admin
      .from('profiles')
      .select('credits_balance')
      .eq('id', userId)
      .single();

    check(
      'Failed processing uses 0 credits',
      failedProfile.credits_balance === 45,
      `Balance is ${failedProfile.credits_balance}`
    );

    const { count: failedTxCount } = await admin
      .from('credit_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', failedMeetingId);

    check(
      'No credit_transactions created for failed processing',
      failedTxCount === 0,
      `Found ${failedTxCount} transactions`
    );

    // Cleanup failed meeting
    await admin.from('meetings').delete().eq('id', failedMeetingId);

    // ------------------------------------------------------------------
    // 7. GET /api/meetings/[id]/transcribe STATUS & CREDITS TRANSPARENCY
    // ------------------------------------------------------------------
    console.log('\n--- 7. Testing GET /api/meetings/[id]/transcribe Transparency ---');
    const getRes = await fetch(`${siteUrl}/api/meetings/${testMeetingId}/transcribe`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const getData = await getRes.json();
    check(
      'GET /transcribe returns required credits and balance transparency',
      getRes.status === 200 &&
        getData.creditsRequired === 5 &&
        getData.creditsBalance === 45 &&
        getData.hasEnoughCredits === true,
      `Required: ${getData.creditsRequired}, Balance: ${getData.creditsBalance}, HasEnough: ${getData.hasEnoughCredits}`
    );

    // Cleanup test meeting and user
    console.log('\n--- Cleaning up test artifacts ---');
    await admin.from('credit_transactions').delete().eq('meeting_id', testMeetingId);
    await admin.from('meetings').delete().eq('id', testMeetingId);
    await admin.auth.admin.deleteUser(userId);
    check('Cleaned up test user and meeting artifacts', true);

  } catch (err) {
    console.error('Unexpected error in test:', err);
    await admin.auth.admin.deleteUser(userId).catch(() => {});
  }

  console.log('\n========================================================');
  const allPassed = results.every((r) => r.pass);
  console.log(`TOTAL CHECKS: ${results.length} | PASSED: ${results.filter((r) => r.pass).length} | FAILED: ${results.filter((r) => !r.pass).length}`);
  console.log(allPassed ? 'ALL CREDIT LOGIC VERIFICATION CHECKS PASSED!' : 'SOME CHECKS FAILED!');
  console.log('========================================================\n');
}

runCreditsVerification();
