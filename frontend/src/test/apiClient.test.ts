import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api/client';

describe('API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches health check successfully', async () => {
    const mockHealth = { status: 'ok', version: '0.1.0', module: 'Weeks 1–2' };
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockHealth,
    });

    const result = await api.getHealth();
    expect(result.status).toBe('ok');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/health'),
      expect.any(Object)
    );
  });

  it('formats event filtering query parameters properly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [],
    });

    await api.getEvents({ event_type: 'flood', source: 'GDACS', limit: 50 });
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/events?event_type=flood&source=GDACS&limit=50'),
      expect.any(Object)
    );
  });
});
