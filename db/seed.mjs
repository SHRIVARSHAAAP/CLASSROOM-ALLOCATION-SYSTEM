// Run: node --env-file=.env.local db/seed.mjs
// A configured Supabase project and completed schema are required.
import { createClient } from "@supabase/supabase-js";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key)
  throw new Error(
    "Configure Supabase URL and service-role key in an ignored environment file.",
  );
const db = createClient(url, key, { auth: { persistSession: false } });
async function insert(table, values) {
  const { error } = await db.from(table).upsert(values);
  if (error) throw error;
}
const blocks = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "I",
  "J",
  "K",
  "M",
  "T",
  "Y",
];
await insert("departments", [
  { id: "CSE", name: "Computer Science and Engineering" },
  { id: "IT", name: "Information Technology" },
]);
await insert(
  "buildings",
  blocks.map((id) => ({ id, name: "Block " + id })),
);
await insert(
  "resources",
  ["projector", "computers", "ac", "smart_board", "lab_equipment"].map(
    (id) => ({ id, name: id.replaceAll("_", " ") }),
  ),
);
const rooms = blocks.flatMap((block) =>
  Array.from({ length: 50 }, (_, i) => ({
    building_id: block,
    floor: i % 4,
    room_number: `${block}-${i % 4}${String(Math.floor(i / 4) + 1).padStart(2, "0")}`,
    capacity: [40, 60, 80, 100, 120, 150, 200][i % 7],
    room_type:
      i % 10 === 0
        ? "computer_lab"
        : i % 9 === 0
          ? "lab"
          : i % 7 === 0
            ? "seminar"
            : "lecture",
    is_active: true,
  })),
);
for (const room of rooms) {
  const { error } = await db
    .from("classrooms")
    .upsert(room, { onConflict: "room_number" });
  if (error) throw error;
}
const { data: saved, error: roomError } = await db
  .from("classrooms")
  .select("id,room_type");
if (roomError) throw roomError;
await insert(
  "classroom_resources",
  saved.flatMap((room, i) => [
    {
      classroom_id: room.id,
      resource_id: "projector",
      quantity_available: 1,
      quantity_working: i % 17 === 0 ? 0 : 1,
    },
    ...(room.room_type === "computer_lab"
      ? [
          {
            classroom_id: room.id,
            resource_id: "computers",
            quantity_available: 40,
            quantity_working: 40,
          },
        ]
      : []),
  ]),
);
await insert("class_sections", [
  { id: "CSE II A", department_id: "CSE", year: 2, section: "A", size: 40 },
  { id: "IT II A", department_id: "IT", year: 2, section: "A", size: 40 },
]);
// Test users are optional and use a caller-supplied password, never a committed one.
if (process.env.SEED_TEST_PASSWORD) {
  const listed = await db.auth.admin.listUsers({ perPage: 1000 });
  if (listed.error) throw listed.error;
  for (const role of ["admin", "rep", "club", "faculty", "student"]) {
    const email = `sample-${role}@example.com`;
    let user = listed.data.users.find((value) => value.email === email);
    if (!user) {
      const created = await db.auth.admin.createUser({
        email,
        password: process.env.SEED_TEST_PASSWORD,
        email_confirm: true,
      });
      if (created.error) throw created.error;
      user = created.data.user;
    }
    await insert("users", [
      {
        id: user.id,
        name: `Sample ${role}`,
        email,
        role,
        section_id: "CSE II A",
        department_id: "CSE",
        roll_number: role === "student" ? "23Z001" : null,
        is_active: true,
      },
    ]);
  }
}
console.log(
  "Seeded 13 blocks and 650 rooms. Optional test users created only when SEED_TEST_PASSWORD is set.",
);
