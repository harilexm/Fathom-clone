import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { askFathom } from '../src/lib/ask-fathom.ts';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
envContent.split('\n').forEach((line) => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    const key = match[1];
    let value = (match[2] || '').trim();
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    process.env[key] = value.trim();
  }
});

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY;

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function run() {
  console.log('========================================================');
  console.log('TESTING ASK FATHOM CROSS-MEETING CONTAMINATION FIX');
  console.log('========================================================\n');

  // Authenticate user A (owner of Every Zoom Meeting and Sec Growth DataScience meeting)
  const userEmail = 'umer.abdullah9891@gmail.com';
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: userEmail,
  });
  if (linkErr) throw new Error('generateLink failed: ' + linkErr.message);

  const verifyRes = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyRes.error) throw new Error('verifyOtp failed: ' + verifyRes.error.message);

  const user = verifyRes.data.user;
  console.log('Authenticated user:', user.email, 'ID:', user.id);

  // Test 1: Asking about Acme when user has NO Acme meetings in DB
  console.log('\n--- Test 1: User asks "What are key next steps from Acme\'s calls?" (NO Acme calls in library) ---');
  const resAcme = await askFathom({
    scope: 'my-calls',
    question: "What are key next steps from Acme's calls?",
    user: { id: user.id, email: user.email },
    supabase,
  });

  console.log('Provider:', resAcme.provider);
  console.log('Relevant Meeting Count:', resAcme.relevantMeetingCount);
  console.log('Answer:\n', resAcme.answer);

  const mentionsDanny = resAcme.answer.toLowerCase().includes('danny');
  const mentionsEveryZoom = resAcme.answer.toLowerCase().includes('every zoom meeting');
  const isGroundedNotice = resAcme.provider === 'grounded-notice' || resAcme.relevantMeetingCount === 0;

  if (mentionsDanny || mentionsEveryZoom) {
    console.error('❌ FAIL: Cross-contamination occurred! Answer mentioned Danny or Every Zoom Meeting for an Acme query.');
    process.exit(1);
  } else if (isGroundedNotice) {
    console.log('✅ PASS: Correctly identified no Acme meetings without leaking Every Zoom Meeting or Danny!');
  } else {
    console.log('✅ PASS: Answer did not leak unrelated meetings.');
  }

  // Test 2: Asking specifically about Sec Growth DataScience meeting
  console.log('\n--- Test 2: User asks about DataScience meeting ---');
  const resDS = await askFathom({
    scope: 'my-calls',
    question: "What was discussed regarding DataScience in the Sec Growth staff meeting?",
    user: { id: user.id, email: user.email },
    supabase,
  });

  console.log('Provider:', resDS.provider);
  console.log('Relevant Meeting Count:', resDS.relevantMeetingCount);
  console.log('Sources:', resDS.sources.map(s => s.meetingTitle));
  console.log('Answer preview:\n', resDS.answer.slice(0, 200) + '...');

  const dsMatches = resDS.sources.some(s => s.meetingTitle.toLowerCase().includes('datascience') || s.meetingTitle.toLowerCase().includes('sec growth'));
  const zoomMatches = resDS.sources.some(s => s.meetingTitle.toLowerCase().includes('every zoom meeting'));

  if (dsMatches && !zoomMatches) {
    console.log('✅ PASS: Correctly targeted Sec Growth DataScience meeting without leaking Every Zoom Meeting!');
  } else if (zoomMatches) {
    console.error('❌ FAIL: Cross-contamination! Every Zoom Meeting was included in sources for Sec Growth DataScience query.');
    process.exit(1);
  } else {
    console.log('ℹ️ Sources returned:', resDS.sources.map(s => s.meetingTitle));
  }

  // Test 3: Broad question across calls
  console.log('\n--- Test 3: Broad question across calls ---');
  const resBroad = await askFathom({
    scope: 'my-calls',
    question: "Summarize key themes across my calls",
    user: { id: user.id, email: user.email },
    supabase,
  });

  console.log('Provider:', resBroad.provider);
  console.log('Relevant Meeting Count:', resBroad.relevantMeetingCount);
  console.log('Answer preview:\n', resBroad.answer.slice(0, 200) + '...');

  if (resBroad.relevantMeetingCount > 0 && resBroad.answer.length > 50) {
    console.log('✅ PASS: Broad query successfully summarized user calls!');
  } else {
    console.error('❌ FAIL: Broad query did not return expected response.');
    process.exit(1);
  }

  console.log('\n🎉 ALL CROSS-CONTAMINATION TESTS PASSED SUCCESSFULLY!');
}

run().catch((err) => {
  console.error('Error running test:', err);
  process.exit(1);
});
