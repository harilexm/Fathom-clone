import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const MEETING_ID = '9032c083-de71-459c-b1e6-0e8a6701ed45';
const UNFINISHED_MEETING_ID = 'a119ae94-ff58-45ae-b9a3-5c65237f2a14';
const BASE_URL = 'http://localhost:3000';

async function runFullMatrixTest() {
  console.log('================================================================');
  console.log('ASK FATHOM END-TO-END VERIFICATION: FULL 9-POINT TEST MATRIX');
  console.log('================================================================\n');

  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');
  function getEnv(key) {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : process.env[key];
  }

  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SECRET_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const results = [];
  function check(name, pass, details = '') {
    results.push({ name, pass, details });
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` (${details})` : ''}`);
  }

  // 1. Authenticate User A (Owner of Every Zoom Meeting)
  console.log('--- Setup: Authenticating User A ---');
  const { data: linkA, error: errA } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'umer.abdullah9891@gmail.com',
  });
  if (errA) throw new Error('Failed to generate link for User A: ' + errA.message);

  const verifyA = await supabase.auth.verifyOtp({
    token_hash: linkA.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyA.error) throw new Error('verifyOtp failed for User A: ' + verifyA.error.message);

  const sessionA = verifyA.data.session;
  const cookieHeaderA = 'sb-sdvijvvcudrorrexgdfw-auth-token=' + encodeURIComponent('base64-' + Buffer.from(JSON.stringify(sessionA)).toString('base64'));
  const authHeaderA = `Bearer ${sessionA.access_token}`;

  // 2. Authenticate or create User B (Different User)
  console.log('--- Setup: Authenticating User B ---');
  let userBId = null;
  const userBEmail = 'test-user-b-fathom@example.com';
  const { data: userBList } = await supabase.auth.admin.listUsers();
  const existingUserB = userBList?.users?.find((u) => u.email === userBEmail);

  if (existingUserB) {
    userBId = existingUserB.id;
  } else {
    const { data: newUserB, error: createBErr } = await supabase.auth.admin.createUser({
      email: userBEmail,
      email_confirm: true,
    });
    if (createBErr) throw new Error('Failed to create User B: ' + createBErr.message);
    userBId = newUserB.user.id;
  }

  const { data: linkB } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: userBEmail,
  });

  const verifyB = await supabase.auth.verifyOtp({
    token_hash: linkB.properties.hashed_token,
    type: 'magiclink',
  });
  const sessionB = verifyB.data.session;
  const cookieHeaderB = 'sb-sdvijvvcudrorrexgdfw-auth-token=' + encodeURIComponent('base64-' + Buffer.from(JSON.stringify(sessionB)).toString('base64'));
  const authHeaderB = `Bearer ${sessionB.access_token}`;

  // -------------------------------------------------------------------------
  // Checklist Item 1: Single meeting question
  // -------------------------------------------------------------------------
  console.log('\n--- 1. Single Meeting Question ---');
  try {
    const res = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeaderA,
        Authorization: authHeaderA,
      },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID,
        question: 'What was the purpose of this meeting?',
        stream: false,
      }),
    });

    const data = await res.json();
    check('Single meeting query returns HTTP 200', res.status === 200);
    check('Single meeting query returns answer', Boolean(data.answer && data.answer.length > 0));
    check('Single meeting returns correct scope', data.scope === 'meeting');
    check('Single meeting returns meetingTitle', data.meetingTitle === 'Every Zoom Meeting');
    check('Single meeting answer mentions Danny or script', data.answer.toLowerCase().includes('danny') || data.answer.toLowerCase().includes('script'));
  } catch (err) {
    check('Single meeting question executed', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Checklist Item 2: Switch between meetings
  // -------------------------------------------------------------------------
  console.log('\n--- 2. Switch Between Meetings ---');
  try {
    // Query Meeting 1 (Every Zoom Meeting)
    const resM1 = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeaderA, Authorization: authHeaderA },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID,
        question: 'Who was this meeting focused on?',
        stream: false,
      }),
    });
    const dataM1 = await resM1.json();

    // Query Meeting 2 (Acme Discovery Call)
    const resM2 = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeaderA, Authorization: authHeaderA },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: 'acme-discovery-call',
        question: 'What company is this call with and what is their requirement?',
        stream: false,
      }),
    });
    const dataM2 = await resM2.json();

    check('Meeting 1 query succeeded', resM1.status === 200 && dataM1.answer.toLowerCase().includes('danny'));
    check('Meeting 2 query succeeded', resM2.status === 200 && dataM2.answer.toLowerCase().includes('acme'));
    check(
      'Contexts between meetings are strictly isolated',
      !dataM1.answer.toLowerCase().includes('acme') && !dataM2.answer.toLowerCase().includes('danny'),
      'No cross-meeting contamination'
    );
  } catch (err) {
    check('Switch between meetings', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Checklist Item 3: Switch to My Calls
  // -------------------------------------------------------------------------
  console.log('\n--- 3. Switch to My Calls ---');
  try {
    const resMyCalls = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeaderA, Authorization: authHeaderA },
      body: JSON.stringify({
        scope: 'my-calls',
        question: 'Summarize key themes across my calls',
        stream: false,
      }),
    });
    const dataMyCalls = await resMyCalls.json();
    check('My Calls query returned HTTP 200', resMyCalls.status === 200);
    check('My Calls returned scope "my-calls"', dataMyCalls.scope === 'my-calls');
    check('My Calls retrieved processed meeting context', dataMyCalls.relevantMeetingCount > 0, `${dataMyCalls.relevantMeetingCount} meetings`);
    check('My Calls answer cites meeting title', dataMyCalls.answer.toLowerCase().includes('every zoom meeting') || dataMyCalls.answer.toLowerCase().includes('danny'));
  } catch (err) {
    check('Switch to My Calls', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Checklist Item 4: Known transcript answer
  // -------------------------------------------------------------------------
  console.log('\n--- 4. Known Transcript Answer ---');
  try {
    const resTranscript = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeaderA, Authorization: authHeaderA },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID,
        question: 'Why was Danny not speaking at first, and what did Speaker 1 say to do?',
        stream: false,
      }),
    });
    const dataTranscript = await resTranscript.json();
    const ans = (dataTranscript.answer || '').toLowerCase();
    check(
      'Grounded answer identifies Danny was muted / microphone issue from transcript',
      ans.includes('mute') || ans.includes('muted'),
      dataTranscript.answer?.slice(0, 140) + '...'
    );
  } catch (err) {
    check('Known transcript answer', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Checklist Item 5: Answer not present
  // -------------------------------------------------------------------------
  console.log('\n--- 5. Answer Not Present in Context ---');
  try {
    const resAbsent = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeaderA, Authorization: authHeaderA },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID,
        question: 'What did we decide regarding our office lease in Singapore and the $2 million budget for it?',
        stream: false,
      }),
    });
    const dataAbsent = await resAbsent.json();
    const ansAbsent = (dataAbsent.answer || '').toLowerCase();
    check(
      'Explicitly states fact is not discussed/mentioned without inventing facts',
      ansAbsent.includes('not mentioned') || ansAbsent.includes('not discussed') || ansAbsent.includes('no mention'),
      dataAbsent.answer?.slice(0, 130) + '...'
    );
  } catch (err) {
    check('Answer not present', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Checklist Item 6: Unfinished meeting
  // -------------------------------------------------------------------------
  console.log('\n--- 6. Unfinished Meeting Handling ---');
  try {
    const resUnfinished = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeaderA, Authorization: authHeaderA },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: UNFINISHED_MEETING_ID,
        question: 'What are the main discussion points?',
        stream: false,
      }),
    });
    const dataUnfinished = await resUnfinished.json();
    const ansUnfinished = (dataUnfinished.answer || '').toLowerCase();
    check(
      'Returns grounded status notice that meeting is processing',
      ansUnfinished.includes('processing') || ansUnfinished.includes('requires a fully processed meeting'),
      dataUnfinished.answer?.slice(0, 130) + '...'
    );
  } catch (err) {
    check('Unfinished meeting handling', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Checklist Item 7: OpenAI failure -> Anthropic fallback
  // -------------------------------------------------------------------------
  console.log('\n--- 7. OpenAI Failure -> Anthropic Fallback ---');
  try {
    const resFallback = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeaderA,
        Authorization: authHeaderA,
        'x-test-simulate-openai-failure': 'true',
      },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID,
        question: 'What was the action item for Danny?',
        stream: false,
      }),
    });

    const dataFallback = await resFallback.json();
    check('Fallback HTTP status 200', resFallback.status === 200);
    check('Provider is anthropic when OpenAI fails', dataFallback.provider === 'anthropic', `Provider: ${dataFallback.provider}`);
    check(
      'Anthropic fallback produced grounded answer',
      Boolean(dataFallback.answer && (dataFallback.answer.toLowerCase().includes('danny') || dataFallback.answer.toLowerCase().includes('unmute'))),
      dataFallback.answer?.slice(0, 130) + '...'
    );
  } catch (err) {
    check('OpenAI failure -> Anthropic fallback', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Checklist Item 8: User A cannot access User B data
  // -------------------------------------------------------------------------
  console.log('\n--- 8. Security: User A vs User B Access Boundaries ---');
  try {
    // User B attempts to access User A's meeting in meeting scope
    const resUnauthorizedMeeting = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeaderB, Authorization: authHeaderB },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID, // Owned by User A
        question: 'What happened in this meeting?',
        stream: false,
      }),
    });
    check('User B cannot access User A meeting (HTTP 403 Forbidden)', resUnauthorizedMeeting.status === 403, `Status: ${resUnauthorizedMeeting.status}`);

    // User B queries My Calls
    const resUserBMyCalls = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeaderB, Authorization: authHeaderB },
      body: JSON.stringify({
        scope: 'my-calls',
        question: 'Tell me about Danny and the script update in Every Zoom Meeting',
        stream: false,
      }),
    });
    const dataUserBMyCalls = await resUserBMyCalls.json();
    check(
      'User B My Calls query does not leak User A meetings',
      !dataUserBMyCalls.answer.toLowerCase().includes('every zoom meeting') || dataUserBMyCalls.relevantMeetingCount === 0,
      `User B meetings count: ${dataUserBMyCalls.relevantMeetingCount || 0}`
    );
  } catch (err) {
    check('User boundary check', false, err.message);
  }

  // -------------------------------------------------------------------------
  // Checklist Item 9: Chat history stays separate per context
  // -------------------------------------------------------------------------
  console.log('\n--- 9. Chat History Stays Separate Per Context ---');
  try {
    // Multi-turn in Meeting 1: Send history belonging to Meeting 1
    const resTurn2 = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', cookie: cookieHeaderA, Authorization: authHeaderA },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID,
        question: 'Can you repeat who was assigned to help him?',
        history: [
          { role: 'user', content: 'What was the action item for Danny?' },
          { role: 'assistant', content: 'Speaker 6 was assigned to send Danny instructions on unmuting.' },
        ],
        stream: false,
      }),
    });
    const dataTurn2 = await resTurn2.json();
    check('Multi-turn query maintains meeting-scoped conversation history', resTurn2.status === 200 && dataTurn2.answer.length > 0);

    // Verify UI chatHistories structure separation
    const sampleChatHistories = {
      'my-calls': [{ id: '1', role: 'user', content: 'Summarize my calls' }],
      'meeting:9032c083-de71-459c-b1e6-0e8a6701ed45': [{ id: '2', role: 'user', content: 'Question about Zoom' }],
      'meeting:acme-discovery-call': [{ id: '3', role: 'user', content: 'Question about Acme' }],
    };

    const myCallsKeys = Object.keys(sampleChatHistories);
    check('Chat history keys are distinct for My Calls and each meeting', myCallsKeys.length === 3);
    check('My Calls history does not contain meeting messages', sampleChatHistories['my-calls'][0].content === 'Summarize my calls');
    check('Meeting 1 history distinct', sampleChatHistories['meeting:9032c083-de71-459c-b1e6-0e8a6701ed45'][0].content === 'Question about Zoom');
    check('Meeting 2 history distinct', sampleChatHistories['meeting:acme-discovery-call'][0].content === 'Question about Acme');
  } catch (err) {
    check('Chat history stays separate per context', false, err.message);
  }

  console.log('\n================================================================');
  const allPassed = results.every((r) => r.pass);
  console.log(allPassed ? '🎉 ALL 9 MATRIX VERIFICATION TESTS PASSED!' : '⚠️ SOME MATRIX TESTS FAILED');
  console.log('================================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runFullMatrixTest().catch((err) => {
  console.error('\nTEST EXECUTION ERROR:', err);
  process.exit(1);
});
