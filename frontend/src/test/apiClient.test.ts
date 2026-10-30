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

  it('fetches model status for Weeks 3-4 prediction engine', async () => {
    const mockStatus = {
      service_status: 'operational',
      model_version: 'v1.2.0-ensemble-quantile',
      targets: [
        'target_food_packets_required',
        'target_water_liters_required',
        'target_medical_kits_required',
        'target_shelter_spaces_required',
      ],
      features_count: 18,
      excel_workbook_path: 'dataset/disaster_resource_demand_dataset.xlsx',
      excel_workbook_size_bytes: 418000,
      evaluations: {},
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockStatus,
    });

    const result = await api.getModelStatus();
    expect(result.service_status).toBe('operational');
    expect(result.targets.length).toBe(4);
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/predictions/status'),
      expect.any(Object)
    );
  });

  it('posts scenario simulation requests properly', async () => {
    const mockScenario = {
      scenario_id: 'SCEN-TEST',
      scenario_name: 'Test Scenario',
      comparisons: {},
      drivers_narrative: 'Testing',
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => mockScenario,
    });

    const result = await api.simulateScenario({
      scenario_name: 'Test Scenario',
      population_multiplier: 1.2,
      planning_horizon_days: 5,
    });

    expect(result.scenario_id).toBe('SCEN-TEST');
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/predictions/scenarios'),
      expect.objectContaining({
        method: 'POST',
      })
    );
  });
});

