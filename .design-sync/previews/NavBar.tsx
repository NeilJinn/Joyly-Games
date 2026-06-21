import React from 'react';
declare const JoylyDS: any;
const { NavBar, __Router, __authStore, __roomStore } = JoylyDS;

function WithAuth({ withRoom, children }: { withRoom?: boolean; children: React.ReactNode }) {
  const [ready, setReady] = React.useState(false);
  React.useEffect(() => {
    __authStore.setState({
      account: { displayName: 'Neil', email: 'host@example.com' },
      entitlement: { points: 120, timePassExpiresAt: Date.now() + 3_600_000 },
      isSignedIn: true,
    });
    if (withRoom) {
      __roomStore.setState({ room: { code: '482901', selectedGame: { id: 'cosmic-trivia', title: 'Cosmic Trivia' } } });
    } else {
      __roomStore.setState({ room: null });
    }
    setReady(true);
  }, []);
  return ready ? <>{children}</> : null;
}

// Shows NavBar with authenticated user — account chip replaces Sign In button
export function SignedIn() {
  return (
    <__Router>
      <div style={{ background: '#0e1623' }}>
        <WithAuth>
          <NavBar floating={false} onPlay={() => {}} />
        </WithAuth>
      </div>
    </__Router>
  );
}

// Shows NavBar when a room is active — "Room 482901 · Cosmic Trivia" pill + account chip
export function WithRoom() {
  return (
    <__Router>
      <div style={{ background: '#0e1623' }}>
        <WithAuth withRoom>
          <NavBar floating={false} />
        </WithAuth>
      </div>
    </__Router>
  );
}
