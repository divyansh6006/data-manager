// Aggregates every Hiring workspace route file into one Router, mounted once from
// backend/src/index.js at app.use('/api/hiring', ...). Adding a future module (e.g. Sales)
// would follow this exact same pattern: its own modules/<name>/routes/index.js, mounted
// under its own path prefix.
const express = require('express');

const router = express.Router();

router.use(require('./candidates.routes'));
router.use(require('./recruiters.routes'));
router.use(require('./teams.routes'));
router.use(require('./companies.routes'));
router.use(require('./interviews.routes'));
router.use(require('./dashboard.routes'));
router.use(require('./reports.routes'));
router.use(require('./dailyTracking.routes'));

module.exports = router;
