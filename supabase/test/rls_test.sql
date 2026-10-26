-- Run after stub.sql + schema.sql. Each block acts as one user; \echo marks expected results.
\set ON_ERROR_STOP 0
insert into auth.users (id,email) values
 ('00000000-0000-0000-0000-00000000000a','admin@co.ge'),
 ('00000000-0000-0000-0000-00000000000b','manager@co.ge'),
 ('00000000-0000-0000-0000-00000000000c','worker@co.ge'),
 ('00000000-0000-0000-0000-00000000000d','stranger@gmail.com');
select email, role, employee_id is not null as linked from profiles order by email;

-- admin creates staff
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
insert into employees (id, full_name, email) values ('10000000-0000-0000-0000-00000000000b','Manager','MANAGER@co.ge');
insert into employees (id, full_name, email, manager_id) values ('10000000-0000-0000-0000-00000000000c','Worker','worker@co.ge','10000000-0000-0000-0000-00000000000b');
insert into employee_private (employee_id, salary) values ('10000000-0000-0000-0000-00000000000c', 2000), ('10000000-0000-0000-0000-00000000000b', 5000);
reset role;
\echo '--- linking after HR adds existing users (expect manager, worker linked)'
select email, role, employee_id is not null as linked from profiles order by email;

\echo '--- worker: sees directory (2), own salary only (1 row, 2000)'
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000c';
select count(*) as directory from employees;
select salary from employee_private;
\echo '--- worker: cannot edit employees (expect 0 rows updated)'
update employees set full_name='hacked';
\echo '--- worker: requests leave (ok), cannot self-approve (error), cannot insert approved (error)'
insert into leave_requests (id, employee_id, type, start_date, end_date, days) values ('20000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000c','paid','2026-11-02','2026-11-04',3);
select decide_leave('20000000-0000-0000-0000-000000000001', true);
insert into leave_requests (employee_id, type, start_date, end_date, days, status) values ('10000000-0000-0000-0000-00000000000c','paid','2026-12-01','2026-12-02',2,'approved');
\echo '--- worker: cannot request for someone else (error)'
insert into leave_requests (employee_id, type, start_date, end_date, days) values ('10000000-0000-0000-0000-00000000000b','paid','2026-11-02','2026-11-04',3);
\echo '--- worker: chat in general (ok), dm to manager (ok)'
insert into messages (channel_id, body) select id, 'გამარჯობა' from channels where kind='public';
select get_or_create_dm('00000000-0000-0000-0000-00000000000b') is not null as dm;
reset role;

\echo '--- manager: sees report leave (1), approves it (ok), sees DM (1 channel dm)'
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
select count(*) as report_leaves from leave_requests;
select decide_leave('20000000-0000-0000-0000-000000000001', true);
select count(*) filter (where kind='dm') as dms, count(*) as channels from channels;
select count(*) as manager_salary_rows from employee_private;
reset role;

\echo '--- stranger (not an employee): sees nothing (0,0,0,0)'
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000d';
select (select count(*) from employees) e, (select count(*) from messages) m, (select count(*) from channels) c, (select count(*) from absences) a;
insert into messages (channel_id, body) select id, 'spam' from channels;
select get_or_create_dm('00000000-0000-0000-0000-00000000000a');
reset role;

\echo '--- reviews: manager rating hidden from worker until cycle closed'
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000a';
insert into review_cycles (id,name,start_date,end_date) values ('30000000-0000-0000-0000-000000000001','Q4','2026-10-01','2026-12-31');
insert into reviews (id,cycle_id,employee_id,reviewer_id) values ('40000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-00000000000c','10000000-0000-0000-0000-00000000000b');
reset role;
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000b';
select submit_manager_review('40000000-0000-0000-0000-000000000001', 4, 'კარგი');
reset role;
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000c';
select submit_self_review('40000000-0000-0000-0000-000000000001', 5, 'ძალიან კარგი');
select self_rating, manager_rating as hidden_manager_rating from reviews_visible;
\echo '--- worker cannot give self the manager rating (error)'
select submit_manager_review('40000000-0000-0000-0000-000000000001', 5, 'x');
reset role;
\echo '--- worker profile self-edit ok; role escalation blocked (0 rows)'
set role authenticated; set request.jwt.sub = '00000000-0000-0000-0000-00000000000c';
select update_my_profile('555','bio','თბილისი',null);
update profiles set role='admin' where id = auth.uid();
reset role;
select email, role from profiles where email='worker@co.ge';
