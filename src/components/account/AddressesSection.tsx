/**
 * Delivery Addresses Section for SARINE Customer Account.
 * Complete address CRUD with validation, default selection,
 * edit mode, safe deletion confirmation, and persistent per-customer isolation.
 */

import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Edit2, Trash2, Check, AlertCircle, Phone, User, CheckCircle2 } from 'lucide-react';

export interface SavedAddress {
  id: string;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  pincode: string;
  isDefault: boolean;
}

interface AddressesSectionProps {
  userId: string;
}

const INDIAN_STATES = [
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chhattisgarh',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
  'Delhi',
  'Chandigarh'
];

export const AddressesSection: React.FC<AddressesSectionProps> = ({ userId }) => {
  const storageKey = `sarine_addresses_${userId || 'guest'}`;

  // Initial load from customer's isolated local storage
  const [addresses, setAddresses] = useState<SavedAddress[]>(() => {
    try {
      const stored = localStorage.getItem(storageKey);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored addresses', e);
    }
    // Default initial address for demonstration
    return [
      {
        id: 'addr-default',
        fullName: 'Aarohi Patel',
        phone: '9876543210',
        line1: 'Flat 402, Lotus Grand Residences',
        line2: 'Jubilee Hills, Road No. 36',
        city: 'Hyderabad',
        state: 'Telangana',
        pincode: '500033',
        isDefault: true
      }
    ];
  });

  // Persist whenever addresses change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(addresses));
    } catch (e) {
      console.warn('Failed to save addresses to storage', e);
    }
  }, [addresses, storageKey]);

  // Form states
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Address Deletion Dialog State
  const [addressToDelete, setAddressToDelete] = useState<SavedAddress | null>(null);

  // Form fields
  const [formData, setFormData] = useState<Omit<SavedAddress, 'id'>>({
    fullName: '',
    phone: '',
    line1: '',
    line2: '',
    city: '',
    state: 'Maharashtra',
    pincode: '',
    isDefault: false
  });

  const handleOpenAdd = () => {
    setEditingAddressId(null);
    setFormData({
      fullName: '',
      phone: '',
      line1: '',
      line2: '',
      city: '',
      state: 'Maharashtra',
      pincode: '',
      isDefault: addresses.length === 0
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (addr: SavedAddress) => {
    setEditingAddressId(addr.id);
    setFormData({
      fullName: addr.fullName,
      phone: addr.phone,
      line1: addr.line1,
      line2: addr.line2 || '',
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      isDefault: addr.isDefault
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingAddressId(null);
    setFormError(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Validations
    if (!formData.fullName.trim() || formData.fullName.trim().length < 2) {
      setFormError('Please enter a valid recipient full name.');
      return;
    }

    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      setFormError('Please enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.');
      return;
    }

    if (!formData.line1.trim() || formData.line1.trim().length < 3) {
      setFormError('Please enter street or building address details.');
      return;
    }

    if (!formData.city.trim() || formData.city.trim().length < 2) {
      setFormError('Please enter a valid delivery city.');
      return;
    }

    if (!/^[1-9][0-9]{5}$/.test(formData.pincode.trim())) {
      setFormError('Please enter a valid 6-digit Indian PIN code.');
      return;
    }

    if (editingAddressId) {
      // Update existing
      setAddresses((prev) => {
        let updated = prev.map((a) => {
          if (a.id === editingAddressId) {
            return {
              ...formData,
              phone: cleanPhone,
              id: editingAddressId
            };
          }
          // If edited address is made default, remove default from others
          if (formData.isDefault) {
            return { ...a, isDefault: false };
          }
          return a;
        });

        // Ensure at least one address is default
        if (!updated.some((a) => a.isDefault) && updated.length > 0) {
          updated[0].isDefault = true;
        }
        return updated;
      });
      setFormSuccess('Address updated successfully.');
    } else {
      // Create new
      const newAddr: SavedAddress = {
        ...formData,
        phone: cleanPhone,
        id: `addr-${Date.now()}`
      };

      setAddresses((prev) => {
        let list = prev;
        if (newAddr.isDefault || list.length === 0) {
          list = list.map((a) => ({ ...a, isDefault: false }));
          newAddr.isDefault = true;
        }
        return [newAddr, ...list];
      });
      setFormSuccess('New address added to your address book.');
    }

    setTimeout(() => setFormSuccess(null), 3000);
    handleCloseForm();
  };

  const handleSetDefault = (id: string) => {
    setAddresses((prev) =>
      prev.map((a) => ({
        ...a,
        isDefault: a.id === id
      }))
    );
  };

  const handleConfirmDelete = () => {
    if (!addressToDelete) return;
    setAddresses((prev) => {
      const remaining = prev.filter((a) => a.id !== addressToDelete.id);
      // If deleted address was default, make the next one default
      if (addressToDelete.isDefault && remaining.length > 0) {
        remaining[0].isDefault = true;
      }
      return remaining;
    });
    setAddressToDelete(null);
  };

  return (
    <div className="bg-white p-6 sm:p-8 border border-[#E7DCEB] rounded-xs shadow-xs space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h3 className="font-serif text-xl sm:text-2xl text-[#302438]">Delivery Addresses</h3>
          <p className="text-xs sm:text-sm text-[#6F6475] mt-1 leading-relaxed">
            Manage your verified shipping destinations for express courier checkout.
          </p>
        </div>

        {!isFormOpen && (
          <button
            type="button"
            onClick={handleOpenAdd}
            className="min-h-[44px] px-4 py-2.5 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Plus size={14} />
            <span>Add New Address</span>
          </button>
        )}
      </div>

      {formSuccess && (
        <div className="p-3.5 bg-[#10B981]/10 border border-[#10B981]/30 text-[#047857] text-xs rounded-xs flex items-center gap-2">
          <CheckCircle2 size={15} />
          <span>{formSuccess}</span>
        </div>
      )}

      {/* Address Form (Add or Edit) */}
      {isFormOpen && (
        <form
          onSubmit={handleSubmit}
          className="p-5 sm:p-6 bg-[#FAF5FC] border border-[#B69ACF]/40 rounded-xs space-y-4 text-xs animate-fadeIn"
        >
          <div className="flex items-center justify-between pb-3 border-b border-[#E7DCEB]">
            <h4 className="font-serif text-sm sm:text-base text-[#302438]">
              {editingAddressId ? 'Edit Delivery Address' : 'Add New Delivery Address'}
            </h4>
            <button
              type="button"
              onClick={handleCloseForm}
              className="text-[#6F6475] hover:text-[#302438] text-xs cursor-pointer p-1"
            >
              Cancel
            </button>
          </div>

          {formError && (
            <div className="p-3 bg-[#DC2626]/10 border border-[#DC2626]/30 text-[#DC2626] rounded-xs flex items-center gap-2">
              <AlertCircle size={14} />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-[#6F6475] mb-1 font-medium">Full Name *</label>
              <input
                type="text"
                required
                value={formData.fullName}
                onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                placeholder="e.g. Aarohi Patel"
                className="w-full min-h-[44px] p-2.5 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[#6F6475] mb-1 font-medium">10-Digit Mobile Number *</label>
              <input
                type="tel"
                required
                value={formData.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    phone: e.target.value.replace(/\D/g, '').slice(0, 10)
                  })
                }
                placeholder="e.g. 9876543210"
                className="w-full min-h-[44px] p-2.5 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#6F6475] mb-1 font-medium">
              Flat, House No., Building, Street (Line 1) *
            </label>
            <input
              type="text"
              required
              value={formData.line1}
              onChange={(e) => setFormData({ ...formData, line1: e.target.value })}
              placeholder="e.g. Flat 402, Lotus Grand Residences, Road No. 36"
              className="w-full min-h-[44px] p-2.5 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-[#6F6475] mb-1 font-medium">
              Landmark, Area, Sector (Line 2 - Optional)
            </label>
            <input
              type="text"
              value={formData.line2 || ''}
              onChange={(e) => setFormData({ ...formData, line2: e.target.value })}
              placeholder="e.g. Near Jubilee Hills Check Post"
              className="w-full min-h-[44px] p-2.5 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-[#6F6475] mb-1 font-medium">City *</label>
              <input
                type="text"
                required
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g. Hyderabad"
                className="w-full min-h-[44px] p-2.5 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[#6F6475] mb-1 font-medium">State *</label>
              <select
                value={formData.state}
                onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                className="w-full min-h-[44px] p-2.5 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none cursor-pointer"
              >
                {INDIAN_STATES.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[#6F6475] mb-1 font-medium">6-Digit PIN Code *</label>
              <input
                type="text"
                required
                value={formData.pincode}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pincode: e.target.value.replace(/\D/g, '').slice(0, 6)
                  })
                }
                placeholder="e.g. 500033"
                className="w-full min-h-[44px] p-2.5 bg-white border border-[#E7DCEB] focus:border-[#563568] rounded-xs focus:outline-none"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 pt-1 text-[#302438] cursor-pointer">
            <input
              type="checkbox"
              checked={formData.isDefault}
              onChange={(e) => setFormData({ ...formData, isDefault: e.target.checked })}
              className="w-4 h-4 accent-[#563568] rounded cursor-pointer"
            />
            <span className="font-medium">Set as my default delivery address</span>
          </label>

          <div className="pt-2 flex items-center gap-3">
            <button
              type="submit"
              className="min-h-[44px] px-6 py-2.5 bg-[#563568] hover:bg-[#80609A] text-white font-medium rounded-xs transition-colors shadow-xs cursor-pointer"
            >
              {editingAddressId ? 'Save Changes' : 'Save Address'}
            </button>
            <button
              type="button"
              onClick={handleCloseForm}
              className="min-h-[44px] px-4 py-2.5 border border-[#E7DCEB] text-[#6F6475] hover:text-[#302438] rounded-xs cursor-pointer"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Address Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {addresses.length === 0 ? (
          <div className="col-span-2 p-10 border border-[#E7DCEB] rounded-xs text-center space-y-3 bg-[#FAF5FC]/30">
            <MapPin size={28} className="mx-auto text-[#B69ACF]" strokeWidth={1.5} />
            <h4 className="font-serif text-sm text-[#302438]">No saved delivery addresses</h4>
            <p className="text-xs text-[#6F6475]">
              Add your primary address to enjoy faster 1-click checkout for your jewellery orders.
            </p>
            <button
              type="button"
              onClick={handleOpenAdd}
              className="min-h-[44px] px-5 py-2 bg-[#563568] hover:bg-[#80609A] text-white text-xs font-medium rounded-xs transition-colors cursor-pointer"
            >
              Add First Address
            </button>
          </div>
        ) : (
          addresses.map((addr) => (
            <div
              key={addr.id}
              className={`p-5 border rounded-xs relative space-y-2 text-xs transition-all ${
                addr.isDefault
                  ? 'border-[#563568] bg-[#FAF5FC]/40 shadow-xs'
                  : 'border-[#E7DCEB] bg-white hover:border-[#B69ACF]'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold text-sm text-[#302438] flex items-center gap-1.5">
                  <User size={14} className="text-[#563568]" />
                  <span>{addr.fullName}</span>
                </span>
                {addr.isDefault && (
                  <span className="text-[10px] uppercase font-bold text-[#563568] bg-[#B69ACF]/25 px-2 py-0.5 rounded-xs border border-[#B69ACF]/40">
                    Default
                  </span>
                )}
              </div>

              <p className="text-[#6F6475] leading-relaxed">
                {addr.line1}
                {addr.line2 ? `, ${addr.line2}` : ''}
              </p>
              <p className="text-[#6F6475]">
                {addr.city}, {addr.state} — <strong className="text-[#302438]">{addr.pincode}</strong>
              </p>
              <p className="text-[#6F6475] flex items-center gap-1.5 pt-0.5">
                <Phone size={12} className="text-[#563568]" />
                <span>+91 {addr.phone}</span>
              </p>

              <div className="pt-3 flex items-center justify-between border-t border-[#E7DCEB] mt-2">
                {!addr.isDefault ? (
                  <button
                    type="button"
                    onClick={() => handleSetDefault(addr.id)}
                    className="min-h-[36px] text-[#563568] text-xs underline hover:text-[#80609A] cursor-pointer"
                  >
                    Set as Default
                  </button>
                ) : (
                  <span className="text-[11px] text-[#047857] font-medium flex items-center gap-1">
                    <Check size={12} /> Primary Delivery Address
                  </span>
                )}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleOpenEdit(addr)}
                    className="min-h-[36px] min-w-[36px] p-1.5 text-[#563568] hover:bg-[#FAF5FC] rounded-xs flex items-center justify-center cursor-pointer"
                    title="Edit address"
                    aria-label={`Edit address for ${addr.fullName}`}
                  >
                    <Edit2 size={13} />
                  </button>

                  <button
                    type="button"
                    onClick={() => setAddressToDelete(addr)}
                    className="min-h-[36px] min-w-[36px] p-1.5 text-[#DC2626] hover:bg-[#DC2626]/10 rounded-xs flex items-center justify-center cursor-pointer"
                    title="Delete address"
                    aria-label={`Delete address for ${addr.fullName}`}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Safe Deletion Confirmation Modal */}
      {addressToDelete && (
        <div className="fixed inset-0 z-50 bg-[#302438]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-[#E7DCEB] rounded-xs shadow-2xl p-6 max-w-sm w-full space-y-4 animate-fadeIn">
            <h4 className="font-serif text-lg text-[#302438]">Delete Delivery Address?</h4>
            <p className="text-xs text-[#6F6475] leading-relaxed">
              Are you sure you want to remove the address for <strong>{addressToDelete.fullName}</strong> in {addressToDelete.city}? This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAddressToDelete(null)}
                className="min-h-[44px] px-4 py-2 border border-[#E7DCEB] text-xs text-[#6F6475] hover:text-[#302438] rounded-xs cursor-pointer"
              >
                Keep Address
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="min-h-[44px] px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] text-white text-xs font-medium rounded-xs transition-colors cursor-pointer"
              >
                Delete Address
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
