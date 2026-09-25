import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const MEETING_ID = '9032c083-de71-459c-b1e6-0e8a6701ed45';
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('========================================================');
  console.log('ASK FATHOM END-TO-END HTTP API & STREAMING VERIFICATION');
  console.log('========================================================\n');

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

  // 1. Unauthenticated Security Check
  console.log('Step 1: Testing Unauthenticated Security...');
  try {
    const unauthRes = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'my-calls', question: 'Hello' }),
    });
    check('Security: Unauthenticated POST /api/ask rejected', unauthRes.status === 401, `Status: ${unauthRes.status}`);
  } catch (err) {
    check('Security: Unauthenticated POST /api/ask rejected', false, err.message);
  }

  // 2. Authenticate user
  console.log('\nStep 2: Authenticating User...');
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'umer.abdullah9891@gmail.com',
  });
  if (linkErr) throw new Error('generateLink failed: ' + linkErr.message);

  const verifyRes = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyRes.error) throw new Error('verifyOtp failed: ' + verifyRes.error.message);

  const session = verifyRes.data.session;
  const cookieHeader = 'sb-sdvijvvcudrorrexgdfw-auth-token=' + encodeURIComponent('base64-' + Buffer.from(JSON.stringify(session)).toString('base64'));
  const authHeader = `Bearer ${session.access_token}`;

  // Record initial credits
  const { data: profileBefore } = await supabase
    .from('profiles')
    .select('credits_balance')
    .eq('id', session.user.id)
    .single();
  const initialCredits = profileBefore?.credits_balance;

  // 3. GET /api/ask - Available Scopes
  console.log('\nStep 3: Testing GET /api/ask (Available Scopes)...');
  try {
    const scopesRes = await fetch(`${BASE_URL}/api/ask`, {
      headers: { cookie: cookieHeader, Authorization: authHeader },
    });
    check('GET /api/ask status 200', scopesRes.status === 200, `Status: ${scopesRes.status}`);
    const scopesData = await scopesRes.json();
    const hasMyCalls = scopesData.scopes?.some((s) => s.id === 'my-calls');
    const hasTargetMeeting = scopesData.processedMeetings?.some((m) => m.id === MEETING_ID);
    check('Scopes include "My Calls"', hasMyCalls);
    check('Processed meetings include "Every Zoom Meeting"', hasTargetMeeting, `${scopesData.processedMeetings?.length} processed meetings`);
  } catch (err) {
    check('GET /api/ask status 200', false, err.message);
  }

  // 4. POST /api/ask with Meeting Scope (SSE Streaming)
  console.log('\nStep 4: Testing POST /api/ask Meeting Scope (SSE Streaming)...');
  try {
    const streamRes = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
        Authorization: authHeader,
      },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID,
        question: 'What issue was Danny having and what action item was given?',
        stream: true,
      }),
    });

    check('Meeting stream HTTP status 200', streamRes.status === 200);
    check('Meeting stream Content-Type is text/event-stream', streamRes.headers.get('content-type')?.includes('text/event-stream'));

    const reader = streamRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let metadataReceived = null;
    let fullText = '';
    let chunkCount = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('event: metadata')) {
          const next = lines[i + 1]?.trim() || '';
          if (next.startsWith('data:')) {
            metadataReceived = JSON.parse(next.slice(5).trim());
          }
        } else if (line.startsWith('event: chunk')) {
          const next = lines[i + 1]?.trim() || '';
          if (next.startsWith('data:')) {
            const chunk = JSON.parse(next.slice(5).trim());
            if (chunk.text) {
              fullText += chunk.text;
              chunkCount++;
            }
          }
        }
      }
    }

    check('SSE metadata event received', Boolean(metadataReceived));
    check('Metadata provider is openai', metadataReceived?.provider === 'openai', `Provider: ${metadataReceived?.provider}`);
    check('Metadata contains sources', (metadataReceived?.sources?.length || 0) > 0, `${metadataReceived?.sources?.length} sources`);
    check('SSE chunks streamed tokens in real time', chunkCount > 0, `${chunkCount} token chunks`);
    check(
      'Meeting scope response grounded in Danny & unmute facts',
      fullText.toLowerCase().includes('danny') && (fullText.toLowerCase().includes('mute') || fullText.toLowerCase().includes('script')),
      fullText.slice(0, 120) + '...'
    );
  } catch (err) {
    check('Meeting stream executed', false, err.message);
  }

  // 5. POST /api/ask Meeting Scope: Grounding on Absent Facts
  console.log('\nStep 5: Testing Meeting Scope Grounding on Absent Facts...');
  try {
    const ungroundedRes = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
        Authorization: authHeader,
      },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID,
        question: 'What was the agreed budget for opening our new office in Zurich?',
        stream: false,
      }),
    });

    const ungroundedData = await ungroundedRes.json();
    const answer = (ungroundedData.answer || '').toLowerCase();
    check(
      'Grounded response states fact is not discussed rather than inventing facts',
      answer.includes('not mentioned') || answer.includes('not discussed') || answer.includes('no mention'),
      ungroundedData.answer?.slice(0, 130) + '...'
    );
  } catch (err) {
    check('Grounded response on absent facts', false, err.message);
  }

  // 6. POST /api/ask with My Calls Scope (SSE Streaming)
  console.log('\nStep 6: Testing POST /api/ask My Calls Scope (SSE Streaming)...');
  try {
    const myCallsRes = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
        Authorization: authHeader,
      },
      body: JSON.stringify({
        scope: 'my-calls',
        question: 'Summarize my recent calls and any pending action items for Danny',
        stream: true,
      }),
    });

    check('My Calls stream HTTP status 200', myCallsRes.status === 200);

    const reader = myCallsRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let metadataReceived = null;
    let myCallsFullText = '';
    let chunkCount = 0;

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('event: metadata')) {
          const next = lines[i + 1]?.trim() || '';
          if (next.startsWith('data:')) {
            metadataReceived = JSON.parse(next.slice(5).trim());
          }
        } else if (line.startsWith('event: chunk')) {
          const next = lines[i + 1]?.trim() || '';
          if (next.startsWith('data:')) {
            const chunk = JSON.parse(next.slice(5).trim());
            if (chunk.text) {
              myCallsFullText += chunk.text;
              chunkCount++;
            }
          }
        }
      }
    }

    check('My Calls SSE metadata received', Boolean(metadataReceived));
    check('My Calls metadata sources returned', (metadataReceived?.sources?.length || 0) > 0, `${metadataReceived?.sources?.length} sources`);
    check('My Calls stream chunks received', chunkCount > 0, `${chunkCount} token chunks`);
    check(
      'My Calls response attributes context to "Every Zoom Meeting"',
      myCallsFullText.toLowerCase().includes('every zoom meeting') || myCallsFullText.toLowerCase().includes('danny'),
      myCallsFullText.slice(0, 130) + '...'
    );
  } catch (err) {
    check('My Calls stream executed', false, err.message);
  }

  // 7. Non-Streaming Mode (stream: false)
  console.log('\nStep 7: Testing Non-Streaming Mode (stream: false)...');
  try {
    const jsonRes = await fetch(`${BASE_URL}/api/ask`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        cookie: cookieHeader,
        Authorization: authHeader,
      },
      body: JSON.stringify({
        scope: 'meeting',
        meetingId: MEETING_ID,
        question: 'Who spoke in this meeting?',
        stream: false,
      }),
    });

    check('Non-streaming HTTP status 200', jsonRes.status === 200);
    const jsonData = await jsonRes.json();
    check('Non-streaming returns success: true', jsonData.success === true);
    check('Non-streaming returns answer string', typeof jsonData.answer === 'string' && jsonData.answer.length > 0);
  } catch (err) {
    check('Non-streaming mode executed', false, err.message);
  }

  // 8. Test Credit Invariance (0 credits deducted)
  console.log('\nStep 8: Testing Credit Invariance (0 Credits Deducted)...');
  try {
    const { data: profileAfter } = await supabase
      .from('profiles')
      .select('credits_balance')
      .eq('id', session.user.id)
      .single();

    check(
      'Ask Fathom chat uses 0 credits',
      profileAfter?.credits_balance === initialCredits,
      `Before: ${initialCredits} | After: ${profileAfter?.credits_balance}`
    );
  } catch (err) {
    check('Ask Fathom chat uses 0 credits', false, err.message);
  }

  console.log('\n========================================================');
  const allPassed = results.every((r) => r.pass);
  console.log(allPassed ? '🎉 ALL E2E VERIFICATION TESTS PASSED!' : '⚠️ SOME TESTS FAILED');
  console.log('========================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('\nTEST SCRIPT ERROR:', err);
  process.exit(1);
});
