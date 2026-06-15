export interface Entitlement {
  points: number;
  hasActiveTimePass: boolean;
  timePassExpiresAt: number;
}

export interface HostAccount {
  email: string;
  displayName: string;
}
