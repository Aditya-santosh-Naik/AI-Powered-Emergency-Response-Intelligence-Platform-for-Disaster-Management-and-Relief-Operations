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
        return <PackageCheck className="h-5 w-5 text-amber-400" />;
      case "water":
        return <Droplet className="h-5 w-5 text-blue-400" />;
      case "medical_kits":
        return <HeartPulse className="h-5 w-5 text-red-400" />;
      case "rescue_vehicles":
        return <Truck className="h-5 w-5 text-purple-400" />;
      case "personnel":
        return <Users className="h-5 w-5 text-emerald-400" />;
      default:
        return <Boxes className="h-5 w-5 text-slate-400" />;
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <Boxes className="h-6 w-6 text-blue-500" />
            <span>Resource Inventory Management</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track supplies, logistics depots, and real-time depot stock across 5 core emergency resource categories (R3).
          </p>
        </div>

        <button
          onClick={() => setIsAddDepotOpen(true)}
          className="flex items-center space-x-2 bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg shadow-blue-900/30 self-start"
        >
          <Plus className="h-4 w-4" />
          <span>Add Logistics Depot</span>
        </button>
      </div>

      {/* Aggregate Inventory Totals Cards */}
      <div>
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
          Network Aggregate Supply Totals
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {summary.map((item) => (
            <div
              key={item.resource_type_id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col justify-between shadow-lg"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-400">{formatResourceLabel(item.resource_type_name)}</span>
                {getResourceIcon(item.resource_type_name)}
              </div>
              <div className="mt-3">
                <div className="text-2xl font-bold font-mono text-white">
                  {item.total_quantity.toLocaleString()}
                </div>
                <div className="text-[11px] text-slate-500 font-mono mt-0.5">{item.resource_type_unit}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logistics Depots Section */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Strategic Logistics Depots ({depots.length})
        </h2>

        {depotsLoading ? (
          <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
            Loading depots...
          </div>
        ) : depots.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
            No depots recorded. Click "Add Logistics Depot" to create one.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {depots.map((d) => (
              <div
                key={d.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-8 w-8 rounded-lg bg-blue-950 border border-blue-800 flex items-center justify-center text-blue-400">
                        <Warehouse className="h-4 w-4" />
                      </div>
                      <h3 className="font-bold text-white text-sm">{d.name}</h3>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-400 uppercase">
                      {d.status}
                    </span>
                  </div>

                  {d.address && <p className="text-xs text-slate-400 mt-2.5">{d.address}</p>}

                  <div className="text-[11px] font-mono text-slate-500 mt-2">
                    Coordinates: {d.latitude.toFixed(4)}, {d.longitude.toFixed(4)}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <button
                    onClick={() => {
                      setAdjustingDepot(d);
                      setSelectedResourceType(resourceTypes[0]?.id || "");
                      setQuantityDelta(0);
                      setAdjustError(null);
                    }}
                    className="flex items-center space-x-1.5 text-xs bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 px-3 py-1.5 rounded-lg transition"
                  >
                    <ArrowUpDown className="h-3.5 w-3.5 text-blue-400" />
                    <span>Adjust Stock</span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm(`Delete depot "${d.name}"?`)) {
                        deleteDepotMutation.mutate(d.id);
                      }
                    }}
                    className="text-slate-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-slate-800 transition"
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
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Adjust Depot Stock</h3>
                <p className="text-xs text-slate-400 mt-0.5">{adjustingDepot.name}</p>
              </div>
              <button
                onClick={() => setAdjustingDepot(null)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current Depot Inventory List */}
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                Current On-Hand Quantities
              </div>
              <div className="grid grid-cols-2 gap-2 bg-slate-950 p-3 rounded-xl border border-slate-800">
                {depotInventory.map((item) => (
                  <div key={item.id} className="flex justify-between items-center text-xs p-1.5">
                    <span className="text-slate-400">{formatResourceLabel(item.resource_type_name || "")}:</span>
                    <span className="font-mono font-bold text-white">
                      {item.quantity.toLocaleString()} {item.resource_type_unit}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Adjustment Form */}
            <form onSubmit={handleAdjustSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">Resource Category</label>
                <select
                  value={selectedResourceType}
                  onChange={(e) => setSelectedResourceType(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {resourceTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {formatResourceLabel(rt.name)} ({rt.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1.5">
                  Quantity Adjustment (positive to add stock, negative to dispatch/consume)
                </label>
                <input
                  type="number"
                  value={quantityDelta || ""}
                  onChange={(e) => setQuantityDelta(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 500 or -250"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
                <p className="text-[11px] text-slate-500 mt-1">
                  Enforces non-negative constraint: negative adjustments exceeding on-hand stock are strictly rejected (Requirement R3.4).
                </p>
              </div>

              {adjustError && (
                <div className="flex items-center space-x-2 p-3 rounded-lg bg-red-950/80 border border-red-800 text-red-300 text-xs">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{adjustError}</span>
                </div>
              )}

              <div className="flex justify-end space-x-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAdjustingDepot(null)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={adjustStockMutation.isPending || quantityDelta === 0}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {adjustStockMutation.isPending ? "Applying..." : "Confirm Adjustment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Depot Modal */}
      {isAddDepotOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Create New Logistics Depot</h3>
              <button
                onClick={() => setIsAddDepotOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDepot} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Depot Facility Name</label>
                <input
                  type="text"
                  required
                  value={newDepotName}
                  onChange={(e) => setNewDepotName(e.target.value)}
                  placeholder="e.g. Northern Regional Staging Depot"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDepotLat}
                    onChange={(e) => setNewDepotLat(e.target.value)}
                    placeholder="26.1445"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    required
                    value={newDepotLon}
                    onChange={(e) => setNewDepotLon(e.target.value)}
                    placeholder="91.7362"
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Facility Address / Location</label>
                <input
                  type="text"
                  value={newDepotAddress}
                  onChange={(e) => setNewDepotAddress(e.target.value)}
                  placeholder="e.g. Industrial Area, Beltola"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddDepotOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDepotMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {createDepotMutation.isPending ? "Creating..." : "Save Depot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
