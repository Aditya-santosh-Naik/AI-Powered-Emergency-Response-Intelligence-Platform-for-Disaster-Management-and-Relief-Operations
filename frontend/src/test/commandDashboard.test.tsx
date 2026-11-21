import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CommandDashboardPage } from '../pages/CommandDashboardPage';
import { AuthProvider } from '../context/AuthContext';

vi.mock('../api/client', () => ({
  api: {
    getOperationsOverview: vi.fn().mockResolvedValue({
      active_alerts_count: 5,
      critical_events_count: 2,
      high_priority_zones_count: 8,
      depots_active_count: 5,
      total_stock: { food_packets: 10000, water: 25000 },
      active_missions_count: 3,
      gdacs_status: 'Connected',
      system_status: 'Operational',
    }),
    getEvents: vi.fn().mockResolvedValue([]),
    getAllocationPlans: vi.fn().mockResolvedValue([]),
    listOverrides: vi.fn().mockResolvedValue([]),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

describe('CommandDashboardPage', () => {
  it('renders command center title and operational solver components', async () => {
    render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <BrowserRouter>
            <CommandDashboardPage />
          </BrowserRouter>
        </AuthProvider>
      </QueryClientProvider>
    );

    expect(screen.getByText(/Disaster Logistics Command Center/i)).toBeInTheDocument();
    expect(screen.getByText(/OR-Tools MILP Solver/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Commander Priority Override/i).length).toBeGreaterThan(0);
  });
});
