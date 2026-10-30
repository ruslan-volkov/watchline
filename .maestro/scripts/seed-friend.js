// Creates a second user straight through the API, with one series in progress, so a flow
// can play "the friend" without driving a second device. API_URL and ANON_KEY come from
// `maestro test -e`. Leaves friendName / friendId / friendToken / friendTitle in output.

function call(method, path, token, body) {
  const response = http.request(API_URL + path, {
    method: method,
    headers: {
      apikey: ANON_KEY,
      Authorization: 'Bearer ' + (token || ANON_KEY),
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) throw new Error(method + ' ' + path + ' -> ' + response.status + ' ' + response.body);
  return json(response.body);
}

// Usernames are not unique, and search returns the first 20 matches: a per-run suffix
// keeps earlier runs' friends out of the results.
const name = 'lucie' + (Date.now() % 1000000);
const title = 'Serie de Lucie';

const signup = call('POST', '/auth/v1/signup', null, {
  email: name + '@test.local',
  password: 'test-password-123',
});
const token = signup.access_token;
const id = signup.user.id;

call('PATCH', '/rest/v1/profiles?id=eq.' + id, token, { username: name });
const media = call('POST', '/rest/v1/media', token, { tmdb_id: 900000 + (Date.now() % 90000), media_type: 'tv', title: title });
call('POST', '/rest/v1/watch_entries', token, { user_id: id, media_id: media[0].id, status: 'watching' });

output.friendName = name;
output.friendId = id;
output.friendToken = token;
output.friendTitle = title;
