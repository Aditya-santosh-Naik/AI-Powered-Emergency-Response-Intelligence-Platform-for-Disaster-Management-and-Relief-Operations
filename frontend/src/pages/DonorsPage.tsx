import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  HeartHandshake,
  Plus,
  Building2,
  Mail,
  Phone,
  Gift,
  X,
} from "lucide-react";
import { api } from "../api/client";
import type { Donor } from "../types";

export const DonorsPage: React.FC = () => {
  const queryClient = useQueryClient();

  const [isAddDonorOpen, setIsAddDonorOpen] = useState(false);
  const [isRecordDonationOpen, setIsRecordDonationOpen] = useState(false);
  const [selectedDonorForDonation, setSelectedDonorForDonation] = useState<Donor | null>(null);

  // New Donor Form state
  const [donorName, setDonorName] = useState("");
  const [donorOrg, setDonorOrg] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");

  // Donation Form state
  const [targetDepotId, setTargetDepotId] = useState("");
  const [targetResourceTypeId, setTargetResourceTypeId] = useState("");
  const [donationQuantity, setDonationQuantity] = useState<number>(100);
  const [donationNotes, setDonationNotes] = useState("");

  // Queries
  const { data: donors = [], isLoading: donorsLoading } = useQuery({
    queryKey: ["donors"],
    queryFn: api.getDonors,
  });

  const { data: donations = [], isLoading: donationsLoading } = useQuery({
    queryKey: ["donations"],
    queryFn: () => api.getDonations(),
  });

  const { data: depots = [] } = useQuery({
    queryKey: ["depots"],
    queryFn: api.getDepots,
  });

  const { data: resourceTypes = [] } = useQuery({
    queryKey: ["resource-types"],
    queryFn: api.getResourceTypes,
  });

  // Mutations
  const createDonorMutation = useMutation({
    mutationFn: api.createDonor,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donors"] });
      setIsAddDonorOpen(false);
      setDonorName("");
      setDonorOrg("");
      setDonorEmail("");
      setDonorPhone("");
    },
  });

  const recordDonationMutation = useMutation({
    mutationFn: api.recordDonation,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["donations"] });
      queryClient.invalidateQueries({ queryKey: ["inventory-summary"] });
      queryClient.invalidateQueries({ queryKey: ["depots"] });
      setIsRecordDonationOpen(false);
      setSelectedDonorForDonation(null);
      setDonationQuantity(100);
      setDonationNotes("");
    },
  });

  const handleCreateDonor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim()) return;
    createDonorMutation.mutate({
      name: donorName,
      organization: donorOrg || undefined,
      email: donorEmail || undefined,
      phone: donorPhone || undefined,
    });
  };

  const handleRecordDonation = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDonorForDonation || !targetDepotId || !targetResourceTypeId || donationQuantity <= 0) return;
    recordDonationMutation.mutate({
      donor_id: selectedDonorForDonation.id,
      depot_id: targetDepotId,
      resource_type_id: targetResourceTypeId,
      quantity: Number(donationQuantity),
      donated_at: new Date().toISOString(),
      notes: donationNotes || undefined,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center space-x-2.5">
            <HeartHandshake className="h-6 w-6 text-pink-500" />
            <span>Donor Registry & Relief Aid Consignments</span>
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Track humanitarian donors, bilateral aid partners, and log incoming supply consignments that automatically replenish depot inventory (Requirement D1).
          </p>
        </div>

        <button
          onClick={() => setIsAddDonorOpen(true)}
          className="flex items-center space-x-2 bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition shadow-lg shadow-pink-900/30 self-start"
        >
          <Plus className="h-4 w-4" />
          <span>Register Donor Entity</span>
        </button>
      </div>

      {/* Donors Grid */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Registered Relief Donors ({donors.length})
        </h2>

        {donorsLoading ? (
          <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
            Loading donors...
          </div>
        ) : donors.length === 0 ? (
          <div className="p-12 text-center text-slate-400 bg-slate-900 rounded-xl border border-slate-800">
            No donors registered yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {donors.map((d) => (
              <div
                key={d.id}
                className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4 shadow-xl flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center space-x-2.5">
                      <div className="h-9 w-9 rounded-lg bg-pink-950 border border-pink-800 flex items-center justify-center text-pink-400">
                        <Building2 className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-sm">{d.name}</h3>
                        {d.organization && <p className="text-xs text-slate-400">{d.organization}</p>}
                      </div>
                    </div>
                  </div>

                  <div className="mt-3.5 space-y-1.5 text-xs text-slate-400">
                    {d.email && (
                      <div className="flex items-center space-x-2">
                        <Mail className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-mono">{d.email}</span>
                      </div>
                    )}
                    {d.phone && (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-3.5 w-3.5 text-slate-500" />
                        <span className="font-mono">{d.phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-800 flex items-center justify-between">
                  <span className="text-[11px] text-slate-500">
                    Partner since {new Date(d.created_at).toLocaleDateString()}
                  </span>

                  <button
                    onClick={() => {
                      setSelectedDonorForDonation(d);
                      setTargetDepotId(depots[0]?.id || "");
                      setTargetResourceTypeId(resourceTypes[0]?.id || "");
                      setIsRecordDonationOpen(true);
                    }}
                    className="flex items-center space-x-1.5 text-xs bg-pink-600/20 hover:bg-pink-600/30 text-pink-300 border border-pink-500/30 px-3 py-1.5 rounded-lg transition font-medium"
                  >
                    <Gift className="h-3.5 w-3.5" />
                    <span>Record Donation</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Donations Table */}
      <div className="space-y-4">
        <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
          Aid Consignments Logged ({donations.length})
        </h2>

        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
          {donationsLoading ? (
            <div className="p-8 text-center text-slate-400 text-sm">Loading consignment records...</div>
          ) : donations.length === 0 ? (
            <div className="p-8 text-center text-slate-400 text-sm">No donations logged yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-slate-950/80 text-slate-400 uppercase text-[11px] font-semibold tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Consignment Resource</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Destination Depot</th>
                    <th className="py-3 px-4">Date Logged</th>
                    <th className="py-3 px-4">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-slate-200">
                  {donations.map((d) => {
                    const depotObj = depots.find((dep) => dep.id === d.depot_id);
                    return (
                      <tr key={d.id} className="hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 font-semibold text-white capitalize">
                          {d.resource_type_name?.replace("_", " ") || "Supplies"}
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-emerald-400">
                          +{d.quantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-300">
                          {depotObj?.name || "Logistics Depot"}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400 font-mono">
                          {new Date(d.donated_at).toLocaleDateString([], {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 text-xs text-slate-400">{d.notes || "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Record Donation Modal */}
      {isRecordDonationOpen && selectedDonorForDonation && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-lg font-bold text-white">Record Aid Consignment</h3>
                <p className="text-xs text-slate-400">From: {selectedDonorForDonation.name}</p>
              </div>
              <button
                onClick={() => setIsRecordDonationOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordDonation} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Target Logistics Depot</label>
                <select
                  required
                  value={targetDepotId}
                  onChange={(e) => setTargetDepotId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {depots.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Resource Item Category</label>
                <select
                  required
                  value={targetResourceTypeId}
                  onChange={(e) => setTargetResourceTypeId(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                >
                  {resourceTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name.replace("_", " ")} ({rt.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Quantity Donated</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={donationQuantity || ""}
                  onChange={(e) => setDonationQuantity(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 5000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 font-mono focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Notes / Grant Identifier</label>
                <input
                  type="text"
                  value={donationNotes}
                  onChange={(e) => setDonationNotes(e.target.value)}
                  placeholder="e.g. Emergency monsoon aid shipment"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsRecordDonationOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordDonationMutation.isPending || donationQuantity <= 0}
                  className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {recordDonationMutation.isPending ? "Recording..." : "Log & Increment Depot Stock"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Donor Modal */}
      {isAddDonorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-start justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">Register Donor Partner</h3>
              <button
                onClick={() => setIsAddDonorOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDonor} className="space-y-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Entity / Donor Name</label>
                <input
                  type="text"
                  required
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="e.g. World Food Programme India"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Organization / Department</label>
                <input
                  type="text"
                  value={donorOrg}
                  onChange={(e) => setDonorOrg(e.target.value)}
                  placeholder="e.g. Humanitarian Logistics Branch"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Email</label>
                <input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="e.g. logistics@partner.org"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contact Phone</label>
                <input
                  type="tel"
                  value={donorPhone}
                  onChange={(e) => setDonorPhone(e.target.value)}
                  placeholder="e.g. +91-11-20000000"
                  className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-200 focus:outline-none focus:border-blue-500"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddDonorOpen(false)}
                  className="px-4 py-2 rounded-lg text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createDonorMutation.isPending}
                  className="bg-pink-600 hover:bg-pink-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50"
                >
                  {createDonorMutation.isPending ? "Saving..." : "Save Donor"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
