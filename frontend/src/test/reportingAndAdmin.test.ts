import { describe, it, expect, vi, beforeEach } from 'vitest';
import { api } from '../api/client';

describe('Disaster Reporting and Admin Review API Client', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('authenticates user and attaches token to subsequent headers', async () => {
    const mockToken = {
      access_token: 'test-jwt-token-xyz',
      token_type: 'bearer',
      user: {
        id: 'u-123',
        email: 'reporter@emergency.gov',
        full_name: 'Priya Sharma',
        role: 'reporter',
        is_active: true,
        created_at: '2026-10-27T00:00:00Z',
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockToken,
    });

    const res = await api.login({
      email: 'reporter@emergency.gov',
      password: 'Reporter@1234',
    });
    expect(res.access_token).toBe('test-jwt-token-xyz');
    expect(res.user.role).toBe('reporter');

    // Simulate storing token in localStorage
    localStorage.setItem('emergency_token', res.access_token);

    // Call submitReport
    const mockReport = {
      id: 'rep-uuid-1',
      report_code: 'REP-20241027-A1B2',
      disaster_type: 'flood',
      title: 'Flash Flood in Majuli',
      status: 'PENDING_REVIEW',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 201,
      json: async () => mockReport,
    });

    await api.submitReport({
      disaster_type: 'flood',
      title: 'Flash Flood in Majuli',
      description: 'Water submerging 4 villages',
      location_name: 'Majuli Island, Assam',
      latitude: 26.95,
      longitude: 94.20,
      occurred_at: '2026-10-27T10:00:00Z',
    });

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/reports'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-jwt-token-xyz',
        }),
      })
    );
  });

  it('admin reviews a report and triggers assessReportAndPredict', async () => {
    localStorage.setItem('emergency_token', 'admin-token-abc');

    const mockAssessmentResponse = {
      report: {
        id: 'rep-uuid-1',
        report_code: 'REP-20241027-A1B2',
        status: 'ACCEPTED_FOR_ASSESSMENT',
      },
      associated_event_id: 'ev-uuid-999',
      predictions: [
        {
          zone_id: 'ZONE-A1',
          planning_horizon_days: 3,
          model_version: 'v1.2.0-ensemble-quantile',
          resource_demands: {
            food_packets: { predicted_demand: 12000, unit: 'packets' },
            water_liters: { predicted_demand: 36000, unit: 'liters' },
            medical_kits: { predicted_demand: 320, unit: 'kits' },
            shelter_spaces: { predicted_demand: 950, unit: 'spaces' },
          },
        },
      ],
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockAssessmentResponse,
    });

    const assessment = await api.assessReportAndPredict('rep-uuid-1', 3, true);

    expect(assessment.associated_event_id).toBe('ev-uuid-999');
    expect(assessment.predictions[0].resource_demands.food_packets.predicted_demand).toBe(12000);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/reports/rep-uuid-1/assess-and-predict?planning_horizon_days=3&apply_vulnerability_buffer=true'),
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer admin-token-abc',
        }),
      })
    );
  });
});
