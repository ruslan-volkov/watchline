// The seeded friend accepts the request the app user just sent. Needs the output of
// seed-friend.js and `-e API_URL / ANON_KEY`.

function call(method, path, body) {
  const response = http.request(API_URL + path, {
    method: method,
    headers: {
      apikey: ANON_KEY,
      Authorization: 'Bearer ' + output.friendToken,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(method + ' ' + path + ' -> ' + response.status + ' ' + response.body);
  return json(response.body);
}

// RLS only lets the friend see requests addressed to them, so this finds exactly one.
const pending = call(
  'GET',
  '/rest/v1/friendships?friend_id=eq.' + output.friendId + '&status=eq.pending&select=id',
);
if (pending.length !== 1) throw new Error('expected one pending request, found ' + pending.length);

const accepted = call('PATCH', '/rest/v1/friendships?id=eq.' + pending[0].id, {
  status: 'accepted',
});
if (accepted.length !== 1) throw new Error('the request was not accepted');
