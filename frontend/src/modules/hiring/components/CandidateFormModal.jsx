import React, { useState } from 'react';
import Modal from '../../../shared/components/Modal';

export default function CandidateFormModal({ onClose, onSubmit }) {
  const [form, setForm] = useState({
    name: '', phone: '', email: '', currentLocation: '', experience: '', currentCompany: '',
    expectedSalary: '', noticePeriod: '', skills: '', resumeUrl: '', source: 'Manual Entry'
  });
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim() || !form.phone.trim()) {
      setError('Name and phone are required.');
      return;
    }
    setSaving(true);
    try {
      await onSubmit({ ...form, skills: form.skills ? form.skills.split(',').map(s => s.trim()).filter(Boolean) : [] });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add Candidate" icon="person_add" onClose={onClose} maxWidth="max-w-xl"
      footer={(
        <>
          <button type="button" onClick={onClose} className="py-1.5 px-3 border border-[#CBD5E1] text-xs font-semibold rounded">Cancel</button>
          <button form="candidate-form" type="submit" disabled={saving} className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Candidate'}
          </button>
        </>
      )}
    >
      {error && (
        <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{error}</div>
      )}
      <form id="candidate-form" onSubmit={handleSubmit} className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Full Name *</label>
          <input value={form.name} onChange={set('name')} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Phone *</label>
          <input value={form.phone} onChange={set('phone')} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Email</label>
          <input type="email" value={form.email} onChange={set('email')} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Current Location</label>
          <input value={form.currentLocation} onChange={set('currentLocation')} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Experience (yrs)</label>
          <input type="number" step="0.1" value={form.experience} onChange={set('experience')} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Current Company</label>
          <input value={form.currentCompany} onChange={set('currentCompany')} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Expected Salary</label>
          <input type="number" value={form.expectedSalary} onChange={set('expectedSalary')} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Notice Period</label>
          <input value={form.noticePeriod} onChange={set('noticePeriod')} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Skills (comma separated)</label>
          <input value={form.skills} onChange={set('skills')} placeholder="e.g. React, Node.js, SQL" className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Resume URL</label>
          <input value={form.resumeUrl} onChange={set('resumeUrl')} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded" />
        </div>
      </form>
    </Modal>
  );
}
