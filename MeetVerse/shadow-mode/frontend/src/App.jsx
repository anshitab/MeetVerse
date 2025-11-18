import React from 'react'
import ShadowMode from './components/ShadowMode'

function App() {
  // Example usage - in real app, get from props/context
  const meetingId = 'example-meeting-123'
  const userId = 'user-123'

  return (
    <div style={{ padding: 20, minHeight: '100vh', background: '#0b1020' }}>
      <h1>Shadow Mode Demo</h1>
      <p>Enable Shadow Mode in the bottom-right corner</p>
      <ShadowMode meetingId={meetingId} userId={userId} />
    </div>
  )
}

export default App

