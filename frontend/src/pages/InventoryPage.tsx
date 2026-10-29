import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Boxes,
  Warehouse,
  Plus,
  ArrowUpDown,
  Trash2,
  PackageCheck,
  Droplet,
  HeartPulse,
  Truck,
  Users,
  AlertCircle,
  X,
} from "lucide-react";
import { api } from "../api/client";
import type { Depot } from "../types";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/ui/EmptyState";

export const InventoryPage: React.FC = () => {
  const queryClient = useQueryClient();

  // Modal states
  const [isAddDepotOpen, setIsAddDepotOpen] = useState(false);
  const [adjustingDepot, setAdjustingDepot] = useState<Depot | null>(null);
  const [selectedResourceType, setSelectedResourceType] = useState<string>("");
  const [quantityDelta, setQuantityDelta] = useState<number>(0);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // New Depot form state
  const [newDepotName, setNewDepotName] = useState("");
  const [newDepotLat, setNewDepotLat] = useState("");
  const [newDepotLon, setNewDepotLon] = useState("");
  const [newDepotAddress, setNewDepotAddress] = useState("");

  // Queries
  const { data: summary = [] } = useQuery({
    queryKey: ["inventory-summary"],
    queryFn: api.getInventorySummary,
  });

  const { data: depots = [], isLoading: depotsLoading } = useQuery({
    queryKey: ["depots"],
    queryFn: api.getDepots,
  });

  const { data: resourceTypes = [] } = useQuery({
    queryKey: ["resource-types"],
    queryFn: api.getResourceTypes,
  });

  // Selected depot inventory query
  const { data: depotInventory = [] } = useQuery({
    queryKey: ["depot-inventory", adjustingDepot?.id],
    queryFn: () => (adjustingDepot ? api.getDepotInventory(adjustingDepot.id) : []),
    enabled: !!adjustingDepot,
  });

  // Mutations
  const createDepotMutation = useMutation({
    mutationFn: api.createDepot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depots"] });
      setIsAddDepotOpen(false);
      setNewDepotName("");
      setNewDepotLat("");
      setNewDepotLon("");
      setNewDepotAddress("");
    },
  });

  const deleteDepotMutation = useMutation({
    mutationFn: api.deleteDepot,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depots"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
    },
  });

  const adjustStockMutation = useMutation({
    mutationFn: ({ depotId, rtId, delta }: { depotId: string; rtId: string; delta: number }) =>
      api.adjustInventory(depotId, rtId, delta),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["depot-inventory", adjustingDepot?.id] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      setQuantityDelta(0);
      setAdjustError(null);
    },
    onError: (err: any) => {
      setAdjustError(err.message || "Adjustment rejected.");
    },
  });

  const getResourceIcon = (name: string) => {
    switch (name) {
      case "food_packets":
        return <PackageCheck className="h-4 w-4 text-amber-400" />;
      case "water":
        return <Droplet className="h-4 w-4 text-sky-400" />;
      case "medical_kits":
        return <HeartPulse className="h-4 w-4 text-pink-400" />;
      case "rescue_vehicles":
        return <Truck className="h-4 w-4 text-purple-400" />;
      case "personnel":
        return <Users className="h-4 w-4 text-emerald-400" />;
      default:
        return <Boxes className="h-4 w-4 text-qc-text-tertiary" />;
    }
  };

  const formatResourceLabel = (name: string) => {
    return name
      .split("_")
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  };

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingDepot || !selectedResourceType || quantityDelta === 0) return;
    setAdjustError(null);
    adjustStockMutation.mutate({
      depotId: adjustingDepot.id,
      rtId: selectedResourceType,
      delta: Number(quantityDelta),
    });
  };

  const handleCreateDepot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDepotName || !newDepotLat || !newDepotLon) return;
    createDepotMutation.mutate({
      name: newDepotName,
      latitude: parseFloat(newDepotLat),
      longitude: parseFloat(newDepotLon),
      address: newDepotAddress || undefined,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 text-qc-text-primary">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-4 border-b border-qc-border-subtle">
        <div>
          <div className="flex items-center space-x-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-sky-950/60 border border-sky-800/80 flex items-center justify-center text-qc-accent">
              <Boxes className="h-4 w-4" />
            </div>
            <h1 className="text-xl font-bold tracking-tight text-qc-text-primary">
              Logistics & Stock Inventory
            </h1>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-qc-surface-2 text-qc-text-secondary border border-qc-border-subtle">
              R3 LOGISTICS
            </span>
          </div>
          <p className="text-xs text-qc-text-secondary max-w-2xl leading-relaxed">
            Track strategic regional relief depots and live stockpile levels across 5 essential disaster supply classifications with non-negative constraints.
          </p>
        </div>

        <Button
          variant="primary"
          size="sm"
          icon={Plus}
          onClick={() => setIsAddDepotOpen(true)}
        >
          Add Logistics Depot
        </Button>
      </div>

      {/* Aggregate Inventory Totals Cards */}
      <div>
        <h2 className="text-[11px] font-mono font-semibold text-qc-text-tertiary uppercase tracking-wider mb-3">
          Network Aggregate Stock Totals
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          {summary.map((item) => (
            <div
              key={item.resource_type_id}
              className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-4 flex flex-col justify-between shadow-md"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-qc-text-secondary">
                  {formatResourceLabel(item.resource_type_name)}
                </span>
                {getResourceIcon(item.resource_type_name)}
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-sans text-qc-text-primary tabular-nums">
                  {item.total_quantity.toLocaleString()}
                </div>
                <div className="text-[10px] text-qc-text-tertiary font-mono mt-0.5">
                  {item.resource_type_unit}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logistics Depots Section */}
      <div className="space-y-4">
        <h2 className="text-[11px] font-mono font-semibold text-qc-text-tertiary uppercase tracking-wider">
          Strategic Logistics Depots ({depots.length})
        </h2>

        {depotsLoading ? (
          <div className="p-12 text-center text-xs text-qc-text-tertiary bg-qc-surface-1 rounded-xl border border-qc-border-subtle">
            Loading logistics depots...
          </div>
        ) : depots.length === 0 ? (
          <EmptyState
            title="No Depots Registered"
            description="No logistics facilities found. Click 'Add Logistics Depot' to register a regional relief staging depot."
            action={
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                onClick={() => setIsAddDepotOpen(true)}
              >
                Register Depot
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {depots.map((d) => (
              <div
                key={d.id}
                className="bg-qc-surface-1 border border-qc-border-subtle rounded-xl p-5 space-y-4 shadow-lg flex flex-col justify-between hover:border-qc-border-strong transition"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 rounded-lg bg-qc-surface-2 border border-qc-border-strong flex items-center justify-center text-qc-accent">
                        <Warehouse className="h-4 w-4" />
                      </div>
                      <h3 className="font-semibold text-qc-text-primary text-sm leading-snug">{d.name}</h3>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-700/80 text-emerald-300 uppercase">
                      {d.status}
                    </span>
                  </div>

                  {d.address && (
                    <p className="text-xs text-qc-text-secondary mt-2.5 leading-relaxed">
                      {d.address}
                    </p>
                  )}

                  <div className="text-[10px] font-mono text-qc-text-tertiary mt-2">
                    Coordinates: {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                  </div>
                </div>

                <div className="pt-3 border-t border-qc-border-subtle flex items-center justify-between">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={ArrowUpDown}
                    onClick={() => {
                      setAdjustingDepot(d);
                      setSelectedResourceType(resourceTypes[0]?.id || "");
                      setQuantityDelta(0);
                      setAdjustError(null);
                    }}
                  >
                    Adjust Stock
                  </Button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete depot "${d.name}"?`)) {
                        deleteDepotMutation.mutate(d.id);
                      }
                    }}
                    className="text-qc-text-tertiary hover:text-red-400 p-1.5 rounded-md hover:bg-qc-surface-2 transition"
                    title="Delete Depot"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Adjust Stock Modal */}
      {adjustingDepot && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-qc-surface-1 border border-qc-border-strong rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-qc-border-subtle pb-3">
              <div>
                <h3 className="text-base font-bold text-qc-text-primary">Adjust Depot Stock</h3>
                <p className="text-xs text-qc-text-secondary mt-0.5">{adjustingDepot.name}</p>
              </div>
              <button
                onClick={() => setAdjustingDepot(null)}
                className="text-qc-text-tertiary hover:text-qc-text-primary p-1 rounded-md hover:bg-qc-surface-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Depot Inventory List */}
            <div className="space-y-2">
              <div className="text-[10px] font-mono font-semibold text-qc-text-tertiary uppercase tracking-wider">
                Current On-Hand Quantities
              </div>
              <div className="grid grid-cols-2 gap-2 bg-qc-surface-2 p-3 rounded-xl border border-qc-border-subtle">
                {depotInventory.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-1">
                    <span className="text-qc-text-secondary">{formatResourceLabel(item.resource_type_name || "")}:</span>
                    <span className="font-mono font-bold text-qc-text-primary tabular-nums">
                      {item.quantity.toLocaleString()} {item.resource_type_unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Adjustment Form */}
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-qc-text-secondary mb-1.5">
                  Resource Category
                </label>
                <select
                  value={selectedResourceType}
                  onChange={(e) => setSelectedResourceType(e.target.value)}
                  className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-2 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
                >
                  {resourceTypes.map((rt) => (
                    <option key={rt.id} value={rt.id} className="bg-qc-surface-2">
                      {formatResourceLabel(rt.name)} ({rt.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-qc-text-secondary mb-1.5">
                  Quantity Adjustment (positive to replenish, negative to dispatch)
                </label>
                <input
                  type="number"
                  value={quantityDelta || ""}
                  onChange={(e) => setQuantityDelta(parseInt(e.target.value, 10) || 0)}
                  placeholder="e.g. 500 or -250"
                  className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-2 text-xs text-qc-text-primary font-mono focus:outline-none focus:border-qc-accent"
                />
                <p className="text-[11px] text-qc-text-tertiary mt-1 leading-relaxed">
                  Strict non-negative constraint: transactions reducing stock below zero are immediately rejected by database constraint (Requirement R3.4).
                </p>
              </div>

              {adjustError && (
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-2.5 pt-2 border-t border-qc-border-subtle">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setAdjustingDepot(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={adjustStockMutation.isPending}
                  disabled={quantityDelta === 0}
                >
                  Confirm Stock Adjustment
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Depot Modal */}
      {isAddDepotOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-qc-surface-1 border border-qc-border-strong rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between border-b border-qc-border-subtle pb-3">
              <h3 className="text-base font-bold text-qc-text-primary">Create New Logistics Depot</h3>
              <button
                onClick={() => setIsAddDepotOpen(false)}
                className="text-qc-text-tertiary hover:text-qc-text-primary p-1 rounded-md hover:bg-qc-surface-2"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDepot} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-qc-text-secondary mb-1">Facility Name</label>
                <input
                  type="text"
                  required
                  value={newDepotName}
                  onChange={(e) => setNewDepotName(e.target.value)}
                  placeholder="e.g. Northern Regional Staging Depot"
                  className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-qc-text-secondary mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDepotLat}
                    onChange={(e) => setNewDepotLat(e.target.value)}
                    placeholder="26.1445"
                    className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary font-mono focus:outline-none focus:border-qc-accent"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-qc-text-secondary mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDepotLon}
                    onChange={(e) => setNewDepotLon(e.target.value)}
                    placeholder="91.7362"
                    className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary font-mono focus:outline-none focus:border-qc-accent"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-qc-text-secondary mb-1">Facility Address</label>
                <input
                  type="text"
                  value={newDepotAddress}
                  onChange={(e) => setNewDepotAddress(e.target.value)}
                  placeholder="e.g. Industrial Area, Beltola"
                  className="w-full bg-qc-surface-2 border border-qc-border-subtle rounded-md px-3 py-1.5 text-xs text-qc-text-primary focus:outline-none focus:border-qc-accent"
                />
              </div>

              <div className="flex justify-end space-x-2.5 pt-3 border-t border-qc-border-subtle">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsAddDepotOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  loading={createDepotMutation.isPending}
                >
                  Save Depot
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
