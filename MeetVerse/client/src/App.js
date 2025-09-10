import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Home from './Home';
import MeetingPage from './MeetingPage';
import Auth from './Auth';

function Root() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/auth" element={<Auth />} />
        <Route path="/meet/:meetingId" element={<MeetingPage />} />
      </Routes>
    </Router>

  );
}

export default Root;
