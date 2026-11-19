// cookieTracker.ts
export interface CookieSnapshot {
  profileId: string;
  takenAt: number;
  cookies: Array<{
    name: string;
    domain: string;
    valueHash: string; // не хранить value в открытом виде
    httpOnly: boolean;
    secure: boolean;
    expires?: number;
  }>;
}

export async function trackDeepSeekCookies(profileId: string): Promise<CookieSnapshot>;
export function diffSnapshots(prev: CookieSnapshot, next: CookieSnapshot): string[];