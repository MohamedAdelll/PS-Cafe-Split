import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { calcPersonCost, fmtEGP, fmtDuration, fmtClock, initials, avatarColor } from '../utils'
import s from './GroupView.module.css'

const POLL_MS = 2000

export default function GroupView() {
  const navigate = useNavigate()
  const { gid } = useParams()
  const [group, setGroup]     = useState(null)
  const [session, setSession] = useState(undefined) // undefined = loading
  const [now, setNow]         = useState(Date.now())
  const [draftName, setDraftName] = useState('')
  const [draftPeople, setDraftPeople] = useState([])
  const [newName, setNewName] = useState('')
  const [editRate, setEditRate] = useState(false)
  const [newRate, setNewRate]   = useState('')
  const [showIntervals, setShowIntervals] = useState(false)
  const [showFinal, setShowFinal] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

async function refresh() {
    try {
      const [g, ses] = await Promise.all([api.getGroup(gid), api.getActiveSession(gid)])
      setGroup(g)
      setSession(ses)
    } catch (e) {
      setError(e.message)
    }
  }

  useEffect(() => { refresh() }, [gid])

  // Live clock
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  // Poll for remote updates when session is live
  useEffect(() => {
    if (!session || session.ended_at) return
    const t = setInterval(refresh, POLL_MS)
    return () => clearInterval(t)
  }, [session, refresh])

  async function startSession() {
    const people = draftPeople.map(name => name.trim()).filter(Boolean)
    if (people.length === 0) {
      setError('Add at least one person before starting the session')
      return
    }
    setError('')
    try {
      const ses = await api.startSession(gid, people)
      setSession(ses)
      setShowFinal(false)
      setDraftName('')
      setDraftPeople([])
    } catch (e) { setError(e.message) }
  }

  async function endSession() {
    if (!session) return
    setError('')
    try {
      const ses = await api.endSession(session.id)
      setSession(ses)
      setShowFinal(true)
    } catch (e) { setError(e.message) }
  }

  async function addPerson() {
    if (!newName.trim() || !session) return
    const nm = newName.trim()
    setNewName('')
    setError('')
    try {
      const ses = await api.addPerson(session.id, nm)
      setSession(ses)
    } catch (e) { setError(e.message) }
  }

  async function markLeft(pid) {
    if (!session) return
    setError('')
    try {
      const ses = await api.personLeave(session.id, pid)
      setSession(ses)
    } catch (e) { setError(e.message) }
  }

  async function saveRate() {
    const r = parseFloat(newRate)
    if (isNaN(r) || r <= 0) return
    try {
      const g = await api.updateRate(gid, r)
      setGroup(g)
      setEditRate(false)
    } catch (e) { setError(e.message) }
  }

  function copyCode() {
    navigator.clipboard.writeText(gid).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  function addDraftPerson() {
    const name = draftName.trim()
    if (!name) return
    setDraftPeople(prev => (prev.includes(name) ? prev : [...prev, name]))
    setDraftName('')
  }

  function removeDraftPerson(name) {
    setDraftPeople(prev => prev.filter(person => person !== name))
  }

  if (!group || session === undefined) {
    return (
      <div className={s.page}>
        <div className={s.loading}>Loading…</div>
      </div>
    )
  }

  const isLive = session && !session.ended_at
  const people = session?.people || []
  const dbIntervals = session?.intervals || []
  const activePeople = people.filter(p => !p.left_at)
  const leftPeople   = people.filter(p => p.left_at)

  // Build live intervals: committed intervals + running current one
  const liveIntervals = [...dbIntervals]
  if (isLive && activePeople.length > 0) {
    liveIntervals.push({
      started_at: session.current_interval_start,
      ended_at: now,
      people_count: activePeople.length,
      rate_per_hour: group.rate_per_hour,
    })
  }

  const displayIntervals = isLive ? liveIntervals : dbIntervals

  function pCost(p) {
    return calcPersonCost(p, displayIntervals, now)
  }

  const totalCost = people.reduce((sum, p) => sum + pCost(p), 0)

  return (
    <div className={s.page}>
      {/* Header */}
      <div className={s.topBar}>
        <button className={s.backBtn} onClick={() => navigate('/')}>← Back</button>
        <h1 className={s.groupName}>{group.name}</h1>
        <button className={s.codeBtn} onClick={copyCode}>
          {copied ? '✓ Copied' : 'Copy code'}
        </button>
      </div>

      {/* Group info / rate editor */}
      <div className={s.card} style={{ marginBottom: '1rem' }}>
        {editRate ? (
          <div className={s.row}>
            <div style={{ flex: 1 }}>
              <label className={s.label}>Hourly rate (EGP/hr)</label>
              <input className={s.input} type="number" value={newRate} autoFocus
                onChange={e => setNewRate(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && saveRate()} />
            </div>
            <button className={s.btnPrimary + ' ' + s.btnSm} style={{ marginTop: 22 }} onClick={saveRate}>Save</button>
            <button className={s.btnSecondary + ' ' + s.btnSm} style={{ marginTop: 22 }} onClick={() => setEditRate(false)}>✕</button>
          </div>
        ) : (
          <div className={s.infoRow}>
            <div className={s.badge}>
              <div className={s.badgeVal}>EGP {group.rate_per_hour}</div>
              <div className={s.badgeLbl}>per hour</div>
            </div>
            <div className={s.badge}>
              <div className={s.badgeVal}>{activePeople.length}</div>
              <div className={s.badgeLbl}>in room now</div>
            </div>
            {isLive && (
              <div className={s.badge}>
                <div className={s.badgeVal}>{fmtClock(now - session.started_at)}</div>
                <div className={s.badgeLbl}>session time</div>
              </div>
            )}
            {!isLive && (
              <button className={s.editRateBtn} onClick={() => { setEditRate(true); setNewRate(group.rate_per_hour) }}>
                Edit rate
              </button>
            )}
          </div>
        )}
      </div>

      {error && <p className={s.error}>{error}</p>}

      {/* No session */}
      {!session && (
        <div className={s.card} style={{ padding: '1.25rem' }}>
          <div className={s.cardTitle}>Who's in the room?</div>
          <div className={s.addRow}>
            <input className={s.input} style={{ flex: 1 }} placeholder="Name…"
              value={draftName} onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDraftPerson()} />
            <button className={s.btnSecondary} onClick={addDraftPerson}>+ Add</button>
          </div>
          {draftPeople.length > 0 && (
            <div className={s.draftList}>
              {draftPeople.map(name => (
                <div key={name} className={s.draftItem}>
                  <span>{name}</span>
                  <button className={s.draftRemoveBtn} onClick={() => removeDraftPerson(name)}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <p className={s.emptyMsg} style={{ textAlign: 'center', marginTop: '1rem' }}>No active session</p>
          <button className={s.btnPrimary} onClick={startSession} style={{ marginTop: 12, width: '100%' }}>▶ Start Session</button>
        </div>
      )}

      {/* Session ended, show restart */}
      {session && session.ended_at && (
        <div className={s.card} style={{ padding: '1.25rem' }}>
          <div className={s.cardTitle}>Who's in the room for the next session?</div>
          <div className={s.addRow}>
            <input className={s.input} style={{ flex: 1 }} placeholder="Name…"
              value={draftName} onChange={e => setDraftName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addDraftPerson()} />
            <button className={s.btnSecondary} onClick={addDraftPerson}>+ Add</button>
          </div>
          {draftPeople.length > 0 && (
            <div className={s.draftList}>
              {draftPeople.map(name => (
                <div key={name} className={s.draftItem}>
                  <span>{name}</span>
                  <button className={s.draftRemoveBtn} onClick={() => removeDraftPerson(name)}>Remove</button>
                </div>
              ))}
            </div>
          )}
          <p className={s.emptyMsg} style={{ textAlign: 'center', marginTop: '1rem' }}>Session ended</p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <button className={s.btnSecondary} onClick={() => setShowFinal(v => !v)}>
              {showFinal ? 'Hide' : 'Show'} Final Bill
            </button>
            <button className={s.btnPrimary} onClick={startSession}>▶ New Session</button>
          </div>
        </div>
      )}

      {/* Live session */}
      {isLive && (
        <>
          <div className={s.sessionBanner}>
            <div className={s.liveDot} />
            <div style={{ flex: 1 }}>
              <div className={s.sessionTime}>{fmtClock(now - session.started_at)}</div>
              <div className={s.sessionLabel}>session running</div>
            </div>
            <button className={s.btnDanger} onClick={endSession}>End Session</button>
          </div>

          <div className={s.card} style={{ marginBottom: '1rem' }}>
            <div className={s.cardTitle}>Add person</div>
            <div className={s.addRow}>
              <input className={s.input} style={{ flex: 1 }} placeholder="Name…"
                value={newName} onChange={e => setNewName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addPerson()} />
              <button className={s.btnPrimary} onClick={addPerson}>+ Add</button>
            </div>
          </div>

          {people.length === 0 && (
            <p className={s.emptyMsg} style={{ textAlign: 'center', marginTop: '2rem' }}>Add people to start tracking</p>
          )}

          {activePeople.length > 0 && (
            <div className={s.card} style={{ marginBottom: '1rem' }}>
              <div className={s.cardTitle}>
                <span className={s.liveDot} style={{ marginRight: 6 }} />
                In the room
              </div>
              {activePeople.map(p => (
                <PersonRow key={p.id} p={p} cost={pCost(p)} isActive now={now} onLeave={() => markLeft(p.id)} />
              ))}
            </div>
          )}

          {leftPeople.length > 0 && (
            <div className={s.card} style={{ marginBottom: '1rem' }}>
              <div className={s.cardTitle}>Left</div>
              {leftPeople.map(p => (
                <PersonRow key={p.id} p={p} cost={pCost(p)} isActive={false} now={now} />
              ))}
            </div>
          )}

          <button className={s.toggleLink} onClick={() => setShowIntervals(v => !v)}>
            {showIntervals ? 'Hide billing intervals' : 'Show billing intervals'}
          </button>

          {showIntervals && (
            <div className={s.card} style={{ marginTop: '0.75rem' }}>
              <div className={s.cardTitle}>Billing intervals</div>
              {liveIntervals.length === 0
                ? <p className={s.emptyMsg}>No intervals yet</p>
                : liveIntervals.map((iv, i) => (
                  <div key={i} className={s.intervalRow}>
                    <span>#{i + 1} · {iv.people_count} {iv.people_count === 1 ? 'person' : 'people'}</span>
                    <span>{fmtDuration(iv.ended_at - iv.started_at)} · EGP {(iv.rate_per_hour / iv.people_count).toFixed(2)}/hr each</span>
                  </div>
                ))
              }
            </div>
          )}
        </>
      )}

      {/* Final bill */}
      {showFinal && session?.ended_at && (
        <div className={s.finalBill}>
          <div className={s.finalTitle}>🧾 Final Bill</div>
          {people.map(p => (
            <div key={p.id} className={s.billRow}>
              <div>
                <div className={s.billName}>{p.name}</div>
                <div className={s.billDur}>stayed {fmtDuration(p.left_at - p.joined_at)}</div>
              </div>
              <div className={s.billAmt}>{fmtEGP(pCost(p))}</div>
            </div>
          ))}
          <div className={s.billRow} style={{ borderTop: '1px solid var(--border)', marginTop: 4, paddingTop: 12 }}>
            <div className={s.billName} style={{ fontWeight: 600, color: 'var(--text)' }}>Total</div>
            <div className={s.billAmt} style={{ fontSize: 20 }}>{fmtEGP(totalCost)}</div>
          </div>
        </div>
      )}

      <div className={s.groupCode}>
        <span>Group code: </span>
        <span className={s.codeText}>{gid}</span>
        <button className={s.codeBtn} onClick={copyCode}>{copied ? '✓' : 'Copy'}</button>
      </div>
    </div>
  )
}

function PersonRow({ p, cost, isActive, onLeave, now }) {
  return (
    <div className={`${s.personCard} ${isActive ? s.personActive : s.personLeft}`}>
      <div className={s.avatar} style={{ background: avatarColor(p.name) }}>{initials(p.name)}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className={s.personName}>{p.name}</div>
        <div className={s.personSub}>
          {isActive
            ? 'joined ' + fmtDuration(now - p.joined_at) + ' ago'
            : 'stayed ' + fmtDuration(p.left_at - p.joined_at)}
        </div>
      </div>
      <div className={s.personCost + (isActive ? '' : ' ' + s.personCostFinal)}>
        {fmtEGP(cost)}
      </div>
      {isActive && (
        <button className={s.leaveBtn} onClick={onLeave}>Left</button>
      )}
    </div>
  )
}
