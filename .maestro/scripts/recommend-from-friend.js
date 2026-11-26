// The seeded friend recommends their series to the app user, through the Edge Function
// the app itself calls. Needs the output of seed-friend.js and `-e API_URL / ANON_KEY`.

function call(method, path, body) {
  const response = http.request(API_URL + path, {
    method: method,
    headers: {
      apikey: ANON_KEY,
      Authorization: 'Bearer ' + output.friendToken,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok)
    throw new Error(method + ' ' + path + ' -> ' + response.status + ' ' + response.body);
  return json(response.body);
}

// The app user is the requester of the friend's only friendship.
const links = call(
  'GET',
  '/rest/v1/friendships?friend_id=eq.' + output.friendId + '&select=user_id',
);
const entries = call(
  'GET',
  '/rest/v1/watch_entries?user_id=eq.' + output.friendId + '&select=media_id',
);

call('POST', '/functions/v1/recommend-media', {
  mediaId: entries[0].media_id,
  recipientIds: [links[0].user_id],
  message: 'Regarde celle-ci',
});
