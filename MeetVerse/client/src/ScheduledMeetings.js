import React, { useState, useEffect } from 'react';

function ScheduledMeetings({ hostEmail }) {
  const [meetings, setMeetings] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (hostEmail) {
      fetchScheduledMeetings();
    }
  }, [hostEmail]);

  const fetchScheduledMeetings = async () => {
    try {
      setIsLoading(true);
      const serverBase = process.env.REACT_APP_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
      const response = await fetch(`${serverBase}/scheduled-meetings/${encodeURIComponent(hostEmail)}`);
      const data = await response.json();
      
      if (response.ok) {
        setMeetings(data);
      } else {
        setError(data.error || 'Failed to fetch meetings');
      }
    } catch (err) {
      setError('Failed to fetch meetings');
    } finally {
      setIsLoading(false);
    }
  };

  const cancelMeeting = async (meetingId) => {
    if (!window.confirm('Are you sure you want to cancel this meeting?')) {
      return;
    }

    try {
      const serverBase = process.env.REACT_APP_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
      const response = await fetch(`${serverBase}/scheduled-meeting/${meetingId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        setMeetings(prev => prev.filter(meeting => meeting.id !== meetingId));
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to cancel meeting');
      }
    } catch (err) {
      alert('Failed to cancel meeting');
    }
  };

  const formatDateTime = (dateTimeString) => {
    const date = new Date(dateTimeString);
    return date.toLocaleString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'scheduled': return '#28c76f';
      case 'active': return '#6c8cff';
      case 'completed': return '#a78bfa';
      case 'cancelled': return '#ff4d6d';
      default: return '#6c8cff';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'scheduled': return 'Scheduled';
      case 'active': return 'In Progress';
      case 'completed': return 'Completed';
      case 'cancelled': return 'Cancelled';
      default: return 'Unknown';
    }
  };

  if (!hostEmail) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h3>My Scheduled Meetings</h3>
        <p className="subtle">Please enter your email to view scheduled meetings.</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h3>My Scheduled Meetings</h3>
        <p className="subtle">Loading...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h3>My Scheduled Meetings</h3>
        <p className="subtle" style={{ color: '#ff4d6d' }}>{error}</p>
        <button className="button" onClick={fetchScheduledMeetings}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0 }}>My Scheduled Meetings</h3>
        <button className="button secondary" onClick={fetchScheduledMeetings}>
          Refresh
        </button>
      </div>

      {meetings.length === 0 ? (
        <p className="subtle">No scheduled meetings found.</p>
      ) : (
        <div className="meetings-list">
          {meetings.map(meeting => (
            <div key={meeting.id} className="meeting-card" style={{ marginBottom: 12 }}>
              <div className="meeting-header">
                <div className="meeting-title">
                  <h4 style={{ margin: 0, fontSize: '1.1em' }}>{meeting.title}</h4>
                  <span 
                    className="meeting-status" 
                    style={{ 
                      color: getStatusColor(meeting.status),
                      fontSize: '0.9em',
                      fontWeight: '500'
                    }}
                  >
                    {getStatusText(meeting.status)}
                  </span>
                </div>
                <div className="meeting-time">
                  <span className="subtle">{formatDateTime(meeting.scheduledTime)}</span>
                </div>
              </div>

              {meeting.description && (
                <p className="meeting-description" style={{ margin: '8px 0', fontSize: '0.95em' }}>
                  {meeting.description}
                </p>
              )}

              <div className="meeting-actions" style={{ marginTop: 12 }}>
                <a 
                  href={meeting.meetingLink} 
                  className="button"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Join Meeting
                </a>
                {meeting.status === 'scheduled' && (
                  <button 
                    className="button secondary" 
                    onClick={() => cancelMeeting(meeting.id)}
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ScheduledMeetings;
