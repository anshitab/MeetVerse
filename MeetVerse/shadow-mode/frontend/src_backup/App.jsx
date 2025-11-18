import React from "react";
import { useParams } from "react-router-dom";
import ShadowMode from "./components/ShadowMode";
import { useAuth } from "./context/AuthContext"; // adjust import to your project

export default function App() {
  // 1. Get meetingId from route:  /meeting/:meetingId
  const { meetingId } = useParams();

  // 2. Get logged in userId
  const { user } = useAuth(); // must give you: user.id
  const userId = user?.id;

  // 3. If no meetingId → don't load anything
  if (!meetingId) {
    return (
      <div style={{ padding: 40, color: "#fff" }}>
        <h2>❌ No Meeting ID Found</h2>
        <p>This page must be opened from a valid meeting link.</p>
      </div>
    );
  }

  // 4. If user not logged in
  if (!userId) {
    return (
      <div style={{ padding: 40, color: "#fff" }}>
        <h2>🔐 Please login to continue</h2>
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", background: "#0b1020" }}>
      {/* Your Video Meeting UI */}
      <div style={{ padding: 20, color: "white" }}>
        <h1>MeetVerse</h1>
        <p>Meeting ID: {meetingId}</p>
        <p>User: {userId}</p>
      </div>

      {/* Shadow Mode Floating Panel */}
      <ShadowMode meetingId={meetingId} userId={userId} />
    </div>
  );
}
