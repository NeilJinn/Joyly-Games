import React, { useEffect, useRef, useState } from 'react';
declare const JoylyDS: any;
const { AccountMenu, __authStore } = JoylyDS;

function WithAccount({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    __authStore.setState({
      account: { displayName: 'Neil Jinn', email: 'host@example.com' },
      entitlement: { points: 120, timePassExpiresAt: Date.now() + 3_600_000 },
      isSignedIn: true,
    });
    setReady(true);
  }, []);
  return ready ? <>{children}</> : null;
}

// Clicks the account chip to open the dropdown after auth + mount
function WithAccountOpen({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    __authStore.setState({
      account: { displayName: 'Neil Jinn', email: 'host@example.com' },
      entitlement: { points: 120, timePassExpiresAt: Date.now() + 3_600_000 },
      isSignedIn: true,
    });
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready) return;
    const btn = ref.current?.querySelector('button');
    if (btn) btn.click();
  }, [ready]);
  return ready ? <div ref={ref}>{children}</div> : null;
}

export function Chip() {
  return (
    <div style={{ padding: 24, background: '#0e1623' }}>
      <WithAccount><AccountMenu /></WithAccount>
    </div>
  );
}

export function OpenMenu() {
  return (
    <div style={{ padding: 24, background: '#0e1623', paddingBottom: 260 }}>
      <WithAccountOpen><AccountMenu /></WithAccountOpen>
    </div>
  );
}
