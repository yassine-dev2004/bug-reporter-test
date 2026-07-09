import React, { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'

export default function AdminDashboard() {
  const router = useRouter()
  
  // Existing Server Admin State
  const [password, setPassword] = useState('')
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [data, setData] = useState<any>(null)
  const [stats, setStats] = useState<any>(null)
  const [connected, setConnected] = useState(false)
  const socketRef = useRef<any>(null)

  // Bug Reporter API Configuration & State
  const bugApiUrl = process.env.NEXT_PUBLIC_BUG_REPORTER_API_URL || 'http://localhost:8081'
  const [activeTab, setActiveTab] = useState<'server' | 'bugs'>('server')
  const [bugToken, setBugToken] = useState('')
  const [bugUsername, setBugUsername] = useState('admin')
  const [bugPassword, setBugPassword] = useState('admin')
  const [bugLoginError, setBugLoginError] = useState('')
  const [bugIsLoggingIn, setBugIsLoggingIn] = useState(false)
  
  const [projects, setProjects] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null)
  const [ticketDetails, setTicketDetails] = useState<any>(null)
  const [projectFilter, setProjectFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  // New Project Form State
  const [newProjName, setNewProjName] = useState('')
  const [newProjOrigins, setNewProjOrigins] = useState('')
  const [newProjActive, setNewProjActive] = useState(true)
  const [projectMessage, setProjectMessage] = useState('')

  // Check for saved Bug Reporter token on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('bug-reporter-jwt')
    if (savedToken) {
      setBugToken(savedToken)
    }
  }, [])

  // Existing Server Socket Connection Effect
  useEffect(() => {
    const { getSocket } = require('../lib/socket')
    const socket = getSocket()
    socketRef.current = socket

    setConnected(socket.connected)
    socket.on('connect', () => setConnected(true))
    socket.on('disconnect', () => setConnected(false))

    // Public stats (no password needed)
    socket.emit('get-stats')
    socket.on('stats', (res: any) => {
      setStats(res)
    })

    socket.on('admin-data', (res: any) => {
      setData(res)
      setIsAuthorized(true)
      setIsLoggingIn(false)
      setLoginError('')
    })

    socket.on('admin-error', (err: any) => {
      setLoginError(err.message)
      setIsLoggingIn(false)
      if (isAuthorized) {
        setIsAuthorized(false)
        alert(err.message)
      }
    })

    const interval = setInterval(() => {
      socket.emit('get-stats')
      if (isAuthorized) {
        socket.emit('admin-get-data', { password: '' })
      }
    }, 5000)

    return () => {
      clearInterval(interval)
      socket.off('stats')
      socket.off('admin-data')
      socket.off('admin-error')
      socket.off('connect')
      socket.off('disconnect')
    }
  }, [isAuthorized, password])

  // Fetch Bug Reporter data when token or filters change
  const fetchProjects = async (token: string) => {
    try {
      const res = await fetch(`${bugApiUrl}/api/projects`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const list = await res.json()
        setProjects(list)
      } else if (res.status === 401) {
        handleBugLogout()
      }
    } catch (err) {
      console.error("Failed to fetch projects:", err)
    }
  }

  const fetchTickets = async (token: string, projId?: string, status?: string) => {
    try {
      let url = `${bugApiUrl}/api/tickets`
      const params = new URLSearchParams()
      if (projId) params.append('projectId', projId)
      if (status) params.append('status', status)
      const query = params.toString()
      if (query) url += `?${query}`

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
      if (res.ok) {
        const list = await res.json()
        setTickets(list)
      }
    } catch (err) {
      console.error("Failed to fetch tickets:", err)
    }
  }

  useEffect(() => {
    if (bugToken) {
      fetchProjects(bugToken)
      fetchTickets(bugToken, projectFilter, statusFilter)
    }
  }, [bugToken, projectFilter, statusFilter])

  // Fetch individual ticket details when selected
  useEffect(() => {
    if (bugToken && selectedTicketId !== null) {
      const fetchDetails = async () => {
        try {
          const res = await fetch(`${bugApiUrl}/api/tickets/${selectedTicketId}`, {
            headers: { 'Authorization': `Bearer ${bugToken}` }
          })
          if (res.ok) {
            const detail = await res.json()
            setTicketDetails(detail)
          }
        } catch (err) {
          console.error("Error fetching ticket details:", err)
        }
      }
      fetchDetails()
    } else {
      setTicketDetails(null)
    }
  }, [bugToken, selectedTicketId])

  // Bug Reporter Authentication Handlers
  const handleBugLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setBugIsLoggingIn(true)
    setBugLoginError('')
    try {
      const res = await fetch(`${bugApiUrl}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: bugUsername, password: bugPassword })
      })
      const data = await res.json()
      if (res.ok && data.token) {
        localStorage.setItem('bug-reporter-jwt', data.token)
        setBugToken(data.token)
      } else {
        setBugLoginError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      setBugLoginError('Could not connect to Bug Reporter API')
    } finally {
      setBugIsLoggingIn(false)
    }
  }

  const handleBugLogout = () => {
    localStorage.removeItem('bug-reporter-jwt')
    setBugToken('')
    setProjects([])
    setTickets([])
    setSelectedTicketId(null)
    setTicketDetails(null)
  }

  // Bug Reporter Project Handlers
  const handleCreateProject = async (e: React.FormEvent) => {
    e.preventDefault()
    setProjectMessage('')
    if (!newProjName.trim()) return
    try {
      const res = await fetch(`${bugApiUrl}/api/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${bugToken}`
        },
        body: JSON.stringify({
          name: newProjName,
          allowedOrigins: newProjOrigins,
          active: newProjActive
        })
      })
      if (res.ok) {
        setProjectMessage('Project created successfully!')
        setNewProjName('')
        setNewProjOrigins('')
        fetchProjects(bugToken)
      } else {
        const errorData = await res.json()
        setProjectMessage(errorData.error || 'Failed to create project')
      }
    } catch (err) {
      setProjectMessage('Network error creating project')
    }
  }

  const handleRegenKey = async (id: number) => {
    if (!confirm('Are you sure you want to regenerate the project key? Existing widgets using the old key will stop working.')) return
    try {
      const res = await fetch(`${bugApiUrl}/api/projects/${id}/regenerate-key`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${bugToken}` }
      })
      if (res.ok) {
        alert('Project key regenerated successfully!')
        fetchProjects(bugToken)
      } else {
        alert('Failed to regenerate key')
      }
    } catch (err) {
      alert('Network error')
    }
  }

  // Bug Reporter Ticket Handlers
  const handleUpdateTicketStatus = async (id: number, status: string) => {
    try {
      const res = await fetch(`${bugApiUrl}/api/tickets/${id}/status?status=${status}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${bugToken}` }
      })
      if (res.ok) {
        fetchTickets(bugToken, projectFilter, statusFilter)
        // Refresh details
        const detailsRes = await fetch(`${bugApiUrl}/api/tickets/${id}`, {
          headers: { 'Authorization': `Bearer ${bugToken}` }
        })
        if (detailsRes.ok) {
          const detail = await detailsRes.json()
          setTicketDetails(detail)
        }
      }
    } catch (err) {
      alert('Network error updating status')
    }
  }

  // Existing Server Handlers
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault()
    if (password && socketRef.current) {
      setIsLoggingIn(true)
      setLoginError('')
      socketRef.current.emit('admin-get-data', { password })
    }
  }

  const handleBan = (ip: string) => {
    const reason = prompt('Reason for ban:', 'Repeated abuse reports')
    if (reason && socketRef.current) {
      socketRef.current.emit('admin-ban-ip', { ip, reason, password })
    }
  }

  const handleUnban = (ip: string) => {
    if (confirm(`Unban IP ${ip}?`) && socketRef.current) {
      socketRef.current.emit('admin-unban-ip', { ip, password })
    }
  }

  const handleExport = () => {
    if (!data?.visitors || data.visitors.length === 0) {
      alert('No visitor data to export.')
      return
    }

    const header = "OmegleCams Visitor History Export\nGenerated: " + new Date().toLocaleString() + "\n" + "-".repeat(50) + "\n\n"
    const content = data.visitors.map((v: any) => 
        `IP: ${v.ip.padEnd(20)} | Visits: ${String(v.visits).padEnd(5)} | First Seen: ${new Date(v.firstSeen).toLocaleString()} | Last Seen: ${new Date(v.lastSeen).toLocaleString()}`
    ).join('\n')

    const blob = new Blob([header + content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `visitor_history_${new Date().toISOString().split('T')[0]}.txt`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Key copied to clipboard!')
  }

  if (!isAuthorized) {
    return (
      <div style={{
        height: '100dvh', backgroundColor: '#09090b', display: 'flex',
        alignItems: 'center', justifyContent: 'center', color: '#fff', fontFamily: 'Inter, sans-serif'
      }}>
        <form onSubmit={handleLogin} style={{
          backgroundColor: '#18181b', padding: '32px', borderRadius: '16px',
          border: '1px solid #27272a', width: '100%', maxWidth: '360px'
        }}>
          <h1 style={{ fontSize: '20px', fontWeight: 800, marginBottom: '20px', textAlign: 'center' }}>Admin Access</h1>
          {loginError && (
            <div style={{
              backgroundColor: loginError.includes('Configuration Error') ? '#7c2d12' : '#450a0a', 
              border: loginError.includes('Configuration Error') ? '1px solid #d97706' : '1px solid #7f1d1d', 
              color: loginError.includes('Configuration Error') ? '#fef3c7' : '#fca5a5',
              padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', textAlign: 'center',
              fontWeight: 600
            }}>
              {loginError}
            </div>
          )}
          <input
            type="password"
            placeholder="Enter Admin Password"
            value={password}
            onChange={(e) => {
                setPassword(e.target.value)
                if (loginError) setLoginError('')
            }}
            disabled={isLoggingIn}
            style={{
              width: '100%', padding: '12px', background: '#09090b', border: '1px solid #27272a',
              borderRadius: '8px', color: '#fff', marginBottom: '16px', outline: 'none',
              opacity: isLoggingIn ? 0.5 : 1
            }}
          />
          <button 
            disabled={isLoggingIn}
            style={{
              width: '100%', padding: '12px', background: isLoggingIn ? '#1e3a8a' : '#2563eb', border: 'none',
              borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: isLoggingIn ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {isLoggingIn ? 'Verifying...' : 'Login'}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div style={{
      minHeight: '100dvh', backgroundColor: '#09090b', color: '#e4e4e7',
      padding: '40px 20px', fontFamily: 'Inter, sans-serif'
    }}>
      <Head>
        <title>OmegleCams | Owner Dashboard</title>
      </Head>

      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        {/* Dashboard Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px' }}>
          <div>
            <h1 style={{ fontSize: '28px', fontWeight: 900, color: '#fff' }}>Owner Dashboard</h1>
            <p style={{ color: '#71717a' }}>Private management console</p>
          </div>
          
          <div style={{ display: 'flex', gap: '32px', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444' }}></div>
              <div style={{ fontSize: '11px', fontWeight: 600, color: connected ? '#22c55e' : '#ef4444', textTransform: 'uppercase' }}>
                {connected ? 'Live' : 'Offline'}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '32px' }}>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#22c55e' }}>{stats?.online || 0}</div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52525b' }}>Total</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#60a5fa' }}>{stats?.waiting || 0}</div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52525b' }}>Waiting</div>
              </div>
              <div>
                <div style={{ fontSize: '24px', fontWeight: 800, color: '#a78bfa' }}>{stats?.chatting || 0}</div>
                <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#52525b' }}>Chatting</div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: '16px', marginBottom: '32px', borderBottom: '1px solid #27272a', paddingBottom: '12px' }}>
          <button
            onClick={() => setActiveTab('server')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'server' ? '#27272a' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === 'server' ? '#fff' : '#a1a1aa',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Server & Ban Controls
          </button>
          <button
            onClick={() => setActiveTab('bugs')}
            style={{
              padding: '8px 16px',
              background: activeTab === 'bugs' ? '#27272a' : 'transparent',
              border: 'none',
              borderRadius: '8px',
              color: activeTab === 'bugs' ? '#fff' : '#a1a1aa',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
          >
            Bug Reports dashboard
          </button>
        </div>

        {/* Server & Ban Controls View */}
        {activeTab === 'server' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', marginBottom: '40px' }}>
              {/* Recent Reports */}
              <div style={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid #27272a', paddingBottom: '12px' }}>Recent Reports</h2>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {data?.logs?.length > 0 ? (
                    data.logs.map((log: any, i: number) => (
                      <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fca5a5' }}>IP: {log.reportedIp}</div>
                          <div style={{ fontSize: '11px', color: '#71717a' }}>{new Date(log.timestamp).toLocaleString()} • Room: {log.roomId}</div>
                        </div>
                        <button
                          onClick={() => handleBan(log.reportedIp)}
                          style={{ padding: '6px 12px', background: '#3f1515', border: '1px solid #7f1d1d', color: '#ef4444', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Ban IP
                        </button>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#52525b', textAlign: 'center', padding: '40px 0' }}>No reports logged yet.</p>
                  )}
                </div>
              </div>

              {/* Active Bans */}
              <div style={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '24px' }}>
                <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid #27272a', paddingBottom: '12px' }}>Banned IPs</h2>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  {data?.bans?.length > 0 ? (
                    data.bans.map((ban: any, i: number) => (
                      <div key={i} style={{ padding: '12px 0', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: '14px', fontWeight: 600, color: '#fff' }}>{ban.ip}</div>
                          <div style={{ fontSize: '11px', color: '#71717a' }}>{ban.reason} • {new Date(ban.timestamp).toLocaleDateString()}</div>
                        </div>
                        <button
                          onClick={() => handleUnban(ban.ip)}
                          style={{ padding: '6px 12px', background: '#09090b', border: '1px solid #27272a', color: '#a1a1aa', borderRadius: '6px', fontSize: '12px', cursor: 'pointer' }}
                        >
                          Unban
                        </button>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: '#52525b', textAlign: 'center', padding: '40px 0' }}>No active bans.</p>
                  )}
                </div>
              </div>
            </div>
            
            {/* Active Connections */}
            <div style={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '24px', marginTop: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid #27272a', paddingBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                Active Connections
                <span style={{ fontSize: '11px', background: '#27272a', padding: '2px 8px', borderRadius: '100px', color: '#a1a1aa' }}>{data?.activeUsers?.length || 0}</span>
              </h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' }}>
                {data?.activeUsers?.length > 0 ? (
                  data.activeUsers.map((user: any, i: number) => (
                    <div key={user.id} style={{ 
                      backgroundColor: '#09090b', padding: '16px', borderRadius: '12px', border: '1px solid #27272a',
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                    }}>
                      <div>
                        <div style={{ fontSize: '14px', fontWeight: 700, color: '#fff', marginBottom: '4px' }}>{user.ip}</div>
                        <div style={{ fontSize: '11px', color: '#52525b' }}>ID: {user.id.slice(0, 8)}... • Online since {new Date(user.connectedAt).toLocaleTimeString()}</div>
                      </div>
                      <button
                        onClick={() => handleBan(user.ip)}
                        style={{ 
                            padding: '6px 10px', background: 'transparent', border: '1px solid #450a0a', 
                            color: '#ef4444', borderRadius: '6px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' 
                        }}
                      >
                        Quick Ban
                      </button>
                    </div>
                  ))
                ) : (
                  <p style={{ color: '#52525b', textAlign: 'center', gridColumn: '1 / -1', padding: '20px 0' }}>No active visitors tracked.</p>
                )}
              </div>
            </div>

            {/* Visitor History */}
            <div style={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '24px', marginTop: '24px' }}>
              <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '20px', borderBottom: '1px solid #27272a', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center' }}>
                    Lifetime Visitor History
                    <span style={{ fontSize: '11px', background: '#27272a', padding: '2px 8px', borderRadius: '100px', color: '#a1a1aa', marginLeft: '10px' }}>
                    {data?.visitors?.length || 0} unique
                    </span>
                </div>
                <button 
                    onClick={handleExport}
                    style={{
                        padding: '6px 14px', background: '#09090b', border: '1px solid #27272a', 
                        color: '#fff', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer',
                        transition: 'border 0.2s'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = '#52525b'}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = '#27272a'}
                >
                    Export TXT
                </button>
              </h2>
              <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                  <thead>
                    <tr style={{ textAlign: 'left', color: '#71717a', borderBottom: '1px solid #27272a' }}>
                      <th style={{ padding: '12px 8px' }}>IP Address</th>
                      <th style={{ padding: '12px 8px' }}>Visits</th>
                      <th style={{ padding: '12px 8px' }}>First Seen</th>
                      <th style={{ padding: '12px 8px' }}>Last Seen</th>
                      <th style={{ padding: '12px 8px', textAlign: 'right' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.visitors?.length > 0 ? (
                      data.visitors.map((visitor: any, i: number) => (
                        <tr key={i} style={{ borderBottom: '1px solid #27272a', color: '#e4e4e7' }}>
                          <td style={{ padding: '12px 8px', fontFamily: 'monospace', color: '#fff' }}>{visitor.ip}</td>
                          <td style={{ padding: '12px 8px' }}>{visitor.visits}</td>
                          <td style={{ padding: '12px 8px', color: '#71717a', fontSize: '12px' }}>{new Date(visitor.firstSeen).toLocaleDateString()}</td>
                          <td style={{ padding: '12px 8px', color: '#71717a', fontSize: '12px' }}>{new Date(visitor.lastSeen).toLocaleString()}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            <button
                              onClick={() => handleBan(visitor.ip)}
                              style={{ padding: '4px 10px', background: '#18181b', border: '1px solid #7f1d1d', color: '#ef4444', borderRadius: '6px', fontSize: '11px', cursor: 'pointer' }}
                            >
                              Ban
                            </button>
                          </td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '40px 0', color: '#52525b' }}>No history recorded yet.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Quick Ban */}
            <div style={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '24px', marginTop: '24px' }}>
                 <h2 style={{ fontSize: '16px', fontWeight: 700, marginBottom: '16px' }}>Quick Ban via IP</h2>
                 <div style={{ display: 'flex', gap: '12px' }}>
                    <input
                      id="quick-ban-ip"
                      type="text"
                      placeholder="0.0.0.0"
                      style={{ flex: 1, padding: '12px', background: '#09090b', border: '1px solid #27272a', borderRadius: '8px', color: '#fff' }}
                    />
                    <button
                      onClick={() => {
                        const el = document.getElementById('quick-ban-ip') as HTMLInputElement
                        if (el.value) { handleBan(el.value); el.value = ''; }
                      }}
                      style={{ padding: '0 24px', background: '#2563eb', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer' }}
                    >
                      Apply Ban
                    </button>
                 </div>
            </div>
          </>
        )}

        {/* Bug Reports Dashboard View */}
        {activeTab === 'bugs' && (
          <div style={{ fontFamily: 'Inter, sans-serif' }}>
            {!bugToken ? (
              /* Bug Reporter Login Panel */
              <div style={{ display: 'flex', justifyContent: 'center', padding: '40px 0' }}>
                <form onSubmit={handleBugLogin} style={{
                  backgroundColor: '#18181b', border: '1px solid #27272a', padding: '32px',
                  borderRadius: '16px', width: '100%', maxWidth: '380px'
                }}>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: 800, color: '#fff', textAlign: 'center' }}>Bug Reporter API Login</h3>
                  <p style={{ margin: '0 0 24px 0', fontSize: '12px', color: '#71717a', textAlign: 'center', lineHeight: '1.5' }}>
                    Please authenticate with your Bug Reporter backend credentials to manage projects and tickets.
                  </p>
                  
                  {bugLoginError && (
                    <div style={{
                      backgroundColor: '#450a0a', border: '1px solid #7f1d1d', color: '#fca5a5',
                      padding: '12px', borderRadius: '8px', marginBottom: '16px', fontSize: '13px', textAlign: 'center',
                      fontWeight: 600
                    }}>
                      {bugLoginError}
                    </div>
                  )}

                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>Username</label>
                  <input
                    type="text"
                    value={bugUsername}
                    onChange={(e) => setBugUsername(e.target.value)}
                    style={{
                      width: '100%', padding: '12px', background: '#09090b', border: '1px solid #27272a',
                      borderRadius: '8px', color: '#fff', marginBottom: '16px', outline: 'none'
                    }}
                  />

                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#a1a1aa', marginBottom: '6px' }}>Password</label>
                  <input
                    type="password"
                    value={bugPassword}
                    onChange={(e) => setBugPassword(e.target.value)}
                    style={{
                      width: '100%', padding: '12px', background: '#09090b', border: '1px solid #27272a',
                      borderRadius: '8px', color: '#fff', marginBottom: '24px', outline: 'none'
                    }}
                  />

                  <button
                    disabled={bugIsLoggingIn}
                    style={{
                      width: '100%', padding: '12px', background: '#2563eb', border: 'none',
                      borderRadius: '8px', color: '#fff', fontWeight: 600, cursor: 'pointer',
                      transition: 'background 0.2s'
                    }}
                  >
                    {bugIsLoggingIn ? 'Connecting...' : 'Sign In'}
                  </button>
                </form>
              </div>
            ) : (
              /* Authenticated Bug Dashboard */
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', backgroundColor: '#18181b', padding: '12px 24px', borderRadius: '12px', border: '1px solid #27272a' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
                    <span style={{ color: '#71717a' }}>API Endpoint:</span>
                    <code style={{ background: '#09090b', padding: '4px 8px', borderRadius: '6px', border: '1px solid #27272a' }}>{bugApiUrl}</code>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', marginLeft: '8px' }}></span>
                    <span style={{ color: '#22c55e', fontWeight: 600, fontSize: '11px', textTransform: 'uppercase' }}>Connected</span>
                  </div>
                  <button
                    onClick={handleBugLogout}
                    style={{ padding: '6px 14px', background: '#27272a', color: '#f3f4f6', border: 'none', borderRadius: '8px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                  >
                    Logout API
                  </button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr 1fr', gap: '24px', alignItems: 'start' }}>
                  {/* Left Column: Projects */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div style={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '20px' }}>
                      <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#fff', borderBottom: '1px solid #27272a', paddingBottom: '10px' }}>Projects</h3>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '320px', overflowY: 'auto', marginBottom: '16px' }}>
                        {projects.length > 0 ? (
                          projects.map((proj) => (
                            <div key={proj.id} style={{ padding: '12px', backgroundColor: '#09090b', borderRadius: '10px', border: '1px solid #27272a' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                                <strong style={{ fontSize: '14px', color: '#fff' }}>{proj.name}</strong>
                                <span style={{
                                  fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '100px',
                                  background: proj.active ? 'rgba(34, 197, 94, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                  color: proj.active ? '#22c55e' : '#ef4444'
                                }}>
                                  {proj.active ? 'ACTIVE' : 'DISABLED'}
                                </span>
                              </div>
                              <div style={{ fontSize: '11px', color: '#71717a', wordBreak: 'break-all', marginBottom: '8px' }}>
                                Key: <code style={{ color: '#f59e0b' }}>{proj.projectKey}</code>
                              </div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                  onClick={() => copyToClipboard(proj.projectKey)}
                                  style={{ flex: 1, padding: '4px', background: '#27272a', border: 'none', borderRadius: '4px', fontSize: '10px', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
                                >
                                  Copy Key
                                </button>
                                <button
                                  onClick={() => handleRegenKey(proj.id)}
                                  style={{ flex: 1, padding: '4px', background: 'transparent', border: '1px solid #27272a', borderRadius: '4px', fontSize: '10px', color: '#a1a1aa', cursor: 'pointer' }}
                                >
                                  Regen Key
                                </button>
                              </div>
                            </div>
                          ))
                        ) : (
                          <div style={{ fontSize: '12px', color: '#52525b', textAlign: 'center', padding: '20px 0' }}>No projects registered.</div>
                        )}
                      </div>

                      {/* Create Project Form */}
                      <form onSubmit={handleCreateProject} style={{ borderTop: '1px solid #27272a', paddingTop: '16px' }}>
                        <h4 style={{ margin: '0 0 12px 0', fontSize: '13px', color: '#fff' }}>Create New Project</h4>
                        <input
                          type="text"
                          placeholder="Project Name (e.g. OmegleCams)"
                          value={newProjName}
                          onChange={(e) => setNewProjName(e.target.value)}
                          style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', color: '#fff', fontSize: '12px', marginBottom: '10px', outline: 'none' }}
                        />
                        <input
                          type="text"
                          placeholder="Allowed Origins (comma-separated)"
                          value={newProjOrigins}
                          onChange={(e) => setNewProjOrigins(e.target.value)}
                          style={{ width: '100%', padding: '10px', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', color: '#fff', fontSize: '12px', marginBottom: '10px', outline: 'none' }}
                        />
                        
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                          <input
                            type="checkbox"
                            id="proj-active-check"
                            checked={newProjActive}
                            onChange={(e) => setNewProjActive(e.target.checked)}
                            style={{ cursor: 'pointer' }}
                          />
                          <label htmlFor="proj-active-check" style={{ fontSize: '12px', color: '#a1a1aa', cursor: 'pointer' }}>Active on creation</label>
                        </div>

                        <button
                          style={{ width: '100%', padding: '8px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
                        >
                          Create Project
                        </button>
                        {projectMessage && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: projectMessage.includes('successfully') ? '#22c55e' : '#fca5a5', textAlign: 'center' }}>
                            {projectMessage}
                          </div>
                        )}
                      </form>
                    </div>
                  </div>

                  {/* Middle Column: Tickets List */}
                  <div style={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    <h3 style={{ margin: '0', fontSize: '15px', fontWeight: 800, color: '#fff', borderBottom: '1px solid #27272a', paddingBottom: '10px' }}>Tickets</h3>
                    
                    {/* Filters */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                      <select
                        value={projectFilter}
                        onChange={(e) => setProjectFilter(e.target.value)}
                        style={{ padding: '8px', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                      >
                        <option value="">All Projects</option>
                        {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                      </select>
                      <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        style={{ padding: '8px', background: '#09090b', border: '1px solid #27272a', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                      >
                        <option value="">All Statuses</option>
                        <option value="open">Open</option>
                        <option value="in progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                    </div>

                    {/* List */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '520px', overflowY: 'auto' }}>
                      {tickets.length > 0 ? (
                        tickets.map((t) => (
                          <div
                            key={t.id}
                            onClick={() => setSelectedTicketId(t.id)}
                            style={{
                              padding: '12px', backgroundColor: selectedTicketId === t.id ? '#27272a' : '#09090b',
                              borderRadius: '10px', border: '1px solid #27272a', cursor: 'pointer',
                              transition: 'all 0.2s', borderLeft: selectedTicketId === t.id ? '4px solid #2563eb' : '1px solid #27272a'
                            }}
                          >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                              <strong style={{ fontSize: '13px', color: '#fff' }}>#{t.id} - {t.projectName}</strong>
                              <span style={{
                                fontSize: '8px', fontWeight: 700, padding: '2px 6px', borderRadius: '100px',
                                background: t.status === 'resolved' ? 'rgba(34, 197, 94, 0.15)' : t.status === 'in progress' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                color: t.status === 'resolved' ? '#22c55e' : t.status === 'in progress' ? '#3b82f6' : '#ef4444',
                                textTransform: 'uppercase'
                              }}>
                                {t.status}
                              </span>
                            </div>
                            <div style={{ fontSize: '11px', color: '#a1a1aa', marginBottom: '6px', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Cat: {t.category || 'N/A'}</span>
                              <span>{new Date(t.createdAt).toLocaleDateString()}</span>
                            </div>
                            <div style={{ fontSize: '12px', color: '#71717a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {t.description || 'No description provided.'}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div style={{ fontSize: '12px', color: '#52525b', textAlign: 'center', padding: '40px 0' }}>No tickets found matching filters.</div>
                      )}
                    </div>
                  </div>

                  {/* Right Column: Ticket Detail */}
                  <div style={{ backgroundColor: '#18181b', borderRadius: '16px', border: '1px solid #27272a', padding: '20px', minHeight: '380px' }}>
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 800, color: '#fff', borderBottom: '1px solid #27272a', paddingBottom: '10px' }}>Ticket details</h3>

                    {ticketDetails ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: '#fff' }}>Ticket #{ticketDetails.id}</span>
                            <span style={{ fontSize: '11px', color: '#71717a' }}>{new Date(ticketDetails.createdAt).toLocaleString()}</span>
                          </div>
                          <span style={{ fontSize: '12px', color: '#a1a1aa' }}>Project: {ticketDetails.projectName}</span>
                        </div>

                        {/* Status update actions */}
                        <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #27272a', paddingBottom: '12px' }}>
                          <button
                            onClick={() => handleUpdateTicketStatus(ticketDetails.id, 'open')}
                            disabled={ticketDetails.status === 'open'}
                            style={{ flex: 1, padding: '6px', background: '#3f1515', border: '1px solid #7f1d1d', borderRadius: '6px', color: '#ef4444', fontSize: '11px', fontWeight: 600, cursor: 'pointer', opacity: ticketDetails.status === 'open' ? 0.3 : 1 }}
                          >
                            Mark Open
                          </button>
                          <button
                            onClick={() => handleUpdateTicketStatus(ticketDetails.id, 'in-progress')}
                            disabled={ticketDetails.status === 'in progress'}
                            style={{ flex: 1, padding: '6px', background: '#1e3a8a', border: '1px solid #1e40af', borderRadius: '6px', color: '#60a5fa', fontSize: '11px', fontWeight: 600, cursor: 'pointer', opacity: ticketDetails.status === 'in progress' ? 0.3 : 1 }}
                          >
                            In Progress
                          </button>
                          <button
                            onClick={() => handleUpdateTicketStatus(ticketDetails.id, 'resolved')}
                            disabled={ticketDetails.status === 'resolved'}
                            style={{ flex: 1, padding: '6px', background: '#064e3b', border: '1px solid #065f46', borderRadius: '6px', color: '#34d399', fontSize: '11px', fontWeight: 600, cursor: 'pointer', opacity: ticketDetails.status === 'resolved' ? 0.3 : 1 }}
                          >
                            Resolve
                          </button>
                        </div>

                        {/* Details Grid */}
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', padding: '12px', background: '#09090b', borderRadius: '8px', border: '1px solid #27272a' }}>
                          <div>
                            <span style={{ color: '#71717a', display: 'block' }}>Reporter:</span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{ticketDetails.username || 'Anonymous'}</span>
                          </div>
                          <div>
                            <span style={{ color: '#71717a', display: 'block' }}>Category:</span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>{ticketDetails.category || 'N/A'}</span>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ color: '#71717a', display: 'block' }}>Source URL:</span>
                            <a href={ticketDetails.url} target="_blank" rel="noreferrer" style={{ color: '#3b82f6', textDecoration: 'none', wordBreak: 'break-all', fontWeight: 600 }}>
                              {ticketDetails.url || 'N/A'}
                            </a>
                          </div>
                          <div style={{ gridColumn: '1 / -1' }}>
                            <span style={{ color: '#71717a', display: 'block' }}>Browser User Agent:</span>
                            <span style={{ color: '#e4e4e7', fontFamily: 'monospace', fontSize: '10px' }}>{ticketDetails.browser || 'N/A'}</span>
                          </div>
                          {ticketDetails.ipAddress && (
                            <div style={{ gridColumn: '1 / -1' }}>
                              <span style={{ color: '#71717a', display: 'block' }}>Reporter IP:</span>
                              <span style={{ color: '#fff', fontFamily: 'monospace' }}>{ticketDetails.ipAddress}</span>
                            </div>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <strong style={{ fontSize: '13px', color: '#fff', display: 'block', marginBottom: '6px' }}>Bug Description</strong>
                          <div style={{ padding: '12px', background: '#09090b', borderRadius: '8px', border: '1px solid #27272a', fontSize: '13px', color: '#e4e4e7', whiteSpace: 'pre-wrap', lineHeight: '1.5' }}>
                            {ticketDetails.description || 'No description provided.'}
                          </div>
                        </div>

                        {/* Console Logs */}
                        {ticketDetails.consoleLogs && (
                          <div>
                            <strong style={{ fontSize: '13px', color: '#fff', display: 'block', marginBottom: '6px' }}>Console Logs</strong>
                            <pre style={{
                              padding: '12px', background: '#09090b', borderRadius: '8px', border: '1px solid #27272a',
                              fontSize: '11px', color: '#f87171', overflowX: 'auto', fontFamily: 'monospace', margin: '0'
                            }}>
                              {ticketDetails.consoleLogs}
                            </pre>
                          </div>
                        )}

                        {/* Attachments */}
                        {ticketDetails.attachments && ticketDetails.attachments.length > 0 && (
                          <div>
                            <strong style={{ fontSize: '13px', color: '#fff', display: 'block', marginBottom: '6px' }}>Attachments</strong>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                              {ticketDetails.attachments.map((att: any) => (
                                <div key={att.id} style={{
                                  border: '1px solid #27272a', borderRadius: '8px', padding: '8px',
                                  backgroundColor: '#09090b', display: 'flex', flexDirection: 'column', alignItems: 'center'
                                }}>
                                  {att.contentType.startsWith('image/') ? (
                                    <img
                                      src={att.fileUrl.startsWith('http') ? att.fileUrl : `${bugApiUrl}${att.fileUrl}`}
                                      alt="Screenshot"
                                      style={{ maxWidth: '140px', maxHeight: '140px', borderRadius: '4px', cursor: 'pointer' }}
                                      onClick={() => window.open(att.fileUrl.startsWith('http') ? att.fileUrl : `${bugApiUrl}${att.fileUrl}`, '_blank')}
                                    />
                                  ) : (
                                    <a
                                      href={att.fileUrl.startsWith('http') ? att.fileUrl : `${bugApiUrl}${att.fileUrl}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      style={{ color: '#3b82f6', fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}
                                    >
                                      Download File
                                    </a>
                                  )}
                                  <span style={{ fontSize: '9px', color: '#52525b', marginTop: '4px' }}>{(att.size / 1024).toFixed(1)} KB</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* AI Analysis Section */}
                        {ticketDetails.analysis ? (
                          <div style={{
                            marginTop: '12px', padding: '16px', borderRadius: '12px', border: '1px solid #f59e0b',
                            backgroundColor: 'rgba(245, 158, 11, 0.05)', display: 'flex', flexDirection: 'column', gap: '12px'
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <h4 style={{ fontSize: '14px', color: '#f59e0b', margin: 0, fontWeight: 800 }}>🤖 AI Agent Analysis</h4>
                              <span style={{
                                fontSize: '10px', background: '#f59e0b', color: '#000', padding: '2px 8px',
                                borderRadius: '100px', fontWeight: 800, textTransform: 'uppercase'
                              }}>
                                {ticketDetails.analysis.severity} severity
                              </span>
                            </div>

                            <div style={{ fontSize: '13px' }}>
                              <strong style={{ color: '#fff', display: 'block', marginBottom: '2px' }}>Summary:</strong>
                              <p style={{ margin: '0', color: '#a1a1aa', lineHeight: '1.4' }}>{ticketDetails.analysis.summary}</p>
                            </div>

                            <div style={{ fontSize: '13px' }}>
                              <strong style={{ color: '#fff', display: 'block', marginBottom: '2px' }}>Root Cause:</strong>
                              <p style={{ margin: '0', color: '#a1a1aa', lineHeight: '1.4' }}>{ticketDetails.analysis.rootCause}</p>
                            </div>

                            <div style={{ fontSize: '13px' }}>
                              <strong style={{ color: '#fff', display: 'block', marginBottom: '6px' }}>Suggested Fix:</strong>
                              <pre style={{
                                margin: '0', padding: '10px', background: '#09090b', border: '1px solid #27272a',
                                borderRadius: '6px', overflowX: 'auto', fontFamily: 'monospace', color: '#38bdf8', fontSize: '11px'
                              }}>
                                {ticketDetails.analysis.suggestedFix}
                              </pre>
                            </div>

                            <div style={{ fontSize: '11px', color: '#52525b', display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(245, 158, 11, 0.1)', paddingTop: '8px' }}>
                              <span>Confidence: {ticketDetails.analysis.confidence}%</span>
                              <span>Model: {ticketDetails.analysis.model}</span>
                            </div>
                          </div>
                        ) : (
                          <div style={{
                            marginTop: '12px', padding: '16px', border: '1px dashed #27272a',
                            borderRadius: '12px', textAlign: 'center', color: '#52525b', fontSize: '12px'
                          }}>
                            Waiting for AI analysis... (Ensure Python worker is running)
                          </div>
                        )}
                      </div>
                    ) : (
                      <div style={{ color: '#52525b', textAlign: 'center', padding: '80px 0', fontSize: '13px' }}>
                        Select a ticket from the list to view complete details, logs, screenshots, and AI debugging analysis.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

