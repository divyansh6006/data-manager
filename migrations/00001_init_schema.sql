-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TEAMS TABLE
CREATE TABLE teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 2. USERS TABLE
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    company_email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL CHECK (role IN ('super_admin', 'manager', 'team_leader', 'counselor')),
    team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
    device_id VARCHAR(255) NULL,
    active BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Add leader relation to teams
ALTER TABLE teams ADD COLUMN leader_id UUID REFERENCES users(id) ON DELETE SET NULL;

-- 3. UPLOAD BATCHES TABLE
CREATE TABLE upload_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    uploaded_by UUID REFERENCES users(id) ON DELETE SET NULL,
    file_name VARCHAR(255) NOT NULL,
    upload_date TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    total_rows INT NOT NULL,
    clean_rows INT DEFAULT 0 NOT NULL,
    duplicate_rows INT DEFAULT 0 NOT NULL,
    invalid_rows INT DEFAULT 0 NOT NULL
);

-- 4. LEADS TABLE
CREATE TABLE leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    email VARCHAR(255) NULL,
    city VARCHAR(100) NULL,
    state VARCHAR(100) NULL,
    experience NUMERIC(4,2) NULL,
    current_company VARCHAR(255) NULL,
    salary NUMERIC(15,2) NULL,
    graduation VARCHAR(255) NULL,
    course_interest VARCHAR(255) NULL,
    source VARCHAR(100) NOT NULL,
    upload_batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'raw' CHECK (status IN ('raw', 'clean', 'duplicate', 'invalid')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Indexes for leads
CREATE INDEX idx_leads_phone ON leads(phone);
CREATE INDEX idx_leads_email ON leads(email);
CREATE INDEX idx_leads_status ON leads(status);
CREATE INDEX idx_leads_upload_batch_id ON leads(upload_batch_id);
CREATE INDEX idx_leads_created_at ON leads(created_at);

-- 5. LEAD ASSIGNMENTS TABLE
CREATE TABLE lead_assignments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE UNIQUE NOT NULL,
    counselor_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL NOT NULL,
    assigned_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    stage VARCHAR(20) NOT NULL DEFAULT 'L1' CHECK (stage IN ('L1', 'L2', 'L3')),
    disposition VARCHAR(50) NOT NULL DEFAULT 'None' CHECK (disposition IN ('None', 'Interested', 'Not Interested', 'Not Picked Up', 'Switched Off')),
    locked BOOLEAN DEFAULT TRUE NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_lead_assignments_counselor_id ON lead_assignments(counselor_id);
CREATE INDEX idx_lead_assignments_stage ON lead_assignments(stage);

-- 6. LEAD ACTIVITY LOG TABLE
CREATE TABLE lead_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NULL,
    counselor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'tick', 'cross', 'note', 'call', 'status_change', 
        'transfer_request', 'transfer_approve', 'transfer_reject', 
        'login', 'export', 'distributed'
    )),
    remark TEXT NULL,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_activity_log_lead_id ON lead_activity_log(lead_id);
CREATE INDEX idx_activity_log_counselor_id ON lead_activity_log(counselor_id);
CREATE INDEX idx_activity_log_timestamp ON lead_activity_log(timestamp);

-- 7. FOLLOW UPS TABLE
CREATE TABLE follow_ups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
    counselor_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    follow_up_date TIMESTAMPTZ NOT NULL,
    notes TEXT NULL,
    completed BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    completed_at TIMESTAMPTZ NULL
);

CREATE INDEX idx_follow_ups_counselor_id_completed ON follow_ups(counselor_id, completed);
CREATE INDEX idx_follow_ups_date ON follow_ups(follow_up_date);

-- 8. UNIVERSITIES TABLE
CREATE TABLE universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    courses JSONB NOT NULL,
    fees JSONB NULL,
    eligibility TEXT NULL,
    specializations JSONB NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 9. CLOSURES TABLE
CREATE TABLE closures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE UNIQUE NOT NULL,
    university_id UUID REFERENCES universities(id) ON DELETE SET NULL,
    documents_status JSONB NULL,
    application_status VARCHAR(50) NULL,
    final_status VARCHAR(50) NOT NULL CHECK (final_status IN ('enrolled', 'lost', 'hold')),
    revenue NUMERIC(15,2) DEFAULT 0.00 NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    closed_at TIMESTAMPTZ NULL
);

-- 10. DISTRIBUTION BATCHES TABLE
CREATE TABLE distribution_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_batch_id UUID REFERENCES upload_batches(id) ON DELETE SET NULL,
    filter_criteria JSONB NULL,
    total_leads INT NOT NULL,
    distributed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    distributed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('draft', 'confirmed'))
);

-- 11. DISTRIBUTION ALLOCATIONS TABLE
CREATE TABLE distribution_allocations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    distribution_batch_id UUID REFERENCES distribution_batches(id) ON DELETE CASCADE NOT NULL,
    counselor_id UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    requested_count INT NOT NULL,
    actual_lead_ids UUID[] NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- 12. TRANSFER REQUESTS TABLE
CREATE TABLE transfer_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID REFERENCES leads(id) ON DELETE CASCADE NOT NULL,
    requested_by UUID REFERENCES users(id) ON DELETE RESTRICT NOT NULL,
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('give_up', 'request_lead', 'leader_initiated')),
    reason VARCHAR(255) NOT NULL,
    note TEXT NULL,
    target_counselor_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
);

CREATE INDEX idx_transfer_requests_status ON transfer_requests(status);
CREATE INDEX idx_transfer_requests_created_at ON transfer_requests(created_at);
