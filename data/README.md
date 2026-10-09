# Campus imports

Generated rooms are samples, not verified college rooms. Home-block mappings are editable placeholders. The actual map image and normalized hotspot anchors are still required; no coordinates have been invented.

Optional JSON/CSV replacements use these columns:
- buildings: id, name, x, y, has_rooms.
- classrooms: id, building_id, floor, room_number, capacity, seat_rows, seat_cols, room_type, is_active, status.
- resources: id, name.
- classroom_resources: classroom_id, resource_id, quantity_available, quantity_working.
- faculty: user_id, name, email, cabin_location.
- students: user_id, roll_number, department_id, year, section_id, address, guardian_name.
- timetable: id, version_id, section_id, faculty_id, classroom_id, subject, day_of_week, start_time, end_time, priority.

Use UUIDs for user/classroom/session identifiers. Department and building IDs are editable text codes. Weekdays use JavaScript convention: Sunday 0 through Saturday 6. Times use HH:MM in Asia/Kolkata. Dates use YYYY-MM-DD. Quantity working must never exceed quantity available. Never include passwords in data files.
