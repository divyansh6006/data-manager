// Thin fetch wrappers for every /api/hiring endpoint. Mirrors the plain-fetch style already
// used throughout the Admissions dashboards (no axios/query-lib dependency added).

async function request(token, path, options = {}) {
  const response = await fetch(`/api/hiring${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      ...(options.body && !(options.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      ...(options.headers || {})
    }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
}

const buildQuery = (params = {}) => {
  const q = Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '');
  return q.length ? `?${new URLSearchParams(q).toString()}` : '';
};

// Raw-fetch blob download — NOT the JSON request() wrapper above, since these endpoints
// return an xlsx file rather than JSON. Mirrors handleDownloadBatch/handleDownloadAllLeads in
// frontend/src/views/ManagerDashboard.jsx: caller is responsible for turning the blob into a
// download (createObjectURL + <a download>).
async function requestBlob(token, path) {
  const response = await fetch(`/api/hiring${path}`, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || 'Export failed');
  }
  return response.blob();
}

export const hiringApi = {
  // Candidates
  listCandidates: (token, filters) => request(token, `/candidates${buildQuery(filters)}`),
  getCandidate: (token, id) => request(token, `/candidates/${id}`),
  createCandidate: (token, body) => request(token, '/candidates', { method: 'POST', body: JSON.stringify(body) }),
  updateCandidate: (token, id, body) => request(token, `/candidates/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  previewUpload: (token, formData) => request(token, '/candidates/upload-preview', { method: 'POST', body: formData }),
  uploadCandidates: (token, formData) => request(token, '/candidates/upload', { method: 'POST', body: formData }),
  listUploadBatches: (token) => request(token, '/upload-batches'),
  assignCandidate: (token, id, body) => request(token, `/candidates/${id}/assign`, { method: 'POST', body: JSON.stringify(body) }),
  distributeCandidates: (token, body) => request(token, '/candidates/distribute', { method: 'POST', body: JSON.stringify(body) }),
  requestTransfer: (token, id, body) => request(token, `/candidates/${id}/transfer-request`, { method: 'POST', body: JSON.stringify(body) }),
  listTransferRequests: (token) => request(token, '/transfer-requests'),
  approveTransfer: (token, id, body) => request(token, `/transfer-requests/${id}/approve`, { method: 'PUT', body: JSON.stringify(body) }),
  rejectTransfer: (token, id) => request(token, `/transfer-requests/${id}/reject`, { method: 'PUT' }),
  updateStatus: (token, id, body) => request(token, `/candidates/${id}/status`, { method: 'PUT', body: JSON.stringify(body) }),
  logCall: (token, id, body) => request(token, `/candidates/${id}/log-call`, { method: 'POST', body: JSON.stringify(body) }),
  getRemarks: (token, id) => request(token, `/candidates/${id}/remarks`),
  scheduleFollowUp: (token, id, body) => request(token, `/candidates/${id}/follow-up`, { method: 'POST', body: JSON.stringify(body) }),
  listFollowUps: (token, pending) => request(token, `/follow-ups${buildQuery({ pending })}`),
  completeFollowUp: (token, id) => request(token, `/follow-ups/${id}/complete`, { method: 'PUT' }),

  // Recruiters / Teams
  listRecruiters: (token) => request(token, '/recruiters'),
  setRecruiterTeam: (token, id, hiringTeamId) => request(token, `/recruiters/${id}/team`, { method: 'PUT', body: JSON.stringify({ hiringTeamId }) }),
  getRecruiterPerformance: (token, id) => request(token, `/recruiters/${id}/performance`),
  listTeams: (token) => request(token, '/teams'),
  createTeam: (token, body) => request(token, '/teams', { method: 'POST', body: JSON.stringify(body) }),
  updateTeam: (token, id, body) => request(token, `/teams/${id}`, { method: 'PUT', body: JSON.stringify(body) }),

  // Companies
  listCompanies: (token) => request(token, '/companies'),
  createCompany: (token, body) => request(token, '/companies', { method: 'POST', body: JSON.stringify(body) }),
  updateCompany: (token, id, body) => request(token, `/companies/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  toggleCompany: (token, id) => request(token, `/companies/${id}/toggle`, { method: 'PUT' }),

  // Interviews
  scheduleInterview: (token, candidateId, body) => request(token, `/candidates/${candidateId}/interviews`, { method: 'POST', body: JSON.stringify(body) }),
  updateInterview: (token, id, body) => request(token, `/interviews/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  listInterviews: (token, upcoming) => request(token, `/interviews${buildQuery({ upcoming })}`),
  interviewHistory: (token, candidateId) => request(token, `/interviews/history${buildQuery({ candidateId })}`),

  // Dashboard
  getDashboardSummary: (token, recruiterId) => request(token, `/dashboard/summary${buildQuery({ recruiterId })}`),
  getDashboardTrend: (token, days) => request(token, `/dashboard/trend${buildQuery({ days })}`),
  getDashboardActivity: (token) => request(token, '/dashboard/activity'),
  getUpcomingInterviews: (token) => request(token, '/dashboard/upcoming-interviews'),
  getPendingFollowups: (token) => request(token, '/dashboard/pending-followups'),

  // Reports
  getRecruiterPerformanceReport: (token) => request(token, '/reports/recruiter-performance'),
  getCandidateSourceReport: (token) => request(token, '/reports/candidate-source'),
  getInterviewRatioReport: (token, recruiterId) => request(token, `/reports/interview-ratio${buildQuery({ recruiterId })}`),
  getSelectionRatioReport: (token, recruiterId) => request(token, `/reports/selection-ratio${buildQuery({ recruiterId })}`),
  getJoiningRatioReport: (token, recruiterId) => request(token, `/reports/joining-ratio${buildQuery({ recruiterId })}`),
  getAvgResponseTimeReport: (token, recruiterId) => request(token, `/reports/avg-response-time${buildQuery({ recruiterId })}`),
  getFollowupPerformanceReport: (token, recruiterId) => request(token, `/reports/followup-performance${buildQuery({ recruiterId })}`),
  getDailyCallsReport: (token, recruiterId) => request(token, `/reports/daily-calls${buildQuery({ recruiterId })}`),
  getPipelineReport: (token, recruiterId) => request(token, `/reports/pipeline${buildQuery({ recruiterId })}`),

  // Daily Tracking
  getDailyTracking: (token, { date, recruiterId } = {}) => request(token, `/daily-tracking${buildQuery({ date, recruiterId })}`),

  // Repository
  getMasterCandidates: (token, filters) => request(token, `/candidates/master${buildQuery(filters)}`),
  exportCandidates: (token, filters) => requestBlob(token, `/candidates/export${buildQuery(filters)}`),
  exportBatch: (token, batchId) => requestBlob(token, `/candidates/export/batch/${batchId}`)
};
