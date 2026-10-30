// The seeded friend switches "activity visible" off. Needs the output of seed-friend.js
// and `-e API_URL / ANON_KEY`.

const response = http.request(API_URL + '/rest/v1/profiles?id=eq.' + output.friendId, {
  method: 'PATCH',
  headers: {
    apikey: ANON_KEY,
    Authorization: 'Bearer ' + output.friendToken,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  },
  body: JSON.stringify({ activity_visible: false }),
});
if (!response.ok) throw new Error('PATCH profiles -> ' + response.status + ' ' + response.body);
if (json(response.body).length !== 1) throw new Error('activity_visible was not updated');
