import React, { useState } from 'react';

// Mirrors the click-to-reveal phone/email pattern already used across the Admissions
// dashboards (CounselorDashboard.jsx's MaskedPhone/MaskedEmail) — masked by default as a
// shoulder-surfing/screen-share deterrent, revealed on click. Not a data-access boundary:
// the full value is already in the row data the browser holds, this only controls what's
// rendered on screen. Shared here (not duplicated per-panel) so every Hiring view that
// shows a candidate's phone/email uses the exact same masking rule and reveal behavior.

function maskPhoneNumber(num) {
  if (num.length <= 4) return num;
  return num.slice(0, 2) + '*'.repeat(num.length - 4) + num.slice(-2);
}

function maskEmailAddress(str) {
  const parts = str.split('@');
  if (parts.length !== 2) return str;
  const [user, domain] = parts;
  if (user.length <= 2) return user[0] + '*' + '@' + domain;
  return user[0] + '*'.repeat(user.length - 2) + user.slice(-1) + '@' + domain;
}

function MaskedField({ value, mask, monoWeight = 'normal' }) {
  const [visible, setVisible] = useState(false);
  if (!value) return <span className="text-slate-400 dark:text-slate-500 italic">—</span>;

  return (
    <span className="inline-flex items-center gap-1">
      <span className={`font-data-mono ${monoWeight === 'bold' ? 'font-bold tracking-wide' : ''}`}>
        {visible ? value : mask(value)}
      </span>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setVisible(v => !v); }}
        className="p-0.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-slate-500 dark:text-slate-400 transition active:scale-90 flex items-center justify-center shrink-0"
        title={visible ? 'Hide' : 'Show'}
      >
        <span className="material-symbols-outlined text-[14px]">{visible ? 'visibility_off' : 'visibility'}</span>
      </button>
    </span>
  );
}

export const MaskedPhone = ({ phone }) => <MaskedField value={phone} mask={maskPhoneNumber} monoWeight="bold" />;
export const MaskedEmail = ({ email }) => <MaskedField value={email} mask={maskEmailAddress} />;
