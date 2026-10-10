"use client";
import { useMemo, useState } from "react";
import { Building2, Check, MapPin, Users, X } from "lucide-react";
import { availability } from "@/lib/availability";
import { validate, type Needs } from "@/lib/engine";
import {
  blockIds,
  slotSchema,
  today,
  type Room,
  type Slot,
  type State,
} from "@/lib/types";

const hotspots = [
  ["A", 135, 540],
  ["B", 68, 415],
  ["C", 410, 608],
  ["D", 520, 465],
  ["E", 1022, 360],
  ["F", 750, 285],
  ["G", 645, 298],
  ["I", 490, 250],
  ["J", 1100, 168],
  ["K", 1165, 268],
  ["M", 1262, 245],
  ["T", 935, 265],
  ["Y", 350, 390],
] as const;
export const facilities = [
  "projector",
  "computers",
  "ac",
  "smart_board",
  "lab_equipment",
];
export default function Rooms({
  state,
  map = false,
  choose,
  edit,
  fixedSlot,
  needs,
  image,
}: {
  state: State;
  map?: boolean;
  choose?: (room: Room) => void;
  edit?: (room: Room) => void;
  fixedSlot?: Slot;
  needs?: Needs;
  image?: (file: File) => void;
}) {
  const campusImage = state.mapImage || "/campus-map.jpg";
  const [mapImageError, setMapImageError] = useState("");
  const [date, setDate] = useState(fixedSlot?.date ?? today());
  const [start, setStart] = useState(fixedSlot?.start ?? "09:00");
  const [end, setEnd] = useState(fixedSlot?.end ?? "10:00");
  const [block, setBlock] = useState(map ? "C" : "");
  const [floor, setFloor] = useState("");
  const [capacity, setCapacity] = useState(needs?.seats ?? 1);
  const [facility, setFacility] = useState("");
  const [search, setSearch] = useState("");
  const [free, setFree] = useState(false);
  const [selected, setSelected] = useState<Room | null>(null);
  const [limit, setLimit] = useState(18);
  const parsed = slotSchema.safeParse({ date, start, end });
  const slot = useMemo(() => {
    const result = slotSchema.safeParse({ date, start, end });
    return result.success
      ? result.data
      : { date: today(), start: "09:00", end: "10:00" };
  }, [date, start, end]);
  const statuses = useMemo(
    () =>
      new Map(
        state.rooms.map((room) => {
          if (needs) {
            const failures = validate(state, room, slot, needs);
            return [
              room.id,
              {
                free: !failures.length,
                label: failures.length ? "Not available" : "Available",
                reason: failures.length
                  ? failures.join("; ")
                  : "Faculty, section, capacity and facilities checked",
              },
            ];
          }
          return [room.id, availability(state, room, slot)];
        }),
      ),
    [state, slot, needs],
  );
  const match = (room: Room) =>
    (!floor || room.floor === Number(floor)) &&
    room.capacity >= capacity &&
    (!facility || room.resources[facility] > 0) &&
    (!search || room.number.toLowerCase().includes(search.toLowerCase())) &&
    (!free || statuses.get(room.id)?.free);
  const rooms = state.rooms.filter(
    (room) => (!block || room.block === block) && match(room),
  );
  const blockRooms = state.rooms.filter((room) => room.block === block);
  const status = selected ? statuses.get(selected.id) : null;
  return (
    <section>
      <form className="filter-bar" onSubmit={(event) => event.preventDefault()}>
        <label>
          Date
          <input
            type="date"
            required
            disabled={!!fixedSlot}
            value={date}
            onChange={(event) => setDate(event.target.value)}
          />
        </label>
        <label>
          From · IST
          <input
            type="time"
            required
            disabled={!!fixedSlot}
            value={start}
            onChange={(event) => setStart(event.target.value)}
          />
        </label>
        <label>
          Until · IST
          <input
            type="time"
            required
            disabled={!!fixedSlot}
            value={end}
            onChange={(event) => setEnd(event.target.value)}
          />
        </label>
        <label>
          Minimum seats
          <input
            type="number"
            min={1}
            max={1000}
            value={capacity}
            onChange={(event) => setCapacity(Number(event.target.value))}
          />
        </label>
        <label>
          Block
          <select
            value={block}
            onChange={(event) => {
              setBlock(event.target.value);
              setFloor("");
            }}
          >
            {!map && <option value="">All blocks</option>}
            {blockIds.map((id) => (
              <option key={id}>{id}</option>
            ))}
          </select>
        </label>
        <label>
          Floor
          <select
            value={floor}
            onChange={(event) => setFloor(event.target.value)}
          >
            <option value="">All floors</option>
            {[0, 1, 2, 3].map((i) => (
              <option value={i} key={i}>
                {i === 0 ? "Ground" : "Floor " + i}
              </option>
            ))}
          </select>
        </label>
        <label>
          Working facility
          <select
            value={facility}
            onChange={(event) => setFacility(event.target.value)}
          >
            <option value="">Any facility</option>
            {facilities.map((name) => (
              <option value={name} key={name}>
                {name.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>
        <label>
          Room number
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="C-101"
          />
        </label>
        <label className="checkbox available-filter">
          <input
            type="checkbox"
            checked={free}
            onChange={(event) => setFree(event.target.checked)}
          />
          Available only
        </label>
      </form>
      {!parsed.success ? (
        <p role="alert" className="error-note">
          Choose a valid date and an end time after the start time.
        </p>
      ) : (
        <>
          <div className="room-legend">
            <span>
              <i className="green-dot" />
              Available
            </span>
            <span>
              <i className="red-dot" />
              Not available
            </span>
            <small>{rooms.length} rooms match</small>
          </div>
          {map ? (
            <div className="map-layout">
              <section className="panel">
                <div className="panel-heading">
                  <h2>Explore the campus</h2>
                  <MapPin size={20} />
                </div>
                <p className="muted small">
                  PSG campus map · select a block to explore its classrooms
                </p>
                <div
                  className="map-canvas uploaded"
                >
                  {mapImageError !== campusImage && (
                    <>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={campusImage}
                        onError={() => setMapImageError(campusImage)}
                        alt="PSG campus map, displayed without cropping"
                      />
                    </>
                  )}
                  <svg
                    viewBox="0 0 1287 882"
                    aria-label="Clickable academic blocks"
                  >
                    {hotspots.map(([id, px, py]) => {
                      const x = Math.max(62, Math.min(1220, px)),
                        y = py;
                      const count = state.rooms.filter(
                        (room) =>
                          room.block === id && statuses.get(room.id)?.free,
                      ).length;
                      return (
                        <g
                          role="button"
                          tabIndex={0}
                          aria-label={`Block ${id}, ${count} available rooms`}
                          key={id}
                          className={
                            "block-hotspot " + (block === id ? "chosen" : "")
                          }
                          onClick={() => {
                            setBlock(id);
                            setFloor("");
                          }}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              setBlock(id);
                              setFloor("");
                            }
                          }}
                        >
                          <rect
                            x={x - 49}
                            y={y - 39}
                            width={98}
                            height={78}
                            rx={12}
                          />
                          <text
                            x={x}
                            y={y}
                            textAnchor="middle"
                            fontSize="32"
                            fontWeight="700"
                          >
                            {id}
                          </text>
                          <text
                            x={x}
                            y={y + 25}
                            textAnchor="middle"
                            fontSize="16"
                          >
                            {count} free
                          </text>
                        </g>
                      );
                    })}
                  </svg>
                </div>
                {mapImageError === campusImage && (
                  <p className="error-note" role="alert">
                    The campus map could not load. Use the Block selector to browse classrooms.
                  </p>
                )}
                {image && (
                  <label className="upload-box">
                    Replace campus image
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      onChange={(event) => {
                        if (event.target.files?.[0])
                          image(event.target.files[0]);
                      }}
                    />
                    <small>
                      JPG or PNG up to 2 MB · hotspots keep their percentage
                      positions
                    </small>
                  </label>
                )}
              </section>
              <section className="panel">
                <div className="panel-heading">
                  <h2>Block {block}</h2>
                  <span className="tag tag-green">
                    {blockRooms.filter((r) => statuses.get(r.id)?.free).length}{" "}
                    available
                  </span>
                </div>
                <p className="muted small">
                  All {blockRooms.length} rooms · floor G at the bottom ·
                  filters dim other rooms
                </p>
                <div className="elevation">
                  {[3, 2, 1, 0].map((f) => (
                    <div className="floor-row" key={f}>
                      <strong>{f ? "F" + f : "G"}</strong>
                      <div>
                        {blockRooms
                          .filter((r) => r.floor === f)
                          .map((room) => (
                            <button
                              key={room.id}
                              title={statuses.get(room.id)?.reason}
                              aria-label={`${room.number}, ${statuses.get(room.id)?.label}, ${statuses.get(room.id)?.reason}`}
                              className={
                                "room-cell " +
                                (statuses.get(room.id)?.free
                                  ? "room-green"
                                  : "room-red") +
                                (match(room) ? "" : " dim")
                              }
                              onClick={() => setSelected(room)}
                            >
                              {statuses.get(room.id)?.free ? (
                                <Check size={10} />
                              ) : (
                                <X size={10} />
                              )}
                              {room.number}
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
                <p className="muted small">
                  Tap a classroom for its seats, facilities and availability
                  reason.
                </p>
              </section>
            </div>
          ) : (
            <>
              <div className="room-cards">
                {rooms.slice(0, limit).map((room) => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    status={statuses.get(room.id)!}
                    open={() => setSelected(room)}
                  />
                ))}
              </div>
              {rooms.length > limit && (
                <button
                  className="secondary"
                  onClick={() => setLimit(limit + 18)}
                >
                  Show more rooms
                </button>
              )}
              {!rooms.length && (
                <div className="empty-state">
                  <Building2 />
                  <h3>No suitable rooms found</h3>
                  <p>Try another time, capacity or facility.</p>
                </div>
              )}
            </>
          )}
        </>
      )}
      {selected && status && (
        <div className="modal">
          <section
            className="dialog room-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="room-name"
          >
            <button
              className="dialog-close"
              aria-label="Close room details"
              onClick={() => setSelected(null)}
            >
              <X size={20} />
            </button>
            <span className="eyebrow">CLASSROOM DETAILS</span>
            <h2 id="room-name">{selected.number}</h2>
            <span className={"tag " + (status.free ? "tag-green" : "tag-red")}>
              {status.label}
            </span>
            <p className="muted">{status.reason}</p>
            <div className="room-meta">
              <span>
                Block<strong>{selected.block}</strong>
              </span>
              <span>
                Floor
                <strong>
                  {selected.floor === 0 ? "Ground" : selected.floor}
                </strong>
              </span>
              <span>
                Capacity<strong>{selected.capacity}</strong>
              </span>
              <span>
                Room type<strong>{selected.type.replaceAll("_", " ")}</strong>
              </span>
            </div>
            <div className="teaching-board">TEACHING BOARD</div>
            <div className="seating">
              {Array.from({ length: selected.capacity }, (_, i) => (
                <i
                  key={i}
                  className={status.free ? "green-seat" : "red-seat"}
                />
              ))}
            </div>
            <p className="muted small">
              Illustrative seats show the room’s status, not individual seat
              bookings.
            </p>
            <h3>Working facilities</h3>
            <div className="facility-chips">
              {facilities.map((name) => (
                <span key={name}>
                  {name.replaceAll("_", " ")}: {selected.resources[name] ?? 0}
                </span>
              ))}
            </div>
            <p className="route-note">
              <MapPin size={18} />
              Quadrangle → Block {selected.block} →{" "}
              {selected.floor === 0
                ? "ground floor"
                : "stairs / lift to floor " + selected.floor}{" "}
              → {selected.number}
            </p>
            <p className="muted small">
              Illustrative directions. Surveyed walking paths are not
              configured.
            </p>
            <div className="actions">
              {choose && (
                <button
                  className="primary"
                  disabled={!status.free}
                  onClick={() => {
                    choose(selected);
                    setSelected(null);
                  }}
                >
                  Choose this classroom
                </button>
              )}
              {edit && (
                <button
                  className="secondary"
                  onClick={() => {
                    edit(selected);
                    setSelected(null);
                  }}
                >
                  Edit classroom
                </button>
              )}
              <button className="secondary" onClick={() => setSelected(null)}>
                Close
              </button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}
export function RoomCard({
  room,
  status,
  open,
}: {
  room: Room;
  status: { free: boolean; label: string; reason: string };
  open: () => void;
}) {
  return (
    <article className="room-card">
      <div>
        <Building2 size={23} />
        <span className={"tag " + (status.free ? "tag-green" : "tag-red")}>
          {status.free ? <Check size={13} /> : <X size={13} />}
          {status.label}
        </span>
      </div>
      <h3>{room.number}</h3>
      <p>
        <MapPin size={14} />
        Block {room.block} ·{" "}
        {room.floor === 0 ? "Ground" : "Floor " + room.floor}
      </p>
      <p>
        <Users size={14} />
        {room.capacity} seats · {room.type.replaceAll("_", " ")}
      </p>
      <p className="room-reason">{status.reason}</p>
      <div className="facility-chips">
        {Object.entries(room.resources)
          .filter(([, count]) => count > 0)
          .slice(0, 3)
          .map(([name]) => (
            <span key={name}>{name.replaceAll("_", " ")}</span>
          ))}
      </div>
      <button className="secondary" onClick={open}>
        View room
      </button>
    </article>
  );
}
