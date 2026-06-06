const BASE = '/api'

async function req(method, path, body) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || 'Request failed')
  }
  return res.json()
}

export const api = {
  createGroup:     (name, ratePerHour)      => req('POST', '/groups', { name, ratePerHour }),
  getGroup:        (gid)                    => req('GET',  `/groups/${gid}`),
  updateRate:      (gid, ratePerHour)       => req('PATCH', `/groups/${gid}`, { ratePerHour }),
  getGroupSessions:(gid)                    => req('GET',  `/groups/${gid}/sessions`),
  startSession:    (gid, people)            => req('POST', `/groups/${gid}/sessions`, { people }),
  getActiveSession:(gid)                    => req('GET',  `/groups/${gid}/sessions/active`),
  endSession:      (sid)                    => req('POST', `/sessions/${sid}/end`),
  addPerson:       (sid, name)              => req('POST', `/sessions/${sid}/people`, { name }),
  personLeave:     (sid, pid)               => req('POST', `/sessions/${sid}/people/${pid}/leave`),
}
