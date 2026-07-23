import React, { useState } from 'react';
import Modal from '../../../shared/components/Modal';
import { INTERVIEW_STATUSES, RESULT_STATUSES } from '../constants/pipeline';

export default function InterviewUpdateModal({ interview, onClose, onSubmit }) {
  const [status, setStatus] = useState(interview.status || 'Scheduled');
  const [result, setResult] = useState(interview.result || 'Pending');
  const [feedback, setFeedback] = useState(interview.feedback || '');
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ status, result, feedback });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title={`Update Interview — ${interview.candidate_name}`} icon="event" onClose={onClose} maxWidth="max-w-sm"
      footer={(
        <>
          <button type="button" onClick={onClose} className="py-1.5 px-3 border border-[#CBD5E1] dark:border-slate-700 dark:text-slate-300 text-xs font-semibold rounded">Cancel</button>
          <button form="interview-update-form" type="submit" disabled={saving} className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded disabled:opacity-50">
            {saving ? 'Saving...' : 'Save'}
          </button>
        </>
      )}
    >
      {error && <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded">{error}</div>}
      <form id="interview-update-form" onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded">
            {INTERVIEW_STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Result</label>
          <select value={result} onChange={(e) => setResult(e.target.value)} className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded">
            {RESULT_STATUSES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-bold text-[#40484B] dark:text-slate-300 mb-1 uppercase font-label-caps">Feedback</label>
          <textarea value={feedback} onChange={(e) => setFeedback(e.target.value)} placeholder="Interviewer notes, next steps..." className="w-full text-xs p-2 bg-[#F9F9FF] dark:bg-slate-900 border border-[#CBD5E1] dark:border-slate-700 dark:text-white rounded h-20" />
        </div>
      </form>
    </Modal>
  );
}
