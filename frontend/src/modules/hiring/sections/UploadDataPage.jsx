import React, { useState } from 'react';
import { hiringApi } from '../services/hiringApi';

// Mirrors Admissions' "Excel/CSV Data Upload & Cleansing Workspace" (ManagerDashboard.jsx)
// exactly: pick a file -> analyze & auto-map columns -> verify/correct the mapping with a
// live 5-row preview -> confirm to commit. Candidates land in the Unassigned pool on the
// Candidates page (or the Distribute page) afterward, same as leads land in the Admissions pool.
export default function UploadDataPage({ token, showToast }) {
  const [uploadFile, setUploadFile] = useState(null);
  const [previewData, setPreviewData] = useState(null);
  const [manualMapping, setManualMapping] = useState({});
  const [previewLoading, setPreviewLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [uploadResult, setUploadResult] = useState(null);

  const handlePreviewSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;
    setPreviewLoading(true);
    setUploadError(null);
    setUploadResult(null);
    setPreviewData(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    try {
      const data = await hiringApi.previewUpload(token, formData);
      setPreviewData(data);
      setManualMapping(data.autoMapping || {});
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleUploadSubmit = async () => {
    if (!uploadFile) return;
    setUploadLoading(true);
    setUploadError(null);
    setUploadResult(null);

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('mapping', JSON.stringify(manualMapping));
    try {
      const data = await hiringApi.uploadCandidates(token, formData);
      setUploadResult(data);
      setPreviewData(null);
      setUploadFile(null);
      showToast('File uploaded and imported.', 'success');
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploadLoading(false);
    }
  };

  const handleCancelPreview = () => {
    setPreviewData(null);
    setManualMapping({});
    setUploadFile(null);
    setUploadError(null);
    setUploadResult(null);
  };

  return (
    <div className="max-w-4xl bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 p-6 rounded-xl space-y-6">
      <h2 className="text-sm font-bold text-[#111C2D] dark:text-white uppercase tracking-wide font-label-caps border-b border-[#E2E8F0] dark:border-slate-700 pb-3">
        Excel/CSV Candidate Upload & Cleansing Workspace
      </h2>

      {!previewData ? (
        <form onSubmit={handlePreviewSubmit} className="space-y-6">
          <div className="border-2 border-dashed border-[#E2E8F0] dark:border-slate-700 hover:border-[#7C3AED] rounded-lg p-8 text-center cursor-pointer transition">
            <span className="material-symbols-outlined text-4xl text-[#70787C] dark:text-slate-500 mb-2">cloud_upload</span>
            <p className="text-xs font-semibold text-[#111C2D] dark:text-white">Drag and drop file here, or select from computer</p>
            <p className="text-[11px] text-[#70787C] dark:text-slate-400 mt-1">Supports Excel (.xlsx, .xls) and CSV</p>
            <input
              type="file"
              required
              accept=".xlsx,.xls,.csv"
              onChange={(e) => { setUploadFile(e.target.files[0]); setUploadResult(null); setUploadError(null); }}
              className="mt-4 block w-full text-xs text-slate-500 dark:text-slate-400 file:mr-4 file:py-1 file:px-3 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-violet-50 file:text-[#7C3AED] hover:file:bg-violet-100"
            />
          </div>

          {uploadFile && (
            <div className="flex items-center gap-2 p-2 bg-violet-50 dark:bg-violet-950/30 border border-violet-100 dark:border-violet-800 rounded text-xs text-[#7C3AED] dark:text-violet-300">
              <span className="material-symbols-outlined text-lg">insert_drive_file</span>
              <span className="font-semibold truncate">{uploadFile.name}</span>
            </div>
          )}

          <button
            type="submit"
            disabled={previewLoading || !uploadFile}
            className="w-full flex items-center justify-center gap-1.5 py-2 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded disabled:opacity-50 transition"
          >
            {previewLoading ? (
              <span className="material-symbols-outlined animate-spin text-lg">sync</span>
            ) : (
              <>
                <span className="material-symbols-outlined text-lg">analytics</span>
                <span>Analyze File & Map Columns</span>
              </>
            )}
          </button>
        </form>
      ) : (
        <div className="space-y-6 animate-fade-in">
          <div className="bg-[#F8FAFC] dark:bg-slate-900 border border-[#E2E8F0] dark:border-slate-700 p-4 rounded space-y-4">
            <div className="flex items-center justify-between border-b border-[#E2E8F0] dark:border-slate-700 pb-2">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] dark:text-white font-label-caps">Verify Column Mapping</h3>
              <span className="text-[10px] bg-[#E2E8F0] dark:bg-slate-700 text-slate-700 dark:text-slate-300 px-2 py-0.5 rounded font-data-mono">{uploadFile?.name}</span>
            </div>

            <p className="text-[11px] text-[#70787C] dark:text-slate-400">
              Review matches below. Adjust dropdowns for any unmatched or misaligned columns. Fields marked with <span className="text-[#BA1A1A] font-bold">*</span> are required.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {previewData.systemFields.map((field) => {
                const isMapped = !!manualMapping[field.key];
                return (
                  <div key={field.key} className="flex items-center justify-between bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 p-2 rounded text-xs">
                    <span className="font-semibold flex items-center gap-1 dark:text-slate-200">
                      {field.label}
                      {field.required && <span className="text-[#BA1A1A] font-bold">*</span>}
                    </span>
                    <select
                      value={manualMapping[field.key] || ''}
                      onChange={(e) => setManualMapping(prev => ({ ...prev, [field.key]: e.target.value || null }))}
                      className={`text-[11px] p-1 bg-white dark:bg-slate-900 border rounded w-48 dark:text-slate-200 ${isMapped ? 'border-[#E2E8F0] dark:border-slate-700 text-slate-800' : 'border-amber-300 bg-amber-50/20 dark:bg-amber-900/10 text-amber-800 dark:text-amber-400 italic'}`}
                    >
                      <option value="">-- Unmapped --</option>
                      {previewData.headers.map((h) => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-xs font-bold uppercase tracking-wider text-[#40484B] dark:text-slate-300 font-label-caps">Data Mapping Preview (First 5 Rows)</h4>
            <div className="border border-[#E2E8F0] dark:border-slate-700 rounded overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#F8FAFC] dark:bg-slate-900 border-b border-[#E2E8F0] dark:border-slate-700 text-[10px] font-bold text-[#70787C] dark:text-slate-400 uppercase tracking-wider font-label-caps">
                    {previewData.systemFields.map((field) => (
                      <th key={field.key} className="p-2 border-r border-[#E2E8F0] dark:border-slate-700">{field.label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0] dark:divide-slate-700">
                  {previewData.previewRows.map((row, rowIdx) => (
                    <tr key={rowIdx} className="hover:bg-[#F8FAFC] dark:hover:bg-slate-900">
                      {previewData.systemFields.map((field) => {
                        const val = row[manualMapping[field.key]];
                        return (
                          <td key={field.key} className="p-2 border-r border-[#E2E8F0] dark:border-slate-700 text-[11px] font-data-mono dark:text-slate-300">
                            {val !== undefined && val !== null ? String(val) : <span className="text-slate-400 italic">null</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 border-t border-[#E2E8F0] dark:border-slate-700 pt-4">
            <button onClick={handleCancelPreview} className="py-1.5 px-3 border border-[#E2E8F0] dark:border-slate-700 dark:text-slate-300 text-xs font-semibold rounded hover:bg-[#F8FAFC] dark:hover:bg-slate-900">
              Cancel & Choose File
            </button>
            <button
              onClick={handleUploadSubmit}
              disabled={uploadLoading || !manualMapping.name || !manualMapping.phone}
              className="py-1.5 px-4 bg-[#7C3AED] hover:bg-[#6D28D9] text-white text-xs font-semibold rounded disabled:opacity-50 transition flex items-center gap-1.5"
            >
              {uploadLoading ? (
                <span className="material-symbols-outlined animate-spin text-sm">sync</span>
              ) : (
                <span className="material-symbols-outlined text-sm">check_circle</span>
              )}
              <span>Confirm & Import Candidates</span>
            </button>
          </div>
        </div>
      )}

      {uploadError && (
        <div className="p-3 bg-red-50 border border-red-200 text-[#BA1A1A] text-xs rounded">{uploadError}</div>
      )}

      {uploadResult && (
        <div className="border border-[#E2E8F0] dark:border-slate-700 rounded p-4 bg-[#F8FAFC] dark:bg-slate-900">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#111C2D] dark:text-white font-label-caps mb-3">Upload Cleansing Report</h3>
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 border border-[#E2E8F0] dark:border-slate-700 p-3 text-center rounded">
              <div className="text-lg font-bold text-[#111C2D] dark:text-white font-data-mono">{uploadResult.totalRows}</div>
              <div className="text-[10px] text-[#70787C] dark:text-slate-400 font-label-caps mt-1">Total Rows</div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-green-200 dark:border-green-800 p-3 text-center rounded">
              <div className="text-lg font-bold text-green-600 font-data-mono">{uploadResult.cleanRows}</div>
              <div className="text-[10px] text-green-700 dark:text-green-400 font-label-caps mt-1">Clean Data</div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 p-3 text-center rounded">
              <div className="text-lg font-bold text-amber-500 font-data-mono">{uploadResult.duplicateRows}</div>
              <div className="text-[10px] text-amber-700 dark:text-amber-400 font-label-caps mt-1">Duplicates</div>
            </div>
            <div className="bg-white dark:bg-slate-800 border border-red-200 dark:border-red-800 p-3 text-center rounded">
              <div className="text-lg font-bold text-red-600 font-data-mono">{uploadResult.invalidRows}</div>
              <div className="text-[10px] text-red-700 dark:text-red-400 font-label-caps mt-1">Invalid</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
