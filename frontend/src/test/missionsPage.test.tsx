import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MissionsPage } from '../pages/MissionsPage';

vi.mock('../api/client', () => ({
  api: {
    listMissions: vi.fn().mockResolvedValue([
      {
        id: 'msn-test-1',
        mission_code: 'MSN-2026-DEL-001',
        status: 'IN_TRANSIT',
        depot_name: 'New Delhi Depot',
        zone_identifier: 'Assam Sector A',
        distance_km: 1200,
        est_duration_hours: 24,
        team_leader: 'Capt. R. Sharma',
        vehicle_type: 'Heavy Cargo Truck',
        manifest: { food_packets: 5000, water_liters: 10000 },
        created_at: new Date().toISOString(),
      },
    ]),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('MissionsPage', () => {
  it('renders relief missions board and list item', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MissionsPage />
      </QueryClientProvider>
    );

    expect(screen.getByText(/Relief Mission Operations Panel/i)).toBeInTheDocument();
    expect(await screen.findByText('MSN-2026-DEL-001')).toBeInTheDocument();
    expect(screen.getByText(/New Delhi Depot/i)).toBeInTheDocument();
    expect(screen.getAllByText(/IN TRANSIT/i).length).toBeGreaterThan(0);
  });
});
