const { randomUUID } = require('crypto');

exports.seed = async function(knex) {
  // Clear any existing tables in reverse order of foreign key dependency
  await knex('transfer_requests').del();
  await knex('distribution_allocations').del();
  await knex('distribution_batches').del();
  await knex('closures').del();
  await knex('universities').del();
  await knex('follow_ups').del();
  await knex('lead_activity_log').del();
  await knex('lead_assignments').del();
  await knex('leads').del();
  await knex('upload_batches').del();
  
  // Clear users and teams circular links
  await knex('teams').update({ leader_id: null });
  await knex('users').del();
  await knex('teams').del();

  const teamId = randomUUID();
  const adminId = randomUUID();
  const managerId = randomUUID();
  const leaderId = randomUUID();
  const counselor1Id = randomUUID();
  const counselor2Id = randomUUID();

  // Create Team
  await knex('teams').insert({
    id: teamId,
    name: 'MBA Admissions Team'
  });

  // Create Users
  await knex('users').insert([
    {
      id: adminId,
      name: 'Super Admin',
      company_email: 'admin@company.com',
      role: 'super_admin',
      team_id: null,
      active: true
    },
    {
      id: managerId,
      name: 'Manager Operations',
      company_email: 'manager@company.com',
      role: 'manager',
      team_id: null,
      active: true
    },
    {
      id: leaderId,
      name: 'Team Leader A',
      company_email: 'leader@company.com',
      role: 'team_leader',
      team_id: teamId,
      active: true
    },
    {
      id: counselor1Id,
      name: 'Counselor One',
      company_email: 'counselor1@company.com',
      role: 'counselor',
      team_id: teamId,
      active: true
    },
    {
      id: counselor2Id,
      name: 'Counselor Two',
      company_email: 'counselor2@company.com',
      role: 'counselor',
      team_id: teamId,
      active: true
    }
  ]);

  // Set Team Leader reference
  await knex('teams').where({ id: teamId }).update({ leader_id: leaderId });

  // Create Universities
  await knex('universities').insert([
    {
      id: 'boston-univ-id-mock',
      name: 'Boston University',
      courses: JSON.stringify(['Online MBA', 'Executive MBA']),
      fees: JSON.stringify({ 'Online MBA': 24000, 'Executive MBA': 35000 }),
      eligibility: "Bachelor's degree with 3+ years experience",
      specializations: JSON.stringify(['Finance', 'Marketing', 'Operations'])
    },
    {
      id: 'illinois-univ-id-mock',
      name: 'University of Illinois',
      courses: JSON.stringify(['iMBA']),
      fees: JSON.stringify({ 'iMBA': 23000 }),
      eligibility: "Bachelor's degree",
      specializations: JSON.stringify(['General Management', 'Strategic Leadership', 'Business Analytics'])
    }
  ]);

  // Create Upload Batch
  const batchId = randomUUID();
  await knex('upload_batches').insert({
    id: batchId,
    uploaded_by: managerId,
    file_name: 'initial_leads_seed.xlsx',
    upload_date: new Date(),
    total_rows: 10,
    clean_rows: 10,
    duplicate_rows: 0,
    invalid_rows: 0
  });

  // Create Leads
  const leadIds = Array.from({ length: 10 }, () => randomUUID());
  const sampleLeads = [
    { id: leadIds[0], name: 'Rohan Sharma', phone: '9876543210', email: 'rohan.sharma@gmail.com', city: 'Mumbai', state: 'MH', experience: 3, current_company: 'TCS', salary: 450000, graduation: 'B.Tech', course_interest: 'Online MBA', source: 'LinkedIn', status: 'clean', upload_batch_id: batchId },
    { id: leadIds[1], name: 'Ananya Iyer', phone: '9812345678', email: 'ananya.iyer@yahoo.com', city: 'Bangalore', state: 'KA', experience: 4, current_company: 'Infosys', salary: 600000, graduation: 'B.Com', course_interest: 'iMBA', source: 'Naukri', status: 'clean', upload_batch_id: batchId },
    { id: leadIds[2], name: 'Vikram Malhotra', phone: '9765432109', email: 'vikram.m@outlook.com', city: 'Delhi', state: 'DL', experience: 1, current_company: 'Wipro', salary: 350000, graduation: 'BBA', course_interest: 'Online MBA', source: 'Google Ads', status: 'clean', upload_batch_id: batchId },
    { id: leadIds[3], name: 'Priya Patel', phone: '9555123456', email: 'priya.patel@gmail.com', city: 'Mumbai', state: 'MH', experience: 5, current_company: 'Cognizant', salary: 800000, graduation: 'B.Sc', course_interest: 'Online MBA', source: 'Direct', status: 'clean', upload_batch_id: batchId },
    { id: leadIds[4], name: 'Siddharth Rao', phone: '9898989898', email: 'sid.rao@gmail.com', city: 'Pune', state: 'MH', experience: 3, current_company: 'Accenture', salary: 500000, graduation: 'BE', course_interest: 'iMBA', source: 'LinkedIn', status: 'clean', upload_batch_id: batchId },
    { id: leadIds[5], name: 'Aditi Deshmukh', phone: '9123456789', email: 'aditi.d@gmail.com', city: 'Hyderabad', state: 'TG', experience: 6, current_company: 'Amazon', salary: 1200000, graduation: 'B.Tech', course_interest: 'Executive MBA', source: 'Facebook', status: 'clean', upload_batch_id: batchId },
    { id: leadIds[6], name: 'Rahul Verma', phone: '8888888888', email: 'rahul.v@gmail.com', city: 'Chennai', state: 'TN', experience: 8, current_company: 'Google', salary: 1500000, graduation: 'M.Tech', course_interest: 'Executive MBA', source: 'LinkedIn', status: 'clean', upload_batch_id: batchId },
    { id: leadIds[7], name: 'Karan Johar', phone: '8765432109', email: 'karan.j@gmail.com', city: 'Kolkata', state: 'WB', experience: 2, current_company: 'HCL', salary: 400000, graduation: 'B.Com', course_interest: 'Online MBA', source: 'Naukri', status: 'clean', upload_batch_id: batchId },
    { id: leadIds[8], name: 'Sneha Gupta', phone: '7654321098', email: 'sneha.g@gmail.com', city: 'Ahmedabad', state: 'GJ', experience: 4, current_company: 'Reliance', salary: 700000, graduation: 'BCA', course_interest: 'iMBA', source: 'Google', status: 'clean', upload_batch_id: batchId },
    { id: leadIds[9], name: 'Amit Singh', phone: '9887766554', email: 'amit.s@gmail.com', city: 'Noida', state: 'UP', experience: 3, current_company: 'Tata Motors', salary: 550000, graduation: 'B.Tech', course_interest: 'Online MBA', source: 'Direct', status: 'clean', upload_batch_id: batchId }
  ];

  await knex('leads').insert(sampleLeads);

  // Seed initial assignments
  await knex('lead_assignments').insert([
    {
      id: randomUUID(),
      lead_id: leadIds[0], // Rohan Sharma (L1) -> Counselor One
      counselor_id: counselor1Id,
      assigned_by: managerId,
      assigned_at: new Date(),
      stage: 'L1',
      locked: true,
      updated_at: new Date()
    },
    {
      id: randomUUID(),
      lead_id: leadIds[1], // Ananya Iyer (L2) -> Counselor One
      counselor_id: counselor1Id,
      assigned_by: managerId,
      assigned_at: new Date(),
      stage: 'L2',
      locked: true,
      updated_at: new Date()
    },
    {
      id: randomUUID(),
      lead_id: leadIds[2], // Vikram Malhotra (L1) -> Counselor Two
      counselor_id: counselor2Id,
      assigned_by: managerId,
      assigned_at: new Date(),
      stage: 'L1',
      locked: true,
      updated_at: new Date()
    },
    {
      id: randomUUID(),
      lead_id: leadIds[3], // Priya Patel (L3) -> Counselor Two
      counselor_id: counselor2Id,
      assigned_by: managerId,
      assigned_at: new Date(),
      stage: 'L3',
      locked: true,
      updated_at: new Date()
    }
  ]);

  // Seed follow-up for Ananya Iyer (Counselor One L2 lead) due 1 hr ago
  await knex('follow_ups').insert({
    id: randomUUID(),
    lead_id: leadIds[1],
    counselor_id: counselor1Id,
    follow_up_date: new Date(Date.now() - 3600000), 
    notes: 'Initial discussion, schedule follow-up to finalize courses.',
    completed: false,
    created_at: new Date()
  });

  // Log assignments in activity log
  for (let i = 0; i < 4; i++) {
    const targetC = i < 2 ? counselor1Id : counselor2Id;
    await knex('lead_activity_log').insert({
      id: randomUUID(),
      lead_id: leadIds[i],
      counselor_id: targetC,
      action: 'distributed',
      remark: 'Allocated during initial database seeding',
      timestamp: new Date()
    });
  }

  console.log('Database seeded successfully.');
};
