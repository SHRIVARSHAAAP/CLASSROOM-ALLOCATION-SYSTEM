import {it,expect} from "vitest";
import {academicBlocks,seedRooms} from "../db/seed_rooms";
it("generates 50 unique rooms for all 13 blocks",()=>{const rooms=seedRooms();expect(rooms).toHaveLength(650);expect(new Set(rooms.map(r=>r.id)).size).toBe(650);expect(new Set(rooms.map(r=>r.room_number)).size).toBe(650);for(const block of academicBlocks)expect(rooms.filter(r=>r.building_id===block)).toHaveLength(50);expect(rooms.every(r=>r.capacity>=30&&r.capacity<=200)).toBe(true);});
