import { HashRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import MeetingPage from './MeetingPage';
import Auth from './Auth';
import MeetingHistory from './MeetingHistory';


function Root() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/join" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/history" element={<MeetingHistory />} />
        <Route path="/meet/:meetingId" element={<MeetingPage />} />
      </Routes>
    </Router>

  );
}

export default Root;
