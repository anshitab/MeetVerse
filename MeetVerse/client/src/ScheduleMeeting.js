import React, { useState } from 'react';

function ScheduleMeeting({ onClose, onMeetingScheduled }) {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    scheduledTime: '',
    hostEmail: '',
    hostName: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const serverBase = process.env.REACT_APP_SERVER_URL || `${window.location.protocol}//${window.location.hostname}:5000`;
      const response = await fetch(`${serverBase}/schedule-meet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to schedule meeting');
      }

      // Notify parent component
      if (onMeetingScheduled) {
        onMeetingScheduled(data);
      }

      // Reset form
      setFormData({
        title: '',
        description: '',
        scheduledTime: '',
        hostEmail: '',
        hostName: ''
      });

      // Close modal
      if (onClose) {
        onClose();
      }

    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Set minimum datetime to current time
  const now = new Date();
  const minDateTime = new Date(now.getTime() + 60 * 1000).toISOString().slice(0, 16);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Schedule a Meeting</h2>
          <button className="close-button" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit} className="schedule-form">
          <div className="form-group">
            <label htmlFor="title">Meeting Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              placeholder="Enter meeting title"
            />
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Enter meeting description (optional)"
              rows="3"
            />
          </div>

          <div className="form-group">
            <label htmlFor="scheduledTime">Date & Time *</label>
            <input
              type="datetime-local"
              id="scheduledTime"
              name="scheduledTime"
              value={formData.scheduledTime}
              onChange={handleInputChange}
              min={minDateTime}
              required
            />
          </div>

          <div className="form-group">
            <label htmlFor="hostEmail">Host Email *</label>
            <input
              type="email"
              id="hostEmail"
              name="hostEmail"
              value={formData.hostEmail}
              onChange={handleInputChange}
              required
              placeholder="Enter your email address"
            />
          </div>

          <div className="form-group">
            <label htmlFor="hostName">Host Name</label>
            <input
              type="text"
              id="hostName"
              name="hostName"
              value={formData.hostName}
              onChange={handleInputChange}
              placeholder="Enter your name (optional)"
            />
          </div>

          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button" disabled={isLoading}>
              {isLoading ? 'Scheduling...' : 'Schedule Meeting'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ScheduleMeeting;
