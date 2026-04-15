import { Client } from '@heroiclabs/nakama-js';

const host = import.meta.env.VITE_NAKAMA_HOST || 'localhost';
const port = import.meta.env.VITE_NAKAMA_PORT || '7350';
const serverKey = import.meta.env.VITE_NAKAMA_SERVER_KEY || 'defaultkey';
const ssl = import.meta.env.VITE_NAKAMA_SSL === 'true';

export const nakamaClient = new Client(serverKey, host, port, ssl);
