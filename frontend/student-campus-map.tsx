"use client";

import { useState } from "react";
import { Building2, MapPin } from "lucide-react";
import { blockIds, type Room, type State } from "@/lib/types";

// Coordinates inherited from the campus map overlay, in its original view box.
const anchors = [
  ["A", 135, 540], ["B", 68, 415], ["C", 410, 608],
  ["D", 520, 465], ["E", 1022, 360], ["F", 750, 285],
  ["G", 645, 298], ["I", 490, 250], ["J", 1100, 168],
  ["K", 1165, 268], ["M", 1262, 245], ["T", 935, 265],
  ["Y", 350, 390],
] as const;

export default function StudentCampusMap({ state, directoryOnly = false }: { state: State; directoryOnly?: boolean }) {
  const [block, setBlock] = useState("");
  const [floor, setFloor] = useState("");
  const [selected, setSelected] = useState<Room | null>(null);
  const [failedImage, setFailedImage] = useState("");
  const mapSource = state.mapImage || "/campus-map.jpg";
  const mapReady = failedImage !== mapSource;
  const rooms = state.rooms.filter((room) => room.block === block);
  const floors = Array.from(new Set(rooms.map((room) => room.floor))).sort((a, b) => b - a);
  function selectBlock(id: string) {
    setBlock(id);
    setFloor("");
    setSelected(null);
  }
  return (
    <section className="student-campus-directory">
      <div className="map-layout">
        <section className="panel">
          <div className="panel-heading">
            <h2>Campus map</h2>
            <MapPin size={20} />
          </div>
          <p className="muted">Select a block to explore its floors and classrooms.</p>
          <div className="map-canvas uploaded" hidden={!mapReady}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mapSource}
              alt="PSG campus map"
              onError={() => setFailedImage(mapSource)}
            />
            {mapReady && (
              <svg viewBox="0 0 1287 882" aria-label="Campus blocks">
                {anchors.map(([id, x, y]) => (
                  <g
                    key={id}
                    role="button"
                    tabIndex={0}
                    aria-label={"Explore Block " + id}
                    aria-pressed={block === id}
                    className={"block-hotspot " + (block === id ? "chosen" : "")}
                    onClick={() => selectBlock(id)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        selectBlock(id);
                      }
                    }}
                  >
                    <rect x={x - 35} y={y - 30} width={70} height={60} rx={10} />
                    <text x={x} y={y + 10} textAnchor="middle" fontSize={30} fontWeight={700}>{id}</text>
                  </g>
                ))}
              </svg>
            )}
          </div>
          {!mapReady && (
            <p className="info-note" role="status">
              The campus map image has not been added yet. You can explore blocks below.
            </p>
          )}
          <div className="student-block-list" aria-label="Choose a campus block">
            {blockIds.map((id) => (
              <button
                key={id}
                className={block === id ? "primary" : "secondary"}
                aria-pressed={block === id}
                onClick={() => selectBlock(id)}
              >
                Block {id}
              </button>
            ))}
          </div>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <h2>{block ? "Block " + block : "Choose a block"}</h2>
            <Building2 size={20} />
          </div>
          {block ? (
            <>
              <p className="muted">{rooms.length} classrooms · {floors.length} floors</p>
              <label>
                Floor
                <select value={floor} onChange={(event) => {
                  setFloor(event.target.value);
                  setSelected(null);
                }}>
                  <option value="">All floors</option>
                  {floors.map((level) => (
                    <option key={level} value={level}>
                      {level === 0 ? "Ground floor" : "Floor " + level}
                    </option>
                  ))}
                </select>
              </label>
              <div className="elevation">
                {floors.filter((level) => !floor || level === Number(floor)).map((level) => (
                  <section key={level}>
                    <h3>{level === 0 ? "Ground floor" : "Floor " + level}</h3>
                    <div className="student-classroom-list">
                      {rooms.filter((room) => room.floor === level).map((room) => (
                        <button
                          key={room.id}
                          className={selected?.id === room.id ? "primary" : "secondary"}
                          aria-label={room.number + ", Block " + block + ", floor " + level}
                          aria-pressed={selected?.id === room.id}
                          onClick={() => setSelected(room)}
                        >{room.number}</button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
              {!rooms.length && <p>No classrooms are listed for this block yet.</p>}
            </>
          ) : <p className="muted">Click a block on the map or choose one from the block list.</p>}
        </section>
      </div>
      {selected && (
        <section className="panel student-room-details" aria-live="polite">
          <div className="panel-heading">
            <h2>{selected.number}</h2>
            <button className="secondary" onClick={() => setSelected(null)}>Close details</button>
          </div>
          <div className="room-meta">
            <span>Block<strong>{selected.block}</strong></span>
            <span>Floor<strong>{selected.floor === 0 ? "Ground" : selected.floor}</strong></span>
            {!directoryOnly && <><span>Capacity<strong>{selected.capacity} seats</strong></span>
            <span>Room type<strong>{selected.type.replaceAll("_", " ")}</strong></span>
            </>}
          </div>
          {!directoryOnly && <><h3>Facilities</h3>
          <div className="facility-chips">
            {Object.entries(selected.resources).map(([name, count]) => (
              <span key={name}>{name.replaceAll("_", " ")}: {count}</span>
            ))}
          </div></>}
        </section>
      )}
    </section>
  );
}
