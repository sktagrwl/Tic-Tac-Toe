import { nakamaClient } from './nakamaClient';
import type { Session } from '@heroiclabs/nakama-js';

export async function registerEmail(
  email: string,
  password: string,
  username: string
): Promise<Session> {
  const session = await nakamaClient.authenticateEmail(
    email,
    password,
    true,       // create account if it doesn't exist
    username
  );
  return session;
}

export async function loginEmail(
  email: string,
  password: string
): Promise<Session> {
  const session = await nakamaClient.authenticateEmail(
    email,
    password,
    false       // do NOT create — fail if account doesn't exist
  );
  return session;
}

export async function authenticateGoogle(idToken: string): Promise<Session> {
  const session = await nakamaClient.authenticateGoogle(idToken, true);
  return session;
}
