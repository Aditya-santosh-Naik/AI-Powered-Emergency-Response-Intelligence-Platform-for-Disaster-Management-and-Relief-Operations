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
  Package,
  Calendar,
  Layers,
} from "lucide-react";
import { api } from "../api/client";
import type { Donor } from "../types";
import { Button } from "../components/ui/Button";
import { KpiTile } from "../components/ui/KpiTile";
import { EmptyState } from "../components/ui/EmptyState";
import { Badge } from "../components/ui/Badge";

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

  // Calculate high-level KPIs
  const totalUnitsDonated = donations.reduce((sum, d) => sum + (d.quantity || 0), 0);
  const uniquePartnerOrgs = new Set(donors.map((d) => d.organization).filter(Boolean)).size;

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
      name: donorName.trim(),
      organization: donorOrg.trim() || undefined,
      email: donorEmail.trim() || undefined,
      phone: donorPhone.trim() || undefined,
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
      notes: donationNotes.trim() || undefined,
    });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-resource-medical/15 border border-resource-medical/30 flex items-center justify-center text-resource-medical">
              <HeartHandshake className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-text-primary tracking-tight">
                Donor Registry & Relief Consignments
              </h1>
              <p className="text-xs sm:text-sm text-text-muted mt-0.5">
                Manage partner entities and log incoming aid consignments that automatically replenish depot inventory reserves.
              </p>
            </div>
          </div>
        </div>

        <Button
          onClick={() => setIsAddDonorOpen(true)}
          variant="primary"
          icon={Plus}
          className="self-start md:self-auto"
        >
          Register Donor Entity
        </Button>
      </div>

      {/* KPI Overview Tiles */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiTile
          label="Registered Donors"
          value={donors.length}
          icon={Building2}
          tone="accent"
        />
        <KpiTile
          label="Consignments Logged"
          value={donations.length}
          icon={Gift}
          tone="success"
        />
        <KpiTile
          label="Total Units Donated"
          value={totalUnitsDonated}
          icon={Package}
          tone="warning"
        />
        <KpiTile
          label="Partner Organizations"
          value={uniquePartnerOrgs}
          icon={Layers}
          tone="default"
        />
      </div>

      {/* Registered Donors Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Active Relief Donors
            </h2>
            <p className="text-xs text-text-muted">
              {donors.length} humanitarian agencies, bilateral partners, and NGOs
            </p>
          </div>
        </div>

        {donorsLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-40 rounded-xl bg-surface-2 animate-pulse border border-border-subtle" />
            ))}
          </div>
        ) : donors.length === 0 ? (
          <div className="bg-surface-1 border border-border-subtle rounded-xl p-8">
            <EmptyState
              title="No donors registered yet"
              description="Register international agencies, civil defense units, or commercial donors to log incoming relief shipments."
              action={
                <Button
                  onClick={() => setIsAddDonorOpen(true)}
                  variant="secondary"
                  size="sm"
                  icon={Plus}
                >
                  Register First Donor
                </Button>
              }
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {donors.map((d) => (
              <div
                key={d.id}
                className="bg-surface-1 border border-border-subtle rounded-xl p-5 space-y-4 shadow-sm hover:border-border-strong transition flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start space-x-3">
                      <div className="h-9 w-9 rounded-lg bg-surface-2 border border-border-subtle flex items-center justify-center text-accent shrink-0 mt-0.5">
                        <Building2 className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-text-primary text-sm leading-snug">
                          {d.name}
                        </h3>
                        {d.organization ? (
                          <span className="text-xs text-text-muted inline-block mt-0.5">
                            {d.organization}
                          </span>
                        ) : (
                          <span className="text-[11px] text-text-dim italic">Individual Donor</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 space-y-1.5 text-xs text-text-muted border-t border-border-subtle">
                    {d.email ? (
                      <div className="flex items-center space-x-2 truncate">
                        <Mail className="h-3.5 w-3.5 text-text-dim shrink-0" />
                        <span className="font-mono text-text-secondary truncate">{d.email}</span>
                      </div>
                    ) : null}
                    {d.phone ? (
                      <div className="flex items-center space-x-2">
                        <Phone className="h-3.5 w-3.5 text-text-dim shrink-0" />
                        <span className="font-mono text-text-secondary">{d.phone}</span>
                      </div>
                    ) : null}
                    {!d.email && !d.phone && (
                      <span className="text-[11px] text-text-dim">No direct contact listed</span>
                    )}
                  </div>
                </div>

                <div className="pt-3 border-t border-border-subtle flex items-center justify-between text-xs">
                  <span className="text-[11px] text-text-dim flex items-center gap-1 font-mono">
                    <Calendar className="h-3 w-3" />
                    {new Date(d.created_at).toLocaleDateString([], {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>

                  <Button
                    onClick={() => {
                      setSelectedDonorForDonation(d);
                      setTargetDepotId(depots[0]?.id || "");
                      setTargetResourceTypeId(resourceTypes[0]?.id || "");
                      setIsRecordDonationOpen(true);
                    }}
                    variant="ghost"
                    size="sm"
                    icon={Gift}
                    className="text-accent hover:text-accent-hover hover:bg-accent/10"
                  >
                    Record Donation
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Donations Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold text-text-primary uppercase tracking-wider">
              Consignment Audit Log
            </h2>
            <p className="text-xs text-text-muted">
              {donations.length} incoming supply batches logged and verified across all regional depots
            </p>
          </div>
        </div>

        <div className="bg-surface-1 border border-border-subtle rounded-xl overflow-hidden shadow-sm">
          {donationsLoading ? (
            <div className="p-8 text-center text-text-muted text-sm">
              Loading consignment records...
            </div>
          ) : donations.length === 0 ? (
            <div className="p-8">
              <EmptyState
                title="No consignments recorded"
                description="When donors provide relief supplies, record the batch here to automatically increment target depot stocks."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface-2 text-text-muted uppercase text-[11px] font-semibold tracking-wider border-b border-border-subtle">
                  <tr>
                    <th className="py-3 px-4">Consignment Resource</th>
                    <th className="py-3 px-4">Quantity</th>
                    <th className="py-3 px-4">Destination Depot</th>
                    <th className="py-3 px-4">Date Logged</th>
                    <th className="py-3 px-4">Notes / Grant ID</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle text-text-secondary">
                  {donations.map((d) => {
                    const depotObj = depots.find((dep) => dep.id === d.depot_id);
                    const formattedResource = d.resource_type_name?.replace(/_/g, " ") || "Supplies";
                    return (
                      <tr key={d.id} className="hover:bg-surface-2/40 transition">
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <Badge variant="info">
                              {formattedResource}
                            </Badge>
                          </div>
                        </td>
                        <td className="py-3 px-4 font-mono font-bold text-semantic-low tabular-nums">
                          +{d.quantity.toLocaleString()}
                        </td>
                        <td className="py-3 px-4 text-xs text-text-primary font-medium">
                          {depotObj?.name || "Logistics Depot"}
                        </td>
                        <td className="py-3 px-4 text-xs text-text-muted font-mono">
                          {new Date(d.donated_at).toLocaleDateString([], {
                            year: "numeric",
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="py-3 px-4 text-xs text-text-muted max-w-xs truncate">
                          {d.notes || "—"}
                        </td>
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
          <div className="bg-surface-1 border border-border-strong rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-base font-bold text-text-primary">Record Aid Consignment</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Donor: <span className="text-text-secondary font-medium">{selectedDonorForDonation.name}</span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsRecordDonationOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-surface-2 transition"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleRecordDonation} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Destination Logistics Depot
                </label>
                <select
                  required
                  value={targetDepotId}
                  onChange={(e) => setTargetDepotId(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {depots.map((dep) => (
                    <option key={dep.id} value={dep.id}>
                      {dep.name} ({dep.address || "HQ"})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Resource Item Category
                </label>
                <select
                  required
                  value={targetResourceTypeId}
                  onChange={(e) => setTargetResourceTypeId(e.target.value)}
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                >
                  {resourceTypes.map((rt) => (
                    <option key={rt.id} value={rt.id}>
                      {rt.name.replace(/_/g, " ")} ({rt.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Quantity Donated
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={donationQuantity || ""}
                  onChange={(e) => setDonationQuantity(parseInt(e.target.value) || 0)}
                  placeholder="e.g. 5000"
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary font-mono tabular-nums focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Notes / Grant Identifier
                </label>
                <input
                  type="text"
                  value={donationNotes}
                  onChange={(e) => setDonationNotes(e.target.value)}
                  placeholder="e.g. Emergency monsoon aid shipment #IN-482"
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsRecordDonationOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={recordDonationMutation.isPending}
                  disabled={recordDonationMutation.isPending || donationQuantity <= 0}
                >
                  Log & Increment Depot Stock
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Donor Modal */}
      {isAddDonorOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-surface-1 border border-border-strong rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl animate-fade-in">
            <div className="flex items-start justify-between border-b border-border-subtle pb-3">
              <div>
                <h3 className="text-base font-bold text-text-primary">Register Donor Partner</h3>
                <p className="text-xs text-text-muted mt-0.5">
                  Add an accredited institutional or NGO relief partner
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAddDonorOpen(false)}
                className="text-text-muted hover:text-text-primary p-1 rounded-lg hover:bg-surface-2 transition"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDonor} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Entity / Contact Name <span className="text-semantic-critical">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={donorName}
                  onChange={(e) => setDonorName(e.target.value)}
                  placeholder="e.g. World Food Programme India"
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Organization / Department
                </label>
                <input
                  type="text"
                  value={donorOrg}
                  onChange={(e) => setDonorOrg(e.target.value)}
                  placeholder="e.g. Humanitarian Logistics Branch"
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Email
                </label>
                <input
                  type="email"
                  value={donorEmail}
                  onChange={(e) => setDonorEmail(e.target.value)}
                  placeholder="e.g. logistics@partner.org"
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-text-secondary mb-1">
                  Contact Phone
                </label>
                <input
                  type="tel"
                  value={donorPhone}
                  onChange={(e) => setDonorPhone(e.target.value)}
                  placeholder="e.g. +91-11-20000000"
                  className="w-full bg-surface-2 border border-border-subtle rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-border-subtle">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setIsAddDonorOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={createDonorMutation.isPending}
                  disabled={createDonorMutation.isPending || !donorName.trim()}
                >
                  Save Donor
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
