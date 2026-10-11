-- First create your two website users under Authentication > Users > Add user.
-- Replace the two example emails with your website users before running.
-- Dashboard account sign-in is separate from website user sign-in.
insert into public.fieldnote_members (user_id)
select id from auth.users
where lower(email) in (lower('PERSON_ONE@example.com'), lower('PERSON_TWO@example.com'))
on conflict (user_id) do nothing;

-- This should show the two people granted access:
select u.email from public.fieldnote_members m
join auth.users u on u.id = m.user_id;
