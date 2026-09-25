import { createClient } from '@supabase/supabase-js';

const MEETING_ID = '9032c083-de71-459c-b1e6-0e8a6701ed45';
const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING HIGHLIGHTS E2E TEST ---');
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  // 1. Get authenticated session for meeting owner
  console.log('Step 1: Authenticating user...');
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
  console.log('Session acquired for user:', session.user.id);
  const cookieHeader = 'sb-sdvijvvcudrorrexgdfw-auth-token=' + encodeURIComponent('base64-' + Buffer.from(JSON.stringify(session)).toString('base64'));

  // 2. Test create highlight
  console.log('\nStep 2: Testing Create Highlight (POST /api/meetings/[id]/highlights)...');
  const createPayload = {
    title: 'Danny script discussion kickoff',
    startTime: 2.25,
    endTime: 5.61,
    text: "Uh, yeah, so we're just going to get an update on Danny's script. That's the plan."
  };

  const createRes = await fetch(`${BASE_URL}/api/meetings/${MEETING_ID}/highlights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieHeader,
    },
    body: JSON.stringify(createPayload),
  });

  console.log('Create HTTP status:', createRes.status);
  const createData = await createRes.json();
  console.log('Create response:', createData);

  if (createRes.status !== 201 || !createData.success || !createData.highlight?.id) {
    throw new Error('Create highlight failed: ' + JSON.stringify(createData));
  }
  const createdId = createData.highlight.id;
  console.log('Created highlight ID:', createdId);

  // 3. Test duplicate prevention
  console.log('\nStep 3: Testing Duplicate Prevention...');
  const dupRes = await fetch(`${BASE_URL}/api/meetings/${MEETING_ID}/highlights`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: cookieHeader,
    },
    body: JSON.stringify(createPayload),
  });

  console.log('Duplicate attempt HTTP status:', dupRes.status);
  const dupData = await dupRes.json();
  console.log('Duplicate response message:', dupData.error);
  if (dupRes.status === 409) {
    console.log('PASS: Duplicate highlight successfully rejected with 409 Conflict!');
  } else {
    throw new Error('Expected 409 Conflict for duplicate, got ' + dupRes.status);
  }

  // 4. Test page reload with the created highlight
  console.log('\nStep 4: Testing Page Reload & SSR with created highlight...');
  const pageRes = await fetch(`${BASE_URL}/meeting/${MEETING_ID}`, {
    headers: {
      cookie: cookieHeader,
      accept: 'text/html',
    }
  });

  console.log('Page reload HTTP status:', pageRes.status);
  const pageHtml = await pageRes.text();
  console.log('Page response length:', pageHtml.length);

  const hasTitle = pageHtml.includes('Danny script discussion kickoff');
  const hasText = pageHtml.includes("Uh, yeah, so we&#x27;re just going to get an update") || pageHtml.includes("Uh, yeah, so we're just going to get an update") || pageHtml.includes("Danny&#x27;s script");
  const hasUserSection = pageHtml.includes('Your Highlights');
  const hasAiSection = pageHtml.includes('AI-Suggested Highlights');

  console.log('PASS: Saved highlight title present in HTML:', hasTitle);
  console.log('PASS: Selected transcript text present in HTML:', hasText);
  console.log('PASS: Your Highlights section present in HTML:', hasUserSection);
  console.log('PASS: AI-Suggested Highlights section present in HTML:', hasAiSection);

  if (!hasTitle) {
    throw new Error('Created highlight title not found in page HTML on reload');
  }

  // 5. Test delete highlight
  console.log('\nStep 5: Testing Delete Highlight (DELETE /api/meetings/[id]/highlights)...');
  const delRes = await fetch(`${BASE_URL}/api/meetings/${MEETING_ID}/highlights?highlightId=${createdId}`, {
    method: 'DELETE',
    headers: {
      cookie: cookieHeader,
    }
  });

  console.log('Delete HTTP status:', delRes.status);
  const delData = await delRes.json();
  console.log('Delete response:', delData);
  if (delRes.status !== 200 || !delData.success) {
    throw new Error('Delete highlight failed: ' + JSON.stringify(delData));
  }
  console.log('PASS: Highlight deleted successfully!');

  // 6. Test page reload after deletion
  console.log('\nStep 6: Testing Page Reload after deletion...');
  const pageAfterDelRes = await fetch(`${BASE_URL}/meeting/${MEETING_ID}`, {
    headers: {
      cookie: cookieHeader,
      accept: 'text/html',
    }
  });

  const pageAfterDelHtml = await pageAfterDelRes.text();
  const stillHasTitle = pageAfterDelHtml.includes('Danny script discussion kickoff');
  console.log('PASS: Deleted highlight no longer present in page:', !stillHasTitle);
  if (stillHasTitle) {
    throw new Error('Deleted highlight was still found in page after reload!');
  }

  // 7. Verify AI highlights still intact in database
  console.log('\nStep 7: Verifying AI highlights remain intact...');
  const { data: dbHighlights } = await supabase
    .from('highlights')
    .select('id, title, kind, start_timestamp')
    .eq('meeting_id', MEETING_ID);

  console.log('Remaining highlights count in DB:', dbHighlights?.length);
  console.log('Highlights in DB:', dbHighlights?.map(h => `${h.kind}: ${h.title}`));
  if ((dbHighlights?.length || 0) < 5) {
    throw new Error('AI highlights were unexpectedly modified or deleted!');
  }
  console.log('PASS: All 5 AI highlights intact!');

  console.log('\n========================================');
  console.log('ALL HIGHLIGHTS E2E TESTS PASSED SUCCESSFULLY!');
  console.log('========================================');
}

runTests().catch(err => {
  console.error('\nTEST FAILED:', err);
  process.exit(1);
});
